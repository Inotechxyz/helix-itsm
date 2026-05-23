import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CacheService } from '../cache/cache.service';
import { CreateOrganizationDto, UpdateOrganizationDto, OrganizationQueryDto, OrganizationEmailSettingsResponseDto } from './dto';
import { Prisma } from '@prisma/client';

const PUBLIC_ORGS_CACHE_KEY = 'organizations:public:list';
const CACHE_TTL_LONG = 3600000; // 1 hour in ms

@Injectable()
export class OrganizationsService {
  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
  ) {}

  /**
   * Create a new organization
   */
  async create(dto: CreateOrganizationDto) {
    // Check if slug already exists
    const existingOrg = await this.prisma.organization.findUnique({
      where: { slug: dto.slug },
    });

    if (existingOrg) {
      throw new ConflictException(`Organization with slug "${dto.slug}" already exists`);
    }

    const organization = await this.prisma.organization.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        status: dto.status || 'active',
        logoUrl: dto.logoUrl,
        primaryColor: dto.primaryColor || '#0066CC',
        secondaryColor: dto.secondaryColor || '#6B7280',
        faviconUrl: dto.faviconUrl,
        emailFromName: dto.emailFromName,
        emailFooterText: dto.emailFooterText,
        authProviderType: dto.authProviderType || 'local',
        authProviderConfig: dto.authProviderConfig as Prisma.InputJsonValue,
        maxUsers: dto.maxUsers || 50,
        maxStorage: dto.maxStorage || 10,
      },
    });

    // Invalidate public orgs cache
    await this.invalidatePublicOrgsCache();

    return organization;
  }

  /**
   * Find all organizations with pagination and filtering
   */
  async findAll(query: OrganizationQueryDto) {
    const { search, status, includeDeleted, page = 1, limit = 20 } = query;

    const where: Prisma.OrganizationWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (!includeDeleted) {
      where.deletedAt = null;
    }

    const [organizations, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { users: true, teams: true },
          },
        },
      }),
      this.prisma.organization.count({ where }),
    ]);

    return {
      data: organizations.map((org) => ({
        ...org,
        userCount: org._count.users,
        teamCount: org._count.teams,
        _count: undefined,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find all active organizations (public, for login dropdown)
   * Uses Redis cache to avoid hitting database on every request
   * Includes cache stampede protection
   */
  async findAllPublic() {
    // Try to get from cache first
    const cached = await this.cacheService.get<any[]>(PUBLIC_ORGS_CACHE_KEY);
    if (cached !== null) {
      return cached;
    }

    // Use lock to prevent cache stampede (multiple requests hitting DB simultaneously)
    const releaseLock = await this.cacheService.acquireLock(PUBLIC_ORGS_CACHE_KEY);

    try {
      // Double-check cache after acquiring lock (another request might have populated it)
      const cachedAgain = await this.cacheService.get<any[]>(PUBLIC_ORGS_CACHE_KEY);
      if (cachedAgain !== null) {
        return cachedAgain;
      }

      // Fetch from database
      const organizations = await this.prisma.organization.findMany({
        where: {
          status: 'active',
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          slug: true,
        },
        orderBy: { name: 'asc' },
      });

      // Cache the result
      await this.cacheService.set(PUBLIC_ORGS_CACHE_KEY, organizations, CACHE_TTL_LONG);

      return organizations;
    } finally {
      // Always release the lock
      await releaseLock();
    }
  }

  /**
   * Invalidate the public organizations cache
   * Should be called when organizations are created, updated, or deleted
   */
  async invalidatePublicOrgsCache() {
    await this.cacheService.del(PUBLIC_ORGS_CACHE_KEY);
  }

  /**
   * Find organization by ID
   */
  async findOne(id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            teams: true,
            tickets: true,
          },
        },
      },
    });

    if (!organization) {
      throw new NotFoundException(`Organization with ID "${id}" not found`);
    }

    return {
      ...organization,
      userCount: organization._count.users,
      teamCount: organization._count.teams,
      ticketCount: organization._count.tickets,
      _count: undefined,
    };
  }

  /**
   * Find organization by slug
   */
  async findBySlug(slug: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { slug },
    });

    if (!organization) {
      throw new NotFoundException(`Organization with slug "${slug}" not found`);
    }

    return organization;
  }

  /**
   * Update organization
   */
  async update(id: string, dto: UpdateOrganizationDto) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
    });

    if (!organization) {
      throw new NotFoundException(`Organization with ID "${id}" not found`);
    }

    // Check if slug is being changed and is already taken
    if (dto.slug && dto.slug !== organization.slug) {
      const existingSlug = await this.prisma.organization.findUnique({
        where: { slug: dto.slug },
      });

      if (existingSlug) {
        throw new ConflictException(`Organization with slug "${dto.slug}" already exists`);
      }
    }

    return this.prisma.organization.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.slug && { slug: dto.slug }),
        ...(dto.status && { status: dto.status }),
        ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
        ...(dto.primaryColor !== undefined && { primaryColor: dto.primaryColor }),
        ...(dto.secondaryColor !== undefined && { secondaryColor: dto.secondaryColor }),
        ...(dto.faviconUrl !== undefined && { faviconUrl: dto.faviconUrl }),
        ...(dto.emailFromName !== undefined && { emailFromName: dto.emailFromName }),
        ...(dto.emailFooterText !== undefined && { emailFooterText: dto.emailFooterText }),
        ...(dto.authProviderType && { authProviderType: dto.authProviderType }),
        ...(dto.authProviderConfig !== undefined && { authProviderConfig: dto.authProviderConfig as Prisma.InputJsonValue }),
        ...(dto.maxUsers !== undefined && { maxUsers: dto.maxUsers }),
        ...(dto.maxStorage !== undefined && { maxStorage: dto.maxStorage }),
        ...(dto.deletedAt !== undefined && { deletedAt: dto.deletedAt }),
      },
    }).then(async (result) => {
      // Invalidate public orgs cache when organization is updated
      await this.invalidatePublicOrgsCache();
      return result;
    });
  }

  /**
   * Soft delete organization
   */
  async delete(id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
    });

    if (!organization) {
      throw new NotFoundException(`Organization with ID "${id}" not found`);
    }

    return this.prisma.organization.update({
      where: { id },
      data: { deletedAt: new Date() },
    }).then(async (result) => {
      // Invalidate public orgs cache when organization is soft deleted
      await this.invalidatePublicOrgsCache();
      return result;
    });
  }

  /**
   * Permanently delete organization (use with caution)
   */
  async forceDelete(id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
    });

    if (!organization) {
      throw new NotFoundException(`Organization with ID "${id}" not found`);
    }

    // Delete organization (cascading deletes should handle related data)
    return this.prisma.organization.delete({
      where: { id },
    });
  }

  /**
   * Restore a soft-deleted organization
   */
  async restore(id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
    });

    if (!organization) {
      throw new NotFoundException(`Organization with ID "${id}" not found`);
    }

    return this.prisma.organization.update({
      where: { id },
      data: { deletedAt: null },
    }).then(async (result) => {
      // Invalidate public orgs cache when organization is restored
      await this.invalidatePublicOrgsCache();
      return result;
    });
  }

  /**
   * Add user to organization with org-level role
   */
  async addUser(organizationId: string, userId: string, orgRole: string = 'requester') {
    const [organization, user] = await Promise.all([
      this.prisma.organization.findUnique({ where: { id: organizationId } }),
      this.prisma.user.findUnique({ where: { id: userId } }),
    ]);

    if (!organization) {
      throw new NotFoundException(`Organization with ID "${organizationId}" not found`);
    }

    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }

    return this.prisma.organizationUser.create({
      data: {
        organizationId,
        userId,
        orgRole: orgRole as 'orgadmin' | 'manager' | 'agent' | 'requester',
      },
      include: {
        organization: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  /**
   * Remove user from organization
   */
  async removeUser(organizationId: string, userId: string) {
    const orgUser = await this.prisma.organizationUser.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });

    if (!orgUser) {
      throw new NotFoundException('User is not a member of this organization');
    }

    return this.prisma.organizationUser.delete({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });
  }

  /**
   * Update user's org-level role
   */
  async updateUserRole(organizationId: string, userId: string, orgRole: string) {
    const orgUser = await this.prisma.organizationUser.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });

    if (!orgUser) {
      throw new NotFoundException('User is not a member of this organization');
    }

    return this.prisma.organizationUser.update({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
      data: { orgRole: orgRole as 'orgadmin' | 'manager' | 'agent' | 'requester' },
    });
  }

  /**
   * Get all users in an organization
   */
  async getUsers(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new NotFoundException(`Organization with ID "${organizationId}" not found`);
    }

    const orgUsers = await this.prisma.organizationUser.findMany({
      where: { organizationId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            isActive: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Flatten the response to match frontend expectations
    return orgUsers.map(orgUser => ({
      id: orgUser.user.id,
      email: orgUser.user.email,
      firstName: orgUser.user.firstName,
      lastName: orgUser.user.lastName,
      isActive: orgUser.user.isActive,
      role: orgUser.user.role,
      currentOrgRole: orgUser.orgRole,
    }));
  }

  /**
   * Get all teams in an organization
   */
  async getTeams(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new NotFoundException(`Organization with ID "${organizationId}" not found`);
    }

    return this.prisma.team.findMany({
      where: { organizationId },
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: { members: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get all members of a team
   */
  async getTeamMembers(organizationId: string, teamId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new NotFoundException(`Organization with ID "${organizationId}" not found`);
    }

    const team = await this.prisma.team.findFirst({
      where: { id: teamId, organizationId },
    });

    if (!team) {
      throw new NotFoundException(`Team with ID "${teamId}" not found in this organization`);
    }

    const members = await this.prisma.userTeam.findMany({
      where: { teamId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
            isActive: true,
          },
        },
      },
    });

    // Flatten to return user data with isPrimary
    return members.map((member: any) => ({
      ...member.user,
      isPrimary: member.isPrimary,
      joinedAt: member.createdAt,
    }));
  }

  /**
   * Get user's organization memberships
   */
  async getUserOrganizations(userId: string) {
    return this.prisma.organizationUser.findMany({
      where: { userId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            logoUrl: true,
            primaryColor: true,
          },
        },
      },
    });
  }

  /**
   * Check if user belongs to organization
   */
  async isUserInOrganization(organizationId: string, userId: string): Promise<boolean> {
    const orgUser = await this.prisma.organizationUser.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });

    return !!orgUser;
  }

  /**
   * Get user's role in organization
   */
  async getUserOrgRole(organizationId: string, userId: string): Promise<string | null> {
    const orgUser = await this.prisma.organizationUser.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });

    return orgUser?.orgRole || null;
  }

  /**
   * Update organization Azure AD SSO configuration
   */
  async updateAzureAdConfig(id: string, dto: {
    azureAdEnabled?: boolean;
    azureAdClientId?: string;
    azureAdClientSecret?: string;
    azureAdTenantId?: string;
    azureAdRedirectUri?: string;
  }) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
    });

    if (!organization) {
      throw new NotFoundException(`Organization with ID "${id}" not found`);
    }

    // If enabling Azure AD, validate that required fields are provided
    if (dto.azureAdEnabled === true) {
      if (!dto.azureAdClientId || !dto.azureAdClientSecret || !dto.azureAdTenantId || !dto.azureAdRedirectUri) {
        throw new ConflictException('All Azure AD fields (client ID, client secret, tenant ID, and redirect URI) are required when enabling Azure AD SSO');
      }
    }

    return this.prisma.organization.update({
      where: { id },
      data: {
        ...(dto.azureAdEnabled !== undefined && { azureAdEnabled: dto.azureAdEnabled }),
        ...(dto.azureAdClientId !== undefined && { azureAdClientId: dto.azureAdClientId }),
        ...(dto.azureAdClientSecret !== undefined && { azureAdClientSecret: dto.azureAdClientSecret }),
        ...(dto.azureAdTenantId !== undefined && { azureAdTenantId: dto.azureAdTenantId }),
        ...(dto.azureAdRedirectUri !== undefined && { azureAdRedirectUri: dto.azureAdRedirectUri }),
      },
    });
  }

  /**
   * Get organization Azure AD SSO configuration (without secrets)
   */
  async getAzureAdConfig(id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        azureAdEnabled: true,
        azureAdClientId: true,
        azureAdTenantId: true,
        azureAdRedirectUri: true,
      },
    });

    if (!organization) {
      throw new NotFoundException(`Organization with ID "${id}" not found`);
    }

    // Return a masked version of the client secret (we don't store it for security reasons,
    // but if we did, we'd mask it here)
    return {
      ...organization,
      hasClientSecret: false, // We don't store the secret in the database
    };
  }

  /**
   * Get organization's email settings (sanitized, without passwords)
   */
  async getEmailSettings(id: string): Promise<OrganizationEmailSettingsResponseDto> {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
      select: {
        id: true,
        emailSettings: true as any,
      },
    });

    if (!organization) {
      throw new NotFoundException(`Organization with ID "${id}" not found`);
    }

    const emailSettings = (organization as any).emailSettings as {
      smtp?: { host?: string; port?: number; secure?: boolean; user?: string; pass?: string; fromAddress?: string; fromName?: string };
      imap?: { host?: string; port?: number; secure?: boolean; user?: string; pass?: string; inboxFolder?: string };
    } | null;

    const response: OrganizationEmailSettingsResponseDto = {
      hasSmtp: !!(emailSettings?.smtp?.host && emailSettings?.smtp?.user),
      smtpHost: emailSettings?.smtp?.host,
      smtpPort: emailSettings?.smtp?.port,
      smtpSecure: emailSettings?.smtp?.secure,
      smtpFromAddress: emailSettings?.smtp?.fromAddress,
      smtpFromName: emailSettings?.smtp?.fromName,
      hasImap: !!(emailSettings?.imap?.host && emailSettings?.imap?.user),
      imapHost: emailSettings?.imap?.host,
      imapPort: emailSettings?.imap?.port,
      imapSecure: emailSettings?.imap?.secure,
      imapInboxFolder: emailSettings?.imap?.inboxFolder,
      isCustom: !!(organization as any).emailSettings,
      // Include raw config for form population
      smtp: emailSettings?.smtp ? {
        host: emailSettings.smtp.host,
        port: emailSettings.smtp.port,
        secure: emailSettings.smtp.secure,
        user: emailSettings.smtp.user,
        fromAddress: emailSettings.smtp.fromAddress,
        fromName: emailSettings.smtp.fromName,
      } : undefined,
      imap: emailSettings?.imap ? {
        host: emailSettings.imap.host,
        port: emailSettings.imap.port,
        secure: emailSettings.imap.secure,
        user: emailSettings.imap.user,
        inboxFolder: emailSettings.imap.inboxFolder,
      } : undefined,
    };

    return response;
  }

  /**
   * Get organization's raw email settings (with passwords - internal use only)
   */
  async getEmailSettingsRaw(id: string): Promise<{
    smtp?: { host?: string; port?: number; secure?: boolean; user?: string; pass?: string; fromAddress?: string; fromName?: string };
    imap?: { host?: string; port?: number; secure?: boolean; user?: string; pass?: string; inboxFolder?: string };
  } | null> {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
      select: {
        id: true,
        emailSettings: true as any,
      },
    });

    if (!organization) {
      throw new NotFoundException(`Organization with ID "${id}" not found`);
    }

    return (organization as any).emailSettings;
  }

  /**
   * Update organization's email settings
   * Use null values to remove specific settings
   */
  async updateEmailSettings(
    id: string,
    settings: {
      smtp?: {
        host?: string;
        port?: number;
        secure?: boolean;
        user?: string;
        pass?: string;
        fromAddress?: string;
        fromName?: string;
      } | null;
      imap?: {
        host?: string;
        port?: number;
        secure?: boolean;
        user?: string;
        pass?: string;
        inboxFolder?: string;
      } | null;
    },
  ) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
    });

    if (!organization) {
      throw new NotFoundException(`Organization with ID "${id}" not found`);
    }

    // Get existing settings
    const existingSettings = ((organization as any).emailSettings as {
      smtp?: Record<string, any>;
      imap?: Record<string, any>;
    } | null) || {};

    // Merge with new settings
    const updatedSettings = {
      smtp: settings.smtp === null ? undefined : { ...existingSettings.smtp, ...settings.smtp },
      imap: settings.imap === null ? undefined : { ...existingSettings.imap, ...settings.imap },
    };

    // Remove undefined values
    if (!updatedSettings.smtp || Object.keys(updatedSettings.smtp).length === 0) {
      delete updatedSettings.smtp;
    }
    if (!updatedSettings.imap || Object.keys(updatedSettings.imap).length === 0) {
      delete updatedSettings.imap;
    }

    return this.prisma.organization.update({
      where: { id },
      data: {
        emailSettings: (Object.keys(updatedSettings).length > 0 ? updatedSettings : Prisma.JsonNull) as any,
      },
    });
  }

  /**
   * Test email settings by attempting to connect to SMTP server
   */
  async testEmailSettings(id: string): Promise<{ success: boolean; message: string }> {
    const emailSettings = await this.getEmailSettingsRaw(id);
    const smtp = emailSettings?.smtp;

    if (!smtp?.host || !smtp?.user || !smtp?.pass) {
      return { success: false, message: 'SMTP settings not configured' };
    }

    try {
      // Dynamic import nodemailer for testing
      const nodemailer = await import('nodemailer');

      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port || 587,
        secure: smtp.secure || false,
        auth: {
          user: smtp.user,
          pass: smtp.pass,
        },
        connectionTimeout: 5000, // 5 second timeout
      });

      // Verify the connection
      await transporter.verify();

      return { success: true, message: 'SMTP connection successful' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, message: `SMTP connection failed: ${errorMessage}` };
    }
  }
}
