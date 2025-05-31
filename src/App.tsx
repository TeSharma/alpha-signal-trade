
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "./contexts/AppContext";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Trade from "./pages/Trade";
import Signals from "./pages/Signals";
import Education from "./pages/Education";
import Account from "./pages/Account";
import NotFound from "./pages/NotFound";
import ResponsiveNav from "./components/layout/ResponsiveNav";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AppProvider>
        <Toaster />
        <Sonner />
        <div className="pb-16 lg:pb-0"> {/* Add bottom padding for mobile nav */}
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/trade" element={<Trade />} />
              <Route path="/signals" element={<Signals />} />
              <Route path="/education" element={<Education />} />
              <Route path="/account" element={<Account />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            <ResponsiveNav />
          </BrowserRouter>
        </div>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
