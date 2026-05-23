import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

/**
 * Azure AD SSO Callback Page
 *
 * This component handles the redirect from Azure AD after successful authentication.
 * It extracts the access token from the URL and sets up the auth state.
 *
 * The flow is:
 * 1. User clicks "Sign in with Azure AD" on login page
 * 2. Backend redirects to Azure AD (with redirect URL in state)
 * 3. After Azure auth, Azure redirects back to backend callback
 * 4. Backend validates Azure user, creates/updates local user, generates tokens
 * 5. Backend redirects to this page with access token and post-login redirect in URL
 * 6. This page extracts token, sets up auth, redirects to the specified URL
 */
export function AzureCallbackPage() {
  const navigate = useNavigate();
  const { setUser, setToken } = useAuthStore();
  const initialized = useRef(false);

  useEffect(() => {
    // Prevent double initialization
    if (initialized.current) return;
    initialized.current = true;

    const handleCallback = async () => {
      // Get token and redirect URL from URL query params
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      const redirect = params.get('redirect');

      if (!token) {
        console.error('No token received from Azure AD callback');
        navigate('/login?error=azure_callback_failed');
        return;
      }

      // Default redirect is dashboard, but use provided redirect if available
      const postLoginRedirect = redirect ? decodeURIComponent(redirect) : '/dashboard';
      console.log('Azure AD callback - will redirect to:', postLoginRedirect);

      try {
        // Set the access token
        setToken(token);

        // Fetch user info using the token
        const response = await fetch('/v1/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch user info');
        }

        const user = await response.json();
        setUser(user);

        // Clean up URL (remove token and redirect from address bar)
        window.history.replaceState({}, '', '/auth/azure/callback');

        // Redirect to the post-login URL (which should be the invitation accept page)
        navigate(postLoginRedirect, { replace: true });
      } catch (error) {
        console.error('Azure AD callback error:', error);
        navigate('/login?error=azure_auth_failed');
      }
    };

    handleCallback();
  }, [navigate, setUser, setToken]);

  // Show loading state while processing
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
        <p className="mt-4 text-muted-foreground">Completing Azure AD sign-in...</p>
      </div>
    </div>
  );
}