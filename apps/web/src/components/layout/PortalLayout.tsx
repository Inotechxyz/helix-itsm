import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  Home,
  ShoppingCart,
  BookOpen,
  Settings,
  Menu,
  X,
  Sun,
  Moon,
  User,
  LogOut,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useCurrentOrganization } from '../../stores/organizationStore';
import { Button } from '../ui/Button';
import { ChatbotWidget } from '../chatbot';

const portalNav = [
  { name: 'Home', href: '/portal', icon: Home },
  { name: 'Service Catalog', href: '/service-catalog', icon: ShoppingCart },
  { name: 'Knowledge Base', href: '/knowledge-base', icon: BookOpen },
];

export function PortalLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const currentOrg = useCurrentOrganization();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  const handleLogout = async () => {
    // Clear chatbot session before logout
    if (typeof window !== 'undefined' && (window as any).__clearChatbotSession) {
      (window as any).__clearChatbotSession();
    }
    await logout();
    navigate('/login');
  };

  const renderNavItem = (item: typeof portalNav[0], closeMobile: () => void) => {
    // For Home, use exact match. For others, use startsWith for sub-paths
    const isActive = item.href === '/portal'
      ? location.pathname === '/portal'
      : location.pathname.startsWith(item.href);

    return (
      <Link
        key={item.name}
        to={item.href}
        onClick={closeMobile}
        className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition ${
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
          {/* Header */}
          <div className="h-14 px-6 flex items-center justify-between border-b shrink-0">
            <span className="text-base font-semibold text-primary">Self-Service Portal</span>
            <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User info */}
          <div className="px-6 py-4 border-b">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-muted-foreground">Requester</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            {portalNav.map((item) => renderNavItem(item, () => setSidebarOpen(false)))}
          </nav>

          {/* Settings and Logout */}
          <div className="p-4 border-t space-y-1">
            <Link to="/profile" onClick={() => setSidebarOpen(false)}>
              <div className="flex items-center px-3 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                <Settings className="w-5 h-5 mr-3" />
                Settings
              </div>
            </Link>
            <button
              onClick={() => {
                setSidebarOpen(false);
                handleLogout();
              }}
              className="w-full flex items-center px-3 py-2 rounded-md text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <LogOut className="w-5 h-5 mr-3" />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col h-full bg-white dark:bg-gray-800 border-r">
          {/* Header */}
          <div className="h-14 px-6 flex items-center border-b shrink-0">
            <span className="text-base font-semibold text-primary">Self-Service Portal</span>
          </div>

          {/* User info */}
          <div className="px-6 py-4 border-b">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-muted-foreground">Requester</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            {portalNav.map((item) => renderNavItem(item, () => {}))}
          </nav>

          {/* Settings and Logout */}
          <div className="p-4 border-t space-y-1">
            <Link to="/profile">
              <div className="flex items-center px-3 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                <Settings className="w-5 h-5 mr-3" />
                Settings
              </div>
            </Link>
            <button
              onClick={handleLogout}
              className="w-full flex items-center px-3 py-2 rounded-md text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <LogOut className="w-5 h-5 mr-3" />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64 flex flex-col h-screen overflow-hidden">
        {/* Top Header */}
        <div className="flex-shrink-0 flex items-center justify-between h-14 px-4 bg-white dark:bg-gray-800 border-b">
          <span className="text-lg font-semibold text-gray-900 dark:text-white">{currentOrg?.name || 'Helpdesk'}</span>

          <Button variant="ghost" size="icon" onClick={toggleDarkMode}>
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          <Outlet />
        </main>

        {/* AI Chatbot Widget */}
        <ChatbotWidget />
      </div>
    </div>
  );
}