import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { ArrowUpRight, BookmarkCheck, CalendarCheck, Megaphone, Sparkles, Users } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import { useEffect, useMemo, useState } from "react";
import { api, type PageResponse, type PlatformAnalytics, type Promotion, type SavedPromotion } from "@/lib/api";
import {
  getPromotionVerificationStatus,
  isApprovedPromotion,
  isPendingPromotion,
  isRejectedPromotion,
} from "@/lib/promotionStatus";

const toPromotionPage = (payload: PageResponse<Promotion> | Promotion[] | null | undefined): PageResponse<Promotion> => {
  if (Array.isArray(payload)) {
    return {
      content: payload,
      pageNumber: 0,
      pageSize: payload.length,
      totalElements: payload.length,
      totalPages: payload.length > 0 ? 1 : 0,
      last: true,
    };
  }

  if (!payload) {
    return {
      content: [],
      pageNumber: 0,
      pageSize: 0,
      totalElements: 0,
      totalPages: 0,
      last: true,
    };
  }

  return {
    content: payload.content ?? [],
    pageNumber: payload.pageNumber ?? 0,
    pageSize: payload.pageSize ?? payload.content?.length ?? 0,
    totalElements: payload.totalElements ?? payload.content?.length ?? 0,
    totalPages: payload.totalPages ?? 0,
    last: payload.last ?? true,
  };
};

