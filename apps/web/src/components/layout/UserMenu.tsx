import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Settings, LogOut, ChevronDown, Check, Building2, Crown } from 'lucide-react';
import { useOrganizationStore, useCurrentOrganization, useOrganizations } from '../../stores/organizationStore';
import { useAuthStore } from '../../stores/authStore';

export const UserMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const currentOrganization = useCurrentOrganization();
  const organizations = useOrganizations();
  const { switchOrganization, fetchOrganizations } = useOrganizationStore();
  const { user, logout } = useAuthStore();

  // Check if user is superadmin
  const isSuperadmin = user?.role === 'superadmin';

  // Fetch organizations on mount
  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    // Clear chatbot session before logout
    if (typeof window !== 'undefined' && (window as any).__clearChatbotSession) {
      (window as any).__clearChatbotSession();
    }
    await logout();
    navigate('/login');
  };

  const handleSwitchOrganization = async (orgId: string) => {
    if (orgId === currentOrganization?.id) {
      setIsOpen(false);
      return;
    }

    setIsSwitching(true);
    try {
      await switchOrganization(orgId);
      setIsOpen(false);
      window.location.reload();
    } catch {
      // Error is handled by the store
    } finally {
      setIsSwitching(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'superadmin':
        return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300';
      case 'orgadmin':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300';
      case 'manager':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300';
      case 'agent':
        return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
      case 'requester':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const formatRole = (role: string) => {
    if (role === 'superadmin') return 'Superadmin';
    return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
  };

  // Show organization switcher for superadmins or users with multiple orgs
  const showOrgSwitcher = isSuperadmin || organizations.length > 1;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* User Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-medium">
          {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
        </div>
        <div className="hidden md:block text-left">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {user?.firstName} {user?.lastName}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {isSuperadmin ? 'Superadmin' : (currentOrganization?.name || 'No org')}
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
          {/* User Info */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white text-lg font-medium">
                {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              {isSuperadmin ? (
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeColor('superadmin')}`}>
                  <span className="flex items-center gap-1">
                    <Crown className="w-3 h-3" />
                    Superadmin
                  </span>
                </span>
              ) : (
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeColor(user?.role || '')}`}>
                  {formatRole(user?.role || '')}
                </span>
              )}
              {isSuperadmin && currentOrganization && (
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                  Admin: {currentOrganization.name}
                </span>
              )}
              {!isSuperadmin && user?.role !== currentOrganization?.role && currentOrganization?.role && (
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeColor(currentOrganization.role)}`}>
                  {formatRole(currentOrganization.role)} in {currentOrganization.name}
                </span>
              )}
            </div>
          </div>

          {/* Organization Switcher Section */}
          {showOrgSwitcher && (
            <>
              <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  {isSuperadmin ? 'All Organizations' : 'Switch Organization'}
                </p>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {organizations.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => handleSwitchOrganization(org.id)}
                    disabled={isSwitching}
                    className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                      org.id === currentOrganization?.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    } ${isSwitching ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {org.logoUrl ? (
                      <img
                        src={org.logoUrl}
                        alt={org.name}
                        className="w-8 h-8 rounded-lg object-cover"
                      />
                    ) : (
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                        style={{ backgroundColor: org.primaryColor || '#0066CC' }}
                      >
                        {org.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{org.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {isSuperadmin ? 'Admin Access' : formatRole(org.role || '')}
                      </div>
                    </div>
                    {org.id === currentOrganization?.id && (
                      <Check className="w-4 h-4 text-blue-600" />
                    )}
                  </button>
                ))}
              </div>
              <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {isSuperadmin
                    ? `Managing ${organizations.length} organization${organizations.length !== 1 ? 's' : ''}`
                    : `Member of ${organizations.length} organization${organizations.length !== 1 ? 's' : ''}`}
                </p>
              </div>
            </>
          )}

          {/* Quick Links */}
          <div className="border-t border-gray-200 dark:border-gray-700 py-1">
            <button
              onClick={() => {
                setIsOpen(false);
                navigate('/profile');
              }}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <User className="w-4 h-4 text-gray-400" />
              Profile Settings
            </button>
          </div>

          {/* Logout */}
          <div className="border-t border-gray-200 dark:border-gray-700 py-1">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {isSwitching && (
        <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-lg flex items-center gap-3">
            <svg className="animate-spin h-5 w-5 text-blue-600" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span className="text-gray-700 dark:text-gray-200">Switching organization...</span>
          </div>
        </div>
      )}
    </div>
  );
};
