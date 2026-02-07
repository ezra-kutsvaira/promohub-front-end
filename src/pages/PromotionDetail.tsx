import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ShieldCheck, Calendar, MapPin, AlertCircle, Share2, Flag } from "lucide-react";
import { motion } from "framer-motion";
import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { api, type Promotion } from "@/lib/api";
import { formatDate, formatDiscount } from "@/lib/format";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/lib/auth";
import { landingPromotions } from "@/data/landing";

const PromotionDetail = () => {
  const { id } = useParams();
  const { isAuthenticated } = useAuth();
  const [promotion, setPromotion] = useState<Promotion | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadPromotion = async () => {
      if (!id) {
        return;
      }
      try {
        const data = await api.getPromotion(id);
        if (isMounted) {
          setPromotion(data);
        }
        await api.trackPromotionView(id);
      } catch (error) {
         if (isMounted && id) {
          const fallbackPromotion = landingPromotions.find((item) => item.id.toString() === id);
          if (fallbackPromotion) {
            setPromotion(fallbackPromotion);
          }
        }
        const message = error instanceof Error ? error.message : "Unable to load promotion.";
        toast.warning(`${message} Showing cached promotion details instead.`);
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
    ? promotion.termsAndConditions.split(/\n+/).filter(Boolean)
    : [];
  const isVerified = ["APPROVED", "ACTIVE"].includes(promotion.status);

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

  const handleReport = async () => {
    const reason = window.prompt("Please share the reason for reporting this promotion:");
    if (!reason) {
      return;
    }
    try {
      await api.reportPromotion({ promotionId: promotion.id, reason });
      toast.success("Thanks for reporting. Our team will review this promotion.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to submit report.";
      toast.error(message);
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
      toast.success("We logged your interest. Redeem this deal in-store with the promo code.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to log engagement.";
      toast.error(message);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              {/* Image */}
              <div className="relative h-96 bg-gradient-to-br from-primary/10 to-accent/10 rounded-lg mb-6 flex items-center justify-center overflow-hidden">
                <div className="text-center p-8">
                  <div className="text-6xl font-bold text-primary mb-4">{discountLabel}</div>
                  <div className="text-2xl font-semibold text-foreground">{promotion.title}</div>
                </div>
                {isVerified && (
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-verified text-verified-foreground flex items-center gap-1 text-base px-3 py-1">
                      <ShieldCheck className="h-4 w-4" />
                      Verified Business
                    </Badge>
                  </div>
                )}
              </div>

              {/* Business Info */}
              <Card className="p-6 mb-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-2xl font-bold text-foreground">{promotion.businessName}</h2>
                      {isVerified && <ShieldCheck className="h-5 w-5 text-verified" />}
                    </div>
                    <Badge variant="secondary">{promotion.categoryName}</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleShare}>
                      <Share2 className="h-4 w-4 mr-2" />
                      Share
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleReport}>
                      <Flag className="h-4 w-4 mr-2" />
                      Report
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {promotion.location}
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {formatDate(promotion.startDate)} - {formatDate(promotion.endDate)}
                  </div>
                </div>
              </Card>

              {/* Description */}
              <Card className="p-6 mb-6">
                <h3 className="text-xl font-semibold mb-4">About This Promotion</h3>
                <p className="text-muted-foreground leading-relaxed">{promotion.description}</p>
              </Card>

              {/* Terms & Conditions */}
              <Card className="p-6">
                <h3 className="text-xl font-semibold mb-4">Terms & Conditions</h3>
                {terms.length > 0 ? (
                  <ul className="space-y-2">
                    {terms.map((term, index) => (
                      <li key={index} className="flex items-start gap-2 text-muted-foreground">
                        <span className="text-primary mt-1">•</span>
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

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="sticky top-24 space-y-6"
            >
              {/* Price Card */}
              <Card className="p-6">
                <div className="text-center mb-4">
                  <div className="text-4xl font-bold text-primary mb-2">
                    {discountLabel}
                  </div>
                  <Badge className="bg-destructive text-destructive-foreground font-bold">
                    Save {discountLabel}
                  </Badge>
                </div>
                <Button className="w-full" size="lg" onClick={handleRedeem}>
                  Get This Deal
                </Button>
                <Button className="w-full mt-3" variant="outline" onClick={handleSave}>
                  Save Promotion
                </Button>
              </Card>

              {/* Validity Card */}
              <Card className="p-6">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  Validity Period
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Starts:</span>
                    <span className="font-medium">{formatDate(promotion.startDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ends:</span>
                    <span className="font-medium">{formatDate(promotion.endDate)}</span>
                  </div>
                </div>
              </Card>

              {isVerified && (
                <Card className="p-6 bg-verified/5 border-verified/20">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="h-6 w-6 text-verified flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-verified mb-1">Verified Business</h4>
                      <p className="text-sm text-muted-foreground">
                        This promotion is from a verified business. All documents have been reviewed by our team.
                      </p>
                    </div>
                  </div>
                </Card>
              )}

              {/* Safety Info */}
              <Card className="p-6 bg-muted/50">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold mb-1 text-sm">Stay Safe</h4>
                    <p className="text-xs text-muted-foreground">
                      Always verify the promotion in-store and report suspicious activity.
                    </p>
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
