import { Switch, Route, useLocation } from "wouter";
import { MotionConfig } from "framer-motion";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { VerifyEmailBanner } from "@/components/VerifyEmailBanner";
import { ReadAloudProvider } from "@/components/ReadAloudProvider";
import { useSettings } from "@/hooks/use-settings";
import { useEffect, useRef } from "react";

import Home from "@/pages/Home";
import Places from "@/pages/Places";
import PlaceDetail from "@/pages/PlaceDetail";
import Submit from "@/pages/Submit";
import Community from "@/pages/Community";
import Petition, { PetitionDetail } from "@/pages/Petition";
import About from "@/pages/About";
import Settings from "@/pages/Settings";
import Resources from "@/pages/Resources";
import Benchmarks from "@/pages/Benchmarks";
import Guides from "@/pages/Guides";
import TransitElevators from "@/pages/TransitElevators";
import Events from "@/pages/Events";
import Blog from "@/pages/Blog";
import FAQ from "@/pages/FAQ";
import Contact from "@/pages/Contact";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import VerifyEmail from "@/pages/VerifyEmail";
import SavedPlaces from "@/pages/SavedPlaces";
import Profile from "@/pages/Profile";
import AdminDashboard from "@/pages/AdminDashboard";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/places" component={Places} />
      <Route path="/places/:id" component={PlaceDetail} />
      <Route path="/submit" component={Submit} />
      <Route path="/community" component={Community} />
      <Route path="/reviews" component={Community} />
      <Route path="/petitions" component={Petition} />
      <Route path="/petitions/:id" component={PetitionDetail} />
      <Route path="/about" component={About} />
      <Route path="/settings" component={Settings} />
      <Route path="/resources" component={Resources} />
      <Route path="/benchmarks" component={Benchmarks} />
      <Route path="/guides" component={Guides} />
      <Route path="/transit/elevators" component={TransitElevators} />
      <Route path="/events" component={Events} />
      <Route path="/blog" component={Blog} />
      <Route path="/faq" component={FAQ} />
      <Route path="/contact" component={Contact} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/saved" component={SavedPlaces} />
      <Route path="/profile" component={Profile} />
      <Route path="/admin/dashboard" component={AdminDashboard} />
      <Route path="/admin/moderation" component={AdminDashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

// After client-side navigation, start the new page at the top and move focus to it, so keyboard
// and screen-reader users land on the new content instead of the link they just used.
// Skipped on first load so the browser's own focus handling applies.
function useFocusOnRouteChange() {
  const [location] = useLocation();
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    window.scrollTo(0, 0);
    document.getElementById("main-content")?.focus({ preventScroll: true });
  }, [location]);
}

// Wrapper to apply global settings classes
function AppContent() {
  useFocusOnRouteChange();
  const { reducedMotion } = useSettings();

  // Apply reduced-motion class to HTML
  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", reducedMotion);
  }, [reducedMotion]);

  return (
    <MotionConfig reducedMotion={reducedMotion ? "always" : "user"}>
    <div className="flex flex-col min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-md focus:bg-primary focus:text-primary-foreground focus:font-bold"
      >
        Skip to main content
      </a>
      <Navigation />
      <div className="pt-16">
        <VerifyEmailBanner />
        <Breadcrumbs />
        <main id="main-content" tabIndex={-1} className="flex-grow focus:outline-none">
          <ErrorBoundary>
            <Router />
          </ErrorBoundary>
        </main>
      </div>
      <Footer />
      <ReadAloudProvider />
    </div>
    </MotionConfig>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
