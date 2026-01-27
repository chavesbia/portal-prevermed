import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { PortalLayout } from "@/components/layout/PortalLayout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ChangePassword from "./pages/ChangePassword";
import NotFound from "./pages/NotFound";
import Profile from "./pages/Profile";
import Social from "./pages/Social";
import Chat from "./pages/Chat";
import Comunicados from "./pages/Comunicados";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminDepartments from "./pages/admin/AdminDepartments";
import AdminPermissions from "./pages/admin/AdminPermissions";
import AdminAudit from "./pages/admin/AdminAudit";
import AdminSettings from "./pages/admin/AdminSettings";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Auth routes - no layout */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/alterar-senha" element={<ChangePassword />} />
            
            {/* Portal routes with layout */}
            <Route element={<PortalLayout />}>
              <Route path="/" element={<Index />} />
              <Route path="/comunicados" element={<Comunicados />} />
              <Route path="/documentos" element={<Index />} />
              <Route path="/links" element={<Index />} />
              <Route path="/organograma" element={<Index />} />
              <Route path="/social" element={<Social />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/notificacoes" element={<Index />} />
              <Route path="/departamentos/*" element={<Index />} />
              
              {/* Admin routes */}
              <Route path="/admin/usuarios" element={<AdminUsers />} />
              <Route path="/admin/departamentos" element={<AdminDepartments />} />
              <Route path="/admin/permissoes" element={<AdminPermissions />} />
              <Route path="/admin/auditoria" element={<AdminAudit />} />
              <Route path="/admin/configuracoes" element={<AdminSettings />} />
              
              <Route path="/perfil" element={<Profile />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
