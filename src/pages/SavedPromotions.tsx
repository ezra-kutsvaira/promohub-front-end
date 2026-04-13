import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookmarkCheck, Calendar, MapPin } from "lucide-react";

import { Navbar } from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, type NotificationPreference, type Promotion, type SavedPromotion } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate, formatDiscount } from "@/lib/format";
import { SAVED_PROMOTION_REMINDER_EVENT_TYPES } from "@/lib/notification-utils";
import { toast } from "@/components/ui/sonner";

type ExpiryStatusBadge = {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
};

const getStartOfToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const parseDateOnly = (value: string) => new Date(`${value}T00:00:00`);

const getDaysUntilDate = (value: string) => {
  const today = getStartOfToday();
  const targetDate = parseDateOnly(value);
  return Math.round((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

const getExpiryStatusBadge = (promotion: Promotion): ExpiryStatusBadge | null => {
  const daysUntilExpiry = getDaysUntilDate(promotion.endDate);

  if (daysUntilExpiry < 0) {
    return {
      label: "Expired",
      variant: "destructive",
    };
  }

  if (daysUntilExpiry === 0) {
    return {
      label: "Ends today",
      variant: "destructive",
    };
  }

  if (daysUntilExpiry === 1) {
    return {
      label: "Ends tomorrow",
      variant: "default",
    };
  }

  if (daysUntilExpiry === 3) {
    return {
      label: "Ends in 3 days",
      variant: "secondary",
    };
  }

  if (daysUntilExpiry <= 7) {
    return {
      label: `Ends in ${daysUntilExpiry} days`,
      variant: "outline",
    };
  }

  return null;
};

const SavedPromotions = () => {
  const { user } = useAuth();
  const [saved, setSaved] = useState<SavedPromotion[]>([]);
  const [details, setDetails] = useState<Record<number, Promotion>>({});
  const [notificationPreferences, setNotificationPreferences] = useState<
    NotificationPreference[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  if (!user) {
    return null;
  }

  useEffect(() => {
    let isMounted = true;

    const loadSavedPromotions = async () => {
      try {
        const [savedPromotions, preferences] = await Promise.all([
          api.getSavedPromotions(),
          api.getNotificationPreferences().catch(() => []),
        ]);

        if (!isMounted) {
          return;
        }

        setSaved(savedPromotions);
        setNotificationPreferences(preferences);

        const promotionDetails = await Promise.all(
          savedPromotions.map((item) => api.getPromotion(item.promotionId).catch(() => null)),
        );

        if (!isMounted) {
          return;
        }

        const nextDetails = promotionDetails.reduce<Record<number, Promotion>>((acc, promotion) => {
          if (promotion) {
            acc[promotion.id] = promotion;
          }
          return acc;
        }, {});

        setDetails(nextDetails);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load saved promotions.";
        toast.error(message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadSavedPromotions();

    return () => {
      isMounted = false;
    };
  }, []);

  const expiringSoon = useMemo(() => {
    const today = getStartOfToday();
    const cutoff = new Date(today);
    cutoff.setDate(today.getDate() + 7);

    return Object.values(details).filter((promotion) => {
      const endDate = parseDateOnly(promotion.endDate);
      return endDate >= today && endDate <= cutoff;
    }).length;
  }, [details]);

  const reminderPreferences = useMemo(
    () =>
      notificationPreferences.filter((preference) =>
        SAVED_PROMOTION_REMINDER_EVENT_TYPES.includes(preference.eventType),
      ),
    [notificationPreferences],
  );

  const activeReminderCount = useMemo(
    () => reminderPreferences.filter((preference) => preference.active).length,
    [reminderPreferences],
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto space-y-6 px-4 py-10">
        <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground md:text-4xl">Saved promotions</h1>
            <p className="text-muted-foreground">
              Track deals you want to redeem and keep them handy for checkout.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/browse">Find more promotions</Link>
          </Button>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">Total saved</CardTitle>
              <CardDescription>Deals in your list.</CardDescription>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">{saved.length}</CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">Expiring soon</CardTitle>
              <CardDescription>Promotions ending in 7 days.</CardDescription>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">{expiringSoon}</CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">Reminders set</CardTitle>
              <CardDescription>Active expiry reminder triggers.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-3xl font-semibold">{activeReminderCount}</p>
              <p className="text-sm text-muted-foreground">
                {reminderPreferences.length === 0
                  ? "Reminder preferences are not available for this account yet."
                  : activeReminderCount === 0
                    ? "Expiry reminders are currently muted."
                    : `${activeReminderCount} reminder trigger${activeReminderCount === 1 ? "" : "s"} enabled.`}
              </p>
            </CardContent>
          </Card>
        </section>

        <section>
          <Card className="border-border bg-muted/20">
            <CardContent className="flex flex-col gap-4 py-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <p className="font-semibold text-foreground">Expiry reminders for saved promotions</p>
                <p className="text-sm text-muted-foreground">
                  PromoHub can notify you 3 days before a deal expires, again tomorrow, and once
                  more on the final day.
                </p>
              </div>
              <Button variant="outline" asChild>
                <Link to="/account-settings?section=notifications">Manage reminder delivery</Link>
              </Button>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6">
          {isLoading && (
            <Card className="border-border">
              <CardContent className="py-8 text-center text-muted-foreground">
                Loading saved promotions...
              </CardContent>
            </Card>
          )}

          {!isLoading && saved.length === 0 && (
            <Card className="border-border">
              <CardContent className="py-8 text-center text-muted-foreground">
                You have not saved any promotions yet.
              </CardContent>
            </Card>
          )}

          {saved.map((promo) => {
            const detail = details[promo.promotionId];
            const expiryStatus = detail ? getExpiryStatusBadge(detail) : null;

            return (
              <Card key={promo.promotionId} className="border-border">
                <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="text-xl">{promo.promotionTitle}</CardTitle>
                    <CardDescription>{promo.businessName}</CardDescription>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {detail && (
                      <Badge variant="secondary" className="text-sm">
                        {formatDiscount(detail.discountType, detail.discountValue)}
                      </Badge>
                    )}
                    {expiryStatus && (
                      <Badge variant={expiryStatus.variant} className="text-sm">
                        {expiryStatus.label}
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="grid gap-2 text-sm text-muted-foreground">
                    {detail?.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span>{detail.location}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>Valid until {detail ? formatDate(detail.endDate) : "-"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <BookmarkCheck className="h-4 w-4" />
                      <span>Saved on {formatDate(promo.savedAt)}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button variant="outline" asChild>
                      <Link to="/account-settings?section=notifications">Manage reminders</Link>
                    </Button>
                    <Button asChild>
                      <Link to={`/promotion/${promo.promotionId}`}>View details</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>
      </main>
    </div>
  );
};

export default SavedPromotions;
