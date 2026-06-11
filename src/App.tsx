import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "@/contexts/AppContext";
import { MarketDataProvider } from "@/contexts/MarketDataContext";
import Index from "./pages/Index";
import Login from "./pages/Login";
import NetworkGuard from "./components/layout/NetworkGuard";
import { AdminRoute } from "./components/auth/AdminRoute";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Trade = lazy(() => import("./pages/Trade"));
const Signals = lazy(() => import("./pages/Signals"));
const Community = lazy(() => import("./pages/Community"));
const Education = lazy(() => import("./pages/Education"));
const Account = lazy(() => import("./pages/Account"));
const Wallet = lazy(() => import("./pages/Wallet"));
const Signup = lazy(() => import("./pages/Signup"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const UpdatePassword = lazy(() => import("./pages/UpdatePassword"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const SeoMonitor = lazy(() => import("./pages/SeoMonitor"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
  </div>
);

// Only authenticated routes need live market data
const WithMarketData = ({ children }: { children: React.ReactNode }) => (
  <MarketDataProvider>{children}</MarketDataProvider>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AppProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <NetworkGuard />
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/update-password" element={<UpdatePassword />} />
              <Route path="/verify-email" element={<VerifyEmail />} />

              <Route path="/dashboard" element={
                <AuthGuard><WithMarketData><Dashboard /></WithMarketData></AuthGuard>
              } />
              <Route path="/trade" element={
                <AuthGuard><WithMarketData><Trade /></WithMarketData></AuthGuard>
              } />
              <Route path="/signals" element={
                <AuthGuard><WithMarketData><Signals /></WithMarketData></AuthGuard>
              } />
              <Route path="/community" element={
                <AuthGuard><Community /></AuthGuard>
              } />
              <Route path="/education" element={
                <AuthGuard><Education /></AuthGuard>
              } />
              <Route path="/account" element={
                <AuthGuard><Account /></AuthGuard>
              } />
              <Route path="/wallet" element={
                <AuthGuard><Wallet /></AuthGuard>
              } />
              <Route path="/seo" element={
                <AuthGuard>
                  <AdminRoute>
                    <SeoMonitor />
                  </AdminRoute>
                </AuthGuard>
              } />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
