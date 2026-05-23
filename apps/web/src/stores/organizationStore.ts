import { create } from 'zustand';
import { api, getOrgContext, setOrgContext as setOrgContextHelper } from '../api/client';
import { queryClient } from '../lib/query';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  status: string;
  tier?: string;
  maxUsers?: number;
  createdAt?: string;
  logoUrl?: string;
  primaryColor?: string;
  role?: string;
  joinedAt?: string;
  isSuperadmin?: boolean; // Indicates superadmin access to this org
}

interface OrganizationState {
  currentOrganization: Organization | null;
  organizations: Organization[];
  activeOrganizationId: string | null; // For admin panel org context
  isLoading: boolean;
  error: string | null;
  setCurrentOrganization: (org: Organization | null) => void;
  setOrganizations: (orgs: Organization[]) => void;
  setActiveOrganizationId: (orgId: string | null) => void;
  fetchOrganizations: () => Promise<void>;
  switchOrganization: (organizationId: string) => Promise<void>;
  fetchOrgBySlug: (slug: string) => Promise<Organization | null>;
}

/**
 * Organization Store Implementation
 *
 * Manages organization context for multi-tenant support.
 * Users can belong to multiple organizations and switch between them.
 */
export const useOrganizationStore = create<OrganizationState>()((set, get) => ({
  currentOrganization: null,
  organizations: [],
  activeOrganizationId: null,
  isLoading: false,
  error: null,

  setCurrentOrganization: (org) => set({ currentOrganization: org }),

  setOrganizations: (orgs) => set({ organizations: orgs }),

  /**
   * Set the active organization for org-scoped admin queries
   * This sets the x-organization-id header for API calls
   */
  setActiveOrganizationId: (orgId: string | null) => {
    const org = orgId ? get().organizations.find(o => o.id === orgId) : null;
    setOrgContextHelper(orgId, org?.slug || null);
    set({ activeOrganizationId: orgId });
  },

  /**
   * Fetch all organizations the current user belongs to
   * For superadmins, fetches all organizations
   */
  fetchOrganizations: async () => {
    // Prevent concurrent calls
    if (get().isLoading) {
      console.log('[OrgStore] Already loading, skipping');
      return;
    }

    console.log('[OrgStore] fetchOrganizations called');
    set({ isLoading: true, error: null });
    try {
      console.log('[OrgStore] Fetching /auth/org/me');
      const response = await api.get('/auth/org/me');
      // API returns {...user, organizations} - user fields are spread at root level
      const { organizations } = response.data;
      const user = {
        id: response.data.id,
        firstName: response.data.firstName,
        lastName: response.data.lastName,
        email: response.data.email,
        role: response.data.role,
      };
      console.log('[OrgStore] Response:', { user, organizationsCount: organizations?.length });

      // Check if user is superadmin
      const isSuperadmin = user?.role === 'superadmin';

      // Find current org from context or first one (for non-superadmins)
      let currentOrg = null;

      if (isSuperadmin && organizations.length === 0) {
        // Superadmin with no org yet - don't auto-select
        currentOrg = null;
        console.log('[OrgStore] Superadmin with no orgs - not auto-selecting');
      } else {
        // Check context first, then use first org
        const currentOrgContext = getOrgContext();
        console.log('[OrgStore] Current org context from sessionStorage:', currentOrgContext);

        if (currentOrgContext.organizationId) {
          currentOrg = organizations.find((o: any) => o.id === currentOrgContext.organizationId) || null;
          console.log('[OrgStore] Found org from context:', currentOrg);
        }
        if (!currentOrg && organizations.length > 0) {
          currentOrg = organizations[0];
          console.log('[OrgStore] Using first org as current:', currentOrg);
        }

        // Update org context if we have a currentOrg (regardless of what was in sessionStorage)
        // This ensures we use the correct org when logging in or when sessionStorage is stale
        if (currentOrg) {
          console.log('[OrgStore] Setting org context:', { id: currentOrg.id, slug: currentOrg.slug });
          setOrgContextHelper(currentOrg.id, currentOrg.slug);
        }
      }

      console.log('[OrgStore] Final currentOrg:', currentOrg);

      set({
        organizations,
        currentOrganization: currentOrg,
        activeOrganizationId: currentOrg?.id || null,
        isLoading: false,
      });

      // Verify sessionStorage was set
      const verifyContext = getOrgContext();
      console.log('[OrgStore] Verified sessionStorage:', verifyContext);
    } catch (error: any) {
      console.error('[OrgStore] Error:', error);
      set({
        error: error.response?.data?.message || 'Failed to fetch organizations',
        isLoading: false,
      });
    }
  },

  /**
   * Switch to a different organization
   */
  switchOrganization: async (organizationId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/auth/org/switch', { organizationId });
      const { accessToken, user, organization, organizations } = response.data;

      // Update auth header with new token
      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
      sessionStorage.setItem('helix_session_token', accessToken);
      sessionStorage.setItem('helix_session_user', JSON.stringify(user));

      // Update org context
      setOrgContextHelper(organization.id, organization.slug);

      // Clear ALL React Query caches to ensure completely fresh data for new org
      // Using clear() to force immediate refetch instead of just marking as stale
      await queryClient.clear();

      set({
        currentOrganization: organization,
        organizations,
        activeOrganizationId: organization.id,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to switch organization',
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Fetch organization info by slug (for login page)
   */
  fetchOrgBySlug: async (slug: string) => {
    try {
      const response = await api.get(`/auth/org/${slug}`);
      return response.data;
    } catch {
      return null;
    }
  },
}));

// Selector hooks for convenient access
export const useCurrentOrganization = () =>
  useOrganizationStore((state) => state.currentOrganization);

export const useOrganizations = () =>
  useOrganizationStore((state) => state.organizations);

export const useCurrentOrganizationId = () =>
  useOrganizationStore((state) => state.currentOrganization?.id || null);

export const useIsOrgAdmin = () => {
  const currentOrg = useCurrentOrganization();
  return currentOrg?.role === 'orgadmin';
};

export const useIsSuperAdmin = () => {
  // This would come from the auth store
  const user = JSON.parse(sessionStorage.getItem('helix_session_user') || '{}');
  return user.role === 'superadmin';
};
