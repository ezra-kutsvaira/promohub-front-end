import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

        setCategories(categoriesResponse);
        setPromotion(promotionResponse);
        setSelectedCategoryCode(promotionResponse.categoryCode ?? "");
        setSelectedDiscountType(promotionResponse.discountType || "PERCENTAGE");
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
      const startDate = String(formData.get("startDate") ?? "");
      const endDate = String(formData.get("endDate") ?? "");
      const discountTypeValue = String(formData.get("discountType") ?? selectedDiscountType);
      const discountType = normalizeDiscountTypeForApi(discountTypeValue);
      const discountValueRaw = String(formData.get("discountValue") ?? "").trim();
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
        termsAndConditions: String(formData.get("termsAndConditions") ?? "").trim() || undefined,
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
          <Card className="max-w-xl mx-auto border-border">
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
          <Card className="max-w-3xl mx-auto border-border">
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
        <Card className="max-w-3xl mx-auto border-border">
          <CardHeader>
            <CardTitle>Edit promotion</CardTitle>
            <CardDescription>Update the details below and re-submit your promotion for another review.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isRejectedPromotion && (
              <Alert variant="destructive">
                <AlertTitle>Previous review feedback</AlertTitle>
                <AlertDescription>{resolvePromotionRejectionReason(promotion)}</AlertDescription>
              </Alert>
            )}
            {!isRejectedPromotion && (
              <Alert>
                <AlertTitle>Promotion status: {promotionStatus}</AlertTitle>
                <AlertDescription>When you save changes, this promotion will go back into the review queue.</AlertDescription>
              </Alert>
            )}

            <form className="grid gap-4" onSubmit={handleSubmit}>
              <Input name="title" placeholder="Promotion title" defaultValue={promotion.title} required />
              <Input name="description" placeholder="Short description" defaultValue={promotion.description} required />
              <div className="grid gap-4 md:grid-cols-2">
                <Input name="startDate" type="date" defaultValue={promotion.startDate || today} required />
                <Input name="endDate" type="date" defaultValue={promotion.endDate || today} required />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Input name="promoCode" placeholder="Promo code (optional)" defaultValue={promotion.promoCode ?? ""} />
                <Input name="location" placeholder="Location" defaultValue={promotion.location ?? ""} required />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <select
                  name="categoryCode"
                  value={selectedCategoryCode}
                  onChange={(event) => setSelectedCategoryCode(event.target.value)}
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                  required
                >
                  <option value="">Select a category</option>
                  {categories.map((category) => (
                    <option key={category.code} value={category.code}>{category.name}</option>
                  ))}
                </select>
                <Input
                  value={categories.find((category) => category.code === selectedCategoryCode)?.description ?? ""}
                  placeholder="Category description"
                  disabled
                  readOnly
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <select
                  name="discountType"
                  value={selectedDiscountType}
                  onChange={(event) => setSelectedDiscountType(event.target.value)}
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="PERCENTAGE">Percentage (%)</option>
                  <option value="FLAT">Fixed amount</option>
                </select>
                <Input
                  name="discountValue"
                  type="number"
                  min="0.01"
                  step="0.01"
                  defaultValue={promotion.discountValue}
                  placeholder={selectedDiscountType === "PERCENTAGE" ? "Discount % value" : "Discount amount"}
                  required
                />
              </div>
              <Input name="imageUrl" placeholder="Image URL (optional)" defaultValue={promotion.imageUrl ?? ""} />
              <Input name="termsAndConditions" placeholder="Terms and conditions (optional)" defaultValue={promotion.termsAndConditions ?? ""} />
              <div className="flex gap-3">
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save & re-submit"}</Button>
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
