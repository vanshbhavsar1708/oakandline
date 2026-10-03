import { lazy, Suspense, useEffect } from "react";
import { Switch, Route, Router, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import PublicLayout from "@/components/site/PublicLayout";
import Home from "@/pages/home";
import NotFound from "@/pages/not-found";

// Code-split everything that isn't the landing page.
const Work = lazy(() => import("@/pages/work"));
const ProjectDetail = lazy(() => import("@/pages/project"));
const Contact = lazy(() => import("@/pages/contact"));
const Play = lazy(() => import("@/pages/play"));
const AdminApp = lazy(() => import("@/pages/admin/AdminApp"));

/**
 * Hash routing is required inside the sandboxed preview iframe.
 * For Netlify / production set VITE_ROUTER=browser to get clean URLs (/work, /contact…).
 */
const useBrowserRouting = import.meta.env.VITE_ROUTER === "browser";

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [location]);
  return null;
}

function PageFallback() {
  return (
    <div className="min-h-[60vh] grid place-items-center" aria-busy="true" aria-live="polite">
      <span className="eyebrow text-muted-foreground">Loading</span>
    </div>
  );
}

function AppRouter() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Switch>
        <Route path="/admin" nest>
          <AdminApp />
        </Route>
        <Route>
          <PublicLayout>
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/work" component={Work} />
              <Route path="/work/:slug" component={ProjectDetail} />
              <Route path="/contact" component={Contact} />
              <Route path="/play" component={Play} />
              <Route component={NotFound} />
            </Switch>
          </PublicLayout>
        </Route>
      </Switch>
    </Suspense>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          {useBrowserRouting ? (
            <Router>
              <ScrollToTop />
              <AppRouter />
            </Router>
          ) : (
            <Router hook={useHashLocation}>
              <ScrollToTop />
              <AppRouter />
            </Router>
          )}
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
