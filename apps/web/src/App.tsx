import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { useCurrentOrganization } from './stores/organizationStore';
import { AppLayout } from './components/layout/AppLayout';
import { PortalLayout } from './components/layout/PortalLayout';
import { ToastContainer } from './components/ui/Toast';
import { LoginPage } from './pages/LoginPage';
import { AzureCallbackPage } from './pages/AzureCallbackPage';
import { InvitationAcceptPage } from './pages/InvitationAcceptPage';
import { SelfServicePortal } from './pages/portal/SelfServicePortal';
import { DashboardPage } from './pages/DashboardPage';
import { TicketsPage } from './pages/TicketsPage';
import { TicketDetailPage } from './pages/TicketDetailPage';
import { TicketFormPage } from './pages/TicketFormPage';
import { KnowledgeBasePage } from './pages/KnowledgeBasePage';
import { ArticleDetailPage } from './pages/ArticleDetailPage';
import { ArticleFormPage } from './pages/ArticleFormPage';
import { ServiceCatalogPage } from './pages/ServiceCatalogPage';
import { ServiceRequestPage } from './pages/ServiceRequestPage';
import { ServiceRequestDetailPage } from './pages/ServiceRequestDetailPage';
import { ReportsPage } from './pages/ReportsPage';
import { AssetsPage } from './pages/AssetsPage';
import { AssetDetailPage } from './pages/AssetDetailPage';
import { AssetFormPage } from './pages/AssetFormPage';
import { ProblemsPage } from './pages/ProblemsPage';
import { ProblemDetailPage } from './pages/ProblemDetailPage';
import { ProblemFormPage } from './pages/ProblemFormPage';
import { KnownErrorsPage } from './pages/KnownErrorsPage';
import { ChangesPage } from './pages/ChangesPage';
import { ChangeDetailPage } from './pages/ChangeDetailPage';
import { ChangeFormPage } from './pages/ChangeFormPage';
import { SlaPoliciesPage } from './pages/SlaPoliciesPage';
import { SlaPolicyFormPage } from './pages/SlaPolicyFormPage';
import { OlaPoliciesPage } from './pages/OlaPoliciesPage';
import { SoftwareLicensesPage } from './pages/SoftwareLicensesPage';
import { CsatSurveyPage } from './pages/CsatSurveyPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminTeamsPage } from './pages/admin/AdminTeamsPage';
import { AdminTicketCategoriesPage } from './pages/admin/AdminTicketCategoriesPage';
import { AdminArticleCategoriesPage } from './pages/admin/AdminArticleCategoriesPage';
import { AdminServiceCategoriesPage } from './pages/admin/AdminServiceCategoriesPage';
import { AdminServicesPage } from './pages/admin/AdminServicesPage';
import { AdminAssetTypesPage } from './pages/admin/AdminAssetTypesPage';
import { AdminChangeCategoriesPage } from './pages/admin/AdminChangeCategoriesPage';
import { AdminOrganizationsPage } from './pages/admin/AdminOrganizationsPage';
import { AdminAuditLogsPage } from './pages/admin/AdminAuditLogsPage';
import { AdminServiceRequestsPage } from './pages/admin/AdminServiceRequestsPage';
import { AdminEmbeddingsPage } from './pages/admin/AdminEmbeddingsPage';
import { OrganizationSettingsPage } from './pages/OrganizationSettingsPage';
import { ProfileSettingsPage } from './pages/ProfileSettingsPage';

// Loading spinner component
function LoadingScreen() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );
}

