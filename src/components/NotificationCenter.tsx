import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Bell,
  CalendarClock,
  CheckCheck,
  Megaphone,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { toast } from "@/components/ui/sonner";
import { type NotificationItem } from "@/lib/api";
import {
  formatNotificationTimestamp,
  getNotificationEventLabel,
  getNotificationTargetPath,
  isExternalNotificationTarget,
} from "@/lib/notification-utils";
import { useNotifications } from "@/lib/notifications";
import { cn } from "@/lib/utils";

const getNotificationIcon = (eventType?: string | null) => {
  switch (eventType) {
    case "BUSINESS_VERIFICATION_APPROVED":
      return ShieldCheck;
    case "BUSINESS_VERIFICATION_REJECTED":
      return ShieldAlert;
    case "PROMOTION_APPROVED":
      return ShieldCheck;
    case "PROMOTION_REJECTED":
    case "PROMOTION_REJECTED_AFTER_REPORT_REVIEW":
      return ShieldAlert;
    case "PROMOTION_FLAGGED_AFTER_REPORTS":
    case "PROMOTION_REPORT_UNDER_REVIEW":
    case "PROMOTION_KEPT_FLAGGED_AFTER_REPORT_REVIEW":
      return Bell;
    case "ADMIN_PROMOTION_SUBMITTED":
    case "ADMIN_BUSINESS_VERIFICATION_SUBMITTED":
    case "ADMIN_REPORT_CREATED":
    case "ADMIN_REPORT_THRESHOLD_REACHED":
      return ShieldAlert;
    case "SAVED_PROMOTION_EXPIRING_IN_3_DAYS":
    case "SAVED_PROMOTION_EXPIRING_TOMORROW":
    case "SAVED_PROMOTION_ENDS_TODAY":
      return CalendarClock;
    case "ROADSHOW_EVENT_APPROVED":
      return Megaphone;
    default:
      return Bell;
  }
};

const NotificationRow = ({
  notification,
  onOpen,
  onMarkRead,
}: {
  notification: NotificationItem;
  onOpen: (notification: NotificationItem) => void;
  onMarkRead: (notification: NotificationItem) => void;
}) => {
  const Icon = getNotificationIcon(notification.eventType);
  const targetPath = getNotificationTargetPath(notification);
  const isExternalTarget = isExternalNotificationTarget(targetPath);

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 transition-colors",
        notification.read
          ? "border-border bg-background"
          : "border-primary/30 bg-primary/5 shadow-sm",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            notification.read ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground",
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={notification.read ? "secondary" : "default"}>
              {getNotificationEventLabel(notification.eventType)}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatNotificationTimestamp(notification.createdAt)}
            </span>
            {!notification.read && (
              <span className="ml-auto inline-flex h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />
            )}
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-foreground">{notification.title}</p>
            <p className="text-sm text-muted-foreground">{notification.message}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isExternalTarget ? (
              <Button asChild size="sm" variant={notification.read ? "outline" : "default"}>
                <a
                  href={targetPath}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => onOpen(notification)}
                >
                  Open
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            ) : (
              <Button asChild size="sm" variant={notification.read ? "outline" : "default"}>
                <Link to={targetPath} onClick={() => onOpen(notification)}>
                  Open
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            )}
            {!notification.read && (
              <Button size="sm" variant="ghost" onClick={() => onMarkRead(notification)}>
                Mark read
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const NotificationCenter = () => {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, isLoading, isRefreshing, refresh, markRead, markAllRead } =
    useNotifications();

  const badgeLabel = useMemo(() => {
    if (unreadCount <= 0) {
      return null;
    }

    return unreadCount > 99 ? "99+" : String(unreadCount);
  }, [unreadCount]);

  const handleOpen = async (notification: NotificationItem) => {
    try {
      if (!notification.read) {
        await markRead(notification.id);
      }
      setOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update the notification.";
      toast.error(message);
    }
  };

  const handleMarkRead = async (notification: NotificationItem) => {
    try {
      await markRead(notification.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to mark that notification as read.";
      toast.error(message);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllRead();
      toast.success("All notifications marked as read.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to mark notifications as read.";
      toast.error(message);
    }
  };

  const handleRefresh = async () => {
    await refresh();
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          void refresh();
        }
      }}
    >
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative border border-border"
          aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : "Open notifications"}
        >
          <Bell className="h-4 w-4" />
          {badgeLabel && (
            <span className="absolute -right-1 -top-1 min-w-[1.2rem] rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
              {badgeLabel}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex h-full w-full max-w-none flex-col p-0 sm:max-w-lg">
        <SheetHeader className="border-b px-6 py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 text-left">
              <SheetTitle>Notifications</SheetTitle>
              <SheetDescription>
                {unreadCount > 0
                  ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"} waiting for you.`
                  : "You are caught up on your latest updates."}
              </SheetDescription>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => void handleRefresh()}>
                <RefreshCw className={cn("mr-2 h-4 w-4", (isLoading || isRefreshing) && "animate-spin")} />
                Refresh
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void handleMarkAllRead()}
                disabled={unreadCount === 0}
              >
                <CheckCheck className="mr-2 h-4 w-4" />
                Mark all read
              </Button>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-3 p-4">
            {!isLoading && notifications.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center">
                <p className="font-medium text-foreground">No notifications yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Approval queues, saved-promotion reminders, and moderation updates will appear here.
                </p>
              </div>
            )}

            {notifications.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                onOpen={(selectedNotification) => {
                  void handleOpen(selectedNotification);
                }}
                onMarkRead={(selectedNotification) => {
                  void handleMarkRead(selectedNotification);
                }}
              />
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
