import { Navbar } from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { BookmarkCheck, Calendar, MapPin } from "lucide-react";

const savedPromotions = [
  {
    id: "promo-1",
    title: "Weekend Grocery Saver",
    businessName: "FreshMart Stores",
    location: "Bulawayo",
    validUntil: "15 Dec 2025",
    savedOn: "02 Nov 2025",
    discount: "35% OFF",
  },
  {
    id: "promo-2",
    title: "Electronics Mega Deal",
    businessName: "TechWorld Zimbabwe",
    location: "Harare",
    validUntil: "30 Nov 2025",
    savedOn: "28 Oct 2025",
    discount: "70% OFF",
  },
  {
    id: "promo-3",
    title: "Summer Fashion Drop",
    businessName: "StyleHub Boutique",
    location: "Harare",
    validUntil: "20 Dec 2025",
    savedOn: "05 Nov 2025",
    discount: "50% OFF",
  },
];

const SavedPromotions = () => {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

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
            <CardContent className="text-3xl font-semibold">{savedPromotions.length}</CardContent>
          </Card>
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">Expiring soon</CardTitle>
              <CardDescription>Promos ending in 7 days.</CardDescription>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">2</CardContent>
          </Card>
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">Reminders set</CardTitle>
              <CardDescription>Notification schedule.</CardDescription>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">5</CardContent>
          </Card>
        </section>

        <section className="grid gap-6">
          {savedPromotions.map((promo) => (
            <Card key={promo.id} className="border-border">
              <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-xl">{promo.title}</CardTitle>
                  <CardDescription>{promo.businessName}</CardDescription>
                </div>
                <Badge variant="secondary" className="text-sm">
                  {promo.discount}
                </Badge>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="grid gap-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>{promo.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>Valid until {promo.validUntil}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <BookmarkCheck className="h-4 w-4" />
                    <span>Saved on {promo.savedOn}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button variant="outline">Set reminder</Button>
                  <Button asChild>
                    <a href={`/promotion/${promo.id}`}>View details</a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      </main>
    </div>
  );
};

export default SavedPromotions;
