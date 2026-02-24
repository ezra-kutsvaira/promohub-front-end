import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Calendar, MapPin, TrendingDown } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useState } from "react"

interface PromotionCardProps {
  id: string;
  title: string;
  businessName: string;
  category: string;
  discount: string;
  location: string;
  validUntil: string;
  isVerified: boolean;
  imageUrl?: string;
}

export const PromotionCard = ({
  id,
  title,
  businessName,
  category,
  discount,
  location,
  validUntil,
  isVerified,
  imageUrl,
}: PromotionCardProps) => {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(imageUrl) && !imageFailed;

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="overflow-hidden h-full flex flex-col shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)] transition-shadow">
        {/* Image */}
        <div className="relative h-48 bg-muted overflow-hidden">
          {showImage ? (
            <img
              src={imageUrl}
              alt={title}
              className="w-full h-full object-cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
              <TrendingDown className="h-16 w-16 text-primary/20" />
            </div>
          )}
          {isVerified && (
            <div className="absolute top-3 right-3">
              <Badge className="bg-verified text-verified-foreground flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" />
                Verified
              </Badge>
            </div>
          )}
          <div className="absolute top-3 left-3">
            <Badge className="bg-destructive text-destructive-foreground font-bold">
              {discount}
            </Badge>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 flex flex-col">
          <div className="mb-2">
            <Badge variant="secondary" className="text-xs mb-2">
              {category}
            </Badge>
            <h3 className="font-semibold text-lg text-card-foreground mb-1 line-clamp-2">
              {title}
            </h3>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              {isVerified && <ShieldCheck className="h-3 w-3 text-verified" />}
              {businessName}
            </p>
          </div>

          <div className="mt-auto space-y-2">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {location}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Until {validUntil}
              </span>
            </div>
            <Button asChild className="w-full">
              <Link to={`/promotion/${id}`}>View Details</Link>
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};
