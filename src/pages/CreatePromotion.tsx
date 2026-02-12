import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Business } from "@/lib/api";

type BusinessesResponse = {
  content?: Business[];
};

const CreatePromotion = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canCreatePromotion = useMemo(() => user?.role === "BUSINESS_OWNER", [user?.role]);

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

      const promotion = await api.createPromotion({
        businessId: business.id,
        categoryId: 1,
        title: String(formData.get("title") ?? ""),
        description: String(formData.get("description") ?? ""),
        imageUrl: String(formData.get("imageUrl") ?? ""),
        startDate: String(formData.get("startDate") ?? ""),
        endDate: String(formData.get("endDate") ?? ""),
        promoCode: String(formData.get("promoCode") ?? ""),
        discountType: String(formData.get("discountType") ?? "PERCENTAGE"),
        discountValue: Number(formData.get("discountValue") ?? 0),
        termsAndConditions: String(formData.get("termsAndConditions") ?? ""),
        location: String(formData.get("location") ?? ""),
      });

      toast.success("Promotion created successfully.");
      navigate("/browse", { state: { createdPromotion: promotion } });
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
                <Input name="promoCode" placeholder="Promo code" required />
                <Input name="location" placeholder="Location" required />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <select name="discountType" className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="PERCENTAGE">Percent</option>
                  <option value="AMOUNT">Amount</option>
                </select>
                <Input name="discountValue" type="number" min="0" step="0.01" placeholder="Discount value" required />
              </div>
              <Input name="imageUrl" placeholder="Image URL (optional)" />
              <Input name="termsAndConditions" placeholder="Terms and conditions" required />
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
