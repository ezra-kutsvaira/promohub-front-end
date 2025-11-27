import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ShieldCheck, Calendar, MapPin, AlertCircle, Share2, Flag } from "lucide-react";
import { motion } from "framer-motion";
import { useParams, Link } from "react-router-dom";

const PromotionDetail = () => {
  const { id } = useParams();

  // Mock data - in real app this would come from API
  const promotion = {
    id: id || "1",
    title: "Black Friday Electronics Sale - Up to 70% Off",
    businessName: "TechWorld Zimbabwe",
    category: "Electronics",
    discount: "70% OFF",
    originalPrice: "$500",
    discountPrice: "$150",
    location: "Harare Central, Corner 4th Street & Jason Moyo Ave",
    validFrom: "25 Nov 2025",
    validUntil: "30 Nov 2025",
    isVerified: true,
    description: "Experience the biggest electronics sale of the year! Get incredible discounts on laptops, smartphones, TVs, and more. Limited stock available. Don't miss out on this once-a-year opportunity to upgrade your tech at unbeatable prices.",
    terms: [
      "Valid only at our Harare Central branch",
      "While stocks last",
      "Cannot be combined with other offers",
      "Original receipt required for warranty claims",
      "Selected items only - see in-store for full list",
    ],
    rating: 4.5,
    reviews: 23,
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
                  <div className="text-6xl font-bold text-primary mb-4">{promotion.discount}</div>
                  <div className="text-2xl font-semibold text-foreground">{promotion.title}</div>
                </div>
                {promotion.isVerified && (
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
                      {promotion.isVerified && <ShieldCheck className="h-5 w-5 text-verified" />}
                    </div>
                    <Badge variant="secondary">{promotion.category}</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Share2 className="h-4 w-4 mr-2" />
                      Share
                    </Button>
                    <Button variant="outline" size="sm">
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
                    {promotion.validFrom} - {promotion.validUntil}
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
                <ul className="space-y-2">
                  {promotion.terms.map((term, index) => (
                    <li key={index} className="flex items-start gap-2 text-muted-foreground">
                      <span className="text-primary mt-1">•</span>
                      <span>{term}</span>
                    </li>
                  ))}
                </ul>
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
                  <div className="text-sm text-muted-foreground line-through mb-1">
                    Was {promotion.originalPrice}
                  </div>
                  <div className="text-4xl font-bold text-primary mb-2">
                    {promotion.discountPrice}
                  </div>
                  <Badge className="bg-destructive text-destructive-foreground font-bold">
                    Save {promotion.discount}
                  </Badge>
                </div>
                <Button className="w-full" size="lg">
                  Get This Deal
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
                    <span className="font-medium">{promotion.validFrom}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ends:</span>
                    <span className="font-medium">{promotion.validUntil}</span>
                  </div>
                </div>
              </Card>

              {/* Trust Badge */}
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
