import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Web3Provider } from "@/components/Web3Provider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ChainProvider } from "@/contexts/ChainContext";
import Index from "./pages/Index.tsx";

// Lazy-load all secondary routes. Keeps the initial JS bundle small —
// only the homepage + providers ship on first paint.
const About = lazy(() => import("./pages/About.tsx"));
const Submit = lazy(() => import("./pages/Submit.tsx"));
const Insights = lazy(() => import("./pages/Insights.tsx"));
const MerchantDetail = lazy(() => import("./pages/MerchantDetail.tsx"));
const EditListing = lazy(() => import("./pages/EditListing.tsx"));
const MapView = lazy(() => import("./pages/MapView.tsx"));
const MyListings = lazy(() => import("./pages/MyListings.tsx"));
const AdminPayments = lazy(() => import("./pages/AdminPayments.tsx"));
const AdminAgents = lazy(() => import("./pages/AdminAgents.tsx"));
const SubmitAIAgent = lazy(() => import("./pages/SubmitAIAgent.tsx"));
const AIAgents = lazy(() => import("./pages/AIAgents.tsx"));
const ApiDocs = lazy(() => import("./pages/ApiDocs.tsx"));
const AdminFeatured = lazy(() => import("./pages/AdminFeatured.tsx"));
const AdminListings = lazy(() => import("./pages/AdminListings.tsx"));
const DeploymentStatus = lazy(() => import("./pages/DeploymentStatus.tsx"));
const Leaderboard = lazy(() => import("./pages/Leaderboard.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
  </div>
);

const App = () => (
  <HelmetProvider>
    <ThemeProvider>
    <Web3Provider>
    <ChainProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/about" element={<About />} />
              <Route path="/submit" element={<Submit />} />
              <Route path="/submit/ai-agent" element={<SubmitAIAgent />} />
              <Route path="/ai-agents" element={<AIAgents />} />
              <Route path="/api-docs" element={<ApiDocs />} />
              {/* Swap temporarily disabled — will return powered by Circle App Kit */}
              <Route path="/swap" element={<Navigate to="/" replace />} />
              <Route path="/insights" element={<Insights />} />
              <Route path="/merchant/:id" element={<MerchantDetail />} />
              <Route path="/edit/:id" element={<EditListing />} />
              <Route path="/map" element={<MapView />} />
              <Route path="/my-listings" element={<MyListings />} />
              <Route path="/admin/payments" element={<AdminPayments />} />
              <Route path="/admin/agents" element={<AdminAgents />} />
              <Route path="/admin/featured" element={<AdminFeatured />} />
              <Route path="/admin/listings" element={<AdminListings />} />
              <Route path="/deployment-status" element={<DeploymentStatus />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </ChainProvider>
    </Web3Provider>
    </ThemeProvider>
  </HelmetProvider>
);

export default App;
