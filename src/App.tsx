import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { PortalLayout } from "@/components/layout/PortalLayout";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route element={<PortalLayout />}>
              <Route path="/" element={<Index />} />
              <Route path="/comunicados" element={<Index />} />
              <Route path="/documentos" element={<Index />} />
              <Route path="/links" element={<Index />} />
              <Route path="/organograma" element={<Index />} />
              <Route path="/social" element={<Index />} />
              <Route path="/chat" element={<Index />} />
              <Route path="/notificacoes" element={<Index />} />
              <Route path="/departamentos/*" element={<Index />} />
              <Route path="/admin/*" element={<Index />} />
              <Route path="/perfil" element={<Index />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