// Simple auth guard - only checks authentication, no role logic
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isInitialized } = useAuthStore();

  // Show nothing while checking auth state on load (prevents flash)
  if (!isInitialized) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  const { initialize } = useAuthStore();
  const [ready, setReady] = useState(false);

  // Initialize auth state on app load - only once
  useEffect(() => {
    const init = async () => {
      try {
        await initialize();
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setReady(true);
      }
    };
    init();
  }, [initialize]);

  // Don't render routes until ready
  if (!ready) {
    return <LoadingScreen />;
  }

  return (
    <>
      <ToastContainer />
      <Routes>
        {/* Public routes - no authentication required */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/azure/callback" element={<AzureCallbackPage />} />
        <Route path="/invitations/accept" element={<InvitationAcceptPage />} />

        {/* Protected routes - all authenticated users */}
        <Route
          path="/"
          element={
            <RequireAuth>
              <AuthenticatedApp />
            </RequireAuth>
          }
        >
          {/* Root redirects based on role */}
          <Route index element={<IndexRedirect />} />

          {/* Dashboard and main pages */}
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="tickets" element={<TicketsPage />} />
          <Route path="tickets/new" element={<TicketFormPage />} />
          <Route path="tickets/:id" element={<TicketDetailPage />} />
          <Route path="tickets/:id/edit" element={<TicketFormPage />} />
          <Route path="knowledge-base" element={<KnowledgeBasePage />} />
          <Route path="knowledge-base/new" element={<ArticleFormPage />} />
          <Route path="knowledge-base/:slug" element={<ArticleDetailPage />} />
          <Route path="knowledge-base/:slug/edit" element={<ArticleFormPage />} />
          <Route path="service-catalog" element={<ServiceCatalogPage />} />
          <Route path="service-catalog/:slug" element={<ServiceRequestPage />} />
          <Route path="service-requests/:id" element={<ServiceRequestDetailPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="rate" element={<CsatSurveyPage />} />
          <Route path="assets" element={<AssetsPage />} />
          <Route path="assets/new" element={<AssetFormPage />} />
          <Route path="assets/:id" element={<AssetDetailPage />} />
          <Route path="assets/:id/edit" element={<AssetFormPage />} />
          <Route path="problems" element={<ProblemsPage />} />
          <Route path="problems/new" element={<ProblemFormPage />} />
          <Route path="problems/:id" element={<ProblemDetailPage />} />
          <Route path="problems/:id/edit" element={<ProblemFormPage />} />
          <Route path="known-errors" element={<KnownErrorsPage />} />
          <Route path="changes" element={<ChangesPage />} />
          <Route path="changes/new" element={<ChangeFormPage />} />
          <Route path="changes/:id" element={<ChangeDetailPage />} />
          <Route path="changes/:id/edit" element={<ChangeFormPage />} />

          {/* Admin routes */}
          <Route path="admin/users" element={<AdminUsersPage />} />
          <Route path="admin/teams" element={<AdminTeamsPage />} />
          <Route path="admin/ticket-categories" element={<AdminTicketCategoriesPage />} />
          <Route path="admin/article-categories" element={<AdminArticleCategoriesPage />} />
          <Route path="admin/embeddings" element={<AdminEmbeddingsPage />} />
          <Route path="admin/service-categories" element={<AdminServiceCategoriesPage />} />
          <Route path="admin/services" element={<AdminServicesPage />} />
          <Route path="service-requests" element={<AdminServiceRequestsPage />} />
          <Route path="service-requests/:id" element={<ServiceRequestDetailPage />} />
          <Route path="admin/asset-types" element={<AdminAssetTypesPage />} />
          <Route path="admin/change-categories" element={<AdminChangeCategoriesPage />} />
          <Route path="admin/sla-policies" element={<SlaPoliciesPage />} />
          <Route path="admin/sla-policies/new" element={<SlaPolicyFormPage />} />
          <Route path="admin/sla-policies/:id" element={<SlaPolicyFormPage />} />
          <Route path="admin/ola-policies" element={<OlaPoliciesPage />} />
          <Route path="admin/software-licenses" element={<SoftwareLicensesPage />} />
          <Route path="admin/organizations" element={<AdminOrganizationsPage />} />
          <Route path="admin/audit-logs" element={<AdminAuditLogsPage />} />
          <Route path="settings/organization" element={<OrganizationSettingsPage />} />
          <Route path="profile" element={<ProfileSettingsPage />} />

          {/* Portal routes - available to requesters */}
          <Route path="portal" element={<SelfServicePortal />} />
        </Route>

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
}

// Inner component that handles layout and portal routing
// This is rendered AFTER auth is confirmed, so no more loading issues
function AuthenticatedApp() {
  const { user } = useAuthStore();
  const currentOrganization = useCurrentOrganization();

  // Superadmin always uses AppLayout (dashboard)
  if (user?.role === 'superadmin') {
    console.log('[AuthenticatedApp] Superadmin user, using AppLayout');
    return <AppLayout />;
  }

  // Get the organization role - this is stored in currentOrganization.role
  // which comes from the OrganizationUser table
  const orgRole = currentOrganization?.role;

  // For requesters, use PortalLayout
  const isRequester = orgRole === 'requester';

  console.log('[AuthenticatedApp] User role:', user?.role, 'Org role:', orgRole, 'IsRequester:', isRequester);

  if (isRequester) {
    return <PortalLayout />;
  }

  // For agents, managers, orgadmins, etc., use AppLayout
  return <AppLayout />;
}

// Route redirect component for role-based routing
function IndexRedirect() {
  const { user } = useAuthStore();
  const currentOrganization = useCurrentOrganization();

  // Superadmin always goes to dashboard
  if (user?.role === 'superadmin') {
    console.log('[IndexRedirect] Superadmin user, redirecting to /dashboard');
    return <Navigate to="/dashboard" replace />;
  }

  // For non-superadmin users, check organization role
  // Requesters go to portal, others go to dashboard
  const orgRole = currentOrganization?.role;
  const isRequester = orgRole === 'requester';

  const redirectPath = isRequester ? '/portal' : '/dashboard';
  console.log('[IndexRedirect] User role:', user?.role, 'Org role:', orgRole, 'Redirect:', redirectPath);

  return <Navigate to={redirectPath} replace />;
}

export default App;