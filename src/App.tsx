
import { RealtimeProvider } from "./providers/RealtimeProvider";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import React, { lazy, Suspense } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ScrollToTop from "./components/ScrollToTop";
import { useScrollAnchor } from "./hooks/useScrollAnchor";
import { AuthProvider } from "./contexts/AuthContext";
import { CurrencyProvider } from "./contexts/CurrencyContext";
import { TopLoadingBar } from "./components/TopLoadingBar";
import { AppSplashScreen } from "./components/AppSplashScreen";
import Index from "./pages/Index";
import UniversalChatbot from "./components/UniversalChatbot";
import ProtectedRoute from "./components/ProtectedRoute";

// Route-level code splitting — keep landing page eager, lazy-load the rest
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const EmailVerification = lazy(() => import("./pages/EmailVerification"));
const Explore = lazy(() => import("./pages/Explore"));
const ExploreArtists = lazy(() => import("./pages/ExploreArtists"));
const Categories = lazy(() => import("./pages/Categories"));
const ArtistProfile = lazy(() => import("./pages/ArtistProfile"));
const UserProfile = lazy(() => import("./pages/UserProfile"));
const ArtworkDetails = lazy(() => import("./pages/ArtworkDetails"));
const ReviewRedirect = lazy(() => import("./pages/ReviewRedirect"));
const ArtistDashboard = lazy(() => import("./pages/ArtistDashboard"));
const ClientDashboard = lazy(() => import("./pages/ClientDashboard"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AboutUs = lazy(() => import("./pages/AboutUs"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const RefundPolicy = lazy(() => import("./pages/RefundPolicy"));
const ContactUs = lazy(() => import("./pages/ContactUs"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Notifications = lazy(() => import("./pages/Notifications"));
const FeatureAudit = lazy(() => import("./pages/FeatureAudit"));
const LiveStreaming = lazy(() => import("./pages/LiveStreaming"));
const Collections = lazy(() => import("./pages/Collections"));
const Trending = lazy(() => import("./pages/Trending"));
const Recommendations = lazy(() => import("./pages/Recommendations"));
const Commissions = lazy(() => import("./pages/Commissions"));
const Events = lazy(() => import("./pages/Events"));
const Merchandise = lazy(() => import("./pages/Merchandise"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMessage: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }
  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, errorMessage: error instanceof Error ? error.message : 'Unknown error' };
  }
  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('🚨 ErrorBoundary caught an error:', error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="text-6xl">⚠️</div>
            <div className="space-y-2">
              <h1 className="text-2xl font-black tracking-tight">Something went wrong</h1>
              <p className="text-sm text-muted-foreground">
                {this.state.errorMessage || 'An unexpected error occurred in this part of the application.'}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => this.setState({ hasError: false, errorMessage: '' })}
                className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="px-6 py-2.5 rounded-xl border border-border font-bold text-sm hover:bg-muted transition-colors"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children as React.ReactElement;
  }
}

const PageTransition = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.25, ease: "easeOut" }}
  >
    {children}
  </motion.div>
);

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
  </div>
);

const AppRoutes = () => {
  const location = useLocation();
  useScrollAnchor("availability-calendar");

  return (
    <ErrorBoundary>
      <ScrollToTop />
      <UniversalChatbot />
      <AnimatePresence mode="wait">
        <Suspense fallback={<RouteFallback />}>
          <Routes location={location}>
            <Route path="/" element={<PageTransition><Index /></PageTransition>} />
            <Route path="/login" element={<PageTransition><Login /></PageTransition>} />
            <Route path="/signup" element={<PageTransition><Signup /></PageTransition>} />
            <Route path="/forgot-password" element={<PageTransition><ForgotPassword /></PageTransition>} />
            <Route path="/reset-password" element={<PageTransition><ResetPassword /></PageTransition>} />
            <Route path="/verify-email" element={<PageTransition><EmailVerification /></PageTransition>} />
            <Route path="/explore" element={<PageTransition><Explore /></PageTransition>} />
            <Route path="/explore-artists" element={<PageTransition><ExploreArtists /></PageTransition>} />
            <Route path="/categories" element={<PageTransition><Categories /></PageTransition>} />
            <Route path="/artist/:id" element={<PageTransition key="artist-public"><ArtistProfile /></PageTransition>} />
            <Route path="/profile/:id" element={<PageTransition key="user-public"><UserProfile /></PageTransition>} />
            <Route path="/review/:id" element={<PageTransition key="review"><ReviewRedirect /></PageTransition>} />
            <Route path="/artwork/:id" element={<PageTransition key="artwork"><ArtworkDetails /></PageTransition>} />
            <Route path="/artist-dashboard" element={<ProtectedRoute requiredRole="artist"><PageTransition key="artist-dashboard"><ArtistDashboard /></PageTransition></ProtectedRoute>} />
            <Route path="/client-dashboard" element={<ProtectedRoute requiredRole="client"><PageTransition key="client-dashboard"><ClientDashboard /></PageTransition></ProtectedRoute>} />
            <Route path="/admin-dashboard" element={<ProtectedRoute adminOnly requiredRole="admin"><PageTransition><AdminDashboard /></PageTransition></ProtectedRoute>} />
            <Route path="/about-us" element={<PageTransition><AboutUs /></PageTransition>} />
            <Route path="/terms-of-service" element={<PageTransition><TermsOfService /></PageTransition>} />
            <Route path="/privacy-policy" element={<PageTransition><PrivacyPolicy /></PageTransition>} />
            <Route path="/refund-policy" element={<PageTransition><RefundPolicy /></PageTransition>} />
            <Route path="/contact-us" element={<PageTransition><ContactUs /></PageTransition>} />
            <Route path="/feature-audit" element={<PageTransition><FeatureAudit /></PageTransition>} />
            <Route path="/live-streaming" element={<PageTransition><LiveStreaming /></PageTransition>} />
            <Route path="/collections" element={<PageTransition><Collections /></PageTransition>} />
            <Route path="/trending" element={<PageTransition><Trending /></PageTransition>} />
            <Route path="/recommendations" element={<PageTransition><Recommendations /></PageTransition>} />
            <Route path="/commissions" element={<PageTransition><Commissions /></PageTransition>} />
            <Route path="/events" element={<PageTransition><Events /></PageTransition>} />
            <Route path="/merchandise" element={<PageTransition><Merchandise /></PageTransition>} />
            <Route path="/notifications" element={<ProtectedRoute><PageTransition><Notifications /></PageTransition></ProtectedRoute>} />
            <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
          </Routes>
        </Suspense>
      </AnimatePresence>
    </ErrorBoundary>
  );
};

const App = () => {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AppSplashScreen />
        <TopLoadingBar />
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <AuthProvider>
              <CurrencyProvider>
                <RealtimeProvider>
                  <Toaster />
                  <Sonner />
                  <AppRoutes />
                </RealtimeProvider>
              </CurrencyProvider>
            </AuthProvider>
          </TooltipProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
};

export default App;
