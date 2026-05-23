// ============================================
// System Roles (Authentication)
// ============================================
// These roles control access to the platform itself
export enum UserRole {
  user = 'user',
  superadmin = 'superadmin',
}

// Ticket types
export enum TicketType {
  INCIDENT = 'incident',
  SERVICE_REQUEST = 'service_request',
}

// Ticket statuses
export enum TicketStatus {
  NEW = 'new',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  PENDING = 'pending',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

// Priority levels
export enum TicketPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

// Team types
export enum TeamType {
  FIRST_LINE = 'first_line',
  SECOND_LINE = 'second_line',
  THIRD_LINE = 'third_line',
}

// Knowledge base article status
export enum ArticleStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

// Service status
export enum ServiceStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  RETIRED = 'retired',
}

// Service request status
export enum ServiceRequestStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

// Email notification types
export enum NotificationType {
  TICKET_CREATED = 'ticket_created',
  TICKET_ASSIGNED = 'ticket_assigned',
  TICKET_UPDATED = 'ticket_updated',
  TICKET_COMMENT = 'ticket_comment',
  TICKET_RESOLVED = 'ticket_resolved',
  TICKET_CLOSED = 'ticket_closed',
  SERVICE_REQUEST_SUBMITTED = 'service_request_submitted',
  SERVICE_REQUEST_APPROVED = 'service_request_approved',
  SERVICE_REQUEST_REJECTED = 'service_request_rejected',
  SERVICE_REQUEST_COMPLETED = 'service_request_completed',
  SLA_WARNING = 'sla_warning',
  SLA_BREACHED = 'sla_breached',
}

// ============================================
// Organization / Multi-tenancy
// ============================================

export enum OrganizationStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  PENDING = 'pending',
}

// ============================================
// Organization Roles (Authorization)
// ============================================
// These roles control what a user can do within an organization
export enum OrganizationRole {
  ORGADMIN = 'orgadmin',  // Full org control
  MANAGER = 'manager',    // Team and content management
  APPROVER = 'approver',  // Service request approval
  AGENT = 'agent',        // Ticket handling and service execution
  REQUESTER = 'requester', // End user submitting requests
}

export enum OrganizationTier {
  STARTER = 'starter',
  STANDARD = 'standard',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise',
}

export enum OrganizationAuthProvider {
  LOCAL = 'local',
  AZURE_AD = 'azure_ad',
  GOOGLE = 'google',
  SAML = 'saml',
  OKTA = 'okta',
}

// Organization-level role hierarchy (permission levels)
export const OrganizationRoleHierarchy: Record<OrganizationRole, number> = {
  [OrganizationRole.ORGADMIN]: 5,
  [OrganizationRole.MANAGER]: 4,
  [OrganizationRole.APPROVER]: 3,
  [OrganizationRole.AGENT]: 2,
  [OrganizationRole.REQUESTER]: 1,
};

export function hasOrgRoleOrHigher(userRole: OrganizationRole, requiredRole: OrganizationRole): boolean {
  return OrganizationRoleHierarchy[userRole] >= OrganizationRoleHierarchy[requiredRole];
}

export function canManageOrgRole(userRole: OrganizationRole, targetRole: OrganizationRole): boolean {
  // Users can only manage roles with lower permission levels
  return OrganizationRoleHierarchy[userRole] > OrganizationRoleHierarchy[targetRole];
}

// ============================================
// Role Assignment Rules
// ============================================
// Defines who can assign which roles within an organization

export enum AssignableRole {
  ORGADMIN = 'orgadmin',
  MANAGER = 'manager',
  APPROVER = 'approver',
  AGENT = 'agent',
  REQUESTER = 'requester',
}

// Map of which roles can be assigned by which roles
export const RoleAssignmentRules: Record<OrganizationRole, AssignableRole[]> = {
  [OrganizationRole.ORGADMIN]: [AssignableRole.MANAGER, AssignableRole.APPROVER, AssignableRole.AGENT, AssignableRole.REQUESTER],
  [OrganizationRole.MANAGER]: [AssignableRole.AGENT, AssignableRole.REQUESTER],
  [OrganizationRole.APPROVER]: [],
  [OrganizationRole.AGENT]: [],
  [OrganizationRole.REQUESTER]: [],
};

// Check if a user can assign a specific role
export function canAssignOrgRole(
  assignerRole: OrganizationRole,
  targetRole: AssignableRole
): boolean {
  return RoleAssignmentRules[assignerRole].includes(targetRole);
}

// Check if superadmin can assign any role (system-level check)
export function canSuperadminAssignAnyRole(): boolean {
  return true;
}
