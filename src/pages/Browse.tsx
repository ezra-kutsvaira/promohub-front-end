import { Navbar } from "@/components/Navbar";
import { PromotionCard } from "@/components/PromotionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, SlidersHorizontal } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { api, type Promotion } from "@/lib/api";
import { formatDate, formatDiscount } from "@/lib/format";
import { toast } from "@/components/ui/sonner";
import { landingPromotions } from "@/data/landing";
import { isApprovedPromotion } from "@/lib/promotionStatus";

const Browse = () => {
  const location = useLocation();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedLocation, setSelectedLocation] = useState("ALL");
  const [sortBy, setSortBy] = useState("NEWEST");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const searchQuery = params.get("search")?.trim() ?? "";
    const categoryQuery = params.get("category")?.trim() ?? "";
    const locationQuery = params.get("location")?.trim() ?? "";

    setSearch(searchQuery);
    setSelectedCategory(categoryQuery || "ALL");
    setSelectedLocation(locationQuery || "ALL");
  }, [location.search]);

  useEffect(() => {
    let isMounted = true;

    const fetchApprovedPromotions = async () => {
      const approvedQueryCandidates = [
        { verificationStatus: "APPROVED", page: "0", size: "60" },
        { status: "APPROVED", page: "0", size: "60" },
      ];

      for (const params of approvedQueryCandidates) {
        try {
          const response = await api.getPromotions(params);
          const promotions = Array.isArray(response) ? response : response.content;
          if (promotions.length > 0) {
            return promotions;
          }
        } catch {
          // Try the next known status parameter name.
        }
      }

      const response = await api.getPromotions();
      return Array.isArray(response) ? response : response.content;
    };

    const loadPromotions = async () => {
      try {
        const content = await fetchApprovedPromotions();
        const createdPromotion = (location.state as {createdPromotion?: Promotion } | null)?.createdPromotion;
        const approvedContent = content.filter(isApprovedPromotion);

        if (isMounted) {
          const baseList = approvedContent.length > 0 ? approvedContent : landingPromotions;
          if(createdPromotion && isApprovedPromotion(createdPromotion) && !baseList.some((item) => item.id === createdPromotion.id)) {
            setPromotions([createdPromotion, ...baseList]);
          } else {
            setPromotions(baseList);
          }
        }
      } catch (error) {
        if(isMounted) {
          setPromotions(landingPromotions);
        }
        const message = error instanceof Error ? error.message : "Unable to load promotions.";
        toast.warning(`${message} Showing featured promotions instead.`);
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
  }, [location.state]);

  const categories = useMemo(() => {
    const uniqueCategories = Array.from(
      new Set(
        promotions
          .map((promotion) => promotion.categoryName?.trim())
          .filter((category): category is string => Boolean(category))
      )
    );

    return uniqueCategories.sort((first, second) => first.localeCompare(second));
  }, [promotions]);

  const locations = useMemo(() => {
    const uniqueLocations = Array.from(
      new Set(
        promotions
          .map((promotion) => promotion.location?.trim())
          .filter((item): item is string => Boolean(item))
      )
    );

    return uniqueLocations.sort((first, second) => first.localeCompare(second));
  }, [promotions]);

  const filteredPromotions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const visiblePromotions = promotions.filter((promotion) => {
      const matchesSearch = !normalizedSearch
        || promotion.title.toLowerCase().includes(normalizedSearch)
        || promotion.businessName.toLowerCase().includes(normalizedSearch)
        || promotion.description.toLowerCase().includes(normalizedSearch);

      const matchesCategory = selectedCategory === "ALL" || promotion.categoryName === selectedCategory;
      const matchesLocation = selectedLocation === "ALL" || promotion.location === selectedLocation;

      return matchesSearch && matchesCategory && matchesLocation;
    });

    const sortedPromotions = [...visiblePromotions].sort((first, second) => {
      if (sortBy === "ENDING_SOON") {
        return new Date(first.endDate).getTime() - new Date(second.endDate).getTime();
      }

      if (sortBy === "DISCOUNT") {
        return second.discountValue - first.discountValue;
      }

      if (sortBy === "POPULAR") {
        const firstScore = Number(first.riskScore ?? 0);
        const secondScore = Number(second.riskScore ?? 0);
        return secondScore - firstScore;
      }

      return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
    });

    return sortedPromotions;
  }, [promotions, search, selectedCategory, selectedLocation, sortBy]);

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
            <select
              className="h-12 px-4 rounded-md border border-input bg-background text-foreground"
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
            >
              <option value="ALL">All Categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <select
              className="h-12 px-4 rounded-md border border-input bg-background text-foreground"
              value={selectedLocation}
              onChange={(event) => setSelectedLocation(event.target.value)}
            >
              <option value="ALL">All Locations</option>
              {locations.map((place) => (
                <option key={place} value={place}>{place}</option>
              ))}
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
          <select
            className="px-4 py-2 rounded-md border border-input bg-background text-foreground text-sm"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
          >
            <option value="NEWEST">Sort by: Newest</option>
            <option value="ENDING_SOON">Sort by: Ending Soon</option>
            <option value="DISCOUNT">Sort by: Discount %</option>
            <option value="POPULAR">Sort by: Popular</option>
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
                isVerified={isApprovedPromotion(promo)}
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
