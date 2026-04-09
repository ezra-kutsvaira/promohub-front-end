import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { api, type Category, type Promotion } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { normalizeDiscountTypeForApi } from "@/lib/discountType";
import { getPromotionVerificationStatus } from "@/lib/promotionStatus";

const resolvePromotionRejectionReason = (promotion: Promotion): string => {
  const candidateValues = [
    promotion.rejectionReason,
    promotion.verificationNotes,
    (promotion as Promotion & { reason?: string }).reason,
    (promotion as Promotion & { note?: string }).note,
    (promotion as Promotion & { message?: string }).message,
    (promotion as Promotion & { rejection_note?: string }).rejection_note,
    (promotion as Promotion & { rejection_reason?: string }).rejection_reason,
  ];

  const resolvedReason = candidateValues.find((value) => typeof value === "string" && value.trim().length > 0);

  return resolvedReason?.trim() ?? "No reason provided.";
};

const EditPromotion = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [promotion, setPromotion] = useState<Promotion | null>(null);
  const [selectedCategoryCode, setSelectedCategoryCode] = useState("");
  const [selectedDiscountType, setSelectedDiscountType] = useState("PERCENTAGE");

  const canEditPromotion = useMemo(() => user?.role === "BUSINESS_OWNER", [user?.role]);
  const selectedCategory = categories.find((category) => category.code === selectedCategoryCode);

  useEffect(() => {
    if (!id || !user) {
      return;
    }

    const loadData = async () => {
      try {
        setIsLoading(true);

        const [categoriesResponse, promotionResponse, business] = await Promise.all([
          api.getCategories(),
          api.getPromotion(id),
          api.getCurrentUserBusiness(user.id),
        ]);

        if (String(promotionResponse.businessId) !== String(business.id)) {
          toast.error("You can only edit promotions that belong to your business.");
          navigate("/dashboard");
          return;
        }

        const matchedCategory = categoriesResponse.find(
          (category) =>
            category.code === promotionResponse.categoryCode
            || category.id === promotionResponse.categoryId
            || category.name.trim().toLowerCase() === promotionResponse.categoryName?.trim().toLowerCase(),
        );

        setCategories(categoriesResponse);
        setPromotion(promotionResponse);
        setSelectedCategoryCode(matchedCategory?.code ?? promotionResponse.categoryCode ?? "");
        setSelectedDiscountType(normalizeDiscountTypeForApi(promotionResponse.discountType || "PERCENTAGE") || "PERCENTAGE");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load promotion details.";
        toast.error(message);
        navigate("/dashboard");
      } finally {
        setIsLoading(false);
      }
    };

    void loadData();
  }, [id, navigate, user]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !id || !promotion) {
      toast.error("Unable to submit promotion updates.");
      return;
    }

    try {
      setIsSubmitting(true);
      const formData = new FormData(event.currentTarget);
      const business = await api.getCurrentUserBusiness(user.id);

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
      const categoryCode = String(formData.get("categoryCode") ?? "").trim();

      if (!categoryCode) {
        toast.error("Category is required. Please select a category before re-submitting your promotion.");
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

      if (!discountValueRaw || Number(discountValueRaw) <= 0) {
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

      const updatedPromotion = await api.resubmitPromotion(id, {
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

      toast.success("Promotion updated and re-submitted for admin review.");
      navigate("/dashboard", {
        state: {
          resubmittedPromotion: {
            ...updatedPromotion,
            status: "PENDING",
            verificationStatus: "PENDING",
            rejectionReason: undefined,
          },
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update promotion.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!canEditPromotion) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-10">
          <Card className="mx-auto max-w-xl border-border">
            <CardHeader>
              <CardTitle>Access restricted</CardTitle>
              <CardDescription>Only business owners can edit promotions.</CardDescription>
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

  if (isLoading || !promotion) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-10">
          <Card className="mx-auto max-w-3xl border-border">
            <CardHeader>
              <CardTitle>Loading promotion details...</CardTitle>
            </CardHeader>
          </Card>
        </main>
      </div>
    );
  }

  const promotionStatus = getPromotionVerificationStatus(promotion);
  const isRejectedPromotion = promotionStatus === "REJECTED";
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-10">
        <Card className="mx-auto max-w-3xl border-border">
          <CardHeader>
            <CardTitle>Edit promotion</CardTitle>
            <CardDescription>Update the details below and re-submit your promotion for another review.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isRejectedPromotion ? (
              <Alert variant="destructive">
                <AlertTitle>Previous review feedback</AlertTitle>
                <AlertDescription>{resolvePromotionRejectionReason(promotion)}</AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <AlertTitle>Promotion status: {promotionStatus}</AlertTitle>
                <AlertDescription>When you save changes, this promotion will go back into the review queue.</AlertDescription>
              </Alert>
            )}

            <form className="space-y-6" onSubmit={handleSubmit}>
              <section className="space-y-4 rounded-lg border border-border p-4">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Basic information</h3>
                </div>
                <Input name="title" placeholder="Promotion title" defaultValue={promotion.title} required />
                <Textarea
                  name="description"
                  defaultValue={promotion.description ?? ""}
                  placeholder="Promotion description"
                  rows={4}
                  required
                />
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
                <Input name="imageUrl" placeholder="Promotion image URL (optional)" defaultValue={promotion.imageUrl ?? ""} />
                <Input
                  name="referenceUrl"
                  type="url"
                  placeholder="Reference URL (optional)"
                  defaultValue={promotion.referenceUrl ?? ""}
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
                    defaultValue={promotion.discountValue ?? ""}
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
                    defaultValue={promotion.originalPrice ?? ""}
                    placeholder="Original price (optional but recommended)"
                  />
                  <Input
                    name="promoCode"
                    placeholder="Promo code (optional)"
                    defaultValue={promotion.promoCode ?? ""}
                  />
                </div>
                <select
                  name="redemptionChannel"
                  value={promotion.redemptionChannel ?? ""}
                  onChange={(event) => {
                    setPromotion((currentPromotion) =>
                      currentPromotion
                        ? { ...currentPromotion, redemptionChannel: event.target.value }
                        : currentPromotion,
                    );
                  }}
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
                  <Input name="startDate" type="date" defaultValue={promotion.startDate || today} required />
                  <Input name="endDate" type="date" defaultValue={promotion.endDate || today} required />
                </div>
                <Input name="location" placeholder="Location / branch" defaultValue={promotion.location ?? ""} required />
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    name="maxRedemptions"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Maximum redemptions (optional)"
                    defaultValue={promotion.maxRedemptions ?? ""}
                  />
                  <Input
                    name="perCustomerLimit"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Per-customer limit (optional)"
                    defaultValue={promotion.perCustomerLimit ?? ""}
                  />
                </div>
              </section>

              <section className="space-y-4 rounded-lg border border-border p-4">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Redemption rules</h3>
                </div>
                <Textarea
                  name="redemptionInstructions"
                  defaultValue={promotion.redemptionInstructions ?? ""}
                  placeholder="How should customers redeem this promotion?"
                  rows={4}
                  required
                />
                <Textarea
                  name="eligibilityCriteria"
                  defaultValue={promotion.eligibilityCriteria ?? ""}
                  placeholder="Eligibility criteria (optional)"
                  rows={3}
                />
                <Textarea
                  name="excludedItems"
                  defaultValue={promotion.excludedItems ?? ""}
                  placeholder="Excluded items or exceptions (optional)"
                  rows={3}
                />
                <Textarea
                  name="termsAndConditions"
                  defaultValue={promotion.termsAndConditions ?? ""}
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
                  defaultValue={promotion.supportContact ?? ""}
                />
              </section>

              <div className="flex gap-3">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save & re-submit"}
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

export default EditPromotion;
