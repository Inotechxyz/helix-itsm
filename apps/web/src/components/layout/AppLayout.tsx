import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Ticket,
  BookOpen,
  ShoppingCart,
  BarChart3,
  Users,
  Menu,
  X,
  Sun,
  Moon,
  Settings,
  ChevronDown,
  FolderTree,
  Layers,
  Briefcase,
  Tag,
  Server,
  AlertTriangle,
  Lightbulb,
  RefreshCw,
  Clock,
  Building2,
  Key,
  FileText,
  MessageSquare,
  Inbox,
  Brain,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useCurrentOrganization, useCurrentOrganizationId, useIsOrgAdmin } from '../../stores/organizationStore';
import { Button } from '../ui/Button';
import { useLicense } from '../../hooks/useLicense';
import { UserMenu } from './UserMenu';
import { ChatbotWidget } from '../chatbot';

// Module key to nav item mapping
const moduleKeyToNav = {
  tickets: { name: 'Tickets', href: '/tickets', icon: Ticket, key: 'tickets' },
  problems: { name: 'Problems', href: '/problems', icon: AlertTriangle, key: 'problems' },
  changes: { name: 'Changes', href: '/changes', icon: RefreshCw, key: 'changes' },
  assets: { name: 'Assets', href: '/assets', icon: Server, key: 'assets' },
  knowledge_base: { name: 'Knowledge Base', href: '/knowledge-base', icon: BookOpen, key: 'knowledge_base' },
  service_catalog: { name: 'Service Catalog', href: '/service-catalog', icon: ShoppingCart, key: 'service_catalog' },
  software_licenses: { name: 'Software Licenses', href: '/admin/software-licenses', icon: Server, key: 'software_licenses', admin: true },
  sla_policies: { name: 'SLA Policies', href: '/admin/sla-policies', icon: Clock, key: 'sla_policies', admin: true },
  ola_policies: { name: 'OLA Policies', href: '/admin/ola-policies', icon: Clock, key: 'ola_policies', admin: true },
  reports: { name: 'Reports', href: '/reports', icon: BarChart3, key: 'reports' },
};

const defaultMainNav = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, always: true },
  { name: 'Tickets', href: '/tickets', icon: Ticket, module: 'tickets' },
  { name: 'Assets', href: '/assets', icon: Server, module: 'assets' },
  { name: 'Problems', href: '/problems', icon: AlertTriangle, module: 'problems' },
  { name: 'Known Errors', href: '/known-errors', icon: Lightbulb, module: 'problems' },
  { name: 'Changes', href: '/changes', icon: RefreshCw, module: 'changes' },
  { name: 'Knowledge Base', href: '/knowledge-base', icon: BookOpen, module: 'knowledge_base' },
  { name: 'Service Catalog', href: '/service-catalog', icon: ShoppingCart, module: 'service_catalog' },
  { name: 'Service Requests', href: '/service-requests', icon: Inbox, module: 'service_catalog' },
  { name: 'Reports', href: '/reports', icon: BarChart3, module: 'reports' },
];

const defaultAdminNav = [
  { name: 'Organization Settings', href: '/settings/organization', icon: Building2, orgAdmin: true },
  { name: 'Users', href: '/admin/users', icon: Users },
  { name: 'Teams', href: '/admin/teams', icon: Users },
  { name: 'Ticket Categories', href: '/admin/ticket-categories', icon: Tag, module: 'tickets' },
  { name: 'Article Categories', href: '/admin/article-categories', icon: FolderTree, module: 'knowledge_base' },
  { name: 'Embeddings', href: '/admin/embeddings', icon: Brain, module: 'knowledge_base' },
  { name: 'Service Categories', href: '/admin/service-categories', icon: Layers, module: 'service_catalog' },
  { name: 'Services', href: '/admin/services', icon: Briefcase, module: 'service_catalog' },
  { name: 'Asset Types', href: '/admin/asset-types', icon: Server, module: 'assets' },
  { name: 'Change Categories', href: '/admin/change-categories', icon: RefreshCw, module: 'changes' },
  { name: 'SLA Policies', href: '/admin/sla-policies', icon: Clock, module: 'sla_policies' },
  { name: 'OLA Policies', href: '/admin/ola-policies', icon: Clock, module: 'ola_policies' },
  { name: 'Software Licenses', href: '/admin/software-licenses', icon: Server, module: 'software_licenses' },
  { name: 'Organizations', href: '/admin/organizations', icon: Building2, superadmin: true },
  { name: 'Audit Logs', href: '/admin/audit-logs', icon: FileText },
];

