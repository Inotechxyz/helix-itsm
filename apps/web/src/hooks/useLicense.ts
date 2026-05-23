import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationsApi } from '../api/client';

export interface LicenseStatus {
  hasLicense: boolean;
  tier: string;
  modules: string[];
  expiresAt: string;
  daysRemaining: number;
  isExpiringSoon: boolean;
  isExpired: boolean;
  validatedAt: string;
  // AI Chatbot
  aiEnabled: boolean;
  aiModel: string | null;
}

export interface ImportLicenseResponse {
  success: boolean;
  organizationId: string;
  organizationName: string;
  tier: string;
  modules: string[];
  expiresAt: string;
  message: string;
}

/**
 * Hook for license management
 * @param organizationId - The ID of the organization to get license for
 */
export function useLicense(organizationId: string) {
  const queryClient = useQueryClient();

  // Get license status
  const {
    data: licenseStatus,
    isLoading: statusLoading,
    error: statusError,
    refetch: refetchStatus,
  } = useQuery<LicenseStatus>({
    queryKey: ['organizations', organizationId, 'license'],
    queryFn: () => organizationsApi.getLicenseStatus(organizationId).then((r) => r.data),
    staleTime: 60000, // 1 minute
    enabled: !!organizationId,
  });

  // Get enabled modules
  const {
    data: modulesData,
    isLoading: modulesLoading,
    error: modulesError,
  } = useQuery<{ modules: string[] }>({
    queryKey: ['organizations', organizationId, 'license-modules'],
    queryFn: () => organizationsApi.getEnabledModules(organizationId).then((r) => r.data),
    staleTime: 60000,
    enabled: !!organizationId,
  });

  // Import license mutation
  const importLicense = useMutation<ImportLicenseResponse, Error, string>({
    mutationFn: (token) => organizationsApi.importLicense(organizationId, token).then((r) => r.data as ImportLicenseResponse),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations', organizationId, 'license'] });
      queryClient.invalidateQueries({ queryKey: ['organizations', organizationId, 'license-modules'] });
    },
  });

  // Refresh license mutation
  const refreshLicense = useMutation({
    mutationFn: () => organizationsApi.refreshLicense(organizationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations', organizationId, 'license'] });
      queryClient.invalidateQueries({ queryKey: ['organizations', organizationId, 'license-modules'] });
    },
  });

  // Invalidate cache mutation
  const invalidateCache = useMutation({
    mutationFn: () => organizationsApi.invalidateLicenseCache(organizationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations', organizationId, 'license'] });
      queryClient.invalidateQueries({ queryKey: ['organizations', organizationId, 'license-modules'] });
    },
  });

  return {
    // License status
    licenseStatus,
    isLoading: statusLoading,
    error: statusError,
    refetchStatus,

    // Modules
    enabledModules: modulesData?.modules || [],
    isLoadingModules: modulesLoading,
    modulesError,

    // Mutations
    importLicense,
    refreshLicense,
    invalidateCache,

    // Helpers
    isExpired: licenseStatus?.isExpired || false,
    isExpiringSoon: licenseStatus?.isExpiringSoon || false,
    daysRemaining: licenseStatus?.daysRemaining || 0,
    tier: licenseStatus?.tier || 'basic',
  };
}

/**
 * Hook to check if a specific module is enabled
 * @param organizationId - The ID of the organization
 * @param moduleKey - The module key to check
 */
export function useIsModuleEnabled(organizationId: string, moduleKey: string) {
  const { enabledModules, isLoadingModules } = useLicense(organizationId);

  return {
    isEnabled: enabledModules.includes(moduleKey),
    isLoading: isLoadingModules,
  };
}

/**
 * Hook for license status only (lighter query)
 * @param organizationId - The ID of the organization
 */
export function useLicenseExpiry(organizationId: string) {
  const { data: licenseStatus } = useQuery<LicenseStatus>({
    queryKey: ['organizations', organizationId, 'license'],
    queryFn: () => organizationsApi.getLicenseStatus(organizationId).then((r) => r.data),
    staleTime: 60000,
    enabled: !!organizationId,
  });

  return {
    isExpired: licenseStatus?.isExpired || false,
    isExpiringSoon: licenseStatus?.isExpiringSoon || false,
    daysRemaining: licenseStatus?.daysRemaining || 0,
    expiresAt: licenseStatus?.expiresAt || null,
  };
}