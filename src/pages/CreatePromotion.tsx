import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Business, Category } from "@/lib/api";

type BusinessesResponse = {
  content?: Business[];
};

const OTHER_CATEGORY_VALUE = "__other__";

const CreatePromotion = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [customCategoryName, setCustomCategoryName] = useState("");

  const canCreatePromotion = useMemo(() => user?.role === "BUSINESS_OWNER", [user?.role]);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await api.getCategories();
        setCategories(response);
      } catch (error) {
        console.warn("Unable to load categories", error);
      }
    };

    loadCategories();
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
        console.warn("Unable to load current business via dedicated endpoint, falling back to businesses list.", currentBusinessError);
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
        toast.error("No business profile found for your account. Please complete business registration first.");
        return;
      }

      const title = String(formData.get("title") ?? "").trim();
      const description = String(formData.get("description") ?? "").trim();
      const startDate = String(formData.get("startDate") ?? "");
      const endDate = String(formData.get("endDate") ?? "");
      const discountType = String(formData.get("discountType") ?? "").trim();
      const discountValueRaw = String(formData.get("discountValue") ?? "").trim();
      const location = String(formData.get("location") ?? "").trim();
      const selectedCategoryValue = String(formData.get("category") ?? "").trim();
      const typedCategoryName = String(formData.get("categoryName") ?? "").trim();

      const isOtherCategory = selectedCategoryValue === OTHER_CATEGORY_VALUE;
      const parsedCategoryId = selectedCategoryValue && !isOtherCategory ? Number(selectedCategoryValue) : undefined;
      const categoryId = Number.isFinite(parsedCategoryId) ? parsedCategoryId : undefined;
      const categoryName = isOtherCategory ? typedCategoryName : undefined;

      if (categoryId && categoryName) {
        toast.error("Select either a category or a custom category name, not both.");
        return;
      }

      if (isOtherCategory && !categoryName) {
        toast.error("Please provide a custom category name.");
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

      const promotion = await api.createPromotion({
        businessId: business.id,
        categoryId,
        categoryName,
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

      toast.success("Promotion submitted and is awaiting admin approval.");
      navigate("/dashboard", { state: { createdPromotion: promotion } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create promotion.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!canCreatePromotion) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-10">
          <Card className="max-w-xl mx-auto border-border">
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
        <Card className="max-w-3xl mx-auto border-border">
          <CardHeader>
            <CardTitle>Create promotion</CardTitle>
            <CardDescription>Publish a new campaign for customers to discover on the browse page.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={handleSubmit}>
              <Input name="title" placeholder="Promotion title" required />
              <Input name="description" placeholder="Short description" required />
              <div className="grid gap-4 md:grid-cols-2">
                <Input name="startDate" type="date" defaultValue={today} required />
                <Input name="endDate" type="date" defaultValue={today} required />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Input name="promoCode" placeholder="Promo code (optional)" />
                <Input name="location" placeholder="Location" required />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <select
                  name="category"
                  value={selectedCategory}
                  onChange={(event) => {
                    setSelectedCategory(event.target.value);
                    if (event.target.value !== OTHER_CATEGORY_VALUE) {
                      setCustomCategoryName("");
                    }
                  }}
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Use business profile category (optional)</option>
                  {categories.map((category) => (
                    <option key={category.id} value={String(category.id)}>{category.name}</option>
                  ))}
                  <option value={OTHER_CATEGORY_VALUE}>Other (type custom category)</option>
                </select>
                <Input
                  name="categoryName"
                  placeholder="Custom category name"
                  value={customCategoryName}
                  disabled={selectedCategory !== OTHER_CATEGORY_VALUE}
                  onChange={(event) => setCustomCategoryName(event.target.value)}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <select name="discountType" className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="PERCENTAGE">Percent</option>
                  <option value="FIXED_AMOUNT">Fixed amount</option>
                </select>
                <Input name="discountValue" type="number" min="0.01" step="0.01" placeholder="Discount value" required />
              </div>
              <Input name="imageUrl" placeholder="Image URL (optional)" />
              <Input name="termsAndConditions" placeholder="Terms and conditions (optional)" />
              <div className="flex gap-3">
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Creating..." : "Create promotion"}</Button>
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
