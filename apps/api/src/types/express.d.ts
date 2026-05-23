import '@helix/shared';

// Extend Express types
declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      avatarUrl?: string | null;
      teams?: Array<{
        id: string;
        name: string;
        type: string;
        isPrimary: boolean;
        organizationId: string | null;
      }>;
      organizationId?: string | null;
      organizationSlug?: string | null;
      orgRole?: string | null;
      organizations?: Array<{
        organizationId: string;
        organizationName: string;
        organizationSlug: string;
        organizationStatus: string;
        orgRole: string;
      }>;
    }

    interface Request {
      organizationId?: string | null;
      userOrgRole?: string | null;
    }
  }
}

export {};
