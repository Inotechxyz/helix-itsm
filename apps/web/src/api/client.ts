import axios from 'axios';

// Custom serializer for arrays to use comma-separated format
const paramsSerializer = (params: any) => {
  const searchParams = new URLSearchParams();
  for (const key in params) {
    const value = params[key];
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      // Send arrays as comma-separated values: status=new,assigned
      searchParams.append(key, value.join(','));
    } else {
      searchParams.append(key, String(value));
    }
  }
  return searchParams.toString();
};

export const api = axios.create({
  baseURL: '/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Required for cookies to be sent/received
  paramsSerializer,
});

// Separate axios instance for chatbot service (runs on port 3001)
export const chatbotApiClient = axios.create({
  baseURL: '/api/chatbot',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
  paramsSerializer,
});

// Add auth interceptor to chatbot API client
chatbotApiClient.interceptors.request.use((config) => {
  console.log('[Chatbot API Request]', config.method?.toUpperCase(), config.url);

  // Get token from sessionStorage or cookie
  let token: string | null = sessionStorage.getItem('helix_session_token') || null;
  if (!token) {
    token = document.cookie
      .split('; ')
      .find(row => row.startsWith('access_token='))
      ?.split('=')[1] || null;
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Add organization context header
  const orgContext = getOrgContext();
  console.log('[Chatbot API] Org context:', orgContext);
  if (orgContext.organizationId) {
    config.headers['x-organization-id'] = orgContext.organizationId;
  }

  return config;
});

// Storage key for organization context
const ORG_CONTEXT_KEY = 'helix_org_context';

// Helper to get/set org context
export function getOrgContext(): { organizationId: string | null; organizationSlug: string | null } {
  try {
    const context = sessionStorage.getItem(ORG_CONTEXT_KEY);
    return context ? JSON.parse(context) : { organizationId: null, organizationSlug: null };
  } catch {
    return { organizationId: null, organizationSlug: null };
  }
}

export function setOrgContext(organizationId: string | null, organizationSlug: string | null = null): void {
  try {
    if (organizationId) {
      sessionStorage.setItem(ORG_CONTEXT_KEY, JSON.stringify({ organizationId, organizationSlug }));
    } else {
      sessionStorage.removeItem(ORG_CONTEXT_KEY);
    }
  } catch {
    // sessionStorage may be blocked
  }
}

// Add auth interceptor to all requests
api.interceptors.request.use((config) => {
  // DEBUG: Log all requests
  console.log('[API Request]', config.method?.toUpperCase(), config.url);
  console.log('[API Request] Headers:', config.headers);

  // Skip auth header for public endpoints (login page, etc.)
  const publicEndpoints = [
    '/v1/organizations/public',  // Public org list for login dropdown (legacy)
    '/v1/public/organizations',  // Public org list for login dropdown (new)
    '/v1/auth/login',            // Login
    '/v1/auth/register',         // Registration
    '/v1/auth/refresh',          // Token refresh
  ];

  const isPublicEndpoint = publicEndpoints.some(endpoint =>
    config.url?.startsWith(endpoint)
  );

  // Only add auth token for non-public endpoints
  if (!isPublicEndpoint) {
    // Get token from sessionStorage (same as auth store) or cookie
    let token: string | null = sessionStorage.getItem('helix_session_token') || null;
    if (!token) {
      token = document.cookie
        .split('; ')
        .find(row => row.startsWith('access_token='))
        ?.split('=')[1] || null;
    }
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add organization context header if set
    const orgContext = getOrgContext();
    console.log('[API Request] Org context from sessionStorage:', orgContext);
    if (orgContext.organizationId) {
      config.headers['x-organization-id'] = orgContext.organizationId;
      console.log('[API Request] Set x-organization-id header:', orgContext.organizationId);
    } else {
      console.log('[API Request] WARNING: No organization ID in context!');
    }
  }

  return config;
});

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (data: any) => api.post('/auth/register', data),
  // Logout - refresh token is sent via cookie automatically
  logout: () => api.post('/auth/logout', {}),
  // Refresh - refresh token is sent via cookie automatically
  refresh: () => api.post('/auth/refresh', {}),
  me: () => api.get('/auth/me'),
  changePassword: (data: any) => api.post('/auth/change-password', data),
  updateProfile: (data: any) => api.patch('/auth/me', data),
};

