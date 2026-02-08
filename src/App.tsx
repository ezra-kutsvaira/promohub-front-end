import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Browse from "./pages/Browse";
import PromotionDetail from "./pages/PromotionDetail";
import HowItWorks from "./pages/HowItWorks";
import Roadshows from "./pages/Roadshows";
import RoadshowDetail from "./pages/RoadshowDetail";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NotFound from "./pages/NotFound";
import Dashboard from "./pages/Dashboard";
import SavedPromotions from "./pages/SavedPromotions";
import AccountSettings from "./pages/AccountSettings";
import OperationsConsole from "./pages/OperationsConsole";
import { RequireAuth, RequireRole } from "./components/RouteGuard";

const queryClient = new QueryClient();

const App = () => {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/browse" element={<Browse />} />
            <Route path="/roadshows" element={<Roadshows />} />
            <Route path="/roadshows/:id" element={<RoadshowDetail />} />
            <Route path="/promotion/:id" element={<PromotionDetail />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/dashboard"
              element={
                <RequireAuth>
                  <Dashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/saved-promotions"
              element={
                <RequireAuth>
                  <RequireRole allowed={["CONSUMER", "CUSTOMER", "ADMIN"]}>
                    <SavedPromotions />
                  </RequireRole>
                </RequireAuth>
              }
            />
            <Route
              path="/account-settings"
              element={
                <RequireAuth>
                  <AccountSettings />
                </RequireAuth>
              }
            />
            <Route
              path="/operations-console"
              element={
                <RequireAuth>
                  <RequireRole allowed={["ADMIN"]}>
                    <OperationsConsole />
                  </RequireRole>
                </RequireAuth>
              }
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
};

export default App;
