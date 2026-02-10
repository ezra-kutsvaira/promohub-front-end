import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, Menu, X, Moon, Sun, User } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import { useAuth } from "@/lib/auth";
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
  const { resolvedTheme, setTheme } = useTheme();
  const { user, signOut } = useAuth();

  const isDarkMode = resolvedTheme === "dark";
  const isAuthenticated = Boolean(user);
  const roleLabel = user?.role ? user.role.toLowerCase().replace("_", " ") : "";

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
                {(user?.role === "BUSINESS_OWNER" || user?.role === "ADMIN") && (
                  <Link to="/promotions/new" className="text-foreground hover:text-primary transition-colors">
                    Create Promotion
                  </Link>
                )}
                {user?.role === "ADMIN" && (
                  <Link to="/operations-console" className="text-foreground hover:text-primary transition-colors">
                    Operations
                  </Link>
                )}
              </>
            )}
            <div className="flex items-center gap-3 ml-4">
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
                    {(user?.role === "BUSINESS_OWNER" || user?.role === "ADMIN") && (
                      <DropdownMenuItem asChild>
                        <Link to="/promotions/new">Create promotion</Link>
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
                        <Link to="/operations-console">Operations console</Link>
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
                  {(user?.role === "BUSINESS_OWNER" || user?.role === "ADMIN") && (
                    <Link
                      to="/promotions/new"
                      className="text-foreground hover:text-primary transition-colors py-2"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Create Promotion
                    </Link>
                  )}
                  {user?.role === "ADMIN" && (
                    <Link
                      to="/operations-console"
                      className="text-foreground hover:text-primary transition-colors py-2"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Operations
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
                    {(user?.role === "BUSINESS_OWNER" || user?.role === "ADMIN") && (
                      <Button variant="outline" asChild>
                        <Link to="/promotions/new" onClick={() => setMobileMenuOpen(false)}>
                          Create promotion
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
