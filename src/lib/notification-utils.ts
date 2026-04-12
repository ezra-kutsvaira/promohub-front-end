import { formatDistanceToNowStrict, parseISO } from "date-fns";

import { type NotificationEventType, type NotificationItem } from "@/lib/api";

type NotificationEventMetadata = {
  label: string;
  description: string;
};

const NOTIFICATION_EVENT_METADATA: Record<string, NotificationEventMetadata> = {
  PROMOTION_APPROVED: {
    label: "Promotion approved",
    description: "Your promotion passed moderation and is now live.",
  },
  PROMOTION_REJECTED: {
    label: "Promotion rejected",
    description: "Your promotion needs changes before it can go live.",
  },
  PROMOTION_FLAGGED_AFTER_REPORTS: {
    label: "Promotion flagged after reports",
    description: "Repeated customer reports triggered an admin review.",
  },
  PROMOTION_REPORT_UNDER_REVIEW: {
    label: "Report under review",
    description: "An admin is actively reviewing a report on your promotion.",
  },
  PROMOTION_KEPT_FLAGGED_AFTER_REPORT_REVIEW: {
    label: "Promotion remains flagged",
    description: "The report was closed, but the promotion is still flagged for follow-up.",
  },
  PROMOTION_REJECTED_AFTER_REPORT_REVIEW: {
    label: "Rejected after report review",
    description: "The promotion was rejected after a report investigation.",
  },
  ROADSHOW_EVENT_APPROVED: {
    label: "Roadshow approved",
    description: "A subscribed roadshow event is now live.",
  },
};

export const NOTIFICATION_EVENT_ORDER: NotificationEventType[] = [
  "PROMOTION_APPROVED",
  "PROMOTION_REJECTED",
  "PROMOTION_FLAGGED_AFTER_REPORTS",
  "PROMOTION_REPORT_UNDER_REVIEW",
  "PROMOTION_KEPT_FLAGGED_AFTER_REPORT_REVIEW",
  "PROMOTION_REJECTED_AFTER_REPORT_REVIEW",
  "ROADSHOW_EVENT_APPROVED",
];

const humanizeEnumValue = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

export const getNotificationEventLabel = (eventType?: string | null) => {
  if (!eventType) {
    return "Notification";
  }

  return NOTIFICATION_EVENT_METADATA[eventType]?.label ?? humanizeEnumValue(eventType);
};

export const getNotificationEventDescription = (eventType?: string | null) => {
  if (!eventType) {
    return "Notification updates for your account.";
  }

  return (
    NOTIFICATION_EVENT_METADATA[eventType]?.description ??
    `${humanizeEnumValue(eventType)} updates for your account.`
  );
};

export const formatNotificationTimestamp = (value?: string | null) => {
  if (!value) {
    return "Just now";
  }

  const parsedDate = parseISO(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return formatDistanceToNowStrict(parsedDate, { addSuffix: true });
};

export const getNotificationTargetPath = (
  notification: Pick<NotificationItem, "actionUrl" | "promotionId">,
) => {
  const actionUrl = notification.actionUrl?.trim();
  if (actionUrl) {
    if (/^https?:\/\//i.test(actionUrl)) {
      return actionUrl;
    }

    return actionUrl.startsWith("/") ? actionUrl : `/${actionUrl}`;
  }

  if (notification.promotionId) {
    return `/promotion/${notification.promotionId}`;
  }

  return "/dashboard";
};

export const isExternalNotificationTarget = (target: string) => /^https?:\/\//i.test(target);
