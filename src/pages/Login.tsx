import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { ShieldCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useState } from "react";

const Login = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const mfaCode = String(formData.get("mfaCode") ?? "").trim() || undefined;

    try {
      setIsSubmitting(true);
      await signIn({ email, password, mfaCode });
      toast.success("Welcome back! We'll take you to your dashboard shortly.");
      navigate("/dashboard");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed. Please try again.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-lg">
          <Card className="border-border shadow-sm">
            <CardHeader className="text-center space-y-2">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <ShieldCheck className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-2xl">Log in to PromoHub</CardTitle>
              <CardDescription>
                Access your verified promotions and manage business campaigns.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="email">
                    Email address
                  </label>
                  <Input id="email" type="email" placeholder="you@business.co.zw" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="password">
                    Password
                  </label>
                  <Input id="password" type="password" placeholder="••••••••" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="mfaCode">
                    MFA code (optional)
                  </label>
                  <Input id="mfaCode" name="mfaCode" placeholder="123456" />
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Need help signing in?</span>
                  <a href="mailto:support@promohub.co.zw" className="text-primary hover:underline">
                    Contact support
                  </a>
                </div>
                <Button className="w-full" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Signing in..." : "Log In"}
                </Button>
              </form>
              <div className="mt-6 text-center text-sm text-muted-foreground">
                New to PromoHub?{" "}
                <Link to="/register" className="text-primary font-medium hover:underline">
                  Get started
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Login;
