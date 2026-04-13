import { useEffect, useMemo, useState } from "react";
import {
  BellRing,
  Mail,
  MessageSquare,
  Phone,
  Save,
  Settings2,
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import {
  api,
  type NotificationPreference,
  type NotificationPreferenceUpdatePayload,
} from "@/lib/api";
import {
  formatNotificationTimestamp,
  getNotificationEventDescription,
  getNotificationEventLabel,
  NOTIFICATION_EVENT_ORDER,
} from "@/lib/notification-utils";

const sortPreferences = (preferences: NotificationPreference[]) => {
  const order = new Map(NOTIFICATION_EVENT_ORDER.map((eventType, index) => [eventType, index]));

  return [...preferences].sort((left, right) => {
    const leftIndex = order.get(left.eventType) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = order.get(right.eventType) ?? Number.MAX_SAFE_INTEGER;
    return leftIndex - rightIndex || left.eventType.localeCompare(right.eventType);
  });
};

const updatePreferenceLocally = (
  preferences: NotificationPreference[],
  eventType: string,
  updater: (preference: NotificationPreference) => NotificationPreference,
) =>
  preferences.map((preference) =>
    preference.eventType === eventType ? updater(preference) : preference,
  );

const hasExternalDeliveryEnabled = (preference: NotificationPreference) =>
  preference.emailEnabled || preference.smsEnabled || preference.whatsappEnabled;

const getDeliveryBadges = (preference: NotificationPreference) => {
  if (!preference.active) {
    return ["Muted"];
  }

  const labels = ["In-app"];
  if (preference.emailEnabled) {
    labels.push("Email");
  }
  if (preference.smsEnabled) {
    labels.push("SMS");
  }
  if (preference.whatsappEnabled) {
    labels.push("WhatsApp");
  }

  if (labels.length === 1) {
    return ["In-app only"];
  }

  return labels;
};

export const NotificationPreferencesPanel = () => {
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingEventTypes, setSavingEventTypes] = useState<string[]>([]);
  const [isApplyingContacts, setIsApplyingContacts] = useState(false);
  const [bulkEmailAddress, setBulkEmailAddress] = useState("");
  const [bulkPhoneNumber, setBulkPhoneNumber] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadPreferences = async () => {
      try {
        setIsLoading(true);
        const response = await api.getNotificationPreferences();
        if (!isMounted) {
          return;
        }

        const orderedPreferences = sortPreferences(response);
        setPreferences(orderedPreferences);
        setBulkEmailAddress(
          orderedPreferences.find((preference) => preference.emailAddress?.trim())?.emailAddress ?? "",
        );
        setBulkPhoneNumber(
          orderedPreferences.find((preference) => preference.phoneNumber?.trim())?.phoneNumber ?? "",
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to load notification preferences.";
        toast.error(message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadPreferences();

    return () => {
      isMounted = false;
    };
  }, []);

  const orderedPreferences = useMemo(() => sortPreferences(preferences), [preferences]);

  const totalAlerts = orderedPreferences.length;
  const activeAlerts = orderedPreferences.filter((preference) => preference.active).length;
  const externalAlerts = orderedPreferences.filter(
    (preference) => preference.active && hasExternalDeliveryEnabled(preference),
  ).length;

  const updateLocalPreferenceField = <K extends keyof NotificationPreference>(
    eventType: string,
    field: K,
    value: NotificationPreference[K],
  ) => {
    setPreferences((current) =>
      updatePreferenceLocally(current, eventType, (preference) => ({
        ...preference,
        [field]: value,
      })),
    );
  };

  const savePreference = async (preference: NotificationPreference) => {
    try {
      setSavingEventTypes((current) => [...current, preference.eventType]);
      const payload: NotificationPreferenceUpdatePayload = {
        active: preference.active,
        emailEnabled: preference.emailEnabled,
        smsEnabled: preference.smsEnabled,
        whatsappEnabled: preference.whatsappEnabled,
        emailAddress: preference.emailAddress?.trim() ?? "",
        phoneNumber: preference.phoneNumber?.trim() ?? "",
      };

      const savedPreference = await api.updateNotificationPreference(preference.eventType, payload);
      setPreferences((current) =>
        updatePreferenceLocally(current, preference.eventType, () => savedPreference),
      );
      toast.success(`${getNotificationEventLabel(preference.eventType)} preferences saved.`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save notification preferences.";
      toast.error(message);
    } finally {
      setSavingEventTypes((current) =>
        current.filter((eventType) => eventType !== preference.eventType),
      );
    }
  };

  const handleApplyContactsToAll = async () => {
    const emailAddress = bulkEmailAddress.trim();
    const phoneNumber = bulkPhoneNumber.trim();

    if (!emailAddress && !phoneNumber) {
      toast.info("Add an email address or phone number before applying contact details.");
      return;
    }

    try {
      setIsApplyingContacts(true);
      const payload: NotificationPreferenceUpdatePayload = {
        ...(emailAddress ? { emailAddress } : {}),
        ...(phoneNumber ? { phoneNumber } : {}),
      };

      const updatedPreferences = await Promise.all(
        orderedPreferences.map((preference) =>
          api.updateNotificationPreference(preference.eventType, payload),
        ),
      );

      setPreferences(sortPreferences(updatedPreferences));
      toast.success("Contact details applied to all notification types.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to apply contact details to all alerts.";
      toast.error(message);
    } finally {
      setIsApplyingContacts(false);
    }
  };

  return (
    <Card className="border-border">
      <CardHeader className="space-y-5">
        <div className="space-y-1">
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            Decide which alerts reach you and which channels should deliver them.
          </CardDescription>
        </div>

        {!isLoading && orderedPreferences.length > 0 && (
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-border bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">Alert types</p>
              <p className="mt-2 text-3xl font-semibold text-foreground">{totalAlerts}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Notification categories available for this account.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">Currently active</p>
              <p className="mt-2 text-3xl font-semibold text-foreground">{activeAlerts}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Alerts that are not muted and can still notify you.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">External delivery</p>
              <p className="mt-2 text-3xl font-semibold text-foreground">{externalAlerts}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Alerts currently configured to send email, SMS, or WhatsApp copies.
              </p>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
          <div className="rounded-2xl border border-border bg-muted/20 p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/10 p-2 text-primary">
                <Settings2 className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1 space-y-4">
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">Default delivery details</p>
                  <p className="text-sm text-muted-foreground">
                    Apply one email address or phone number across every notification type so you do
                    not have to repeat the same details in each alert.
                  </p>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1fr,1fr,auto] lg:items-end">
                  <div className="grid gap-2">
                    <Label htmlFor="bulk-notification-email">Default email address</Label>
                    <Input
                      id="bulk-notification-email"
                      type="email"
                      value={bulkEmailAddress}
                      onChange={(event) => setBulkEmailAddress(event.target.value)}
                      placeholder="name@business.com"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="bulk-notification-phone">Default phone number</Label>
                    <Input
                      id="bulk-notification-phone"
                      value={bulkPhoneNumber}
                      onChange={(event) => setBulkPhoneNumber(event.target.value)}
                      placeholder="+263..."
                    />
                  </div>

                  <Button
                    onClick={() => void handleApplyContactsToAll()}
                    disabled={isApplyingContacts}
                    className="lg:self-end"
                  >
                    {isApplyingContacts ? "Applying..." : "Apply to all alerts"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/10 p-2 text-primary">
                <BellRing className="h-4 w-4" />
              </div>
              <div className="space-y-2">
                <p className="font-semibold text-foreground">How delivery works</p>
                <p className="text-sm text-muted-foreground">
                  In-app alerts appear immediately in your notification center. Email, SMS, and
                  WhatsApp copies are only sent when those delivery providers are connected on the
                  backend.
                </p>
                <p className="text-sm text-muted-foreground">
                  You can keep an alert active for in-app only, or expand any alert below to enable
                  extra channels and override contact details.
                </p>
              </div>
            </div>
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading notification preferences...</p>
        ) : orderedPreferences.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notification preferences were returned.</p>
        ) : (
          <Accordion
            type="single"
            collapsible
            defaultValue={orderedPreferences[0]?.eventType}
            className="rounded-2xl border border-border px-5"
          >
            {orderedPreferences.map((preference) => {
              const isSaving = savingEventTypes.includes(preference.eventType);
              const deliveryBadges = getDeliveryBadges(preference);

              return (
                <AccordionItem
                  key={preference.eventType}
                  value={preference.eventType}
                  className="border-border"
                >
                  <AccordionTrigger className="py-5 hover:no-underline">
                    <div className="flex w-full flex-col gap-3 pr-4 text-left lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-foreground">
                            {getNotificationEventLabel(preference.eventType)}
                          </p>
                          <Badge variant={preference.active ? "default" : "secondary"}>
                            {preference.active ? "Enabled" : "Muted"}
                          </Badge>
                        </div>
                        <p className="max-w-2xl text-sm text-muted-foreground">
                          {getNotificationEventDescription(preference.eventType)}
                        </p>
                        {preference.updatedAt && (
                          <p className="text-xs text-muted-foreground">
                            Last updated {formatNotificationTimestamp(preference.updatedAt)}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {deliveryBadges.map((label) => (
                          <Badge key={`${preference.eventType}-${label}`} variant="outline">
                            {label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent>
                    <div className="grid gap-4 lg:grid-cols-[1.1fr,1.1fr]">
                      <div className="rounded-2xl border border-border bg-muted/20 p-4">
                        <p className="font-semibold text-foreground">Alert behavior</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Choose whether this alert should reach you and which channels should be
                          available when it fires.
                        </p>

                        <Separator className="my-4" />

                        <div className="space-y-3">
                          <div className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3">
                            <div className="pr-4">
                              <p className="font-medium text-foreground">Enable alert</p>
                              <p className="text-xs text-muted-foreground">
                                Turn this notification type on or mute it completely.
                              </p>
                            </div>
                            <Switch
                              checked={preference.active}
                              onCheckedChange={(checked) =>
                                updateLocalPreferenceField(preference.eventType, "active", checked)
                              }
                            />
                          </div>

                          <div className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3">
                            <div className="flex items-start gap-3 pr-4">
                              <Mail className="mt-0.5 h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="font-medium text-foreground">Email copy</p>
                                <p className="text-xs text-muted-foreground">
                                  Send this alert to your saved email address.
                                </p>
                              </div>
                            </div>
                            <Switch
                              checked={preference.emailEnabled}
                              onCheckedChange={(checked) =>
                                updateLocalPreferenceField(
                                  preference.eventType,
                                  "emailEnabled",
                                  checked,
                                )
                              }
                            />
                          </div>

                          <div className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3">
                            <div className="flex items-start gap-3 pr-4">
                              <Phone className="mt-0.5 h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="font-medium text-foreground">SMS copy</p>
                                <p className="text-xs text-muted-foreground">
                                  Send a text message to your saved phone number.
                                </p>
                              </div>
                            </div>
                            <Switch
                              checked={preference.smsEnabled}
                              onCheckedChange={(checked) =>
                                updateLocalPreferenceField(
                                  preference.eventType,
                                  "smsEnabled",
                                  checked,
                                )
                              }
                            />
                          </div>

                          <div className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3">
                            <div className="flex items-start gap-3 pr-4">
                              <MessageSquare className="mt-0.5 h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="font-medium text-foreground">WhatsApp copy</p>
                                <p className="text-xs text-muted-foreground">
                                  Deliver the same alert through WhatsApp when available.
                                </p>
                              </div>
                            </div>
                            <Switch
                              checked={preference.whatsappEnabled}
                              onCheckedChange={(checked) =>
                                updateLocalPreferenceField(
                                  preference.eventType,
                                  "whatsappEnabled",
                                  checked,
                                )
                              }
                            />
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border bg-background p-4">
                        <p className="font-semibold text-foreground">Contact details for this alert</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Leave the fields below as-is to keep the current saved values for this
                          notification type.
                        </p>

                        <div className="mt-4 grid gap-4">
                          <div className="grid gap-2">
                            <Label htmlFor={`${preference.eventType}-email`}>Email address</Label>
                            <Input
                              id={`${preference.eventType}-email`}
                              type="email"
                              value={preference.emailAddress ?? ""}
                              onChange={(event) =>
                                updateLocalPreferenceField(
                                  preference.eventType,
                                  "emailAddress",
                                  event.target.value,
                                )
                              }
                              placeholder="name@business.com"
                            />
                          </div>

                          <div className="grid gap-2">
                            <Label htmlFor={`${preference.eventType}-phone`}>Phone number</Label>
                            <Input
                              id={`${preference.eventType}-phone`}
                              value={preference.phoneNumber ?? ""}
                              onChange={(event) =>
                                updateLocalPreferenceField(
                                  preference.eventType,
                                  "phoneNumber",
                                  event.target.value,
                                )
                              }
                              placeholder="+263..."
                            />
                          </div>
                        </div>

                        <div className="mt-5 rounded-xl border border-dashed border-border bg-muted/20 p-3 text-sm text-muted-foreground">
                          Email is required if email delivery is enabled. A phone number is required
                          if SMS or WhatsApp delivery is enabled.
                        </div>

                        <div className="mt-5 flex justify-end">
                          <Button
                            size="sm"
                            onClick={() => void savePreference(preference)}
                            disabled={isSaving}
                          >
                            <Save className="mr-2 h-4 w-4" />
                            {isSaving ? "Saving..." : "Save this alert"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
};
