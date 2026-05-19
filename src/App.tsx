import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "@/contexts/AppContext";
import { MarketDataProvider } from "@/contexts/MarketDataContext";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Trade from "./pages/Trade";
import Signals from "./pages/Signals";
import Community from "./pages/Community";
import Education from "./pages/Education";
import Account from "./pages/Account";
import Wallet from "./pages/Wallet";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import UpdatePassword from "./pages/UpdatePassword";
import VerifyEmail from "./pages/VerifyEmail";
import NotFound from "./pages/NotFound";
import SeoMonitor from "./pages/SeoMonitor";
import NetworkGuard from "./components/layout/NetworkGuard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AppProvider>
        <MarketDataProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
        <NetworkGuard />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={
            <AuthGuard>
              <Dashboard />
            </AuthGuard>
          } />
          <Route path="/trade" element={
            <AuthGuard>
              <Trade />
            </AuthGuard>
          } />
          <Route path="/signals" element={
            <AuthGuard>
              <Signals />
            </AuthGuard>
          } />
          <Route path="/community" element={
            <AuthGuard>
              <Community />
            </AuthGuard>
          } />
          <Route path="/education" element={
            <AuthGuard>
              <Education />
            </AuthGuard>
          } />
          <Route path="/account" element={
            <AuthGuard>
              <Account />
            </AuthGuard>
          } />
          <Route path="/wallet" element={
            <AuthGuard>
              <Wallet />
            </AuthGuard>
          } />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/update-password" element={<UpdatePassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </BrowserRouter>
        </MarketDataProvider>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
