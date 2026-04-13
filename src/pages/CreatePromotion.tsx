import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { normalizeDiscountTypeForApi } from "@/lib/discountType";
import type { Business, Category } from "@/lib/api";

type BusinessesResponse = {
  content?: Business[];
};

const CreatePromotion = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryCode, setSelectedCategoryCode] = useState("");
  const [selectedDiscountType, setSelectedDiscountType] = useState("PERCENTAGE");

  const canCreatePromotion = useMemo(() => user?.role === "BUSINESS_OWNER", [user?.role]);
  const selectedCategory = categories.find((category) => category.code === selectedCategoryCode);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await api.getCategories();
        setCategories(response);
      } catch (error) {
        console.warn("Unable to load categories", error);
      }
    };

    void loadCategories();
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      toast.error("Please sign in to create a promotion.");
      navigate("/login");
      return;
    }

    try {
      setIsSubmitting(true);
      const formData = new FormData(event.currentTarget);
      let business: Business | undefined;

      try {
        business = await api.getCurrentUserBusiness(user.id);
      } catch (currentBusinessError) {
        console.warn(
          "Unable to load current business via dedicated endpoint, falling back to businesses list.",
          currentBusinessError,
        );
      }

      if (!business) {
        const businessesResponse = await api.getBusinesses();
        const businesses = Array.isArray(businessesResponse)
          ? businessesResponse
          : (businessesResponse as BusinessesResponse)?.content ?? [];

        if (!Array.isArray(businesses)) {
          console.error("Expected businesses array, got:", businessesResponse);
          toast.error("Unable to load business profile. Please try again.");
          return;
        }

        business = businesses.find((item) => item.ownerId === user.id);
      }

      if (!business) {
        toast.error("No business profile found for your account. Please complete your business owner setup first.");
        navigate("/create-business-owner-account");
        return;
      }

      const title = String(formData.get("title") ?? "").trim();
      const description = String(formData.get("description") ?? "").trim();
      const startDate = String(formData.get("startDate") ?? "").trim();
      const endDate = String(formData.get("endDate") ?? "").trim();
      const discountTypeValue = String(formData.get("discountType") ?? selectedDiscountType);
      const discountType = normalizeDiscountTypeForApi(discountTypeValue);
      const discountValueRaw = String(formData.get("discountValue") ?? "").trim();
      const originalPriceRaw = String(formData.get("originalPrice") ?? "").trim();
      const referenceUrl = String(formData.get("referenceUrl") ?? "").trim();
      const redemptionChannel = String(formData.get("redemptionChannel") ?? "").trim();
      const redemptionInstructions = String(formData.get("redemptionInstructions") ?? "").trim();
      const eligibilityCriteria = String(formData.get("eligibilityCriteria") ?? "").trim();
      const maxRedemptionsRaw = String(formData.get("maxRedemptions") ?? "").trim();
      const perCustomerLimitRaw = String(formData.get("perCustomerLimit") ?? "").trim();
      const excludedItems = String(formData.get("excludedItems") ?? "").trim();
      const supportContact = String(formData.get("supportContact") ?? "").trim();
      const termsAndConditions = String(formData.get("termsAndConditions") ?? "").trim();
      const location = String(formData.get("location") ?? "").trim();
      const selectedCategoryValue = String(formData.get("categoryCode") ?? "").trim();

      let categoryCode = selectedCategoryValue;

      if (!categoryCode) {
        const businessCategoryMatch = categories.find(
          (category) =>
            category.code === business.categoryCode
            || category.name.trim().toLowerCase() === business.category.trim().toLowerCase(),
        );
        categoryCode = businessCategoryMatch?.code ?? "";
      }

      if (!categoryCode) {
        toast.error("Category is required. Please select a category before posting your promotion.");
        return;
      }

      if (endDate < startDate) {
        toast.error("End date cannot be before start date.");
        return;
      }

      if (!location) {
        toast.error("Please provide a promotion location.");
        return;
      }

      if (!discountValueRaw) {
        toast.error("Please provide a discount value.");
        return;
      }

      if (Number(discountValueRaw) <= 0) {
        toast.error("Discount value must be a positive number.");
        return;
      }

      if (!redemptionChannel) {
        toast.error("Please select a redemption channel.");
        return;
      }

      if (!redemptionInstructions) {
        toast.error("Please provide redemption instructions.");
        return;
      }

      if (!termsAndConditions) {
        toast.error("Terms and conditions are required.");
        return;
      }

      if (discountType === "PERCENTAGE" && Number(discountValueRaw) > 100) {
        toast.error("Percentage discount cannot exceed 100.");
        return;
      }

      if (originalPriceRaw && Number(originalPriceRaw) <= 0) {
        toast.error("Original price must be positive.");
        return;
      }

      if (
        discountType === "FLAT"
        && originalPriceRaw
        && Number(discountValueRaw) >= Number(originalPriceRaw)
      ) {
        toast.error("Fixed discount must be less than the original price.");
        return;
      }

      const promotion = await api.createPromotion({
        businessId: business.id,
        categoryCode,
        title,
        description,
        imageUrl: String(formData.get("imageUrl") ?? "").trim() || undefined,
        startDate,
        endDate,
        promoCode: String(formData.get("promoCode") ?? "").trim() || undefined,
        discountType: discountType || undefined,
        discountValue: Number(discountValueRaw),
        originalPrice: originalPriceRaw ? Number(originalPriceRaw) : undefined,
        referenceUrl: referenceUrl || undefined,
        redemptionChannel: redemptionChannel || undefined,
        redemptionInstructions: redemptionInstructions || undefined,
        eligibilityCriteria: eligibilityCriteria || undefined,
        maxRedemptions: maxRedemptionsRaw ? Number(maxRedemptionsRaw) : undefined,
        perCustomerLimit: perCustomerLimitRaw ? Number(perCustomerLimitRaw) : undefined,
        excludedItems: excludedItems || undefined,
        supportContact: supportContact || undefined,
        termsAndConditions: termsAndConditions || undefined,
        location,
      });

      toast.success("Promotion submitted and is awaiting admin approval.");
      navigate("/dashboard", { state: { createdPromotion: promotion } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create promotion.";
      if (message.includes("Provide only one of categoryId, categoryCode, or categoryName")) {
        toast.error("Please choose exactly one category source before submitting.");
      } else {
        toast.error(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!canCreatePromotion) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-10">
          <Card className="mx-auto max-w-xl border-border">
            <CardHeader>
              <CardTitle>Access restricted</CardTitle>
              <CardDescription>Only business owners can create promotions.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to="/dashboard">Return to dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-10">
        <Card className="mx-auto max-w-3xl border-border">
          <CardHeader>
            <CardTitle>Create promotion</CardTitle>
            <CardDescription>Publish a new campaign for customers to discover on the browse page.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={handleSubmit}>
              <section className="space-y-4 rounded-lg border border-border p-4">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Basic information</h3>
                </div>
                <Input name="title" placeholder="Promotion title" required />
                <Textarea name="description" placeholder="Promotion description" rows={4} required />
                <div className="space-y-2">
                  <select
                    name="categoryCode"
                    value={selectedCategoryCode}
                    onChange={(event) => setSelectedCategoryCode(event.target.value)}
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                    required
                  >
                    <option value="">Select a category</option>
                    {categories.map((category) => (
                      <option key={category.code} value={category.code}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  {selectedCategory?.description && (
                    <p className="text-sm text-muted-foreground">{selectedCategory.description}</p>
                  )}
                </div>
                <Input name="imageUrl" placeholder="Promotion image URL (optional)" />
                <Input
                  name="referenceUrl"
                  type="url"
                  placeholder="Reference URL (optional)"
                />
              </section>

              <section className="space-y-4 rounded-lg border border-border p-4">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Offer details</h3>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <select
                    name="discountType"
                    value={selectedDiscountType}
                    onChange={(event) => setSelectedDiscountType(event.target.value)}
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                    required
                  >
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FLAT">Fixed amount</option>
                  </select>
                  <Input
                    name="discountValue"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder={selectedDiscountType === "PERCENTAGE" ? "Discount % value" : "Discount amount"}
                    required
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    name="originalPrice"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="Original price (optional but recommended)"
                  />
                  <Input name="promoCode" placeholder="Promo code (optional)" />
                </div>
                <select
                  name="redemptionChannel"
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                  required
                >
                  <option value="">Select redemption channel</option>
                  <option value="ONLINE">Online only</option>
                  <option value="IN_STORE">In-store only</option>
                  <option value="BOTH">Both</option>
                </select>
              </section>

              <section className="space-y-4 rounded-lg border border-border p-4">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Validity</h3>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Input name="startDate" type="date" defaultValue={today} required />
                  <Input name="endDate" type="date" defaultValue={today} required />
                </div>
                <Input name="location" placeholder="Location / branch" required />
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    name="maxRedemptions"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Maximum redemptions (optional)"
                  />
                  <Input
                    name="perCustomerLimit"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Per-customer limit (optional)"
                  />
                </div>
              </section>

              <section className="space-y-4 rounded-lg border border-border p-4">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Redemption rules</h3>
                </div>
                <Textarea
                  name="redemptionInstructions"
                  placeholder="How should customers redeem this promotion?"
                  rows={4}
                  required
                />
                <Textarea
                  name="eligibilityCriteria"
                  placeholder="Eligibility criteria (optional)"
                  rows={3}
                />
                <Textarea
                  name="excludedItems"
                  placeholder="Excluded items or exceptions (optional)"
                  rows={3}
                />
                <Textarea
                  name="termsAndConditions"
                  placeholder="Terms and conditions"
                  rows={4}
                  required
                />
              </section>

              <section className="space-y-4 rounded-lg border border-border p-4">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Support</h3>
                </div>
                <Input
                  name="supportContact"
                  placeholder="Support contact for this promotion (optional)"
                />
              </section>

              <div className="flex gap-3">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Creating..." : "Create promotion"}
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link to="/dashboard">Cancel</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default CreatePromotion;
