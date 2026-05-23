import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { organizationsApi } from '../api/client';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';

interface OrganizationOption {
  id: string;
  name: string;
  slug: string;
}

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, loginWithAzure, isLoading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [orgSlug, setOrgSlug] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string>('');
  const [isLoadingOrg, setIsLoadingOrg] = useState(false);
  const [orgError, setOrgError] = useState<string | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(false);

  // Get redirect URL and token from query params
  const redirectUrl = searchParams.get('redirect');
  const token = searchParams.get('token');

  // Fetch organizations from public API (with caching via React state)
  useEffect(() => {
    if (!token) {
      setIsLoadingOrgs(true);
      organizationsApi.getAllPublic()
        .then((response) => {
          setOrganizations(response.data || []);
        })
        .catch((err) => {
          console.error('Failed to fetch organizations:', err);
          // On error, show empty dropdown - user can contact admin
          setOrganizations([]);
        })
        .finally(() => {
          setIsLoadingOrgs(false);
        });
    }
  }, [token]);

  // Get organization info from invitation token
  useEffect(() => {
    if (token) {
      setIsLoadingOrg(true);
      setOrgError(null);
      organizationsApi.getInvitationByToken(token)
        .then((response) => {
          const invitation = response.data;
          if (invitation?.organization) {
            setOrgSlug(invitation.organization.slug);
            setOrgName(invitation.organization.name);
            // Also set selectedOrgId to enable the Azure AD button
            setSelectedOrgId(invitation.organization.id);
          } else {
            setOrgError('Invalid invitation. Organization not found.');
          }
        })
        .catch((err) => {
          console.error('Failed to get invitation info:', err);
          if (err.response?.status === 404) {
            setOrgError('This invitation link is invalid or has expired.');
          } else {
            setOrgError('Failed to load invitation. Please try again.');
          }
        })
        .finally(() => {
          setIsLoadingOrg(false);
        });
    }
  }, [token]);

  // Handle organization selection
  const handleOrgChange = (orgId: string) => {
    setSelectedOrgId(orgId);
    if (orgId) {
      const selectedOrg = organizations.find((org) => org.id === orgId);
      if (selectedOrg) {
        setOrgSlug(selectedOrg.slug);
        setOrgName(selectedOrg.name);
      }
    } else {
      setOrgSlug(null);
      setOrgName('');
    }
  };

  // Create a handler for Azure login that passes the redirect URL and org slug
  const handleAzureLogin = () => {
    // Build the full redirect URL that includes the invitation token
    const fullRedirectUrl = redirectUrl
      ? decodeURIComponent(redirectUrl)
      : (token ? `/invitations/accept?token=${token}` : undefined);

    // Pass both redirect URL and org slug to Azure login
    loginWithAzure(fullRedirectUrl || undefined, orgSlug || undefined);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await login(email, password);
      // Navigate to redirect URL if provided, otherwise go to dashboard
      if (redirectUrl) {
        navigate(decodeURIComponent(redirectUrl));
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    }
  };

  // Handle error from URL (e.g., Azure AD not configured)
  useEffect(() => {
    const urlError = searchParams.get('error');
    const urlErrorMessage = searchParams.get('message');

    if (urlError) {
      let errorMsg = '';
      switch (urlError) {
        case 'azure_not_configured':
        case 'azure_not_configured_for_org':
          errorMsg = 'Azure AD SSO is not configured for this organization. Please contact your administrator.';
          break;
        case 'azure_auth_failed':
          errorMsg = urlErrorMessage || 'Azure AD authentication failed. Please try again.';
          break;
        case 'token_exchange_failed':
          errorMsg = 'Failed to complete Azure AD login. Please try again.';
          break;
        case 'organization_not_found':
          errorMsg = 'Organization not found. Please check your invitation link.';
          break;
        default:
          errorMsg = urlErrorMessage || 'An error occurred. Please try again.';
      }
      if (errorMsg) {
        setError(errorMsg);
      }
      // Clear the error from URL
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary">Helix Helpdesk</CardTitle>
          {orgName && (
            <CardDescription>Signing in to <span className="font-medium">{orgName}</span></CardDescription>
          )}
          {!orgName && <CardDescription>Sign in to your account to continue</CardDescription>}
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              label="Email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              type="password"
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-gray-800 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          {!token && !isLoadingOrgs && (
            <Select
              label="Organization"
              placeholder="Select your organization"
              value={selectedOrgId}
              onChange={(e) => handleOrgChange(e.target.value)}
              options={organizations.map((org) => ({
                value: org.id,
                label: org.name,
              }))}
            />
          )}

          {isLoadingOrgs && (
            <div className="flex justify-center py-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
            </div>
          )}

          {token && isLoadingOrg && (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          )}

          {token && orgError && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
              {orgError}
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            className="w-full mt-4"
            onClick={handleAzureLogin}
            disabled={isLoading || isLoadingOrg || !!orgError || (!token && !selectedOrgId)}
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zM24 11.4H12.6V0H24v11.4z"/>
            </svg>
            Sign in with Azure AD
          </Button>
        </CardContent>

        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            Need help? Contact your administrator
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
