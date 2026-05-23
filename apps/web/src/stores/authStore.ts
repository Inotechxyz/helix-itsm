import { create } from 'zustand';
import { api } from '../api/client';
import { useOrganizationStore } from './organizationStore';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  avatarUrl?: string;
  teams?: { id: string; name: string; type: string; isPrimary: boolean }[];
  jobTitle?: string;
  department?: string;
  phone?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithAzure: (redirectUrl?: string, orgSlug?: string) => void;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null | ((prev: User | null) => User | null)) => void;
  setToken: (token: string | null) => void;
  initialize: () => Promise<void>; // Check session on app load
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

/**
 * Auth Store Implementation
 *
 * Session persistence using sessionStorage (survives page refresh, not browser close).
 * The refresh token cookie is used to restore sessions on page load.
 */

// Storage key for session
const SESSION_TOKEN_KEY = 'helix_session_token';
const SESSION_USER_KEY = 'helix_session_user';

// Helper to get/set session token
function getSessionToken(): string | null {
  try {
    return sessionStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

function setSessionToken(token: string | null): void {
  try {
    if (token) {
      sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(SESSION_TOKEN_KEY);
    }
  } catch {
    // sessionStorage may be blocked
  }
}

function getSessionUser(): User | null {
  try {
    const userStr = sessionStorage.getItem(SESSION_USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  } catch {
    return null;
  }
}

function setSessionUser(user: User | null): void {
  try {
    if (user) {
      sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
    } else {
      sessionStorage.removeItem(SESSION_USER_KEY);
    }
  } catch {
    // sessionStorage may be blocked
  }
}

// Current access token (in memory for API requests)
let currentAccessToken: string | null = null;

// Refresh lock to prevent multiple concurrent refresh attempts
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

// Subscribe to token refresh completion
function subscribeTokenRefresh(callback: (token: string) => void): () => void {
  refreshSubscribers.push(callback);
  // Return unsubscribe function
  return () => {
    refreshSubscribers = refreshSubscribers.filter((cb) => cb !== callback);
  };
}

// Notify all subscribers when refresh is complete
function onRefreshComplete(token: string): void {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
  isRefreshing = false;
}

// Request interceptor to set auth header before each request
api.interceptors.request.use((config) => {
  // Skip adding auth header for public endpoints
  const publicEndpoints = [
    '/v1/organizations/public',
    '/v1/auth/login',
    '/v1/auth/register',
    '/v1/auth/refresh',
  ];

  const isPublicEndpoint = publicEndpoints.some(endpoint =>
    config.url?.startsWith(endpoint)
  );

  // Only add token if not a public endpoint
  if (!isPublicEndpoint) {
    const token = currentAccessToken || getSessionToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  return config;
});

// Handle token refresh and 401 errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Skip if no original request or already retried
    if (!originalRequest || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Handle 401 Unauthorized - attempt token refresh
    if (error.response?.status === 401) {
      // Don't try to refresh for auth or public endpoints
      const skipRefreshEndpoints = [
        '/auth/login',
        '/auth/register',
        '/auth/refresh',
        '/organizations/public',
      ];

      const shouldSkipRefresh = skipRefreshEndpoints.some(endpoint =>
        originalRequest.url?.includes(endpoint)
      );

      if (shouldSkipRefresh) {
        return Promise.reject(error);
      }

      // Prevent multiple concurrent refresh attempts
      if (isRefreshing) {
        // Wait for the current refresh to complete
        return new Promise((resolve, reject) => {
          const unsubscribe = subscribeTokenRefresh((token: string) => {
            unsubscribe();
            if (token) {
              originalRequest._retry = true;
              originalRequest.headers['Authorization'] = `Bearer ${token}`;
              resolve(api(originalRequest));
            } else {
              reject(error);
            }
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Read refresh token from cookie (will be sent automatically with withCredentials)
        const response = await api.post('/auth/refresh', {});

        // Update access token in memory
        const { accessToken } = response.data;
        currentAccessToken = accessToken;
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;

        // Notify all waiting requests
        onRefreshComplete(accessToken);

        return api(originalRequest);
      } catch (refreshError: any) {
        // Refresh failed
        currentAccessToken = null;
        delete api.defaults.headers.common['Authorization'];
        setSessionToken(null);
        setSessionUser(null);

        // Notify all waiting requests of failure
        onRefreshComplete('');

        // Only redirect if not already on login page and not a public endpoint
        const isPublicEndpoint = skipRefreshEndpoints.some(endpoint =>
          originalRequest.url?.includes(endpoint)
        );

        if (!isPublicEndpoint && !window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,

  /**
   * Initialize auth state on app load.
   * First tries to restore from sessionStorage, then attempts refresh via cookie.
   */
  initialize: async () => {
    // Prevent multiple concurrent initializations
    if (get().isInitialized) {
      return;
    }

    set({ isLoading: true });

    try {
      // Check if we're on the login page - skip auth entirely
      const isLoginPage = window.location.pathname === '/login';

      if (isLoginPage) {
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
          isLoading: false,
          isInitialized: true,
        });
        return;
      }

      // Try to restore from sessionStorage first
      const storedToken = getSessionToken();
      const storedUser = getSessionUser();

      if (storedToken && storedUser) {
        currentAccessToken = storedToken;
        api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;

        // Verify the token is still valid
        try {
          const response = await api.get('/auth/me');
          const user = response.data;

          set({
            user,
            accessToken: storedToken,
            isAuthenticated: true,
            isLoading: false,
            isInitialized: true,
          });

          // Update stored user data
          setSessionUser(user);

          // Fetch organizations after auth is verified
          useOrganizationStore.getState().fetchOrganizations();

          return;
        } catch {
          // Token invalid - clear and try refresh
          currentAccessToken = null;
          delete api.defaults.headers.common['Authorization'];
          setSessionToken(null);
          setSessionUser(null);
        }
      }

      if (isRefreshing) {
        // Wait for ongoing refresh
        await new Promise<void>((resolve) => {
          const unsubscribe = subscribeTokenRefresh((token: string) => {
            unsubscribe();
            if (token) {
              set({
                isAuthenticated: true,
                isLoading: false,
                isInitialized: true,
              });
            }
            resolve();
          });
        });
        return;
      }

      isRefreshing = true;

      try {
        const refreshResponse = await api.post('/auth/refresh', {});
        const { accessToken: newAccessToken, user: refreshedUser } = refreshResponse.data;

        if (newAccessToken) {
          currentAccessToken = newAccessToken;
          api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
          setSessionToken(newAccessToken);
          setSessionUser(refreshedUser);

          set({
            user: refreshedUser,
            accessToken: newAccessToken,
            isAuthenticated: true,
            isLoading: false,
            isInitialized: true,
          });

          // Fetch organizations after auth is verified
          useOrganizationStore.getState().fetchOrganizations();

          onRefreshComplete(newAccessToken);
          return;
        }
      } catch {
        // Refresh failed - no valid session
      }

      // No valid session
      set({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isLoading: false,
        isInitialized: true,
      });

      onRefreshComplete('');
    } finally {
      // Ensure isInitialized is always set
      if (!get().isInitialized) {
        set({ isInitialized: true });
      }
    }
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      // withCredentials: true is set in api client, so cookie will be received
      const response = await api.post('/auth/login', { email, password });
      const { accessToken, user } = response.data;

      // Store in memory and sessionStorage
      currentAccessToken = accessToken;
      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
      setSessionToken(accessToken);
      setSessionUser(user);

      set({
        user,
        accessToken,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  loginWithAzure: (redirectUrl?: string, orgSlug?: string) => {
    // Build the Azure AD login URL with optional redirect and org slug
    let azureLoginUrl = '/v1/auth/azure/login';
    const params: string[] = [];

    if (redirectUrl) {
      params.push(`redirect=${encodeURIComponent(redirectUrl)}`);
    }
    if (orgSlug) {
      params.push(`org=${encodeURIComponent(orgSlug)}`);
    }

    if (params.length > 0) {
      azureLoginUrl += '?' + params.join('&');
    }
    // Azure AD login will set the cookie when it returns
    window.location.href = azureLoginUrl;
  },

  register: async (data: RegisterData) => {
    set({ isLoading: true });
    try {
      const response = await api.post('/auth/register', data);
      const { accessToken, user } = response.data;

      // Store in memory and sessionStorage
      currentAccessToken = accessToken;
      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
      setSessionToken(accessToken);
      setSessionUser(user);

      set({
        user,
        accessToken,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      // Make logout request - refresh token cookie will be sent
      // Server will clear the cookie and revoke the token
      await api.post('/auth/logout', {});
    } catch {
      // Ignore logout errors
    } finally {
      // Clear all stored tokens
      currentAccessToken = null;
      delete api.defaults.headers.common['Authorization'];
      setSessionToken(null);
      setSessionUser(null);
      set({
        user: null,
        accessToken: null,
        isAuthenticated: false,
      });
    }
  },

  setUser: (user) => set((state) => {
    if (typeof user === 'function') {
      return { user: user(state.user) };
    }
    return { user };
  }),

  setToken: (token) => {
    if (token) {
      // Store in memory only (not localStorage - security improvement)
      currentAccessToken = token;
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      set({ accessToken: token, isAuthenticated: true });
    } else {
      // Clear memory token
      currentAccessToken = null;
      delete api.defaults.headers.common['Authorization'];
      set({ accessToken: null, isAuthenticated: false });
    }
  },
}));