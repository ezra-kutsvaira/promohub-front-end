import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>
          Manage in-app alerts and optional external delivery channels for each notification event.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-2xl border border-border bg-muted/20 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="grid flex-1 gap-2">
              <Label htmlFor="bulk-notification-email">Default email address</Label>
              <Input
                id="bulk-notification-email"
                type="email"
                value={bulkEmailAddress}
                onChange={(event) => setBulkEmailAddress(event.target.value)}
                placeholder="name@business.com"
              />
            </div>
            <div className="grid flex-1 gap-2">
              <Label htmlFor="bulk-notification-phone">Default phone number</Label>
              <Input
                id="bulk-notification-phone"
                value={bulkPhoneNumber}
                onChange={(event) => setBulkPhoneNumber(event.target.value)}
                placeholder="+263..."
              />
            </div>
            <Button onClick={() => void handleApplyContactsToAll()} disabled={isApplyingContacts}>
              {isApplyingContacts ? "Applying..." : "Apply to all alerts"}
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            In-app notifications are available immediately. Email, SMS, and WhatsApp will use your
            backend delivery integrations when those providers are connected. Leaving a contact field
            blank keeps the currently saved value on the backend.
          </p>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading notification preferences...</p>
        ) : orderedPreferences.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notification preferences were returned.</p>
        ) : (
          <div className="space-y-4">
            {orderedPreferences.map((preference) => {
              const isSaving = savingEventTypes.includes(preference.eventType);

              return (
                <div key={preference.eventType} className="rounded-2xl border border-border p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-foreground">
                          {getNotificationEventLabel(preference.eventType)}
                        </p>
                        <Badge variant={preference.active ? "default" : "secondary"}>
                          {preference.active ? "Enabled" : "Muted"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {getNotificationEventDescription(preference.eventType)}
                      </p>
                      {preference.updatedAt && (
                        <p className="text-xs text-muted-foreground">
                          Last updated {formatNotificationTimestamp(preference.updatedAt)}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => void savePreference(preference)}
                      disabled={isSaving}
                    >
                      {isSaving ? "Saving..." : "Save changes"}
                    </Button>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                      <div>
                        <p className="font-medium text-foreground">Enable alert</p>
                        <p className="text-xs text-muted-foreground">
                          Turns this event on or off completely.
                        </p>
                      </div>
                      <Switch
                        checked={preference.active}
                        onCheckedChange={(checked) =>
                          updateLocalPreferenceField(preference.eventType, "active", checked)
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                      <div>
                        <p className="font-medium text-foreground">Email</p>
                        <p className="text-xs text-muted-foreground">Send a copy by email.</p>
                      </div>
                      <Switch
                        checked={preference.emailEnabled}
                        onCheckedChange={(checked) =>
                          updateLocalPreferenceField(preference.eventType, "emailEnabled", checked)
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                      <div>
                        <p className="font-medium text-foreground">SMS</p>
                        <p className="text-xs text-muted-foreground">Send a text message.</p>
                      </div>
                      <Switch
                        checked={preference.smsEnabled}
                        onCheckedChange={(checked) =>
                          updateLocalPreferenceField(preference.eventType, "smsEnabled", checked)
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                      <div>
                        <p className="font-medium text-foreground">WhatsApp</p>
                        <p className="text-xs text-muted-foreground">Send a WhatsApp alert.</p>
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

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
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
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
