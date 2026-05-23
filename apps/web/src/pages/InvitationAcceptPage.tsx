import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { organizationsApi } from '../api/client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export function InvitationAcceptPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, isInitialized, user, initialize } = useAuthStore();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string>('');
  const [organizationName, setOrganizationName] = useState<string>('');
  const hasAcceptedRef = useRef(false);

  const token = searchParams.get('token');

  // Handle initial auth initialization
  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [initialize, isInitialized]);

  const acceptInvitation = useCallback(async () => {
    // Prevent multiple acceptance attempts
    if (hasAcceptedRef.current) {
      return;
    }

    if (!token) {
      setStatus('error');
      setError('Invalid invitation link. No token provided.');
      return;
    }

    if (!isAuthenticated || !user) {
      // Redirect to login with return URL
      navigate(`/login?redirect=/invitations/accept?token=${token}`);
      return;
    }

    hasAcceptedRef.current = true;

    try {
      console.log('Accepting invitation with token:', token, 'for user:', user.id);

      // Accept the invitation
      const result = await organizationsApi.acceptInvitation(token, user.id);
      console.log('Invitation accepted:', result);

      setStatus('success');
      setOrganizationName(result.data.organization?.name || '');
    } catch (err: any) {
      console.error('Failed to accept invitation:', err);
      setStatus('error');
      hasAcceptedRef.current = false; // Allow retry on error
      const errorMessage = err.response?.data?.message || err.message || 'Failed to accept invitation';
      setError(errorMessage);
    }
  }, [token, isAuthenticated, user, navigate]);

  // Accept invitation when auth is ready
  useEffect(() => {
    // Wait for auth to be initialized and user to be authenticated
    if (!isInitialized) {
      return;
    }

    if (!isAuthenticated || !user) {
      // Redirect to login with return URL
      navigate(`/login?redirect=/invitations/accept?token=${token}`);
      return;
    }

    // User is authenticated, accept the invitation
    acceptInvitation();
  }, [isInitialized, isAuthenticated, user, token, navigate, acceptInvitation]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Accepting invitation...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Invitation Error</CardTitle>
            <CardDescription>Unable to accept the invitation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg mb-4">
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => navigate('/login')} variant="outline" className="flex-1">
                Go to Login
              </Button>
              <Button onClick={() => navigate('/')} className="flex-1">
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <CardTitle className="text-2xl">Invitation Accepted!</CardTitle>
          <CardDescription>
            You have successfully joined{organizationName ? ` ${organizationName}` : ' the organization'}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            You can now access all resources and features of the organization.
          </p>
          <Button onClick={() => navigate('/')} className="w-full">
            Go to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}