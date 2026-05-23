import { useQuery } from '@tanstack/react-query';
import { organizationsApi } from '../api/client';
import { AlertTriangle, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCurrentOrganizationId } from '../stores/organizationStore';

interface LicenseStatusBannerProps {
  className?: string;
}

interface LicenseStatus {
  hasLicense: boolean;
  tier: string;
  modules: string[];
  expiresAt: string;
  daysRemaining: number;
  isExpiringSoon: boolean;
  isExpired: boolean;
}

export function LicenseStatusBanner({ className = '' }: LicenseStatusBannerProps) {
  const organizationId = useCurrentOrganizationId();

  const { data: licenseStatus } = useQuery<LicenseStatus>({
    queryKey: ['organizations', organizationId, 'license'],
    queryFn: () => organizationsApi.getLicenseStatus(organizationId!).then((r) => r.data),
    staleTime: 60000, // 1 minute
    enabled: !!organizationId,
  });

  // Don't show banner if no license issues or no org
  if (!licenseStatus || !organizationId || (!licenseStatus.isExpired && !licenseStatus.isExpiringSoon)) {
    return null;
  }

  const isExpired = licenseStatus.isExpired;

  return (
    <div
      className={`${
        isExpired
          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
      } border ${className}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className={`p-1.5 rounded-full ${
              isExpired
                ? 'bg-red-100 dark:bg-red-900'
                : 'bg-yellow-100 dark:bg-yellow-900'
            }`}>
              {isExpired ? (
                <XCircle className={`w-5 h-5 text-red-600 dark:text-red-400`} />
              ) : (
                <AlertTriangle className={`w-5 h-5 text-yellow-600 dark:text-yellow-400`} />
              )}
            </div>
            <div>
              <p className={`text-sm font-medium ${
                isExpired
                  ? 'text-red-800 dark:text-red-200'
                  : 'text-yellow-800 dark:text-yellow-200'
              }`}>
                {isExpired
                  ? 'License Expired'
                  : `License Expiring Soon (${licenseStatus.daysRemaining} days remaining)`
                }
              </p>
              <p className={`text-sm ${
                isExpired
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-yellow-600 dark:text-yellow-400'
              }`}>
                {isExpired
                  ? 'Your organization\'s license has expired. Please contact support.'
                  : 'Your license will expire soon. Please renew to avoid service interruption.'
                }
              </p>
            </div>
          </div>
          <Link
            to="/admin/organizations"
            className={`inline-flex items-center px-4 py-2 rounded-md text-sm font-medium ${
              isExpired
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-yellow-600 hover:bg-yellow-700 text-white'
            } transition-colors`}
          >
            Manage License
          </Link>
        </div>
      </div>
    </div>
  );
}