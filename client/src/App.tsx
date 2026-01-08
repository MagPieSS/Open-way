import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Navigation } from "@/components/Navigation";
import { useSettings } from "@/hooks/use-settings";
import { useEffect } from "react";

import Home from "@/pages/Home";
import Places from "@/pages/Places";
import PlaceDetail from "@/pages/PlaceDetail";
import Submit from "@/pages/Submit";
import Community from "@/pages/Community";
import Petition from "@/pages/Petition";
import About from "@/pages/About";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/places" component={Places} />
      <Route path="/places/:id" component={PlaceDetail} />
      <Route path="/submit" component={Submit} />
      <Route path="/reviews" component={Community} />
      <Route path="/petition" component={Petition} />
      <Route path="/about" component={About} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

// Wrapper to apply global settings classes
function AppContent() {
  const { reducedMotion } = useSettings();

  // Apply reduced-motion class to HTML
  useEffect(() => {
    if (reducedMotion) {
      document.documentElement.style.setProperty('scroll-behavior', 'auto');
      // Add a class that disables all CSS animations if needed
      // For now, Tailwind 'motion-reduce' handles system pref, but we force it via class if we wanted manually
    } else {
      document.documentElement.style.removeProperty('scroll-behavior');
    }
  }, [reducedMotion]);

  return (
    <div className="flex flex-col min-h-screen">
      <Navigation />
      <main className="flex-grow">
        <Router />
      </main>
      <footer className="bg-secondary py-12 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 text-center text-muted-foreground">
          <p>© 2024 Open Way. Built for everyone.</p>
        </div>
      </footer>
    </div>
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
