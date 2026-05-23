import { useCurrentOrganizationId } from '../stores/organizationStore';
import { useLicense } from './useLicense';

/**
 * Hook to check if a module is enabled based on the organization license
 * Automatically gets organization ID from the store
 */
export function useModuleEnabled(moduleKey: string) {
  const organizationId = useCurrentOrganizationId();
  const { enabledModules, licenseStatus } = useLicense(organizationId || '');

  // If no license imported, default to basic modules
  if (!licenseStatus?.hasLicense) {
    return moduleKey === 'tickets' || moduleKey === 'service_catalog';
  }

  return enabledModules.includes(moduleKey);
}

/**
 * Hook to filter a list of items by module availability
 * @param items - Array of items with optional module property
 * @param getModuleKey - Function to extract module key from item (defaults to item.module)
 */
export function useFilterByModule<T>(
  items: T[],
  getModuleKey?: (item: T) => string | undefined,
) {
  const organizationId = useCurrentOrganizationId();
  const { enabledModules, licenseStatus } = useLicense(organizationId || '');

  if (!items || items.length === 0) return [];

  // If no license imported, filter to basic modules only
  if (!licenseStatus?.hasLicense) {
    return items.filter((item) => {
      const module = getModuleKey ? getModuleKey(item) : (item as any).module;
      return module === 'tickets' || module === 'service_catalog' || !module;
    });
  }

  return items.filter((item) => {
    const module = getModuleKey ? getModuleKey(item) : (item as any).module;
    // If item has no module requirement, include it
    if (!module) return true;
    // Otherwise check if module is enabled
    return enabledModules.includes(module);
  });
}

/**
 * Hook to get all enabled module keys for the current organization
 */
export function useEnabledModules() {
  const organizationId = useCurrentOrganizationId();
  const { enabledModules, licenseStatus } = useLicense(organizationId || '');

  // If no license imported, return basic modules
  if (!licenseStatus?.hasLicense) {
    return ['tickets', 'service_catalog'];
  }

  return enabledModules;
}