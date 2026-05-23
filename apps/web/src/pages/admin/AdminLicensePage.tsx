import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationsApi } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Loader2, Key, AlertTriangle, CheckCircle, XCircle, RefreshCw, Copy, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useCurrentOrganizationId } from '../../stores/organizationStore';

interface LicenseStatus {
  hasLicense: boolean;
  tier: string;
  modules: string[];
  expiresAt: string;
  daysRemaining: number;
  isExpiringSoon: boolean;
  isExpired: boolean;
  validatedAt: string;
}

interface ImportResponse {
  success: boolean;
  organizationId: string;
  organizationName: string;
  tier: string;
  modules: string[];
  expiresAt: string;
  message: string;
}

const TIER_DESCRIPTIONS: Record<string, string> = {
  basic: 'Essential ITSM features (tickets, service catalog)',
  standard: 'Core ITSM workflow (tickets, problems, knowledge base, service catalog)',
  premium: 'Extended operations (+ changes, assets, software licenses, reports)',
  enterprise: 'Full platform (+ SLA policies, OLA policies)',
  custom: 'Custom module selection',
};

const MODULE_DISPLAY_NAMES: Record<string, string> = {
  tickets: 'Tickets',
  problems: 'Problems',
  changes: 'Changes',
  assets: 'Assets',
  knowledge_base: 'Knowledge Base',
  service_catalog: 'Service Catalog',
  software_licenses: 'Software Licenses',
  sla_policies: 'SLA Policies',
  ola_policies: 'OLA Policies',
  reports: 'Reports',
};

export function AdminLicensePage() {
  const queryClient = useQueryClient();
  const organizationId = useCurrentOrganizationId();
  const [tokenInput, setTokenInput] = useState('');

  // Get current license status
  const { data: licenseStatus, isLoading: statusLoading } = useQuery<LicenseStatus>({
    queryKey: ['organizations', organizationId, 'license'],
    queryFn: () => organizationsApi.getLicenseStatus(organizationId!).then((r) => r.data),
    refetchInterval: 60000, // Refresh every minute
    enabled: !!organizationId,
  });

  // Import license mutation
  const importMutation = useMutation<ImportResponse, Error, string>({
    mutationFn: (token) => organizationsApi.importLicense(organizationId!, token).then((r) => r.data),
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['organizations', organizationId, 'license'] });
      setTokenInput('');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to import license');
    },
  });

  // Refresh license mutation
  const refreshMutation = useMutation({
    mutationFn: () => organizationsApi.refreshLicense(organizationId!).then((r) => r.data),
    onSuccess: () => {
      toast.success('License refreshed successfully');
      queryClient.invalidateQueries({ queryKey: ['organizations', organizationId, 'license'] });
    },
    onError: () => {
      toast.error('Failed to refresh license');
    },
  });

  // Invalidate cache mutation
  const invalidateCacheMutation = useMutation({
    mutationFn: () => organizationsApi.invalidateLicenseCache(organizationId!).then((r) => r.data),
    onSuccess: () => {
      toast.success('License cache invalidated');
      queryClient.invalidateQueries({ queryKey: ['organizations', organizationId, 'license'] });
    },
    onError: () => {
      toast.error('Failed to invalidate cache');
    },
  });

  const handleImport = () => {
    if (!tokenInput.trim()) {
      toast.error('Please enter a license token');
      return;
    }
    importMutation.mutate(tokenInput.trim());
  };

  const copyTokenToClipboard = () => {
    if (licenseStatus) {
      navigator.clipboard.writeText(JSON.stringify({
        tier: licenseStatus.tier,
        modules: licenseStatus.modules,
        expiresAt: licenseStatus.expiresAt,
      }, null, 2));
      toast.success('License info copied to clipboard');
    }
  };

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isExpired = licenseStatus?.isExpired;
  const isExpiringSoon = licenseStatus?.isExpiringSoon;
  const hasLicense = licenseStatus?.hasLicense;

  return (
    <div className="h-full overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">License Management</h1>
          <p className="text-muted-foreground">Manage your organization's Helix license</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending || !hasLicense}
          >
            {refreshMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => invalidateCacheMutation.mutate()}
            disabled={invalidateCacheMutation.isPending || !hasLicense}
          >
            {invalidateCacheMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Clear Cache
          </Button>
        </div>
      </div>

      {/* Status Banner */}
      {isExpired && (
        <Card className="border-red-500 bg-red-50 dark:bg-red-900/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900 rounded-full shrink-0">
                <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="font-medium text-red-700 dark:text-red-400">License Expired</h3>
                <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                  Your organization's license has expired. Please contact Helix support to renew your license.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isExpiringSoon && !isExpired && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-full shrink-0">
                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <h3 className="font-medium text-yellow-700 dark:text-yellow-400">License Expiring Soon</h3>
                <p className="text-sm text-yellow-600 dark:text-yellow-300 mt-1">
                  Your license will expire in {licenseStatus?.daysRemaining} days. Please renew before the expiration date.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* License Info Card */}
      {hasLicense && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Current License
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={copyTokenToClipboard}>
              <Copy className="w-4 h-4 mr-2" />
              Copy Info
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Tier</p>
                <p className="text-lg font-semibold capitalize">{licenseStatus?.tier}</p>
                <p className="text-sm text-muted-foreground">{TIER_DESCRIPTIONS[licenseStatus?.tier || 'basic']}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Expires</p>
                <p className="text-lg font-semibold">
                  {licenseStatus?.expiresAt ? new Date(licenseStatus.expiresAt).toLocaleDateString() : 'N/A'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {licenseStatus?.daysRemaining} days remaining
                </p>
              </div>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-2">Enabled Modules</p>
              <div className="flex flex-wrap gap-2">
                {licenseStatus?.modules.map((module) => (
                  <span
                    key={module}
                    className="px-3 py-1 rounded-full text-sm bg-gray-100 dark:bg-gray-800"
                  >
                    {MODULE_DISPLAY_NAMES[module] || module}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Info className="w-4 h-4" />
              <span>Last validated: {licenseStatus?.validatedAt ? new Date(licenseStatus.validatedAt).toLocaleString() : 'N/A'}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import License Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            Import License
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-full shrink-0">
              <Info className="w-5 h-5 text-blue-600 dark:text-blue-300" />
            </div>
            <div>
              <h3 className="font-medium">How to import a license</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Enter the license token provided by Helix. The token will be validated and stored securely.
                Each organization requires a valid license to access the platform.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">License Token</label>
            <div className="flex gap-2">
              <Input
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                className="font-mono text-sm"
              />
              <Button
                onClick={handleImport}
                disabled={importMutation.isPending || !tokenInput.trim()}
              >
                {importMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                Import
              </Button>
            </div>
          </div>

          {importMutation.error && (
            <div className="p-3 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{importMutation.error.message}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tier Information */}
      <Card>
        <CardHeader>
          <CardTitle>License Tiers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(TIER_DESCRIPTIONS).map(([tier, description]) => (
              <div key={tier} className="flex items-start gap-3">
                <div className={`p-2 rounded-full shrink-0 ${
                  licenseStatus?.tier === tier
                    ? 'bg-green-100 dark:bg-green-900'
                    : 'bg-gray-100 dark:bg-gray-800'
                }`}>
                  {licenseStatus?.tier === tier ? (
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <Key className="w-4 h-4 text-gray-500" />
                  )}
                </div>
                <div>
                  <p className="font-medium capitalize">{tier}</p>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
