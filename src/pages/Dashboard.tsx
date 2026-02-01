import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { ArrowUpRight, BookmarkCheck, CalendarCheck, Megaphone, Sparkles, Users } from "lucide-react";

const Dashboard = () => {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  const isBusiness = user.role === "business";
  const isAdmin = user.role === "admin";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-10 space-y-8">
        <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">
              Welcome back, {user.name.split(" ")[0]}
            </h1>
            <p className="text-muted-foreground">
              Here is a snapshot of your PromoHub activity and tailored next steps.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="capitalize">
              {user.role} account
            </Badge>
            <Button asChild>
              <a href="/account-settings">
                Manage account <ArrowUpRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">Saved promotions</CardTitle>
              <CardDescription>Deals ready for redemption.</CardDescription>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">8</CardContent>
          </Card>
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">Upcoming expiries</CardTitle>
              <CardDescription>Promotions closing this week.</CardDescription>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">3</CardContent>
          </Card>
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">Messages</CardTitle>
              <CardDescription>Updates from PromoHub support.</CardDescription>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">2</CardContent>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Quick actions</CardTitle>
              <CardDescription>Jump back in where you left off.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex items-start gap-4 rounded-lg border border-border p-4">
                <BookmarkCheck className="h-5 w-5 text-primary" />
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">Review saved promotions</p>
                  <p className="text-sm text-muted-foreground">
                    Revisit deals you want to redeem this week.
                  </p>
                </div>
                <Button variant="outline" className="ml-auto" asChild>
                  <a href="/saved-promotions">View list</a>
                </Button>
              </div>
              <div className="flex items-start gap-4 rounded-lg border border-border p-4">
                <CalendarCheck className="h-5 w-5 text-primary" />
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">Schedule redemption reminders</p>
                  <p className="text-sm text-muted-foreground">
                    Set notifications so you never miss a closing promotion.
                  </p>
                </div>
                <Button variant="outline" className="ml-auto">
                  Set reminder
                </Button>
              </div>
              {isBusiness && (
                <div className="flex items-start gap-4 rounded-lg border border-border p-4">
                  <Megaphone className="h-5 w-5 text-primary" />
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">Launch a new promotion</p>
                    <p className="text-sm text-muted-foreground">
                      Publish a verified deal and notify your audience instantly.
                    </p>
                  </div>
                  <Button className="ml-auto">Create promo</Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle>Role highlights</CardTitle>
              <CardDescription>What your account unlocks.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              {user.role === "consumer" && (
                <>
                  <div className="flex items-start gap-3">
                    <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
                    <span>Save promotions from trusted, verified businesses.</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Users className="mt-0.5 h-4 w-4 text-primary" />
                    <span>Get early access to loyalty rewards and VIP events.</span>
                  </div>
                </>
              )}
              {isBusiness && (
                <>
                  <div className="flex items-start gap-3">
                    <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
                    <span>Publish verified campaigns with premium placement.</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Users className="mt-0.5 h-4 w-4 text-primary" />
                    <span>Track audience engagement and redemption intent.</span>
                  </div>
                </>
              )}
              {isAdmin && (
                <>
                  <div className="flex items-start gap-3">
                    <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
                    <span>Approve and monitor new promotion submissions.</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Users className="mt-0.5 h-4 w-4 text-primary" />
                    <span>View platform-wide health and verification metrics.</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </section>

        {isAdmin && (
          <section className="grid gap-4 md:grid-cols-2">
            <Card className="border-border">
              <CardHeader>
                <CardTitle>Admin insights</CardTitle>
                <CardDescription>Platform verification queue.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-muted-foreground">
                <p>12 new businesses awaiting verification.</p>
                <p>4 promotions flagged for review.</p>
                <Button variant="outline">Open moderation console</Button>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardHeader>
                <CardTitle>Compliance status</CardTitle>
                <CardDescription>Trust & safety metrics.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-muted-foreground">
                <p>98% verification SLA met this week.</p>
                <p>Average review time: 14 hours.</p>
              </CardContent>
            </Card>
          </section>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
