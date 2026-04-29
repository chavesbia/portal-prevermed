import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { ProtectedModuleRoute } from "@/components/layout/ProtectedModuleRoute";
import { AdminMasterRoute } from "@/components/layout/AdminMasterRoute";
import Index from "./pages/Index";
import Organograma from "./pages/Organograma";
import Auth from "./pages/Auth";
import ChangePassword from "./pages/ChangePassword";
import NotFound from "./pages/NotFound";
import Profile from "./pages/Profile";
import Social from "./pages/Social";
import Chat from "./pages/Chat";
import Comunicados from "./pages/Comunicados";
import Calendario from "./pages/Calendario";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminDepartments from "./pages/admin/AdminDepartments";
import AdminPermissions from "./pages/admin/AdminPermissions";
import AdminAudit from "./pages/admin/AdminAudit";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminDocuments from "./pages/admin/AdminDocuments";
import AdminLaudosServicos from "./pages/admin/AdminLaudosServicos";

import Documentos from "./pages/Documentos";
import LinksUteis from "./pages/LinksUteis";
import Diretorio from "./pages/Diretorio";
import Notificacoes from "./pages/Notificacoes";
import Precificacao from "./pages/Precificacao";
import GestaoGuias from "./pages/GestaoGuias";
import GuiaDetalhe from "./pages/guias/GuiaDetalhe";
import CarteiraComercial from "./pages/CarteiraComercial";
import GestaoOS from "./pages/GestaoOS";
import LiberacaoASOs from "./pages/LiberacaoASOs";
import GestaoOcorrencias from "./pages/GestaoOcorrencias";

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
              <Route path="/calendario" element={<Calendario />} />
              <Route path="/documentos" element={<Documentos />} />
              
              <Route path="/links" element={<LinksUteis />} />
              <Route path="/diretorio" element={<Diretorio />} />
              <Route path="/organograma" element={<Organograma />} />
              <Route path="/precificacao" element={<Precificacao />} />
              <Route path="/gestao-guias" element={<GestaoGuias />} />
              <Route path="/guias/:codigo" element={<GuiaDetalhe />} />
              <Route path="/carteira-comercial" element={<CarteiraComercial />} />
              <Route path="/gestao-os" element={<GestaoOS />} />
              <Route path="/gestao-ocorrencias" element={<ProtectedModuleRoute route="/gestao-ocorrencias"><GestaoOcorrencias /></ProtectedModuleRoute>} />
              <Route path="/liberacao-asos" element={<ProtectedModuleRoute route="/liberacao-asos"><LiberacaoASOs /></ProtectedModuleRoute>} />
              <Route path="/social" element={<Social />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/notificacoes" element={<Notificacoes />} />
              <Route path="/departamentos/*" element={<Index />} />
              
              {/* Admin routes - exclusivo ADM Master */}
              <Route path="/admin/usuarios" element={<AdminMasterRoute><AdminUsers /></AdminMasterRoute>} />
              <Route path="/admin/departamentos" element={<AdminMasterRoute><AdminDepartments /></AdminMasterRoute>} />
              <Route path="/admin/permissoes" element={<AdminMasterRoute><AdminPermissions /></AdminMasterRoute>} />
              <Route path="/admin/auditoria" element={<AdminMasterRoute><AdminAudit /></AdminMasterRoute>} />
              <Route path="/admin/configuracoes" element={<AdminMasterRoute><AdminSettings /></AdminMasterRoute>} />
              <Route path="/admin/documentos" element={<AdminMasterRoute><AdminDocuments /></AdminMasterRoute>} />
              <Route path="/admin/laudos-servicos" element={<AdminMasterRoute><AdminLaudosServicos /></AdminMasterRoute>} />
              
              
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
