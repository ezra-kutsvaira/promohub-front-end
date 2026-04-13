import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { formatDate, formatDiscount } from "@/lib/format";
import { ArrowUpRight, BookmarkCheck, CalendarCheck, MapPin, Megaphone, Sparkles, Store, Users } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import { useEffect, useMemo, useState } from "react";
import { api, type Business, type BusinessVerificationReview, type PageResponse, type PlatformAnalytics, type Promotion, type SavedPromotion } from "@/lib/api";
import {
  formatNotificationTimestamp,
  getNotificationEventLabel,
  getNotificationTargetPath,
  isExternalNotificationTarget,
} from "@/lib/notification-utils";
import { useNotifications } from "@/lib/notifications";
import {
  getPromotionVerificationStatus,
  isApprovedPromotion,
  isPendingPromotion,
  isRejectedPromotion,
} from "@/lib/promotionStatus";

const PENDING_BUSINESS_STATUSES = new Set([
  "PENDING",
  "IN_REVIEW",
  "SUBMITTED",
  "AWAITING_REVIEW",
  "AWAITING_APPROVAL",
  "UNDER_REVIEW",
  "REVIEW_PENDING",
  "QUEUED",
  "REQUESTED",
  "NEW",
  "MORE_DOCUMENTS_REQUESTED",
  "ADDITIONAL_DOCUMENTS_REQUIRED",
]);


const FINAL_BUSINESS_STATUSES = new Set(["APPROVED", "VERIFIED", "REJECTED", "DECLINED"]);

const getStartOfToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const parseDateOnly = (value: string) => new Date(`${value}T00:00:00`);

const shouldCountBusinessInVerificationQueue = (business: Business, review: BusinessVerificationReview | null) => {
  const normalizedStatus = String(review?.status ?? business.businessVerificationStatus ?? "").toUpperCase();

  if (PENDING_BUSINESS_STATUSES.has(normalizedStatus)) {
    return true;
  }

  if (FINAL_BUSINESS_STATUSES.has(normalizedStatus)) {
    return false;
  }

  return !business.verified;
};

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

const getPromotionRejectionReason = (promotion: Promotion): string => {
  const candidateValues = [
    promotion.rejectionReason,
    promotion.verificationNotes,
    (promotion as Promotion & { reason?: string }).reason,
    (promotion as Promotion & { note?: string }).note,
    (promotion as Promotion & { message?: string }).message,
    (promotion as Promotion & { rejection_note?: string }).rejection_note,
    (promotion as Promotion & { rejection_reason?: string }).rejection_reason,
  ];

  const resolvedReason = candidateValues.find(
    (value) => typeof value === "string" && value.trim().length > 0
  );

  return resolvedReason?.trim() ?? "No reason provided.";
}

const getPromotionVerificationNote = (promotion: Promotion): string | null => {
  const normalizedNote = promotion.verificationNotes?.trim();

  if (!normalizedNote) {
    return null;
  }

  const rejectionReason = getPromotionRejectionReason(promotion);
  return normalizedNote === rejectionReason ? null : normalizedNote;
};

const getBusinessPromotionStatusSummary = (promotion: Promotion): string => {
  const status = getPromotionVerificationStatus(promotion);

  if (status === "PENDING") {
    return promotion.flagged
      ? "Under admin review and currently flagged for additional checks."
      : "Awaiting admin approval.";
  }

  if (status === "APPROVED") {
    return promotion.flagged
      ? "Approved, but still flagged for admin follow-up after a report."
      : "Approved promotions are visible to customers during their active date range.";
  }

  return "Rejected after moderation review.";
};

