import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ShieldCheck, Calendar, MapPin, AlertCircle, Share2, Flag } from "lucide-react";
import { motion } from "framer-motion";
import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { api, type Promotion } from "@/lib/api";
import { formatDate, formatDiscount } from "@/lib/format";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/lib/auth";
import { landingPromotions } from "@/data/landing";

const reportReasonOptions = [
  { value: "SCAM_SUSPECTED", label: "Scam suspected" },
  { value: "MISLEADING_INFORMATION", label: "Misleading information" },
  { value: "EXPIRED_PROMOTION", label: "Expired promotion" },
  { value: "REDEMPTION_PROBLEM", label: "Redemption problem" },
  { value: "OFFENSIVE_CONTENT", label: "Offensive content" },
  { value: "OTHER", label: "Other" },
];

const normalizeDiscountType = (type?: string) => {
  if (!type) {
    return "";
  }

  return type.trim().toLowerCase().replace(/[\s-]+/g, "_");
};

const formatAmount = (value?: number) => {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return "";
  }

  const formattedValue = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);

  return `$${formattedValue}`;
};

const formatRedemptionChannel = (channel?: string) => {
  const normalized = channel?.trim().toUpperCase().replace(/[\s-]+/g, "_");

  switch (normalized) {
    case "ONLINE":
      return "Online only";
    case "IN_STORE":
    case "INSTORE":
      return "In-store only";
    case "BOTH":
      return "Online and in-store";
    default:
      return channel || "Check with the business before redeeming.";
  }
};

const getSavingsDetails = (promotion: Promotion) => {
  if (promotion.originalPrice === undefined || promotion.originalPrice === null) {
    return { savingsValue: undefined, finalPriceValue: undefined };
  }

  const normalizedDiscountType = normalizeDiscountType(promotion.discountType);

  if (normalizedDiscountType.includes("percent")) {
    const savingsValue = (promotion.originalPrice * promotion.discountValue) / 100;
    return {
      savingsValue,
      finalPriceValue: Math.max(promotion.originalPrice - savingsValue, 0),
    };
  }

  if (
    normalizedDiscountType.includes("amount")
    || normalizedDiscountType.includes("flat")
    || normalizedDiscountType.includes("fixed")
  ) {
    const savingsValue = Math.min(promotion.discountValue, promotion.originalPrice);
    return {
      savingsValue,
      finalPriceValue: Math.max(promotion.originalPrice - savingsValue, 0),
    };
  }

  if (normalizedDiscountType.includes("free")) {
    return {
      savingsValue: promotion.originalPrice,
      finalPriceValue: 0,
    };
  }

  return { savingsValue: undefined, finalPriceValue: undefined };
};

const isNotFoundPromotionError = (message: string) => {
  const normalizedMessage = message.toLowerCase();
  return normalizedMessage.includes("not found") || normalizedMessage.includes("404");
};