// Users API
export const usersApi = {
  list: (params?: any) => api.get('/users', { params }),
  get: (id: string) => api.get(`/users/${id}`),
  create: (data: any) => api.post('/users', data),
  update: (id: string, data: any) => api.patch(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
  assignTeams: (id: string, data: any) =>
    api.post(`/users/${id}/assign-teams`, data),
};

// Teams API
export const teamsApi = {
  list: (params?: any) => api.get('/teams', { params }),
  get: (id: string) => api.get(`/teams/${id}`),
  create: (data: any) => api.post('/teams', data),
  update: (id: string, data: any) => api.patch(`/teams/${id}`, data),
  delete: (id: string) => api.delete(`/teams/${id}`),
  getMembers: (id: string) => api.get(`/teams/${id}/members`),
  addMember: (id: string, userId: string, isPrimary?: boolean) =>
    api.post(`/teams/${id}/members`, { userId, isPrimary }),
  removeMember: (id: string, userId: string) =>
    api.delete(`/teams/${id}/members/${userId}`),
};

// Tickets API
export const ticketsApi = {
  list: (params?: any) => api.get('/tickets', { params }),
  get: (id: string) => api.get(`/tickets/${id}`),
  getByNumber: (ticketNumber: string) =>
    api.get(`/tickets/number/${ticketNumber}`),
  create: (data: any) => api.post('/tickets', data),
  update: (id: string, data: any) => api.patch(`/tickets/${id}`, data),
  delete: (id: string) => api.delete(`/tickets/${id}`),
  assign: (id: string, data: any) => api.post(`/tickets/${id}/assign`, data),
  transition: (id: string, data: any) =>
    api.post(`/tickets/${id}/transition`, data),
  getComments: (id: string) => api.get(`/tickets/${id}/comments`),
  addComment: (id: string, data: any) =>
    api.post(`/tickets/${id}/comments`, data),
};

// Categories API
export const categoriesApi = {
  list: (params?: any) => api.get('/categories', { params }),
  tree: (params?: any) => api.get('/categories/tree', { params }),
  get: (id: string) => api.get(`/categories/${id}`),
  create: (data: any) => api.post('/categories', data),
  update: (id: string, data: any) => api.patch(`/categories/${id}`, data),
  delete: (id: string) => api.delete(`/categories/${id}`),
};

// Knowledge Base API
export const kbApi = {
  articles: {
    list: (params?: any) => api.get('/knowledge-base/articles', { params }),
    get: (slug: string) => api.get(`/knowledge-base/articles/${slug}`),
    create: (data: any) => api.post('/knowledge-base/articles', data),
    update: (id: string, data: any) =>
      api.patch(`/knowledge-base/articles/${id}`, data),
    publish: (id: string) =>
      api.post(`/knowledge-base/articles/${id}/publish`),
    archive: (id: string) =>
      api.post(`/knowledge-base/articles/${id}/archive`),
    feedback: (id: string, helpful: boolean) =>
      api.post(`/knowledge-base/articles/${id}/feedback`, { helpful }),
    search: (q: string) =>
      api.get('/knowledge-base/articles/search', { params: { q } }),
    popular: () => api.get('/knowledge-base/articles/popular'),
    recent: () => api.get('/knowledge-base/articles/recent'),
    suggest: (q: string) =>
      api.get('/knowledge-base/articles/suggest', { params: { q } }),
    hybridSearch: (q: string, limit?: number) =>
      api.get('/knowledge-base/articles/search-hybrid', { params: { q, limit } }),
  },
  categories: {
    list: () => api.get('/knowledge-base/categories'),
    tree: () => api.get('/knowledge-base/categories/tree'),
    get: (slug: string) => api.get(`/knowledge-base/categories/${slug}`),
    create: (data: any) => api.post('/knowledge-base/categories', data),
    update: (id: string, data: any) => api.patch(`/knowledge-base/categories/${id}`, data),
    delete: (id: string) => api.delete(`/knowledge-base/categories/${id}`),
  },
  tags: {
    list: () => api.get('/knowledge-base/tags'),
    create: (data: any) => api.post('/knowledge-base/tags', data),
  },
  stats: () => api.get('/knowledge-base/stats/dashboard'),
  embeddings: {
    // Get embedding status for an article
    getStatus: (articleId: string) =>
      api.get(`/knowledge-base/embeddings/status/${articleId}`),
    // Rebuild all embeddings for the organization
    rebuild: () => api.post('/knowledge-base/embeddings/rebuild'),
  },
};

// Service Catalog API
export const serviceCatalogApi = {
  services: {
    list: (params?: any) => api.get('/service-catalog/services', { params }),
    get: (slug: string) => api.get(`/service-catalog/services/${slug}`),
    create: (data: any) => api.post('/service-catalog/services', data),
    update: (id: string, data: any) =>
      api.patch(`/service-catalog/services/${id}`, data),
    activate: (id: string) =>
      api.post(`/service-catalog/services/${id}/activate`),
    deactivate: (id: string) =>
      api.post(`/service-catalog/services/${id}/deactivate`),
  },
  categories: {
    list: (params?: any) => api.get('/service-catalog/categories', { params }),
    create: (data: any) => api.post('/service-catalog/categories', data),
    update: (id: string, data: any) => api.patch(`/service-catalog/categories/${id}`, data),
    delete: (id: string) => api.delete(`/service-catalog/categories/${id}`),
  },
  requests: {
    list: (params?: any) => api.get('/service-catalog/requests', { params }),
    get: (id: string) => api.get(`/service-catalog/requests/${id}`),
    create: (data: any) => api.post('/service-catalog/requests', data),
    submit: (id: string) => api.post(`/service-catalog/requests/${id}/submit`),
    approve: (id: string, comments?: string) =>
      api.post(`/service-catalog/requests/${id}/approve`, { comments }),
    reject: (id: string, comments: string) =>
      api.post(`/service-catalog/requests/${id}/reject`, { comments }),
    complete: (id: string, data?: any) =>
      api.post(`/service-catalog/requests/${id}/complete`, data),
    cancel: (id: string) =>
      api.post(`/service-catalog/requests/${id}/cancel`),
  },
  stats: {
    dashboard: () => api.get('/service-catalog/stats/dashboard'),
    pendingApprovals: () =>
      api.get('/service-catalog/stats/pending-approvals'),
    myRequests: () => api.get('/service-catalog/stats/my-requests'),
  },
};

// Reports API
export const reportsApi = {
  dashboard: () => api.get('/reports/dashboard'),
  volume: (params?: any) => api.get('/reports/volume', { params }),
  resolutionTime: (params?: any) =>
    api.get('/reports/resolution-time', { params }),
  agentPerformance: (params?: any) =>
    api.get('/reports/agent-performance', { params }),
  slaCompliance: (params?: any) => api.get('/reports/sla-compliance', { params }),
  statusDistribution: () => api.get('/reports/status-distribution'),
  priorityDistribution: () => api.get('/reports/priority-distribution'),
  kpiMetrics: (params?: any) => api.get('/reports/kpi-metrics', { params }),
};

// Dashboard API (basic stats, available for all tiers)
export const dashboardApi = {
  getStats: () => api.get('/dashboard'),
};

// Storage API
export const storageApi = {
  upload: (ticketId: string, file: File, description?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (description) formData.append('description', description);

    return api.post(`/storage/upload/${ticketId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      // Axios doesn't support upload progress directly, but we can use onUploadProgress
      onUploadProgress: (progressEvent) => {
        // This is handled by the XHR wrapper below
      },
    });
  },

  // Upload with XHR for progress tracking
  uploadWithProgress: (
    ticketId: string,
    file: File,
    onProgress: (percent: number) => void,
    description?: string
  ): Promise<any> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('file', file);
      if (description) formData.append('description', description);

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            resolve(xhr.responseText);
          }
        } else {
          try {
            reject(JSON.parse(xhr.responseText));
          } catch {
            reject(new Error(xhr.statusText));
          }
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed'));
      });

      xhr.open('POST', `/v1/storage/upload/${ticketId}`);
      xhr.withCredentials = true;

      // Get auth token from sessionStorage (same as auth store) or cookie
      let token: string | null = sessionStorage.getItem('helix_session_token');
      if (!token) {
        token = document.cookie
          .split('; ')
          .find(row => row.startsWith('access_token='))
          ?.split('=')[1] || null;
      }

      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      xhr.send(formData);
    });
  },

  getTicketAttachments: (ticketId: string) =>
    api.get(`/storage/ticket/${ticketId}`),
  download: (id: string) =>
    api.get(`/storage/${id}`, { responseType: 'blob' }),
  delete: (id: string) => api.delete(`/storage/${id}`),
};

// Assets API
export const assetsApi = {
  list: (params?: any) => api.get('/assets', { params }),
  get: (id: string) => api.get(`/assets/${id}`),
  getByTag: (assetTag: string) => api.get(`/assets/tag/${assetTag}`),
  create: (data: any) => api.post('/assets', data),
  update: (id: string, data: any) => api.patch(`/assets/${id}`, data),
  delete: (id: string) => api.delete(`/assets/${id}`),
  getStats: () => api.get('/assets/stats'),
  getTree: (id: string) => api.get(`/assets/tree/${id}`),
  getImpact: (id: string) => api.get(`/assets/impact/${id}`),
  types: {
    list: () => api.get('/assets/types'),
    get: (id: string) => api.get(`/assets/types/${id}`),
    create: (data: any) => api.post('/assets/types', data),
    update: (id: string, data: any) => api.patch(`/assets/types/${id}`, data),
    delete: (id: string) => api.delete(`/assets/types/${id}`),
  },
  relationships: {
    get: (id: string) => api.get(`/assets/relationships/${id}`),
    create: (data: any) => api.post('/assets/relationships', data),
    update: (id: string, data: any) => api.patch(`/assets/relationships/${id}`, data),
    delete: (id: string) => api.delete(`/assets/relationships/${id}`),
  },
  maintenance: {
    list: (assetId: string) => api.get(`/assets/${assetId}/maintenance`),
    create: (data: any) => api.post('/assets/maintenance', data),
    update: (id: string, data: any) => api.patch(`/assets/maintenance/${id}`, data),
    delete: (id: string) => api.delete(`/assets/maintenance/${id}`),
  },
  tickets: {
    link: (assetId: string, ticketId: string, data: any) =>
      api.post(`/assets/${assetId}/tickets/${ticketId}`, data),
    unlink: (assetId: string, linkedAssetId: string) =>
      api.delete(`/assets/${assetId}/tickets/${linkedAssetId}`),
  },
};

// Problems API
export const problemsApi = {
  list: (params?: any) => api.get('/problems', { params }),
  get: (id: string) => api.get(`/problems/${id}`),
  getByNumber: (problemNumber: string) => api.get(`/problems/number/${problemNumber}`),
  create: (data: any) => api.post('/problems', data),
  update: (id: string, data: any) => api.patch(`/problems/${id}`, data),
  delete: (id: string) => api.delete(`/problems/${id}`),
  getStats: () => api.get('/problems/stats'),
  incidents: {
    list: (problemId: string) => api.get(`/problems/${problemId}/incidents`),
    link: (problemId: string, data: any) => api.post(`/problems/${problemId}/incidents`, data),
    unlink: (problemId: string, ticketId: string) =>
      api.delete(`/problems/${problemId}/incidents/${ticketId}`),
  },
  rca: {
    list: (problemId: string) => api.get(`/problems/${problemId}/rca`),
    create: (problemId: string, data: any) => api.post(`/problems/${problemId}/rca`, data),
    update: (rcaId: string, data: any) => api.put(`/problems/rca/${rcaId}`, data),
    delete: (rcaId: string) => api.delete(`/problems/rca/${rcaId}`),
  },
  knownErrors: {
    list: (status?: string) => api.get('/problems/known-errors', { params: { status } }),
    get: (problemId: string) => api.get(`/problems/${problemId}/known-error`),
    create: (problemId: string, data: any) => api.post(`/problems/${problemId}/known-error`, data),
    update: (knownErrorId: string, data: any) =>
      api.put(`/problems/known-error/${knownErrorId}`, data),
    delete: (knownErrorId: string) => api.delete(`/problems/known-error/${knownErrorId}`),
  },
  // Change Management
  changes: {
    list: (params?: any) => api.get('/changes', { params }),
    get: (id: string) => api.get(`/changes/${id}`),
    create: (data: any) => api.post('/changes', data),
    update: (id: string, data: any) => api.put(`/changes/${id}`, data),
    delete: (id: string) => api.delete(`/changes/${id}`),
    submit: (id: string) => api.post(`/changes/${id}/submit`),
    approve: (id: string, data?: any) => api.post(`/changes/${id}/approve`, data),
    reject: (id: string, data: any) => api.post(`/changes/${id}/reject`, data),
    stats: () => api.get('/changes/stats'),
    // Asset linking
    linkAsset: (changeId: string, data: any) => api.post(`/changes/${changeId}/assets`, data),
    unlinkAsset: (changeId: string, assetId: string) => api.delete(`/changes/${changeId}/assets/${assetId}`),
    // Ticket linking
    linkTicket: (changeId: string, data: any) => api.post(`/changes/${changeId}/tickets`, data),
    unlinkTicket: (changeId: string, ticketId: string) => api.delete(`/changes/${changeId}/tickets/${ticketId}`),
    // Problem linking
    linkProblem: (changeId: string, data: any) => api.post(`/changes/${changeId}/problems`, data),
    unlinkProblem: (changeId: string, problemId: string) => api.delete(`/changes/${changeId}/problems/${problemId}`),
    // Risk assessment
    createRiskAssessment: (changeId: string, data: any) => api.post(`/changes/${changeId}/risk-assessment`, data),
    updateRiskAssessment: (changeId: string, data: any) => api.put(`/changes/${changeId}/risk-assessment`, data),
    // CAB meetings
    cabMeetings: {
      list: (status?: string) => api.get('/changes/cab/meetings', { params: { status } }),
      get: (id: string) => api.get(`/changes/cab/meetings/${id}`),
      create: (data: any) => api.post('/changes/cab/meetings', data),
      update: (id: string, data: any) => api.put(`/changes/cab/meetings/${id}`, data),
      delete: (id: string) => api.delete(`/changes/cab/meetings/${id}`),
      addAgendaItem: (meetingId: string, data: any) => api.post(`/changes/cab/meetings/${meetingId}/agenda`, data),
      removeAgendaItem: (meetingId: string, agendaItemId: string) =>
        api.delete(`/changes/cab/meetings/${meetingId}/agenda/${agendaItemId}`),
    },
  },
};

// Change Categories API
export const changeCategoriesApi = {
  list: () => api.get('/change-categories'),
  get: (id: string) => api.get(`/change-categories/${id}`),
  create: (data: any) => api.post('/change-categories', data),
  update: (id: string, data: any) => api.patch(`/change-categories/${id}`, data),
  delete: (id: string) => api.delete(`/change-categories/${id}`),
};

// Change Management API
export const changesApi = {
  list: (params?: any) => api.get('/changes', { params }),
  get: (id: string) => api.get(`/changes/${id}`),
  create: (data: any) => api.post('/changes', data),
  update: (id: string, data: any) => api.put(`/changes/${id}`, data),
  delete: (id: string) => api.delete(`/changes/${id}`),
  submit: (id: string) => api.post(`/changes/${id}/submit`),
  approve: (id: string, data?: any) => api.post(`/changes/${id}/approve`, data),
  reject: (id: string, data: any) => api.post(`/changes/${id}/reject`, data),
  stats: () => api.get('/changes/stats'),
  // Asset linking
  linkAsset: (changeId: string, data: any) => api.post(`/changes/${changeId}/assets`, data),
  unlinkAsset: (changeId: string, assetId: string) => api.delete(`/changes/${changeId}/assets/${assetId}`),
  // Ticket linking
  linkTicket: (changeId: string, data: any) => api.post(`/changes/${changeId}/tickets`, data),
  unlinkTicket: (changeId: string, ticketId: string) => api.delete(`/changes/${changeId}/tickets/${ticketId}`),
  // Problem linking
  linkProblem: (changeId: string, data: any) => api.post(`/changes/${changeId}/problems`, data),
  unlinkProblem: (changeId: string, problemId: string) => api.delete(`/changes/${changeId}/problems/${problemId}`),
  // Risk assessment
  createRiskAssessment: (changeId: string, data: any) => api.post(`/changes/${changeId}/risk-assessment`, data),
  updateRiskAssessment: (changeId: string, data: any) => api.put(`/changes/${changeId}/risk-assessment`, data),
  // CAB meetings
  cabMeetings: {
    list: (status?: string) => api.get('/changes/cab/meetings', { params: { status } }),
    get: (id: string) => api.get(`/changes/cab/meetings/${id}`),
    create: (data: any) => api.post('/changes/cab/meetings', data),
    update: (id: string, data: any) => api.put(`/changes/cab/meetings/${id}`, data),
    delete: (id: string) => api.delete(`/changes/cab/meetings/${id}`),
    addAgendaItem: (meetingId: string, data: any) => api.post(`/changes/cab/meetings/${meetingId}/agenda`, data),
    removeAgendaItem: (meetingId: string, agendaItemId: string) =>
      api.delete(`/changes/cab/meetings/${meetingId}/agenda/${agendaItemId}`),
  },
};

// SLA API
export const slaApi = {
  // SLA Policies
  policies: {
    list: (params?: any) => api.get('/sla/policies', { params }),
    get: (id: string) => api.get(`/sla/policies/${id}`),
    create: (data: any) => api.post('/sla/policies', data),
    update: (id: string, data: any) => api.patch(`/sla/policies/${id}`, data),
    delete: (id: string) => api.delete(`/sla/policies/${id}`),
  },
  // Escalation Rules
  escalationRules: {
    list: (policyId: string) => api.get(`/sla/policies/${policyId}/escalation-rules`),
    create: (data: any) => api.post('/sla/escalation-rules', data),
    update: (id: string, data: any) => api.patch(`/sla/escalation-rules/${id}`, data),
    delete: (id: string) => api.delete(`/sla/escalation-rules/${id}`),
  },
  // OLA Policies
  olaPolicies: {
    list: (params?: any) => api.get('/sla/ola-policies', { params }),
    get: (id: string) => api.get(`/sla/ola-policies/${id}`),
    create: (data: any) => api.post('/sla/ola-policies', data),
    update: (id: string, data: any) => api.patch(`/sla/ola-policies/${id}`, data),
    delete: (id: string) => api.delete(`/sla/ola-policies/${id}`),
  },
  // OLA Handoffs
  handoffs: {
    listByTicket: (ticketId: string) => api.get(`/sla/handoffs/ticket/${ticketId}`),
    create: (data: any) => api.post('/sla/handoffs', data),
    update: (id: string, data: any) => api.patch(`/sla/handoffs/${id}`, data),
  },
  // Ticket SLA Status
  getTicketStatus: (ticketId: string) => api.get(`/sla/ticket/${ticketId}`),
  // Statistics
  getStats: () => api.get('/sla/stats'),
};

// Software Licenses API (CMDB Enhancement)
export const softwareLicensesApi = {
  // Software
  software: {
    list: (params?: any) => api.get('/software-licenses/software', { params }),
    get: (id: string) => api.get(`/software-licenses/software/${id}`),
    create: (data: any) => api.post('/software-licenses/software', data),
    update: (id: string, data: any) => api.patch(`/software-licenses/software/${id}`, data),
    delete: (id: string) => api.delete(`/software-licenses/software/${id}`),
  },
  // Licenses
  licenses: {
    list: (params?: any) => api.get('/software-licenses/licenses', { params }),
    get: (id: string) => api.get(`/software-licenses/licenses/${id}`),
    create: (data: any) => api.post('/software-licenses/licenses', data),
    update: (id: string, data: any) => api.patch(`/software-licenses/licenses/${id}`, data),
    delete: (id: string) => api.delete(`/software-licenses/licenses/${id}`),
  },
  // Assignments
  assignments: {
    list: (params?: any) => api.get('/software-licenses/assignments', { params }),
    create: (data: any) => api.post('/software-licenses/assignments', data),
    revoke: (id: string) => api.post(`/software-licenses/assignments/${id}/revoke`),
    delete: (id: string) => api.delete(`/software-licenses/assignments/${id}`),
  },
  // Statistics
  getStats: () => api.get('/software-licenses/stats'),
};

// CMDB Enhancement - Asset Analysis
export const cmdbApi = {
  // Dependency graph for visualization
  getDependencyGraph: () => api.get('/assets/graph/dependency'),
  // CI statistics
  getCiStats: () => api.get('/assets/stats/ci'),
  // Detailed impact analysis
  getImpactAnalysis: (assetId: string) => api.get(`/assets/analysis/impact/${assetId}`),
};

// CSAT (Customer Satisfaction) API
export const csatApi = {
  // Configuration
  getConfig: () => api.get('/csat/config'),
  getConfigById: (id: string) => api.get(`/csat/config/${id}`),
  listConfigs: (params?: any) => api.get('/csat/configs', { params }),
  createConfig: (data: any) => api.post('/csat/config', data),
  updateConfig: (id: string, data: any) => api.patch(`/csat/config/${id}`, data),
  // Questions
  addQuestion: (configId: string, data: any) => api.post(`/csat/config/${configId}/questions`, data),
  updateQuestion: (questionId: string, data: any) => api.patch(`/csat/questions/${questionId}`, data),
  deleteQuestion: (questionId: string) => api.delete(`/csat/questions/${questionId}`),
  // Surveys
  listSurveys: (params?: any) => api.get('/csat/surveys', { params }),
  getSurveyByTicket: (ticketId: string) => api.get(`/csat/surveys/ticket/${ticketId}`),
  getSurveyById: (id: string) => api.get(`/csat/surveys/${id}`),
  createSurvey: (ticketId: string) => api.post(`/csat/surveys/ticket/${ticketId}`),
  // Survey response (public)
  getSurveyForResponse: (surveyId: string) => api.get(`/csat/respond/${surveyId}`),
  submitSurvey: (ticketId: string, data: any) => api.post(`/csat/ticket/${ticketId}/rate`, data),
  optOut: (ticketId: string) => api.post(`/csat/opt-out/${ticketId}`),
  // Analytics
  getAnalytics: (params?: any) => api.get('/csat/analytics', { params }),
  getDashboardStats: () => api.get('/csat/dashboard'),
};

// Audit Logs API
export const auditApi = {
  list: (params?: any) => api.get('/audit-logs', { params }),
  getById: (id: string) => api.get(`/audit-logs/${id}`),
  getByEntity: (entityType: string, entityId: string) =>
    api.get(`/audit-logs/entity/${entityType}/${entityId}`),
  getStats: (params: { startDate: string; endDate: string; organizationId?: string }) =>
    api.get('/audit-logs/stats/summary', { params }),
  export: (params?: { format?: 'csv' | 'json'; startDate?: string; endDate?: string; organizationId?: string; entityType?: string }) =>
    api.post('/audit-logs/export', {}, { params }),
};

// Organization API
export const organizationsApi = {
  // List all organizations (SuperAdmin only)
  list: (params?: any) => api.get('/organizations', { params }),
  get: (id: string) => api.get(`/organizations/${id}`),
  create: (data: any) => api.post('/organizations', data),
  update: (id: string, data: any) => api.patch(`/organizations/${id}`, data),
  delete: (id: string) => api.delete(`/organizations/${id}`),
  // Get all active organizations for login dropdown (public)
  getAllPublic: () => api.get('/public/organizations'),
  // User management
  getUsers: (id: string, params?: any) => api.get(`/organizations/${id}/users`, { params }),
  getTeams: (id: string, params?: any) => api.get(`/organizations/${id}/teams`, { params }),
  addUser: (id: string, userId: string, orgRole?: string) =>
    api.post(`/organizations/${id}/users`, { userId, orgRole }),
  updateUserRole: (id: string, userId: string, data: { orgRole: string }) =>
    api.patch(`/organizations/${id}/users/${userId}/role`, data),
  removeUser: (id: string, userId: string) =>
    api.delete(`/organizations/${id}/users/${userId}`),
  inviteUser: (id: string, data: any) => api.post(`/organizations/${id}/invitations`, data),
  bulkInvite: (id: string, data: any) => api.post(`/organizations/${id}/invitations/bulk`, data),
  getInvitations: (id: string) => api.get(`/organizations/${id}/invitations`),
  getInvitationByToken: (token: string) => api.get(`/organizations/invitations/${token}`),
  acceptInvitation: (token: string, userId: string) =>
    api.post(`/organizations/invitations/${token}/accept`, { userId }),
  resendInvitation: (id: string, invitationId: string) =>
    api.post(`/organizations/${id}/invitations/${invitationId}/resend`),
  cancelInvitation: (id: string, invitationId: string) =>
    api.delete(`/organizations/${id}/invitations/${invitationId}`),
  // Branding
  getBranding: (id: string) => api.get(`/organizations/${id}/branding`),
  updateBranding: (id: string, data: any) => api.patch(`/organizations/${id}/branding/settings`, data),
  // Teams
  createTeam: (id: string, data: any) => api.post(`/organizations/${id}/teams`, data),
  getTeamMembers: (orgId: string, teamId: string) => api.get(`/organizations/${orgId}/teams/${teamId}/members`),
  // Email templates
  getEmailTemplates: (id: string) => api.get(`/organizations/${id}/email-templates`),
  getEmailTemplateTypes: (id: string) => api.get(`/organizations/${id}/email-templates/types`),
  getEmailTemplate: (id: string, type: string) => api.get(`/organizations/${id}/email-templates/${type}`),
  createEmailTemplate: (id: string, data: any) => api.post(`/organizations/${id}/email-templates`, data),
  updateEmailTemplate: (id: string, type: string, data: any) =>
    api.patch(`/organizations/${id}/email-templates/${type}`, data),
  deleteEmailTemplate: (id: string, type: string) =>
    api.delete(`/organizations/${id}/email-templates/${type}`),
  resetEmailTemplates: (id: string) => api.post(`/organizations/${id}/email-templates/reset`),
  // Azure AD SSO
  getAzureAdConfig: (id: string) => api.get(`/organizations/${id}/azure-ad`),
  updateAzureAdConfig: (id: string, data: any) => api.patch(`/organizations/${id}/azure-ad`, data),
  // Email Settings (SMTP/IMAP)
  getEmailSettings: (id: string) => api.get(`/organizations/${id}/email-settings`),
  updateEmailSettings: (id: string, data: any) => api.patch(`/organizations/${id}/email-settings`, data),
  testEmailSettings: (id: string, data: any) => api.post(`/organizations/${id}/email-settings/test`, data),
  // License Management
  getLicenseStatus: (organizationId: string) => api.get(`/organizations/${organizationId}/license`),
  importLicense: (organizationId: string, token: string) =>
    api.post(`/organizations/${organizationId}/license/import`, { token }),
  refreshLicense: (organizationId: string) =>
    api.post(`/organizations/${organizationId}/license/refresh`),
  invalidateLicenseCache: (organizationId: string) =>
    api.post(`/organizations/${organizationId}/license/invalidate-cache`),
  getEnabledModules: (organizationId: string) =>
    api.get(`/organizations/${organizationId}/license/modules`),
};

// Organization Auth API
export const orgAuthApi = {
  // Login to specific organization
  login: (email: string, password: string, organizationSlug: string) =>
    api.post('/auth/org/login', { email, password, organizationSlug }),
  // Switch organization
  switch: (organizationId: string) => api.post('/auth/org/switch', { organizationId }),
  // Get current user with org info
  getMe: () => api.get('/auth/org/me'),
  // Get organization by slug (for login page)
  getBySlug: (slug: string) => api.get(`/auth/org/${slug}`),
};

// Chatbot API (uses separate chatbot service on port 3001)
export const chatbotApi = {
  // Check AI status
  getStatus: () => chatbotApiClient.get('/status'),

  // Session management
  createSession: (data?: { context?: string }) =>
    chatbotApiClient.post('/sessions', data),

  getSession: (sessionId: string) =>
    chatbotApiClient.get(`/sessions/${sessionId}`),

  getSessionWithMessages: (sessionId: string) =>
    chatbotApiClient.get(`/sessions/${sessionId}/messages`),

  closeSession: (sessionId: string) =>
    chatbotApiClient.post(`/sessions/${sessionId}/close`),

  // Messaging
  sendMessage: (sessionId: string, data: { content: string; attachments?: any[]; metadata?: any }) =>
    chatbotApiClient.post(`/sessions/${sessionId}/messages`, data),

  // File upload for chatbot attachments
  uploadFile: async (file: File, onProgress?: (percent: number) => void): Promise<{ id: string; url: string; name: string; size: number; type: string }> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('file', file);

      if (onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress(percent);
          }
        });
      }

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve({
              id: response.id || response.storageId,
              url: response.url || `/storage/download/${response.id || response.storageId}`,
              name: file.name,
              size: file.size,
              type: file.type,
            });
          } catch {
            reject(new Error('Invalid response'));
          }
        } else {
          try {
            reject(JSON.parse(xhr.responseText));
          } catch {
            reject(new Error(xhr.statusText));
          }
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed'));
      });

      xhr.open('POST', '/v1/storage/chatbot-upload');
      xhr.withCredentials = true;

      // Get auth token
      let token: string | null = sessionStorage.getItem('helix_session_token');
      if (!token) {
        token = document.cookie
          .split('; ')
          .find(row => row.startsWith('access_token='))
          ?.split('=')[1] || null;
      }

      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      // Add org context
      const orgContext = getOrgContext();
      if (orgContext.organizationId) {
        xhr.setRequestHeader('x-organization-id', orgContext.organizationId);
      }

      xhr.send(formData);
    });
  },

  // Feedback
  submitFeedback: (messageId: string, data: { helpful: boolean; comment?: string }) =>
    chatbotApiClient.post(`/messages/${messageId}/feedback`, data),

  // Configuration
  getConfig: () => chatbotApiClient.get('/config'),

  updateConfig: (data: {
    aiModel?: string;
    aiTemperature?: number;
    aiMaxTokens?: number;
    chatbotName?: string;
    greetingMessage?: string;
    systemPrompt?: string;
    autoEscalateAfter?: number;
    escalateKeywords?: string[];
    customFaqs?: Array<{ question: string; answer: string }>;
    embeddingModel?: string;
    embeddingBaseUrl?: string;
    embeddingEnabled?: boolean;
    reasoningEnabled?: boolean;
  }) => chatbotApiClient.patch('/config', data),
};