const getFlaggedPromotionSummary = (promotion: Promotion): string | null => {
  if (!promotion.flagged) {
    return null;
  }

  const status = getPromotionVerificationStatus(promotion);

  if (status === "PENDING") {
    return "This flagged promotion stays visible to admins while they investigate the report.";
  }

  if (status === "APPROVED") {
    return "This promotion is still flagged, so admins can continue monitoring it even while it is approved.";
  }

  if (status === "REJECTED") {
    return "This promotion remains part of the flagged moderation record for audit history.";
  }

  return "This promotion is currently flagged for moderation follow-up.";
};

const PromotionModerationCard = ({
  promotion,
  reason,
  isSubmitting,
  onReasonChange,
  onApprove,
  onReject,
}: {
  promotion: Promotion;
  reason: string;
  isSubmitting: boolean;
  onReasonChange: (reason: string) => void;
  onApprove: () => void;
  onReject: () => void;
}) => {
  const discountLabel = formatDiscount(promotion.discountType, promotion.discountValue);
  const terms = promotion.termsAndConditions
    ? promotion.termsAndConditions.split(/\n+/).map((term) => term.trim()).filter(Boolean)
    : [];

  return (
    <Card className="border-border">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{getPromotionVerificationStatus(promotion)}</Badge>
          {promotion.flagged && <Badge variant="destructive">Flagged</Badge>}
          {typeof promotion.riskScore === "number" && <Badge variant="secondary">Risk {promotion.riskScore}</Badge>}
          <Badge variant="secondary">{promotion.categoryName}</Badge>
          <Badge className="ml-auto">{discountLabel}</Badge>
        </div>
        <div>
          <CardTitle className="text-xl">{promotion.title}</CardTitle>
          <CardDescription className="mt-1">Submitted by {promotion.businessName || `business #${promotion.businessId}`}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{promotion.description}</p>
        {promotion.flagged && (
          <p className="text-sm text-muted-foreground">
            This promotion is still flagged, so it remains visible for moderator follow-up even if the report is already closed.
          </p>
        )}

        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <MapPin className="h-4 w-4" />
            {promotion.location}
          </div>
          <div>
            {formatDate(promotion.startDate)} - {formatDate(promotion.endDate)}
          </div>
          <div>Promo code: {promotion.promoCode}</div>
        </div>

        <div>
          <p className="text-sm font-medium">Terms & conditions</p>
          {terms.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {terms.map((term, index) => (
                <li key={`${promotion.id}-term-${index}`} className="text-sm text-muted-foreground">
                  • {term}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No additional terms provided.</p>
          )}
        </div>

        <Textarea
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          placeholder="If rejecting, provide the reason shown to the business owner."
          rows={3}
          disabled={isSubmitting}
        />

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={onApprove} disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Approve"}
          </Button>
          <Button size="sm" variant="destructive" onClick={onReject} disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Reject"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const Dashboard = () => {
  const { user } = useAuth();
  const { notifications, unreadCount, markRead } = useNotifications();
  const [savedPromotions, setSavedPromotions] = useState<SavedPromotion[]>([]);
  const [savedPromotionDetails, setSavedPromotionDetails] = useState<Promotion[]>([]);
  const [platformAnalytics, setPlatformAnalytics] = useState<PlatformAnalytics | null>(null);
  const [pendingPromotionsCount, setPendingPromotionsCount] = useState(0);
  const [businessPromotions, setBusinessPromotions] = useState<Promotion[]>([]);
  const [businessSetupRequired, setBusinessSetupRequired] = useState(false);
  const [adminPendingPromotions, setAdminPendingPromotions] = useState<Promotion[]>([]);
  const [adminApprovedPromotions, setAdminApprovedPromotions] = useState<Promotion[]>([]);
  const [adminRejectedPromotions, setAdminRejectedPromotions] = useState<Promotion[]>([]);
  const [moderationReasonByPromotionId, setModerationReasonByPromotionId] = useState<Record<number, string>>({});
  const [promotionActionId, setPromotionActionId] = useState<number | null>(null);
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
          let business: Business | null = null;

          try {
            business = await api.getCurrentUserBusiness(user.id);
          } catch (error) {
            if (!isMounted) return;

            const message = error instanceof Error ? error.message.toLowerCase() : "";
            const missingBusinessProfile =
              message.includes("no business profile") ||
              message.includes("no business") ||
              message.includes("not found") ||
              message.includes("404");

            if (missingBusinessProfile) {
              setBusinessSetupRequired(true);
              setBusinessPromotions([]);
              setPendingPromotionsCount(0);
              return;
            }

            throw error;
          }

          if (!isMounted) return;
          if (!business) return;
          setBusinessSetupRequired(false);
          const allBusinessPromotions = await api.getCurrentUserBusinessPromotions(business.id, user.id);
          if (!isMounted) return;

          
          setBusinessPromotions(allBusinessPromotions);
          setPendingPromotionsCount(
            allBusinessPromotions.filter((promotion) => getPromotionVerificationStatus(promotion) === "PENDING").length
          );
        
        } else if (!isAdmin) {
          setBusinessSetupRequired(false);
          const saved = await api.getSavedPromotions();
          if (!isMounted) return;
          setSavedPromotions(saved);

          const details = await Promise.all(
            saved.map((item) => api.getPromotion(item.promotionId).catch(() => null))
          );
          if (!isMounted) return;
          setSavedPromotionDetails(details.filter(Boolean) as Promotion[]);
        }

        if (isAdmin) {
          const [pendingPromotions, approvedPromotions, rejectedPromotions, analytics, adminBusinesses] = await Promise.all([
            api.getAdminPromotionsByStatus("PENDING", user.id),
            api.getAdminPromotionsByStatus("APPROVED", user.id),
            api.getAdminPromotionsByStatus("REJECTED", user.id),
            api.getPlatformAnalytics(),
            api.getAdminBusinesses().catch(() => []),
          ]);
          if (!isMounted) return;
          setAdminPendingPromotions(pendingPromotions);
          setAdminApprovedPromotions(approvedPromotions);
          setAdminRejectedPromotions(rejectedPromotions);
          const reviewResults = await Promise.all(
            adminBusinesses.map(async (business) => ({
              business,
              review: await api.getBusinessVerification(business.id).catch(() => null),
            }))
          );

          const derivedPendingBusinesses = reviewResults.filter(({ business, review }) =>
            shouldCountBusinessInVerificationQueue(business, review)
          ).length;

          setPlatformAnalytics({
            ...analytics,
            pendingBusinesses: derivedPendingBusinesses,
          });
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
    const today = getStartOfToday();
    const cutoff = new Date(today);
    cutoff.setDate(today.getDate() + 7);
    return savedPromotionDetails.filter((promotion) => {
      const endDate = parseDateOnly(promotion.endDate);
      return endDate >= today && endDate <= cutoff;
    }).length;
  }, [savedPromotionDetails]);

  const locationState = (location.state as { createdPromotion?: Promotion; resubmittedPromotion?: Promotion } | null);
  const createdPromotion = locationState?.createdPromotion;
  const resubmittedPromotion = locationState?.resubmittedPromotion;
  const promotionsWithNewlyCreated = useMemo(() => {
    const nextPromotions = [...businessPromotions];

    if (createdPromotion && !nextPromotions.some((item) => item.id === createdPromotion.id)) {
      nextPromotions.unshift(createdPromotion);
    }

    if (resubmittedPromotion) {
      const existingIndex = nextPromotions.findIndex((item) => item.id === resubmittedPromotion.id);
      if (existingIndex >= 0) {
        nextPromotions[existingIndex] = { ...nextPromotions[existingIndex], ...resubmittedPromotion };
      } else {
        nextPromotions.unshift(resubmittedPromotion);
      }
    }

    return nextPromotions;
  }, [businessPromotions, createdPromotion, resubmittedPromotion]);

  const pendingPromotions = promotionsWithNewlyCreated.filter(isPendingPromotion);
  const approvedPromotions = promotionsWithNewlyCreated.filter(isApprovedPromotion);
  const rejectedPromotions = promotionsWithNewlyCreated.filter(isRejectedPromotion);
  const recentNotifications = notifications.slice(0, 4);

  const isSubmittingPromotionAction = (promotionId: number) => promotionActionId === promotionId;

  const handleApprovePromotion = async (promotion: Promotion) => {
    setPromotionActionId(promotion.id);

    try {
      await api.approvePromotion(promotion.id);
      setAdminPendingPromotions((current) => current.filter((item) => item.id !== promotion.id));
      setAdminRejectedPromotions((current) => current.filter((item) => item.id !== promotion.id));
      setAdminApprovedPromotions((current) => [
        {
          ...promotion,
          verificationStatus: "APPROVED",
          status: "APPROVED",
          rejectionReason: undefined,
        },
        ...current,
      ]);
      toast.success(`Promotion "${promotion.title}" was approved and is now live.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to approve promotion.";
      toast.error(message);
    } finally {
      setPromotionActionId(null);
    }
  };

  const handleRejectPromotion = async (promotion: Promotion) => {
    const reason = moderationReasonByPromotionId[promotion.id]?.trim();

    if (!reason) {
      toast.error("Please add a rejection reason before rejecting this promotion.");
      return;
    }

    setPromotionActionId(promotion.id);

    try {
      await api.rejectPromotion(promotion.id, reason);
      setAdminPendingPromotions((current) => current.filter((item) => item.id !== promotion.id));
      setAdminApprovedPromotions((current) => current.filter((item) => item.id !== promotion.id));
      setAdminRejectedPromotions((current) => [
        {
          ...promotion,
          verificationStatus: "REJECTED",
          status: "REJECTED",
          rejectionReason: reason,
        },
        ...current,
      ]);
      setModerationReasonByPromotionId((current) => ({ ...current, [promotion.id]: "" }));
      toast.success(`Promotion "${promotion.title}" was rejected.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to reject promotion.";
      toast.error(message);
    } finally {
      setPromotionActionId(null);
    }
  };

  const handleNotificationOpen = async (notificationId: number, isRead: boolean) => {
    if (isRead) {
      return;
    }

    try {
      await markRead(notificationId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update that notification.";
      toast.error(message);
    }
  };

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
                {isBusiness ? pendingPromotionsCount : isAdmin ? adminPendingPromotions.length : savedPromotions.length}
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
              <CardDescription>Unread notification updates.</CardDescription>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">
              {unreadCount}
            </CardContent>
          </Card>
        </section>

        {isBusiness && (
          businessSetupRequired ? (
            <section>
              <Card className="border-border">
                <CardHeader>
                  <CardTitle>Complete your business owner account</CardTitle>
                  <CardDescription>
                    Your account has business-owner access, but you still need to submit the
                    business details and documents required for admin approval.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-4">
                    <Store className="mt-0.5 h-5 w-5 text-primary" />
                    <p className="max-w-2xl text-sm text-muted-foreground">
                      Finish the onboarding form so admins can review your business owner account and
                      unlock the full promotion workflow.
                    </p>
                  </div>
                  <Button asChild>
                    <Link to="/create-business-owner-account">Complete setup</Link>
                  </Button>
                </CardContent>
              </Card>
            </section>
          ) : (
          <section>
            <Card className="border-border">
              <CardHeader>
                <CardTitle>Posted promotions</CardTitle>
                <CardDescription>Track approvals, rejection reasons, and flagged follow-up from admin reviews.</CardDescription>
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
                        <p className="text-sm text-muted-foreground">{getBusinessPromotionStatusSummary(promotion)}</p>
                        {getFlaggedPromotionSummary(promotion) && (
                          <p className="mt-2 text-sm text-muted-foreground">{getFlaggedPromotionSummary(promotion)}</p>
                        )}
                        {getPromotionVerificationNote(promotion) && (
                          <p className="mt-2 text-sm text-muted-foreground">
                            Moderator note: {getPromotionVerificationNote(promotion)}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge variant="outline">PENDING</Badge>
                          {promotion.flagged && <Badge variant="destructive">FLAGGED</Badge>}
                        </div>
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
                        <p className="text-sm text-muted-foreground">{getBusinessPromotionStatusSummary(promotion)}</p>
                        {getFlaggedPromotionSummary(promotion) && (
                          <p className="mt-2 text-sm text-muted-foreground">{getFlaggedPromotionSummary(promotion)}</p>
                        )}
                        {getPromotionVerificationNote(promotion) && (
                          <p className="mt-2 text-sm text-muted-foreground">
                            Moderator note: {getPromotionVerificationNote(promotion)}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge>{getPromotionVerificationStatus(promotion)}</Badge>
                          {promotion.flagged && <Badge variant="destructive">FLAGGED</Badge>}
                        </div>
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
                        <p className="text-sm text-muted-foreground">{getBusinessPromotionStatusSummary(promotion)}</p>
                        <p className="mt-2 text-sm text-muted-foreground">Reason: {getPromotionRejectionReason(promotion)}</p>
                        {getFlaggedPromotionSummary(promotion) && (
                          <p className="mt-2 text-sm text-muted-foreground">{getFlaggedPromotionSummary(promotion)}</p>
                        )}
                        {getPromotionVerificationNote(promotion) && (
                          <p className="mt-2 text-sm text-muted-foreground">
                            Moderator note: {getPromotionVerificationNote(promotion)}
                          </p>
                        )}
                        <Button size="sm" variant="outline" className="mt-3" asChild>
                          <Link to={`/promotions/${promotion.id}/edit`}>Edit & re-submit</Link>
                        </Button>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge variant="destructive">REJECTED</Badge>
                          {promotion.flagged && <Badge variant="destructive">FLAGGED</Badge>}
                        </div>
                      </div>
                    ))}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </section>
          )
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
                <Button variant="outline" className="ml-auto" asChild>
                  <Link to="/account-settings?section=notifications">Manage reminders</Link>
                </Button>
              </div>
              {!isBusiness && !isAdmin && (
                <div className="flex items-start gap-4 rounded-lg border border-border p-4">
                  <Store className="h-5 w-5 text-primary" />
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">Create Business Owner Account</p>
                    <p className="text-sm text-muted-foreground">
                      Use this login to submit your business details and required verification documents.
                    </p>
                  </div>
                  <Button variant="outline" className="ml-auto" asChild>
                    <Link to="/create-business-owner-account">Start application</Link>
                  </Button>
                </div>
              )}
              {isBusiness && !businessSetupRequired && (
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
                  <div className="flex items-start gap-3">
                    <Store className="mt-0.5 h-4 w-4 text-primary" />
                    <span>Create a business owner account when you are ready to submit a business for review.</span>
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

        <section>
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Recent notifications</CardTitle>
              <CardDescription>
                Approval queues, saved-promotion reminders, moderation decisions, and account activity.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentNotifications.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No notifications yet. New reminders, approvals, and review events will appear here.
                </p>
              )}

              {recentNotifications.map((notification) => {
                const targetPath = getNotificationTargetPath(notification);
                const isExternalTarget = isExternalNotificationTarget(targetPath);

                return (
                  <div key={notification.id} className="rounded-lg border border-border p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={notification.read ? "secondary" : "default"}>
                        {getNotificationEventLabel(notification.eventType)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatNotificationTimestamp(notification.createdAt)}
                      </span>
                    </div>
                    <p className="mt-3 font-semibold text-foreground">{notification.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{notification.message}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {isExternalTarget ? (
                        <Button size="sm" variant={notification.read ? "outline" : "default"} asChild>
                          <a
                            href={targetPath}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => {
                              void handleNotificationOpen(notification.id, notification.read);
                            }}
                          >
                            Open update
                            <ArrowUpRight className="ml-2 h-4 w-4" />
                          </a>
                        </Button>
                      ) : (
                        <Button size="sm" variant={notification.read ? "outline" : "default"} asChild>
                          <Link
                            to={targetPath}
                            onClick={() => {
                              void handleNotificationOpen(notification.id, notification.read);
                            }}
                          >
                            Open update
                            <ArrowUpRight className="ml-2 h-4 w-4" />
                          </Link>
                        </Button>
                      )}
                      {!notification.read && <Badge variant="outline">Unread</Badge>}
                    </div>
                  </div>
                );
              })}
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
                <CardTitle>Promotion moderation queue</CardTitle>
                <CardDescription>Review promotions by verification status.</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="pending" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="pending">Pending ({adminPendingPromotions.length})</TabsTrigger>
                    <TabsTrigger value="approved">Approved ({adminApprovedPromotions.length})</TabsTrigger>
                    <TabsTrigger value="rejected">Rejected ({adminRejectedPromotions.length})</TabsTrigger>
                  </TabsList>
                  <TabsContent value="pending" className="space-y-3">
                    {adminPendingPromotions.length === 0 && (
                      <p className="text-sm text-muted-foreground">No pending promotions at the moment.</p>
                    )}
                    {adminPendingPromotions.slice(0, 5).map((promotion) => (
                      <PromotionModerationCard
                        key={promotion.id}
                        promotion={promotion}
                        reason={moderationReasonByPromotionId[promotion.id] ?? ""}
                        isSubmitting={isSubmittingPromotionAction(promotion.id)}
                        onReasonChange={(reason) =>
                          setModerationReasonByPromotionId((current) => ({
                            ...current,
                            [promotion.id]: reason,
                          }))
                        }
                        onApprove={() => handleApprovePromotion(promotion)}
                        onReject={() => handleRejectPromotion(promotion)}
                      />
                    ))}
                  </TabsContent>
                  <TabsContent value="approved" className="space-y-3">
                    {adminApprovedPromotions.length === 0 && (
                      <p className="text-sm text-muted-foreground">No approved promotions found.</p>
                    )}
                    {adminApprovedPromotions.slice(0, 5).map((promotion) => (
                      <div key={promotion.id} className="rounded-lg border border-border p-4">
                        <p className="font-semibold">{promotion.title}</p>
                        <p className="text-sm text-muted-foreground">Approved for business #{promotion.businessId}.</p>
                        {promotion.flagged && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            Still flagged, so moderators can continue to track it after the report is closed.
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge>{getPromotionVerificationStatus(promotion)}</Badge>
                          {promotion.flagged && <Badge variant="destructive">FLAGGED</Badge>}
                        </div>
                      </div>
                    ))}
                  </TabsContent>
                  <TabsContent value="rejected" className="space-y-3">
                    {adminRejectedPromotions.length === 0 && (
                      <p className="text-sm text-muted-foreground">No rejected promotions found.</p>
                    )}
                    {adminRejectedPromotions.slice(0, 5).map((promotion) => (
                      <div key={promotion.id} className="rounded-lg border border-border p-4">
                        <p className="font-semibold">{promotion.title}</p>
                        <p className="text-sm text-muted-foreground">Rejected for business #{promotion.businessId}.</p>
                        <p className="mt-1 text-sm text-muted-foreground">Reason: {getPromotionRejectionReason(promotion)}</p>
                        {promotion.flagged && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            This promotion is still marked as flagged in the moderation record.
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge variant="destructive">{getPromotionVerificationStatus(promotion)}</Badge>
                          {promotion.flagged && <Badge variant="destructive">FLAGGED</Badge>}
                        </div>
                      </div>
                    ))}
                  </TabsContent>
                </Tabs>
                <Button variant="outline" className="mt-4" asChild>
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
