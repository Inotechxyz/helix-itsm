import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { OrganizationAuthProvider, OrganizationRole } from '@helix/shared';
import { LicenseService } from '../license/license.module';

export interface OrgJwtPayload {
  sub: string;
  email: string;
  role: string;
  organizationId: string;
  orgRole?: string;
}

export interface OrgAuthResponse {
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
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  organizations: Array<{
    id: string;
    name: string;
    slug: string;
    role: string;
  }>;
}

@Injectable()
export class OrganizationAuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
    private licenseService: LicenseService,
  ) {}

  /**
   * Get organization by slug for login
   */
  async getOrganizationBySlug(slug: string) {
    const org = await this.prisma.organization.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        authProviderType: true,
        authProviderConfig: true,
        primaryColor: true,
        logoUrl: true,
      },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    if (org.status !== 'active') {
      throw new BadRequestException('Organization is not active');
    }

    return org;
  }

  /**
   * Get organization by ID
   */
  async getOrganizationById(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        authProviderType: true,
        authProviderConfig: true,
        primaryColor: true,
        logoUrl: true,
      },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return org;
  }

  /**
   * Login user to a specific organization
   */
  async loginToOrganization(
    email: string,
    password: string,
    organizationId: string,
  ): Promise<OrgAuthResponse> {
    // Verify organization exists and is active
    const organization = await this.getOrganizationById(organizationId);

    if (organization.authProviderType !== OrganizationAuthProvider.LOCAL) {
      throw new BadRequestException(
        `This organization uses ${organization.authProviderType} authentication. Please use SSO.`,
      );
    }

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        organizationUsers: {
          where: { organizationId },
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify user belongs to this organization
    const orgMembership = user.organizationUsers.find(
      (ou) => ou.organizationId === organizationId,
    );

    if (!orgMembership) {
      throw new UnauthorizedException(
        'You are not a member of this organization',
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('User account is disabled');
    }

    // Generate tokens with org context
    return this.generateOrgTokens(user, organization, orgMembership.orgRole as OrganizationRole);
  }

  /**
   * Get user's organizations for org switcher
   * For superadmins, returns all organizations
   */
  async getUserOrganizations(userId: string) {
    // First, check if user is a superadmin
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    // If superadmin, return all organizations
    if (user?.role === 'superadmin') {
      const allOrgs = await this.prisma.organization.findMany({
        where: { status: { not: 'suspended' } },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          maxUsers: true,
          createdAt: true,
          logoUrl: true,
          primaryColor: true,
        },
        orderBy: { name: 'asc' },
      });

      // Get license info for all organizations
      const orgsWithLicense = await Promise.all(
        allOrgs.map(async (org) => {
          const license = await this.licenseService.getLicense(org.id);
          return {
            id: org.id,
            name: org.name,
            slug: org.slug,
            status: org.status,
            tier: license.tier || 'basic',
            hasLicense: license.tier !== null,
            maxUsers: org.maxUsers,
            createdAt: org.createdAt,
            logoUrl: org.logoUrl,
            primaryColor: org.primaryColor,
            role: 'orgadmin', // Superadmins have admin access to all orgs
            isSuperadmin: true,
          };
        })
      );

      return orgsWithLicense;
    }

    // For regular users, return only their organizations
    const orgUsers = await this.prisma.organizationUser.findMany({
      where: { userId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            maxUsers: true,
            createdAt: true,
            logoUrl: true,
            primaryColor: true,
          },
        },
      },
    });

    // Get license info for user's organizations
    const orgsWithLicense = await Promise.all(
      orgUsers.map(async (ou) => {
        const license = await this.licenseService.getLicense(ou.organization.id);
        return {
          id: ou.organization.id,
          name: ou.organization.name,
          slug: ou.organization.slug,
          status: ou.organization.status,
          tier: license.tier || 'basic',
          hasLicense: license.tier !== null,
          maxUsers: ou.organization.maxUsers,
          createdAt: ou.organization.createdAt,
          logoUrl: ou.organization.logoUrl,
          primaryColor: ou.organization.primaryColor,
          role: ou.orgRole,
          joinedAt: ou.createdAt,
        };
      })
    );

    return orgsWithLicense;
  }

  /**
   * Switch user's current organization
   * For superadmins, allows switching to any organization
   */
  async switchOrganization(userId: string, organizationId: string) {
    // First, check if user is a superadmin
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // For superadmins, allow switching to any organization
    if (user.role === 'superadmin') {
      const org = await this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          maxUsers: true,
          createdAt: true,
          logoUrl: true,
          primaryColor: true,
        },
      });

      if (!org) {
        throw new NotFoundException('Organization not found');
      }

      if (org.status !== 'active') {
        throw new BadRequestException('Organization is not active');
      }

      // Get all organizations for superadmin
      const organizations = await this.getUserOrganizations(userId);

      const currentOrg = organizations.find((o) => o.id === organizationId);

      if (!currentOrg) {
        throw new NotFoundException('Organization not found in user orgs');
      }

      // Generate new tokens for superadmin
      return this.generateOrgTokens(
        user,
        org,
        'orgadmin' as OrganizationRole,
        organizations,
      );
    }

    // For regular users, verify membership
    const orgUser = await this.prisma.organizationUser.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            maxUsers: true,
            createdAt: true,
            logoUrl: true,
            primaryColor: true,
          },
        },
      },
    });

    if (!orgUser) {
      throw new UnauthorizedException('You are not a member of this organization');
    }

    if (orgUser.organization.status !== 'active') {
      throw new BadRequestException('Organization is not active');
    }

    // Get all user's organizations
    const organizations = await this.getUserOrganizations(userId);
    const currentOrg = organizations.find((o) => o.id === organizationId);

    if (!currentOrg) {
      throw new NotFoundException('Organization not found');
    }

    // Generate new tokens with new org context
    return this.generateOrgTokens(
      user,
      orgUser.organization,
      orgUser.orgRole as OrganizationRole,
      organizations,
    );
  }

  /**
   * Generate JWT tokens with organization context
   */
  private async generateOrgTokens(
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      avatarUrl?: string | null;
    },
    organization: { id: string; name: string; slug: string },
    orgRole: OrganizationRole,
    organizations?: Array<{
      id: string;
      name: string;
      slug: string;
      role: string;
    }>,
  ): Promise<OrgAuthResponse> {
    // Generate access token with org context
    const payload: OrgJwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: organization.id,
      orgRole,
    };

    const accessToken = this.jwtService.sign(payload);

    // Generate refresh token
    const refreshPayload = { ...payload };
    const refreshTokenValue = this.jwtService.sign(refreshPayload, {
      secret: this.config.get('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '7d'),
    });

    const uniqueToken = `${refreshTokenValue}.${crypto.randomUUID()}`;

    // Store refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: uniqueToken,
        expiresAt,
      },
    });

    // If no organizations provided, fetch them
    if (!organizations) {
      const orgUsers = await this.prisma.organizationUser.findMany({
        where: { userId: user.id },
        include: {
          organization: {
            select: { id: true, name: true, slug: true, status: true, maxUsers: true, createdAt: true, logoUrl: true, primaryColor: true },
          },
        },
      });

      // Get license info for user's organizations
      organizations = await Promise.all(
        orgUsers.map(async (ou) => {
          const license = await this.licenseService.getLicense(ou.organization.id);
          return {
            id: ou.organization.id,
            name: ou.organization.name,
            slug: ou.organization.slug,
            status: ou.organization.status,
            tier: license.tier || 'basic',
            hasLicense: license.tier !== null,
            maxUsers: ou.organization.maxUsers,
            createdAt: ou.organization.createdAt,
            logoUrl: ou.organization.logoUrl,
            primaryColor: ou.organization.primaryColor,
            role: ou.orgRole,
          };
        })
      );
    }

    return {
      accessToken,
      refreshToken: uniqueToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        avatarUrl: user.avatarUrl || undefined,
      },
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
      },
      organizations,
    };
  }
}
