import { Navbar } from "@/components/Navbar";
import { PromotionCard } from "@/components/PromotionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, SlidersHorizontal } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { api, type Promotion } from "@/lib/api";
import { formatDate, formatDiscount } from "@/lib/format";
import { toast } from "@/components/ui/sonner";

const Browse = () => {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadPromotions = async () => {
      try {
        const response = await api.getPromotions();
        const content = Array.isArray(response) ? response : response.content;
        if (isMounted) {
          setPromotions(content);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load promotions.";
        toast.error(message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadPromotions();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredPromotions = useMemo(() => {
    if (!search) {
      return promotions;
    }
    return promotions.filter((promo) =>
      promo.title.toLowerCase().includes(search.toLowerCase()) ||
      promo.businessName.toLowerCase().includes(search.toLowerCase())
    );
  }, [promotions, search]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-foreground mb-2">Browse Promotions</h1>
          <p className="text-muted-foreground">Discover verified deals from trusted businesses</p>
        </motion.div>

        {/* Filters */}
        <div className="bg-card border border-border rounded-lg p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search promotions..."
                className="pl-10 h-12"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <select className="h-12 px-4 rounded-md border border-input bg-background text-foreground">
              <option>All Categories</option>
              <option>Electronics</option>
              <option>Groceries</option>
              <option>Fashion</option>
              <option>Food & Beverages</option>
              <option>Furniture</option>
              <option>Health & Fitness</option>
            </select>
            <select className="h-12 px-4 rounded-md border border-input bg-background text-foreground">
              <option>All Locations</option>
              <option>Harare</option>
              <option>Bulawayo</option>
              <option>Gweru</option>
            </select>
            <Button variant="outline" className="h-12">
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              More Filters
            </Button>
          </div>
        </div>

        {/* Results Info */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{filteredPromotions.length}</span> verified promotions
          </p>
          <select className="px-4 py-2 rounded-md border border-input bg-background text-foreground text-sm">
            <option>Sort by: Newest</option>
            <option>Sort by: Ending Soon</option>
            <option>Sort by: Discount %</option>
            <option>Sort by: Popular</option>
          </select>
        </div>

        {/* Promotions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPromotions.map((promo, index) => (
            <motion.div
              key={promo.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
            >
              <PromotionCard
                id={promo.id.toString()}
                title={promo.title}
                businessName={promo.businessName}
                category={promo.categoryName}
                discount={formatDiscount(promo.discountType, promo.discountValue)}
                location={promo.location}
                validUntil={formatDate(promo.endDate)}
                isVerified={["APPROVED", "ACTIVE"].includes(promo.status)}
                imageUrl={promo.imageUrl}
              />
            </motion.div>
          ))}
        </div>

        {/* Load More */}
        <div className="mt-12 text-center">
          <Button variant="outline" size="lg" disabled={isLoading}>
            {isLoading ? "Loading promotions..." : "Load More Promotions"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Browse;
