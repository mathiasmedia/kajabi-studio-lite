import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { RequireAuth } from "@/components/RequireAuth";
import Index from "./pages/Index.tsx";
// LandingPagesDashboard is no longer routed — the unified workspace at "/" shows
// both websites and landing pages. The file is kept for thin-client sync compat.

import SiteEditor from "./pages/SiteEditor.tsx";
import Auth from "./pages/Auth.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import Admin from "./pages/Admin.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <Index />
                </RequireAuth>
              }
            />
            {/* Legacy /landing-pages → unified workspace at "/" */}
            <Route path="/landing-pages" element={<Navigate to="/" replace />} />
            <Route
              path="/sites/:siteId"
              element={
                <RequireAuth>
                  <SiteEditor />
                </RequireAuth>
              }
            />
            <Route
              path="/admin"
              element={
                <RequireAuth>
                  <Admin />
                </RequireAuth>
              }
            />
            {/* Legacy /admin/users → /admin */}
            <Route path="/admin/users" element={<Navigate to="/admin" replace />} />
            {/* Legacy /export route → bounce to dashboard */}
            <Route path="/export" element={<Navigate to="/" replace />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
