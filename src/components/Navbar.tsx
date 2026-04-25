import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, Menu, X, Moon, Sun, User } from "lucide-react";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { NotificationCenter } from "@/components/NotificationCenter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [businessSetupStatus, setBusinessSetupStatus] = useState<"unknown" | "required" | "complete">("unknown");
  const { resolvedTheme, setTheme } = useTheme();
  const { user, signOut } = useAuth();

  const isDarkMode = resolvedTheme === "dark";
  const isAuthenticated = Boolean(user);
  const roleLabel = user?.role ? user.role.toLowerCase().replace("_", " ") : "";
  const businessOwnerAction =
    user?.role === "BUSINESS_OWNER"
      ? businessSetupStatus === "required"
        ? { to: "/create-business-owner-account", label: "Complete setup" }
        : businessSetupStatus === "complete"
          ? { to: "/promotions/new", label: "Create Promotion" }
          : null
      : null;

  useEffect(() => {
    let isMounted = true;

    if (!user || user.role !== "BUSINESS_OWNER") {
      setBusinessSetupStatus("unknown");
      return () => {
        isMounted = false;
      };
    }

    const loadBusinessSetupStatus = async () => {
      try {
        await api.getCurrentUserBusiness(user.id);
        if (isMounted) {
          setBusinessSetupStatus("complete");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message.toLowerCase() : "";
        const missingBusinessProfile =
          message.includes("no business profile") ||
          message.includes("no business") ||
          message.includes("not found") ||
          message.includes("404");

        if (isMounted) {
          setBusinessSetupStatus(missingBusinessProfile ? "required" : "unknown");
        }
      }
    };

    void loadBusinessSetupStatus();

    return () => {
      isMounted = false;
    };
  }, [user]);

  return (
    <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl text-primary">
            <Shield className="h-6 w-6" />
            <span>PromoHub</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <Link to="/" className="text-foreground hover:text-primary transition-colors">
              Home
            </Link>
            <Link to="/browse" className="text-foreground hover:text-primary transition-colors">
              Browse Promotions
            </Link>
            <Link to="/roadshows" className="text-foreground hover:text-primary transition-colors">
              Roadshows & Events
            </Link>
            <Link to="/how-it-works" className="text-foreground hover:text-primary transition-colors">
              About
            </Link>
            {isAuthenticated && (
              <>
                <Link to="/dashboard" className="text-foreground hover:text-primary transition-colors">
                  Dashboard
                </Link>
                {user?.role === "BUSINESS_OWNER" && businessSetupStatus === "complete" && (
                  <Link to="/business/analytics" className="text-foreground hover:text-primary transition-colors">
                    Analytics
                  </Link>
                )}
                {user?.role === "ADMIN" && (
                  <Link to="/admin/analytics" className="text-foreground hover:text-primary transition-colors">
                    Analytics
                  </Link>
                )}
                {user?.role === "CONSUMER" && (
                  <Link
                    to="/create-business-owner-account"
                    className="text-foreground hover:text-primary transition-colors"
                  >
                    Create Business Owner Account
                  </Link>
                )}
                {businessOwnerAction && (
                  <Link to={businessOwnerAction.to} className="text-foreground hover:text-primary transition-colors">
                    {businessOwnerAction.label}
                  </Link>
                )}
                {user?.role === "ADMIN" && (
                  <Link to="/admin/business-verification" className="text-foreground hover:text-primary transition-colors">
                    Operations
                  </Link>
                )}
              </>
            )}
            <div className="flex items-center gap-3 ml-4">
              {isAuthenticated && <NotificationCenter />}
              <Button
                variant="ghost"
                size="icon"
                className="border border-border"
                onClick={() => setTheme(isDarkMode ? "light" : "dark")}
                aria-label="Toggle dark mode"
              >
                {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              {isAuthenticated ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <User className="h-4 w-4" />
                      {user?.fullName.split(" ")[0]}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel className="capitalize">
                      {roleLabel} account
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/dashboard">Dashboard</Link>
                    </DropdownMenuItem>
                    {user?.role === "BUSINESS_OWNER" && businessSetupStatus === "complete" && (
                      <DropdownMenuItem asChild>
                        <Link to="/business/analytics">Analytics</Link>
                      </DropdownMenuItem>
                    )}
                    {user?.role === "ADMIN" && (
                      <DropdownMenuItem asChild>
                        <Link to="/admin/analytics">Analytics</Link>
                      </DropdownMenuItem>
                    )}
                    {user?.role === "CONSUMER" && (
                      <DropdownMenuItem asChild>
                        <Link to="/create-business-owner-account">Create Business Owner Account</Link>
                      </DropdownMenuItem>
                    )}
                    {businessOwnerAction && (
                      <DropdownMenuItem asChild>
                        <Link to={businessOwnerAction.to}>{businessOwnerAction.label}</Link>
                      </DropdownMenuItem>
                    )}
                    {user?.role !== "BUSINESS_OWNER" && (
                      <DropdownMenuItem asChild>
                        <Link to="/saved-promotions">Saved promotions</Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem asChild>
                      <Link to="/account-settings">Account settings</Link>
                    </DropdownMenuItem>
                    {user?.role === "ADMIN" && (
                      <DropdownMenuItem asChild>
                        <Link to="/admin/business-verification">Operations console</Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => void signOut()}>Sign out</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <>
                  <Button variant="outline" asChild>
                    <Link to="/login">Log In</Link>
                  </Button>
                  <Button asChild>
                    <Link to="/register">Get Started</Link>
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-2 md:hidden">
            {isAuthenticated && <NotificationCenter />}
            <Button
              variant="ghost"
              size="icon"
              className="border border-border"
              onClick={() => setTheme(isDarkMode ? "light" : "dark")}
              aria-label="Toggle dark mode"
            >
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <button
              className="p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-border bg-background"
          >
            <div className="container mx-auto px-4 py-4 flex flex-col gap-4">
              <Link
                to="/"
                className="text-foreground hover:text-primary transition-colors py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Home
              </Link>
              <Link
                to="/browse"
                className="text-foreground hover:text-primary transition-colors py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Browse Promotions
              </Link>
              <Link
                to="/roadshows"
                className="text-foreground hover:text-primary transition-colors py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Roadshows & Events
              </Link>
              <Link
                to="/how-it-works"
                className="text-foreground hover:text-primary transition-colors py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                About
              </Link>
              {isAuthenticated && (
                <>
                  <Link
                    to="/dashboard"
                    className="text-foreground hover:text-primary transition-colors py-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                  {user?.role === "BUSINESS_OWNER" && businessSetupStatus === "complete" && (
                    <Link
                      to="/business/analytics"
                      className="text-foreground hover:text-primary transition-colors py-2"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Analytics
                    </Link>
                  )}
                  {user?.role === "ADMIN" && (
                    <Link
                      to="/admin/analytics"
                      className="text-foreground hover:text-primary transition-colors py-2"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Analytics
                    </Link>
                  )}
                  {user?.role === "CONSUMER" && (
                    <Link
                      to="/create-business-owner-account"
                      className="text-foreground hover:text-primary transition-colors py-2"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Create Business Owner Account
                    </Link>
                  )}
                  {businessOwnerAction && (
                    <Link
                      to={businessOwnerAction.to}
                      className="text-foreground hover:text-primary transition-colors py-2"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {businessOwnerAction.label}
                    </Link>
                  )}
                  {user?.role === "ADMIN" && (
                    <Link
                      to="/admin/business-verification"
                      className="text-foreground hover:text-primary transition-colors py-2"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Verification queue
                    </Link>
                  )}
                </>
              )}
              <div className="flex flex-col gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setTheme(isDarkMode ? "light" : "dark");
                    setMobileMenuOpen(false);
                  }}
                >
                  {isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                </Button>
                {isAuthenticated ? (
                  <>
                    {user?.role === "CONSUMER" && (
                      <Button variant="outline" asChild>
                        <Link
                          to="/create-business-owner-account"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          Create Business Owner Account
                        </Link>
                      </Button>
                    )}
                    {businessOwnerAction && (
                      <Button variant="outline" asChild>
                        <Link to={businessOwnerAction.to} onClick={() => setMobileMenuOpen(false)}>
                          {businessOwnerAction.label}
                        </Link>
                      </Button>
                    )}
                    {user?.role === "BUSINESS_OWNER" && businessSetupStatus === "complete" && (
                      <Button variant="outline" asChild>
                        <Link to="/business/analytics" onClick={() => setMobileMenuOpen(false)}>
                          Analytics
                        </Link>
                      </Button>
                    )}
                    {user?.role === "ADMIN" && (
                      <Button variant="outline" asChild>
                        <Link to="/admin/analytics" onClick={() => setMobileMenuOpen(false)}>
                          Analytics
                        </Link>
                      </Button>
                    )}
                    {user?.role !== "BUSINESS_OWNER" && (
                      <Button variant="outline" asChild>
                        <Link to="/saved-promotions" onClick={() => setMobileMenuOpen(false)}>
                          Saved promotions
                        </Link>
                      </Button>
                    )}
                    <Button variant="outline" asChild>
                      <Link to="/account-settings" onClick={() => setMobileMenuOpen(false)}>
                        Account settings
                      </Link>
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        void signOut();
                        setMobileMenuOpen(false);
                      }}
                    >
                      Sign out
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" asChild>
                      <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                        Log In
                      </Link>
                    </Button>
                    <Button asChild>
                      <Link to="/register" onClick={() => setMobileMenuOpen(false)}>
                        Get Started
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};
