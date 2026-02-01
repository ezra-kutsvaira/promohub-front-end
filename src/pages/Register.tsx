import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { BadgeCheck, FileCheck, Shield, TrendingUp } from "lucide-react";

const Register = () => {
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    toast.success("Thanks! Your verification request is now queued for review.");
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
            Get Your Business Verified
          </h1>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
            Share your business details once and we will review your documentation to unlock
            verified promotions across Zimbabwe.
          </p>
        </section>

        <section className="grid gap-8 lg:grid-cols-[2fr,1fr]">
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle>Verification request</CardTitle>
              <CardDescription>
                Complete the form below so our team can confirm your business legitimacy.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4" onSubmit={handleSubmit}>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="business-name">
                      Business name
                    </label>
                    <Input id="business-name" placeholder="PromoHub Retailers" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="category">
                      Business category
                    </label>
                    <Input id="category" placeholder="Retail, Food & Beverage, Tech" required />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="contact-email">
                      Contact email
                    </label>
                    <Input id="contact-email" type="email" placeholder="you@business.co.zw" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="phone">
                      Phone number
                    </label>
                    <Input id="phone" type="tel" placeholder="+263 77 000 0000" required />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="location">
                      City & location
                    </label>
                    <Input id="location" placeholder="Harare, Borrowdale" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="documents">
                      Upload registration docs
                    </label>
                    <Input id="documents" type="file" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="website">
                    Website or social handle (optional)
                  </label>
                  <Input id="website" placeholder="https://instagram.com/yourbusiness" />
                </div>
                <Button type="submit" className="w-full">
                  Submit verification request
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
