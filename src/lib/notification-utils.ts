import { formatDistanceToNowStrict, parseISO } from "date-fns";

import { type NotificationEventType, type NotificationItem } from "@/lib/api";

type NotificationEventMetadata = {
  label: string;
  description: string;
};

export const SAVED_PROMOTION_REMINDER_EVENT_TYPES: NotificationEventType[] = [
  "SAVED_PROMOTION_EXPIRING_IN_3_DAYS",
  "SAVED_PROMOTION_EXPIRING_TOMORROW",
  "SAVED_PROMOTION_ENDS_TODAY",
];

const NOTIFICATION_EVENT_METADATA: Record<string, NotificationEventMetadata> = {
  BUSINESS_VERIFICATION_APPROVED: {
    label: "Business verification approved",
    description: "Your business owner account was approved and can now publish promotions.",
  },
  BUSINESS_VERIFICATION_REJECTED: {
    label: "Business verification rejected",
    description: "Your business verification needs changes before it can be approved.",
  },
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
  ADMIN_PROMOTION_SUBMITTED: {
    label: "Promotion awaiting review",
    description: "A newly submitted promotion is waiting in the admin approval queue.",
  },
  ADMIN_BUSINESS_VERIFICATION_SUBMITTED: {
    label: "Business verification awaiting review",
    description: "A business verification request has been submitted for admin review.",
  },
  ADMIN_REPORT_CREATED: {
    label: "New promotion report",
    description: "A customer report was submitted and may need moderation follow-up.",
  },
  ADMIN_REPORT_THRESHOLD_REACHED: {
    label: "Report threshold reached",
    description: "A promotion hit the reporting threshold and should be reviewed urgently.",
  },
  SAVED_PROMOTION_EXPIRING_IN_3_DAYS: {
    label: "Saved promotion expires in 3 days",
    description: "One of your saved promotions is approaching its expiry date.",
  },
  SAVED_PROMOTION_EXPIRING_TOMORROW: {
    label: "Saved promotion expires tomorrow",
    description: "One of your saved promotions will expire tomorrow.",
  },
  SAVED_PROMOTION_ENDS_TODAY: {
    label: "Saved promotion ends today",
    description: "One of your saved promotions expires today.",
  },
  ROADSHOW_EVENT_APPROVED: {
    label: "Roadshow approved",
    description: "A subscribed roadshow event is now live.",
  },
};

export const NOTIFICATION_EVENT_ORDER: NotificationEventType[] = [
  "BUSINESS_VERIFICATION_APPROVED",
  "BUSINESS_VERIFICATION_REJECTED",
  "PROMOTION_APPROVED",
  "PROMOTION_REJECTED",
  "PROMOTION_FLAGGED_AFTER_REPORTS",
  "PROMOTION_REPORT_UNDER_REVIEW",
  "PROMOTION_KEPT_FLAGGED_AFTER_REPORT_REVIEW",
  "PROMOTION_REJECTED_AFTER_REPORT_REVIEW",
  "ADMIN_PROMOTION_SUBMITTED",
  "ADMIN_BUSINESS_VERIFICATION_SUBMITTED",
  "ADMIN_REPORT_CREATED",
  "ADMIN_REPORT_THRESHOLD_REACHED",
  "SAVED_PROMOTION_EXPIRING_IN_3_DAYS",
  "SAVED_PROMOTION_EXPIRING_TOMORROW",
  "SAVED_PROMOTION_ENDS_TODAY",
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
