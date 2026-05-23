import React, { useState, useRef, useEffect } from 'react';
import { useOrganizationStore, useCurrentOrganization, useOrganizations } from '../../stores/organizationStore';
import { useAuthStore } from '../../stores/authStore';

interface OrgSwitcherProps {
  className?: string;
}

export const OrgSwitcher: React.FC<OrgSwitcherProps> = ({ className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentOrganization = useCurrentOrganization();
  const organizations = useOrganizations();
  const { switchOrganization, fetchOrganizations } = useOrganizationStore();
  const { setUser, setToken } = useAuthStore();

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

  const handleSwitchOrganization = async (orgId: string) => {
    if (orgId === currentOrganization?.id) {
      setIsOpen(false);
      return;
    }

    setIsSwitching(true);
    try {
      await switchOrganization(orgId);
      setIsOpen(false);
      // Reload the page to refresh all data with new org context
      window.location.reload();
    } catch {
      // Error is handled by the store
    } finally {
      setIsSwitching(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'orgadmin':
        return 'bg-purple-100 text-purple-800';
      case 'manager':
        return 'bg-blue-100 text-blue-800';
      case 'agent':
        return 'bg-green-100 text-green-800';
      case 'requester':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatRole = (role: string) => {
    return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
  };

  if (organizations.length <= 1) {
    // Don't show switcher if user only belongs to one org
    return null;
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Current Organization Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        disabled={isSwitching}
      >
        {currentOrganization?.logoUrl ? (
          <img
            src={currentOrganization.logoUrl}
            alt={currentOrganization.name}
            className="w-6 h-6 rounded-full object-cover"
          />
        ) : (
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
            style={{ backgroundColor: currentOrganization?.primaryColor || '#0066CC' }}
          >
            {currentOrganization?.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="text-left hidden sm:block">
          <div className="font-medium text-gray-900">{currentOrganization?.name}</div>
          <div className="text-xs text-gray-500">{formatRole(currentOrganization?.role || '')}</div>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
          <div className="px-4 py-2 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Switch Organization
            </p>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {organizations.map((org) => (
              <button
                key={org.id}
                onClick={() => handleSwitchOrganization(org.id)}
                disabled={isSwitching}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${
                  org.id === currentOrganization?.id ? 'bg-blue-50' : ''
                } ${isSwitching ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {org.logoUrl ? (
                  <img
                    src={org.logoUrl}
                    alt={org.name}
                    className="w-10 h-10 rounded-lg object-cover"
                  />
                ) : (
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg font-bold"
                    style={{ backgroundColor: org.primaryColor || '#0066CC' }}
                  >
                    {org.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 text-left">
                  <div className="font-medium text-gray-900">{org.name}</div>
                  <div className="text-sm text-gray-500">
                    {org.status === 'active' ? 'Active' : org.status}
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeColor(org.role || '')}`}>
                  {formatRole(org.role || '')}
                </span>
                {org.id === currentOrganization?.id && (
                  <svg
                    className="w-5 h-5 text-blue-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>

          <div className="border-t border-gray-100 px-4 py-2">
            <p className="text-xs text-gray-500">
              You belong to {organizations.length} organization{organizations.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {isSwitching && (
        <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 shadow-lg flex items-center gap-3">
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
            <span className="text-gray-700">Switching organization...</span>
          </div>
        </div>
      )}
    </div>
  );
};
