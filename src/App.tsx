import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AuthProvider } from "@/contexts/AuthContext";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { ProtectedModuleRoute } from "@/components/layout/ProtectedModuleRoute";
import { AdminMasterRoute } from "@/components/layout/AdminMasterRoute";
import { RequireAuth } from "@/components/layout/RequireAuth";

// Auth (eager - small e necessário pra redirect)
import Auth from "./pages/Auth";
import ChangePassword from "./pages/ChangePassword";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Lazy-loaded pages (code-splitting por rota)
const Organograma = lazy(() => import("./pages/Organograma"));
const Profile = lazy(() => import("./pages/Profile"));
const Social = lazy(() => import("./pages/Social"));
const Comunicados = lazy(() => import("./pages/Comunicados"));
const Calendario = lazy(() => import("./pages/Calendario"));
const Documentos = lazy(() => import("./pages/Documentos"));
const LinksUteis = lazy(() => import("./pages/LinksUteis"));
const Diretorio = lazy(() => import("./pages/Diretorio"));
const Notificacoes = lazy(() => import("./pages/Notificacoes"));
const Precificacao = lazy(() => import("./pages/Precificacao"));
const GestaoGuias = lazy(() => import("./pages/GestaoGuias"));
const GuiaDetalhe = lazy(() => import("./pages/guias/GuiaDetalhe"));
const CarteiraComercial = lazy(() => import("./pages/CarteiraComercial"));
const GestaoOS = lazy(() => import("./pages/GestaoOS"));
const LiberacaoASOs = lazy(() => import("./pages/LiberacaoASOs"));
const GestaoOcorrencias = lazy(() => import("./pages/GestaoOcorrencias"));
const RetificacaoASOs = lazy(() => import("./pages/RetificacaoASOs"));
const GestaoPassivos = lazy(() => import("./pages/GestaoPassivos"));
const GestaoFeedback = lazy(() => import("./pages/GestaoFeedback"));
const GestaoContratual = lazy(() => import("./pages/GestaoContratual"));

// Admin (lazy - só carregados pelo ADM Master)
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminDepartments = lazy(() => import("./pages/admin/AdminDepartments"));
const AdminPermissions = lazy(() => import("./pages/admin/AdminPermissions"));
const AdminAudit = lazy(() => import("./pages/admin/AdminAudit"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminDocuments = lazy(() => import("./pages/admin/AdminDocuments"));
const AdminLaudosServicos = lazy(() => import("./pages/admin/AdminLaudosServicos"));
const AdminSigningDoctors = lazy(() => import("./pages/admin/AdminSigningDoctors"));
const AdminEmpresas = lazy(() => import("./pages/admin/AdminEmpresas"));

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              {/* Auth routes - no layout */}
              <Route path="/auth" element={<Auth />} />
              <Route path="/alterar-senha" element={<ChangePassword />} />

              {/* Portal routes with layout - all require authentication */}
              <Route element={<RequireAuth><PortalLayout /></RequireAuth>}>

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
                <Route path="/retificacao-asos" element={<ProtectedModuleRoute route="/retificacao-asos"><RetificacaoASOs /></ProtectedModuleRoute>} />
                <Route path="/gestao-passivos" element={<GestaoPassivos />} />
                <Route path="/gestao-feedback" element={<ProtectedModuleRoute route="/gestao-feedback"><GestaoFeedback /></ProtectedModuleRoute>} />
                <Route path="/social" element={<Social />} />
                <Route path="/gestao-contratual" element={<GestaoContratual />} />

                <Route path="/notificacoes" element={<Notificacoes />} />
                <Route path="/departamentos/*" element={<Index />} />

                {/* Admin routes - exclusivo ADM Master */}
                <Route path="/admin/usuarios" element={<Navigate to="/admin/permissoes?tab=usuarios" replace />} />
                <Route path="/admin/departamentos" element={<AdminMasterRoute><AdminDepartments /></AdminMasterRoute>} />
                <Route path="/admin/permissoes" element={<AdminMasterRoute><AdminPermissions /></AdminMasterRoute>} />
                <Route path="/admin/auditoria" element={<AdminMasterRoute><AdminAudit /></AdminMasterRoute>} />
                <Route path="/admin/configuracoes" element={<AdminMasterRoute><AdminSettings /></AdminMasterRoute>} />
                <Route path="/admin/documentos" element={<AdminMasterRoute><AdminDocuments /></AdminMasterRoute>} />
                <Route path="/admin/laudos-servicos" element={<AdminMasterRoute><AdminLaudosServicos /></AdminMasterRoute>} />
                <Route path="/admin/revisao-permissoes" element={<Navigate to="/admin/permissoes?tab=revisao-permissoes" replace />} />
                <Route path="/admin/revisao-vinculos" element={<Navigate to="/admin/permissoes?tab=revisao-vinculos" replace />} />
                <Route path="/admin/medicos-aso" element={<AdminMasterRoute><AdminSigningDoctors /></AdminMasterRoute>} />
                <Route path="/admin/empresas" element={<AdminMasterRoute><AdminEmpresas /></AdminMasterRoute>} />


                <Route path="/perfil" element={<Profile />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