const Dashboard = () => {
  const { user } = useAuth();
  const [savedPromotions, setSavedPromotions] = useState<SavedPromotion[]>([]);
  const [savedPromotionDetails, setSavedPromotionDetails] = useState<Promotion[]>([]);
  const [notificationsCount, setNotificationsCount] = useState(0);
  const [platformAnalytics, setPlatformAnalytics] = useState<PlatformAnalytics | null>(null);
  const [pendingPromotionsCount, setPendingPromotionsCount] = useState(0);
  const [businessPromotions, setBusinessPromotions] = useState<Promotion[]>([]);
  const [adminPromotions, setAdminPromotions] = useState<Promotion[]>([]);
  const location = useLocation();

  if (!user) {
    return null;
  }

  const isBusiness = user.role === "BUSINESS_OWNER";
  const isAdmin = user.role === "ADMIN";

  useEffect(() => {
    let isMounted = true;

    const loadDashboard = async () => {
      try {
        if (isBusiness) {
          const business = await api.getCurrentUserBusiness(user.id);
          if (!isMounted) return;
          const [pendingBusinessPromotions, approvedBusinessPromotions, rejectedBusinessPromotions] = await Promise.all([
            api.getCurrentUserBusinessPromotionsByStatus(business.id, "PENDING", user.id),
            api.getCurrentUserBusinessPromotionsByStatus(business.id, "APPROVED", user.id),
            api.getCurrentUserBusinessPromotionsByStatus(business.id, "REJECTED", user.id),
          ]);
          if (!isMounted) return;

          const uniquePromotions = new Map<number, Promotion>();
          [...pendingBusinessPromotions, ...approvedBusinessPromotions, ...rejectedBusinessPromotions].forEach((promotion) => {
            uniquePromotions.set(promotion.id, promotion);
          });

          const allBusinessPromotions = Array.from(uniquePromotions.values());
          setBusinessPromotions(allBusinessPromotions);
          setPendingPromotionsCount(pendingBusinessPromotions.length);
        } else if (!isAdmin) {
          const saved = await api.getSavedPromotions();
          if (!isMounted) return;
          setSavedPromotions(saved);

          const details = await Promise.all(
            saved.map((item) => api.getPromotion(item.promotionId).catch(() => null))
          );
          if (!isMounted) return;
          setSavedPromotionDetails(details.filter(Boolean) as Promotion[]);

          const notifications = await api.getNotifications();
          if (!isMounted) return;
          setNotificationsCount(notifications.filter((item) => !item.read).length);
        }

        if (isAdmin) {
           const promotions = await api.getAdminPromotions();
          if (!isMounted) return;
          setAdminPromotions(promotions);
          const analytics = await api.getPlatformAnalytics();
          if (!isMounted) return;
          setPlatformAnalytics(analytics);
        }
      } catch (error) {
        if (isBusiness) {
          const message = error instanceof Error ? error.message : "Unable to load your promotions.";
          toast.error(message);
        }
        
      }
    };

    loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [isAdmin, isBusiness, user.id]);

  const expiringSoonCount = useMemo(() => {
    const today = new Date();
    const cutoff = new Date();
    cutoff.setDate(today.getDate() + 7);
    return savedPromotionDetails.filter((promotion) => {
      const endDate = new Date(`${promotion.endDate}T00:00:00`);
      return endDate >= today && endDate <= cutoff;
    }).length;
  }, [savedPromotionDetails]);

  const createdPromotion = (location.state as { createdPromotion?: Promotion } | null)?.createdPromotion;
  const promotionsWithNewlyCreated = useMemo(() => {
    if (!createdPromotion || businessPromotions.some((item) => item.id === createdPromotion.id)) {
      return businessPromotions;
    }

    return [createdPromotion, ...businessPromotions];
  }, [businessPromotions, createdPromotion]);

  const pendingPromotions = promotionsWithNewlyCreated.filter(isPendingPromotion);
  const approvedPromotions = promotionsWithNewlyCreated.filter(isApprovedPromotion);
  const rejectedPromotions = promotionsWithNewlyCreated.filter(isRejectedPromotion);
  const submittedPromotions = adminPromotions.filter(isPendingPromotion);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-10 space-y-8">
        <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">
              Welcome back, {user.fullName.split(" ")[0]}
            </h1>
            <p className="text-muted-foreground">
              Here is a snapshot of your PromoHub activity and tailored next steps.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="capitalize">
              {user.role.toLowerCase().replace("_", " ")} account
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
              <CardTitle className="text-lg">{isBusiness ? "Pending promotions" : isAdmin ? "Submitted promotions" : "Saved promotions"}</CardTitle>
              <CardDescription>{isBusiness ? "Awaiting admin approval." : isAdmin ? "Waiting for moderation decision." : "Deals ready for redemption."}</CardDescription>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">
                {isBusiness ? pendingPromotionsCount : isAdmin ? submittedPromotions.length : savedPromotions.length}
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">Upcoming expiries</CardTitle>
              <CardDescription>Promotions closing this week.</CardDescription>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">
              {isBusiness ? "—" : expiringSoonCount}
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">Messages</CardTitle>
              <CardDescription>Updates from PromoHub support.</CardDescription>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">
              {isBusiness ? "—" : notificationsCount}
            </CardContent>
          </Card>
        </section>

        {isBusiness && (
          <section>
            <Card className="border-border">
              <CardHeader>
                <CardTitle>Posted promotions</CardTitle>
                <CardDescription>Track admin review outcomes and when your promotions go live.</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="pending" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="pending">Pending ({pendingPromotions.length})</TabsTrigger>
                    <TabsTrigger value="approved">Approved ({approvedPromotions.length})</TabsTrigger>
                    <TabsTrigger value="rejected">Rejected ({rejectedPromotions.length})</TabsTrigger>
                  </TabsList>
                  <TabsContent value="pending" className="space-y-3">
                    {pendingPromotions.length === 0 && (
                      <p className="text-sm text-muted-foreground">No pending promotions right now.</p>
                    )}
                    {pendingPromotions.map((promotion) => (
                      <div key={promotion.id} className="rounded-lg border border-border p-4">
                        <p className="font-semibold">{promotion.title}</p>
                        <p className="text-sm text-muted-foreground">Awaiting admin approval.</p>
                        <Badge variant="outline" className="mt-2">PENDING</Badge>
                      </div>
                    ))}
                  </TabsContent>
                  <TabsContent value="approved" className="space-y-3">
                    {approvedPromotions.length === 0 && (
                      <p className="text-sm text-muted-foreground">No approved promotions yet.</p>
                    )}
                    {approvedPromotions.map((promotion) => (
                      <div key={promotion.id} className="rounded-lg border border-border p-4">
                        <p className="font-semibold">{promotion.title}</p>
                        <p className="text-sm text-muted-foreground">Approved promotions are visible to customers during their active date range.</p>
                        <Badge className="mt-2">{getPromotionVerificationStatus(promotion)}</Badge>
                      </div>
                    ))}
                  </TabsContent>
                  <TabsContent value="rejected" className="space-y-3">
                    {rejectedPromotions.length === 0 && (
                      <p className="text-sm text-muted-foreground">No rejected promotions.</p>
                    )}
                    {rejectedPromotions.map((promotion) => (
                      <div key={promotion.id} className="rounded-lg border border-border p-4">
                        <p className="font-semibold">{promotion.title}</p>
                        <p className="text-sm text-muted-foreground">Denied: {promotion.rejectionReason ?? "No reason provided."}</p>
                        <Badge variant="destructive" className="mt-2">REJECTED</Badge>
                      </div>
                    ))}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </section>
        )}

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
                <Button variant="outline" className="ml-auto" onClick={() => toast.info("Use Account Settings to configure notification subscriptions.")}>
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
                  <Button className="ml-auto" asChild><Link to="/promotions/new">Create promo</Link></Button>
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
              {user.role === "CONSUMER" && (
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

        {isAdmin && platformAnalytics && (
          <section className="grid gap-4 md:grid-cols-2">
            <Card className="border-border">
              <CardHeader>
                <CardTitle>Admin insights</CardTitle>
                <CardDescription>Platform verification queue.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-muted-foreground">
                <p>{platformAnalytics.pendingBusinesses} new businesses awaiting verification.</p>
                <p>{platformAnalytics.flaggedPromotions} promotions flagged for review.</p>
                <Button variant="outline" asChild><Link to="/operations-console">Open moderation console</Link></Button>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardHeader>
                <CardTitle>Compliance status</CardTitle>
                <CardDescription>Trust & safety metrics.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-muted-foreground">
                <p>Platform trust score: {platformAnalytics.platformTrustScore}%</p>
                <p>Reports resolved: {platformAnalytics.resolvedReports}</p>
              </CardContent>
            </Card>
          </section>
        )}

         {isAdmin && (
          <section>
            <Card className="border-border">
              <CardHeader>
                <CardTitle>Submitted promotions</CardTitle>
                <CardDescription>Newest promotions awaiting admin review.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {submittedPromotions.length === 0 && (
                  <p className="text-sm text-muted-foreground">No submitted promotions at the moment.</p>
                )}
                {submittedPromotions.slice(0, 5).map((promotion) => (
                  <div key={promotion.id} className="rounded-lg border border-border p-4">
                    <p className="font-semibold">{promotion.title}</p>
                    <p className="text-sm text-muted-foreground">Submitted by business #{promotion.businessId}.</p>
                    <Badge variant="outline" className="mt-2">{getPromotionVerificationStatus(promotion)}</Badge>
                  </div>
                ))}
                <Button variant="outline" asChild>
                  <Link to="/operations-console">Review all submissions</Link>
                </Button>
              </CardContent>
            </Card>
          </section>
        )}

      </main>
    </div>
  );
};

export default Dashboard;
