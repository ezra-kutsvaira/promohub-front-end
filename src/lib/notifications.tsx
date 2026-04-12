import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { toast } from "@/components/ui/sonner";
import { api, type NotificationItem } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const NOTIFICATION_POLL_INTERVAL_MS = 30000;
const MAX_NEW_NOTIFICATION_TOASTS = 2;

type NotificationContextValue = {
  notifications: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  isRefreshing: boolean;
  refresh: () => Promise<void>;
  markRead: (notificationId: number | string) => Promise<void>;
  markAllRead: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

type RefreshOptions = {
  background?: boolean;
  announceNew?: boolean;
};

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const knownNotificationIdsRef = useRef<Set<number>>(new Set());
  const hasLoadedRef = useRef(false);
  const inFlightRefreshRef = useRef<Promise<void> | null>(null);

  const resetState = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
    setIsLoading(false);
    setIsRefreshing(false);
    knownNotificationIdsRef.current = new Set();
    hasLoadedRef.current = false;
    inFlightRefreshRef.current = null;
  }, []);

  const applySnapshot = useCallback(
    (nextNotifications: NotificationItem[], nextUnreadCount: number, announceNew: boolean) => {
      const knownIds = knownNotificationIdsRef.current;
      const nextIds = new Set(nextNotifications.map((notification) => notification.id));

      if (announceNew && hasLoadedRef.current) {
        const newUnreadNotifications = nextNotifications.filter(
          (notification) => !notification.read && !knownIds.has(notification.id),
        );

        newUnreadNotifications
          .slice(0, MAX_NEW_NOTIFICATION_TOASTS)
          .forEach((notification) => {
            toast.info(notification.title, {
              description: notification.message,
            });
          });

        if (newUnreadNotifications.length > MAX_NEW_NOTIFICATION_TOASTS) {
          const remainingCount = newUnreadNotifications.length - MAX_NEW_NOTIFICATION_TOASTS;
          toast.info("More new notifications", {
            description: `${remainingCount} more updates are waiting in your inbox.`,
          });
        }
      }

      setNotifications(nextNotifications);
      setUnreadCount(nextUnreadCount);
      knownNotificationIdsRef.current = nextIds;
      hasLoadedRef.current = true;
    },
    [],
  );

  const refreshInternal = useCallback(
    async ({ background = false, announceNew = true }: RefreshOptions = {}) => {
      if (!user) {
        resetState();
        return;
      }

      if (inFlightRefreshRef.current) {
        return inFlightRefreshRef.current;
      }

      if (background) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const refreshPromise = (async () => {
        try {
          const [nextNotifications, unreadPayload] = await Promise.all([
            api.getNotifications(),
            api.getUnreadNotificationCount(),
          ]);

          const derivedUnreadCount =
            typeof unreadPayload?.unreadCount === "number"
              ? unreadPayload.unreadCount
              : nextNotifications.filter((notification) => !notification.read).length;

          applySnapshot(nextNotifications, derivedUnreadCount, announceNew);
        } catch (error) {
          console.error("Unable to refresh notifications.", error);
        } finally {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      })();

      inFlightRefreshRef.current = refreshPromise;

      try {
        await refreshPromise;
      } finally {
        if (inFlightRefreshRef.current === refreshPromise) {
          inFlightRefreshRef.current = null;
        }
      }
    },
    [applySnapshot, resetState, user],
  );

  const refresh = useCallback(async () => {
    await refreshInternal({ background: false, announceNew: true });
  }, [refreshInternal]);

  const markRead = useCallback(async (notificationId: number | string) => {
    const numericId = Number(notificationId);
    const targetNotification = notifications.find(
      (notification) => notification.id === numericId,
    );

    if (targetNotification && !targetNotification.read) {
      const readAt = new Date().toISOString();
      setNotifications((current) =>
        current.map((notification) =>
          notification.id !== numericId || notification.read
            ? notification
            : {
                ...notification,
                read: true,
                readAt,
              },
        ),
      );
      setUnreadCount((current) => Math.max(0, current - 1));
    }

    try {
      await api.markNotificationRead(notificationId);
    } catch (error) {
      await refreshInternal({ background: true, announceNew: false });
      throw error;
    }
  }, [notifications, refreshInternal]);

  const markAllRead = useCallback(async () => {
    if (notifications.some((notification) => !notification.read)) {
      const readAt = new Date().toISOString();

      setNotifications((current) =>
        current.map((notification) =>
          notification.read
            ? notification
            : {
                ...notification,
                read: true,
                readAt,
              },
        ),
      );
      setUnreadCount(0);
    }

    try {
      await api.markAllNotificationsRead();
    } catch (error) {
      await refreshInternal({ background: true, announceNew: false });
      throw error;
    }
  }, [notifications, refreshInternal]);

  useEffect(() => {
    if (!user) {
      resetState();
      return;
    }

    knownNotificationIdsRef.current = new Set();
    hasLoadedRef.current = false;

    void refreshInternal({ background: false, announceNew: false });

    const intervalId = window.setInterval(() => {
      void refreshInternal({ background: true, announceNew: true });
    }, NOTIFICATION_POLL_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshInternal({ background: true, announceNew: true });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshInternal, resetState, user]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      isLoading,
      isRefreshing,
      refresh,
      markRead,
      markAllRead,
    }),
    [isLoading, isRefreshing, markAllRead, markRead, notifications, refresh, unreadCount],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
};
