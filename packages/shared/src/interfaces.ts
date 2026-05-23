// API response wrapper
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Pagination
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Form field for service requests
export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'checkbox' | 'date' | 'textarea';
  required: boolean;
  options?: string[];
  placeholder?: string;
}

// Dashboard stats
export interface DashboardStats {
  totalTickets: number;
  openTickets: number;
  resolvedToday: number;
  slaBreached: number;
  avgResolutionTime: number;
  ticketsByStatus: Record<string, number>;
  ticketsByPriority: Record<string, number>;
  recentTickets: unknown[];
}

// JWT payload
export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

// Login response
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    avatarUrl?: string;
  };
}

// File upload response
export interface FileUploadResponse {
  id: string;
  filename: string;
  url: string;
  fileSize: number;
  contentType: string;
}

// Email message
export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
  html?: string;
  attachments?: {
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }[];
}

// Ticket filter params
export interface TicketFilterParams {
  status?: string[];
  priority?: string[];
  type?: string[];
  requesterId?: string;
  assignedAgentId?: string;
  assignedTeamId?: string;
  categoryId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

// Report filter params
export interface ReportFilterParams {
  dateFrom?: string;
  dateTo?: string;
  teamId?: string;
  agentId?: string;
}

// Auth provider
export enum AuthProvider {
  AZURE_AD = 'azure_ad',
  LOCAL = 'local',
}