export function AppLayout() {
  const location = useLocation();
  const { user } = useAuthStore();
  const currentOrg = useCurrentOrganization();
  const organizationId = useCurrentOrganizationId();
  const isOrgAdmin = useIsOrgAdmin();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [adminExpanded, setAdminExpanded] = useState(false);

  // Check if user is superadmin
  const isSuperAdmin = user?.role === 'superadmin';

  // Check if user is requester (hide most nav items for requesters)
  const isRequester = currentOrg?.role === 'requester';

  // Get license status for this organization
  const { enabledModules, licenseStatus } = useLicense(organizationId || '');

  // Build main nav based on license and role
  const mainNav = defaultMainNav.filter((item) => {
    // Dashboard is always visible
    if ((item as any).always) return true;

    // Hide most nav items for requesters (they should use portal)
    if (isRequester) return false;

    // If no license imported, show only Dashboard
    if (!licenseStatus?.hasLicense) {
      return false;
    }

    // Check if module is in enabled modules list
    return item.module ? enabledModules.includes(item.module) : false;
  });

  // Build admin nav based on license and role
  const adminNav = defaultAdminNav.filter((item) => {
    // Hide admin nav for requesters entirely
    if (isRequester) return false;

    // SuperAdmin-only items (Organizations)
    if ((item as any).superadmin && !isSuperAdmin) return false;

    // OrgAdmin-only items (Organization Settings)
    if ((item as any).orgAdmin && !isOrgAdmin) return false;

    // If no license imported, show only basic admin items
    if (!licenseStatus?.hasLicense) {
      // Show Users, Teams, Organization Settings, Organizations
      const basicAdminItems = [
        '/admin/users',
        '/admin/teams',
        '/settings/organization',
        '/admin/organizations',
      ];
      return basicAdminItems.includes(item.href);
    }

    // Check if module is in enabled modules list
    if (item.module) {
      return enabledModules.includes(item.module);
    }

    return true;
  });

  const isAdminSection = location.pathname.startsWith('/admin');

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  const renderNavItem = (item: any, closeMobile: () => void) => {
    const isActive = location.pathname.startsWith(item.href);
    return (
      <Link
        key={item.name}
        to={item.href}
        onClick={closeMobile}
        className={`flex items-center px-3 py-2 rounded-md text-sm font-medium ${
          isActive
            ? 'bg-primary text-white'
            : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
        }`}
      >
        <item.icon className="w-5 h-5 mr-3" />
        {item.name}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-900/50" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 w-72 bg-white dark:bg-gray-800 flex flex-col">
          <div className="flex items-center justify-between h-16 px-6 border-b shrink-0">
            <span className="text-xl font-bold text-primary">Helix</span>
            <button onClick={() => setSidebarOpen(false)}>
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">
            <nav className="p-4 space-y-1">
              {mainNav.map((item) => renderNavItem(item, () => setSidebarOpen(false)))}
            </nav>

            {/* Admin section */}
            <div className="px-4 py-2 border-t">
              <button
                onClick={() => setAdminExpanded(!adminExpanded)}
                className="flex items-center w-full px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-300"
              >
                <Settings className="w-4 h-4 mr-2" />
                Administration
                <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${adminExpanded ? 'rotate-180' : ''}`} />
              </button>
              {adminExpanded && (
                <div className="mt-1 space-y-1 pb-4">
                  {adminNav.map((item) => renderNavItem(item, () => setSidebarOpen(false)))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col h-full bg-white dark:bg-gray-800 border-r">
          <div className="flex items-center h-16 px-6 border-b shrink-0">
            <span className="text-2xl font-bold text-primary">Helix</span>
            <span className="ml-2 text-sm text-muted-foreground">Helpdesk</span>
          </div>

          {/* Scrollable navigation area */}
          <div className="flex-1 overflow-y-auto">
            <nav className="p-4 space-y-1">
              {mainNav.map((item) => renderNavItem(item, () => {}))}
            </nav>

            {/* Admin section */}
            <div className="px-4 py-2 border-t">
              <button
                onClick={() => setAdminExpanded(!adminExpanded)}
                className={`flex items-center w-full px-3 py-2 text-xs font-semibold uppercase tracking-wider rounded-md ${
                  isAdminSection ? 'text-primary' : 'text-gray-500 dark:text-gray-400'
                } hover:bg-gray-100 dark:hover:bg-gray-700`}
              >
                <Settings className="w-4 h-4 mr-2" />
                Administration
                <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${adminExpanded || isAdminSection ? 'rotate-180' : ''}`} />
              </button>
              {(adminExpanded || isAdminSection) && (
                <div className="mt-1 space-y-1">
                  {adminNav.map((item) => renderNavItem(item, () => {}))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64 flex flex-col h-screen overflow-hidden">
        <div className="flex-shrink-0 flex items-center h-16 px-4 bg-white dark:bg-gray-800 border-b shadow-sm">
          <button
            className="lg:hidden -ml-0.5 -mt-0.5 inline-flex items-center justify-center rounded-md p-2 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleDarkMode}>
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>

            {/* User Menu with Organization Switcher */}
            <UserMenu />
          </div>
        </div>

        <main className="flex-1 overflow-y-auto">
          <div className="p-4">
            <Outlet />
          </div>
        </main>

        {/* AI Chatbot Widget */}
        <ChatbotWidget />
      </div>
    </div>
  );
}
