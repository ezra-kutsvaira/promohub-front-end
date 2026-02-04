import { Navbar } from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { BookmarkCheck, Calendar, MapPin } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, type Promotion, type SavedPromotion } from "@/lib/api";
import { formatDate, formatDiscount } from "@/lib/format";
import { toast } from "@/components/ui/sonner";

const SavedPromotions = () => {
  const { user } = useAuth();
  const [saved, setSaved] = useState<SavedPromotion[]>([]);
  const [details, setDetails] = useState<Record<number, Promotion>>({});
  const [isLoading, setIsLoading] = useState(true);

  if (!user) {
    return null;
  }

  useEffect(() => {
    let isMounted = true;
    const loadSaved = async () => {
      try {
        const savedPromotions = await api.getSavedPromotions();
        if (!isMounted) return;
        setSaved(savedPromotions);
        const promotionDetails = await Promise.all(
          savedPromotions.map((item) => api.getPromotion(item.promotionId).catch(() => null))
        );
        if (!isMounted) return;
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

    loadSaved();

    return () => {
      isMounted = false;
    };
  }, []);

  const expiringSoon = useMemo(() => {
    const today = new Date();
    const cutoff = new Date();
    cutoff.setDate(today.getDate() + 7);
    return Object.values(details).filter((promotion) => {
      const endDate = new Date(`${promotion.endDate}T00:00:00`);
      return endDate >= today && endDate <= cutoff;
    }).length;
  }, [details]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-10 space-y-6">
        <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">Saved promotions</h1>
            <p className="text-muted-foreground">
              Track deals you want to redeem and keep them handy for checkout.
            </p>
          </div>
          <Button variant="outline" asChild>
            <a href="/browse">Find more promotions</a>
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
              <CardDescription>Promos ending in 7 days.</CardDescription>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">{expiringSoon}</CardContent>
          </Card>
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">Reminders set</CardTitle>
              <CardDescription>Notification schedule.</CardDescription>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">—</CardContent>
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
                You haven't saved any promotions yet.
              </CardContent>
            </Card>
          )}
          {saved.map((promo) => {
            const detail = details[promo.promotionId];
            return (
            <Card key={promo.promotionId} className="border-border">
              <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-xl">{promo.promotionTitle}</CardTitle>
                  <CardDescription>{promo.businessName}</CardDescription>
                </div>
                {detail && (
                  <Badge variant="secondary" className="text-sm">
                    {formatDiscount(detail.discountType, detail.discountValue)}
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="grid gap-2 text-sm text-muted-foreground">
                  {detail && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>{detail.location}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>Valid until {detail ? formatDate(detail.endDate) : "—"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <BookmarkCheck className="h-4 w-4" />
                    <span>Saved on {formatDate(promo.savedAt)}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button variant="outline">Set reminder</Button>
                  <Button asChild>
                    <a href={`/promotion/${promo.promotionId}`}>View details</a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )})}
        </section>
      </main>
    </div>
  );
};

export default SavedPromotions;
