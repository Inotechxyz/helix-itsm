/**
 * Extended Express Request with organization context and user
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        role: string;
        avatarUrl?: string | null;
        teams?: { id: string; name: string; type: string; isPrimary: boolean; organizationId: string | null }[];
        organizationId: string | null;
        organizationSlug: string | null;
        orgRole: string | null;
        organizations?: {
          organizationId: string;
          organizationName: string;
          organizationSlug: string;
          organizationStatus: string;
          orgRole: string;
          joinedAt: string;
        }[];
      };
      organizationId?: string;
      organizationSlug?: string;
      userOrgRole?: string;
    }
  }
}

export {};