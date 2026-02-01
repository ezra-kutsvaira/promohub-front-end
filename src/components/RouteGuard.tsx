import { useAuth, UserRole } from "@/lib/auth";
import { Navigate, useLocation } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type RequireAuthProps = {
  children: React.ReactNode;
};

type RequireRoleProps = {
  allowed: UserRole[];
  children: React.ReactNode;
};

const AccessDenied = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-16">
        <Card className="mx-auto max-w-xl border-border">
          <CardHeader>
            <CardTitle>Access restricted</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>
              Your current account role does not have permission to view this page. If you need
              additional access, please contact your administrator or update your account role.
            </p>
            <Button asChild>
              <a href="/dashboard">Return to dashboard</a>
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export const RequireAuth = ({ children }: RequireAuthProps) => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
};

export const RequireRole = ({ allowed, children }: RequireRoleProps) => {
  const { user } = useAuth();

  if (!user || !allowed.includes(user.role)) {
    return <AccessDenied />;
  }

  return <>{children}</>;
};