const PromotionDetail = () => {
  const { id } = useParams();
  const { isAuthenticated, user } = useAuth();
  const [promotion, setPromotion] = useState<Promotion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadPromotion = async () => {
      if (!id) {
        setIsLoading(false);
        return;
      }

      const fallbackPromotion = landingPromotions.find((item) => item.id.toString() === id);
      if (isMounted && fallbackPromotion) {
        setPromotion((currentPromotion) => currentPromotion ?? fallbackPromotion);
      }

      try {
        const data = await api.getPromotion(id);
        if (isMounted) {
          setPromotion(data);
        }
      } catch (error) {
        if (!fallbackPromotion) {
          const message = error instanceof Error ? error.message : "Unable to load promotion.";
          toast.warning(message);
        }
      }

      try {
        await api.trackPromotionView(id);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to log promotion view.";
        if (!isNotFoundPromotionError(message)) {
          toast.info(message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadPromotion();

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (!promotion) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-3xl font-bold text-foreground mb-4">Promotion not found</h1>
          <p className="text-muted-foreground mb-6">
            {isLoading ? "Loading promotion details..." : "The promotion you are looking for is not available."}
          </p>
          <Button asChild>
            <Link to="/browse">Back to promotions</Link>
          </Button>
        </div>
      </div>
    );
  }

  const discountLabel = formatDiscount(promotion.discountType, promotion.discountValue);
  const terms = promotion.termsAndConditions
    ? promotion.termsAndConditions.split(/\n+/).map((term) => term.trim()).filter(Boolean)
    : [];
  const isVerified = ["APPROVED", "ACTIVE"].includes(promotion.status);
  const redemptionChannelValue = promotion.redemptionChannel?.trim();
  const redemptionChannelLabel = redemptionChannelValue
    ? formatRedemptionChannel(redemptionChannelValue)
    : "";
  const supportContact = promotion.supportContact?.trim();
  const redemptionInstructions = promotion.redemptionInstructions?.trim();
  const hasRedemptionInfo = Boolean(redemptionChannelLabel || supportContact || redemptionInstructions);
  const { savingsValue, finalPriceValue } = getSavingsDetails(promotion);
  const hasRedemptionLimits =
    promotion.maxRedemptions !== undefined || promotion.perCustomerLimit !== undefined;
  const showHeroImage = Boolean(promotion.imageUrl?.trim());

  const handleShare = async () => {
    try {
      await navigator.share?.({
        title: promotion.title,
        text: promotion.description,
        url: window.location.href,
      });
    } catch {
      toast.info("Sharing is not supported in this browser.");
    }
  };

  const handleReport = () => {
    if (!isAuthenticated) {
      toast.info("Please sign in to report promotions.");
      return;
    }

    if (user?.role === "BUSINESS_OWNER") {
      toast.info("Business owner accounts cannot submit promotion reports.");
      return;
    }

    setIsReportDialogOpen(true);
  };

  const submitReport = async () => {
    const normalizedReason = reportReason.trim();
    const normalizedDetails = reportDetails.trim();

    if (!normalizedReason) {
      toast.error("Please select the reason for reporting this promotion.");
      return;
    }

    setIsSubmittingReport(true);

    try {
      await api.reportPromotion({
        promotionId: promotion.id,
        reason: normalizedReason,
        details: normalizedDetails || undefined,
      });
      setReportReason("");
      setReportDetails("");
      setIsReportDialogOpen(false);
      toast.success("Thanks for reporting. Our team will review this promotion.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to submit report.";
      toast.error(message);
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const handleSave = async () => {
    if (!isAuthenticated) {
      toast.info("Please sign in to save promotions.");
      return;
    }

    try {
      await api.savePromotion(promotion.id);
      toast.success("Promotion saved to your list.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save promotion.";
      toast.error(message);
    }
  };

  const handleRedeem = async () => {
    try {
      await api.trackPromotionClick(promotion.id);
      await api.trackPromotionRedeem(promotion.id);
      toast.success("Great! We logged your click and redemption intent for this promotion.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to log engagement.";
      if (isNotFoundPromotionError(message)) {
        return;
      }
      toast.error(message);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report this promotion</DialogTitle>
            <DialogDescription>
              Tell the moderation team what looks suspicious so they can investigate this promotion.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="report-reason">Reason</Label>
              <Select value={reportReason} onValueChange={setReportReason}>
                <SelectTrigger id="report-reason">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {reportReasonOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="report-details">Additional details</Label>
              <Textarea
                id="report-details"
                value={reportDetails}
                onChange={(event) => setReportDetails(event.target.value)}
                placeholder="Add context such as pricing mismatch, suspicious wording, or what happened when you tried to redeem it."
                rows={5}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsReportDialogOpen(false)}
              disabled={isSubmittingReport}
            >
              Cancel
            </Button>
            <Button onClick={() => void submitReport()} disabled={isSubmittingReport}>
              {isSubmittingReport ? "Submitting..." : "Submit report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-6 text-sm text-muted-foreground"
        >
          <Link to="/" className="hover:text-foreground">Home</Link>
          {" / "}
          <Link to="/browse" className="hover:text-foreground">Browse</Link>
          {" / "}
          <span className="text-foreground">{promotion.title}</span>
        </motion.div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="relative mb-6 h-96 overflow-hidden rounded-lg bg-gradient-to-br from-primary/10 via-background to-accent/10">
                {showHeroImage && (
                  <img
                    src={promotion.imageUrl}
                    alt={promotion.title}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                )}

                <div
                  className={`absolute inset-0 ${
                    showHeroImage
                      ? "bg-gradient-to-t from-background/95 via-background/70 to-background/10"
                      : "bg-gradient-to-br from-primary/10 via-background to-accent/10"
                  }`}
                />

                <div className="relative flex h-full flex-col justify-end p-8">
                  <h1 className="max-w-3xl text-3xl font-bold text-foreground md:text-4xl">
                    {promotion.title}
                  </h1>
                </div>

                {isVerified && (
                  <div className="absolute right-4 top-4">
                    <Badge className="bg-verified text-verified-foreground flex items-center gap-1 text-base px-3 py-1">
                      <ShieldCheck className="h-4 w-4" />
                      Verified Business
                    </Badge>
                  </div>
                )}
              </div>

              <Card className="mb-6 p-6">
                <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="mb-1 text-2xl font-bold text-foreground">{promotion.businessName}</h2>
                    <p className="text-sm text-muted-foreground">
                      This promotion is offered by the business listed below.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={handleShare}>
                      <Share2 className="mr-2 h-4 w-4" />
                      Share
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleReport}>
                      <Flag className="mr-2 h-4 w-4" />
                      Report
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 text-sm sm:grid-cols-2">
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Category
                    </p>
                    <p className="mt-2 font-medium text-foreground">{promotion.categoryName}</p>
                  </div>

                  <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Location
                    </p>
                    <p className="mt-2 flex items-center gap-2 font-medium text-foreground">
                      <MapPin className="h-4 w-4 text-primary" />
                      {promotion.location || "Location not provided"}
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="mb-6 p-6">
                <h3 className="mb-4 text-xl font-semibold">About This Promotion</h3>
                <p className="leading-relaxed text-muted-foreground">{promotion.description}</p>

                {(promotion.eligibilityCriteria || promotion.excludedItems) && (
                  <div className="mt-6 grid gap-4 border-t pt-6 md:grid-cols-2">
                    {promotion.eligibilityCriteria && (
                      <div className="rounded-lg border bg-muted/30 p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Eligibility
                        </p>
                        <p className="mt-2 text-sm text-foreground">
                          {promotion.eligibilityCriteria}
                        </p>
                      </div>
                    )}

                    {promotion.excludedItems && (
                      <div className="rounded-lg border bg-muted/30 p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Exclusions
                        </p>
                        <p className="mt-2 text-sm text-foreground">
                          {promotion.excludedItems}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </Card>

              <Card className="mb-6 p-6">
                <h3 className="mb-4 text-xl font-semibold">How To Redeem</h3>

                {hasRedemptionInfo ? (
                  <>
                    {(redemptionChannelLabel || supportContact) && (
                      <div className="grid gap-4 md:grid-cols-2">
                        {redemptionChannelLabel && (
                          <div className="rounded-lg border bg-muted/30 p-4">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Redemption Channel
                            </p>
                            <p className="mt-2 text-sm font-medium text-foreground">{redemptionChannelLabel}</p>
                          </div>
                        )}

                        {supportContact && (
                          <div className="rounded-lg border bg-muted/30 p-4">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Support Contact
                            </p>
                            <p className="mt-2 text-sm font-medium text-foreground">
                              {supportContact}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {redemptionInstructions && (
                      <div className="mt-6">
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Instructions
                        </p>
                        <p className="leading-relaxed text-muted-foreground">
                          {redemptionInstructions}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Redemption details are not available for this promotion yet.
                  </p>
                )}

                {promotion.referenceUrl && (
                  <div className="mt-6">
                    <Button asChild variant="outline">
                      <a href={promotion.referenceUrl} target="_blank" rel="noreferrer">
                        View Official Offer Page
                      </a>
                    </Button>
                  </div>
                )}
              </Card>

              <Card className="p-6">
                <h3 className="mb-4 text-xl font-semibold">Terms & Conditions</h3>
                {terms.length > 0 ? (
                  <ul className="space-y-2">
                    {terms.map((term, index) => (
                      <li key={index} className="flex items-start gap-2 text-muted-foreground">
                        <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                        <span>{term}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">No additional terms provided.</p>
                )}
              </Card>
            </motion.div>
          </div>

          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="sticky top-24 space-y-6"
            >
              <Card className="p-6">
                <div className="mb-5">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Deal Snapshot
                  </p>
                  <div className="text-4xl font-bold text-primary">
                    {discountLabel || "Special offer"}
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  {promotion.promoCode && (
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Promo code</span>
                      <span className="rounded-md bg-muted px-2 py-1 font-mono text-foreground">
                        {promotion.promoCode}
                      </span>
                    </div>
                  )}

                  {promotion.originalPrice !== undefined && (
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Original price</span>
                      <span className="font-medium text-foreground">{formatAmount(promotion.originalPrice)}</span>
                    </div>
                  )}

                  {savingsValue !== undefined && (
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">You save</span>
                      <span className="font-medium text-foreground">{formatAmount(savingsValue)}</span>
                    </div>
                  )}

                  {finalPriceValue !== undefined && (
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Estimated final price</span>
                      <span className="font-semibold text-foreground">{formatAmount(finalPriceValue)}</span>
                    </div>
                  )}
                </div>

                <Button className="mt-5 w-full" size="lg" onClick={handleRedeem}>
                  Get This Deal
                </Button>
                <Button className="mt-3 w-full" variant="outline" onClick={handleSave}>
                  Save Promotion
                </Button>
              </Card>

              <Card className="p-6">
                <h4 className="mb-3 flex items-center gap-2 font-semibold">
                  <Calendar className="h-4 w-4 text-primary" />
                  Validity Period
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Starts:</span>
                    <span className="font-medium">{formatDate(promotion.startDate)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Ends:</span>
                    <span className="font-medium">{formatDate(promotion.endDate)}</span>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <h4 className="mb-3 font-semibold">Redemption Limits</h4>
                {hasRedemptionLimits ? (
                  <div className="space-y-2 text-sm">
                    {promotion.maxRedemptions !== undefined && (
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Total redemptions:</span>
                        <span className="font-medium">{promotion.maxRedemptions}</span>
                      </div>
                    )}
                    {promotion.perCustomerLimit !== undefined && (
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Per customer:</span>
                        <span className="font-medium">{promotion.perCustomerLimit}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No customer-specific redemption limits were provided for this promotion.
                  </p>
                )}
              </Card>

              <Card className={`p-6 ${isVerified ? "border-verified/20 bg-verified/5" : "bg-muted/50"}`}>
                <div className="space-y-4">
                  {isVerified && (
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="mt-0.5 h-6 w-6 flex-shrink-0 text-verified" />
                      <div>
                        <h4 className="mb-1 font-semibold text-verified">Verified Business</h4>
                        <p className="text-sm text-muted-foreground">
                          This promotion is from a verified business. All documents have been reviewed by our team.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground" />
                    <div>
                      <h4 className="mb-1 text-sm font-semibold">Stay Safe</h4>
                      <p className="text-xs text-muted-foreground">
                        Always verify the promotion in-store and report suspicious activity if any detail looks incorrect.
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromotionDetail;
