import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { BadgeCheck, FileCheck, Shield, TrendingUp } from "lucide-react";
import { useAuth, UserRole } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { api } from "@/lib/api";

const Register = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<UserRole>("BUSINESS_OWNER");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const fullName = String(formData.get("full-name") ?? "");
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    try {
      setIsSubmitting(true);
      const authResponse = await register({ fullName, email, password, role });

      if (role === "BUSINESS_OWNER") {
        const businessPayload = {
          ownerId: authResponse.userId,
          businessName: String(formData.get("business-name") ?? ""),
          description: String(formData.get("description") ?? ""),
          contactEmail: String(formData.get("contact-email") ?? email),
          phoneNumber: String(formData.get("phone") ?? ""),
          category: String(formData.get("category") ?? ""),
          websiteUrl: String(formData.get("website") ?? ""),
          address: String(formData.get("address") ?? ""),
          logoUrl: String(formData.get("logo-url") ?? ""),
          city: String(formData.get("city") ?? ""),
          country: String(formData.get("country") ?? ""),
        };

        const business = await api.createBusiness(businessPayload);

        await api.requestBusinessVerification({
          businessId: business.id,
          vatNumber: String(formData.get("vat-number") ?? ""),
          tinNumber: String(formData.get("tin-number") ?? ""),
          ownerNationalId: String(formData.get("owner-national-id") ?? ""),
          supportingDocumentsUrl: String(formData.get("supporting-documents-url") ?? ""),
        });

        toast.success("Thanks! Your verification request is now queued for review.");
      } else {
        toast.success("Your account has been created.");
      }

      navigate("/dashboard");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Registration failed. Please try again.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-12">
        <section className="mb-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <h1 className="mt-4 text-3xl md:text-4xl font-bold text-foreground">
            Create Your PromoHub Account
          </h1>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
            Business owners submit verification details to publish promotions. Customers only need
            an account to browse, save deals, and log in.
          </p>
        </section>

        <section className="grid gap-8 lg:grid-cols-[2fr,1fr]">
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle>{role === "BUSINESS_OWNER" ? "Verification request" : "Account registration"}</CardTitle>
              <CardDescription>
                {role === "BUSINESS_OWNER"
                  ? "Complete the form below so our team can confirm your business legitimacy."
                  : "Create your account to browse and save promotions instantly."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="role">
                    Account type
                  </label>
                  <select
                    id="role"
                    name="role"
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={role}
                    onChange={(event) => setRole(event.target.value as UserRole)}
                  >
                    <option value="BUSINESS_OWNER">Business owner</option>
                    <option value="CONSUMER">Consumer</option>
                    <option value="CUSTOMER">Customer</option>
                  </select>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="full-name">
                      Full name
                    </label>
                    <Input id="full-name" name="full-name" placeholder="Tadiwa Moyo" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="email">
                      Email address
                    </label>
                    <Input id="email" name="email" type="email" placeholder="you@business.co.zw" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="password">
                    Password
                  </label>
                  <Input id="password" name="password" type="password" placeholder="••••••••" required />
                </div>
                {role === "BUSINESS_OWNER" && (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="business-name">
                          Business name
                        </label>
                        <Input id="business-name" name="business-name" placeholder="PromoHub Retailers" required />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="category">
                          Business category
                        </label>
                        <Input id="category" name="category" placeholder="Retail, Food & Beverage, Tech" required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground" htmlFor="description">
                        Description
                      </label>
                      <Input id="description" name="description" placeholder="Short summary of your business." required />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="contact-email">
                          Contact email
                        </label>
                        <Input id="contact-email" name="contact-email" type="email" placeholder="hello@business.co.zw" required />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="phone">
                          Phone number
                        </label>
                        <Input id="phone" name="phone" type="tel" placeholder="+263 77 000 0000" required />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="address">
                          Address
                        </label>
                        <Input id="address" name="address" placeholder="22 Samora Machel Avenue" required />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="city">
                          City
                        </label>
                        <Input id="city" name="city" placeholder="Harare" required />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="country">
                          Country
                        </label>
                        <Input id="country" name="country" placeholder="Zimbabwe" required />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="logo-url">
                          Logo URL
                        </label>
                        <Input id="logo-url" name="logo-url" placeholder="https://..." required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground" htmlFor="website">
                        Website or social handle (optional)
                      </label>
                      <Input id="website" name="website" placeholder="https://instagram.com/yourbusiness" />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="vat-number">
                          VAT number
                        </label>
                        <Input id="vat-number" name="vat-number" placeholder="VAT-000000" required />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="tin-number">
                          TIN number
                        </label>
                        <Input id="tin-number" name="tin-number" placeholder="TIN-000000" required />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="owner-national-id">
                          Owner national ID
                        </label>
                        <Input id="owner-national-id" name="owner-national-id" placeholder="ID123456" required />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="supporting-documents-url">
                          Supporting documents URL (optional)
                        </label>
                        <Input id="supporting-documents-url" name="supporting-documents-url" placeholder="https://..." />
                      </div>
                    </div>
                  </>
                )}
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Submitting..." : role === "BUSINESS_OWNER" ? "Submit verification request" : "Create account"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-border shadow-sm">
              <CardHeader>
                <CardTitle>What happens next?</CardTitle>
                <CardDescription>
                  We keep you updated at every verification milestone.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <div className="flex items-start gap-3">
                  <BadgeCheck className="mt-0.5 h-4 w-4 text-primary" />
                  <span>Document checks and business registry validation within 48 hours.</span>
                </div>
                <div className="flex items-start gap-3">
                  <FileCheck className="mt-0.5 h-4 w-4 text-primary" />
                  <span>We schedule a verification call to confirm your point of contact.</span>
                </div>
                <div className="flex items-start gap-3">
                  <TrendingUp className="mt-0.5 h-4 w-4 text-primary" />
                  <span>Publish trusted promotions and start reaching new customers.</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-muted/40">
              <CardHeader>
                <CardTitle>Need help?</CardTitle>
                <CardDescription>
                  Speak to our verification specialists for guidance.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" asChild>
                  <a href="mailto:verification@promohub.co.zw">Email verification team</a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Register;
