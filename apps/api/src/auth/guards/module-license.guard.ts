import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PrismaService } from '../../common/prisma.service';
import { UserRole, OrganizationRole, hasOrgRoleOrHigher } from '@helix/shared';
import { IS_PUBLIC_KEY } from '../../decorators/public.decorator';
import { ORGANIZATION_ROLES_KEY } from '../../decorators/organization-roles.decorator';
import { MODULE_KEY, RequiredModule } from '../../decorators/module.decorator';
import { LicenseService } from '@inotechxyz/protected-license';

/**
 * Module display names for error messages
 */
const MODULE_DISPLAY_NAMES: Record<string, string> = {
  tickets: 'Tickets',
  service_catalog: 'Service Catalog',
  knowledge_base: 'Knowledge Base',
  assets: 'Assets',
  problems: 'Problems',
  changes: 'Changes',
  software_licenses: 'Software Licenses',
  sla_policies: 'SLA Policies',
  ola_policies: 'OLA Policies',
  reports: 'Reports',
};

/**
 * Combined Guard: JWT Auth + Organization Context + License + Module Check
 *
 * This guard combines all authentication and authorization checks:
 * 1. Validates JWT and sets user context
 * 2. Sets organization context from header
 * 3. Checks required organization roles
 * 4. Checks license is not expired
 * 5. Checks required module is enabled
 *
 * Superadmins bypass all checks except JWT validation.
 *
 * Usage:
 * @UseGuards(ModuleLicenseGuard)
 * @RequiredModule('service_catalog')
 * @Controller('service-catalog')
 */
@Injectable()
export class ModuleLicenseGuard implements CanActivate {
  private readonly logger = new Logger(ModuleLicenseGuard.name);

  // Paths that don't require license validation
  private readonly publicPaths = [
    '/api/health',
    '/api/v1/auth/login',
    '/api/v1/auth/register',
    '/api/v1/organizations/public',
    '/api/v1/organizations/slug/',
    '/api/v1/invitations/',
  ];

  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
    private licenseService: LicenseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Check if public endpoint
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<Request>();
    const path = request.url || request.originalUrl || '';
    const isPublicPath = path.includes('organizations/public') ||
                         path.includes('organizations/invitations/') ||
                         path.includes('organizations/slug/');

    // 2. Check for internal API key (service-to-service auth from chatbot)
    const internalApiKey = request.headers['x-internal-api-key'] as string;
    const chatbotServiceCall = request.headers['x-chatbot-service'] === 'true';
    const internalApiKeyConfigured = process.env.INTERNAL_API_KEY;

    if (chatbotServiceCall && internalApiKey && internalApiKeyConfigured && internalApiKey === internalApiKeyConfigured) {
      const orgId = request.headers['x-organization-id'] as string;
      const userId = request.headers['x-user-id'] as string;
      const userEmail = request.headers['x-user-email'] as string;

      if (orgId) {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, role: true },
        });

        if (user) {
          const orgUser = await this.prisma.organizationUser.findUnique({
            where: {
              organizationId_userId: {
                organizationId: orgId,
                userId: userId,
              },
            },
          });

          if (orgUser || user.role === UserRole.superadmin) {
            (request as any).user = {
              id: userId,
              email: userEmail || '',
              firstName: '',
              lastName: '',
              role: user.role,
            };
            request.organizationId = orgId;
            request.userOrgRole = orgUser?.orgRole || 'orgadmin';
            return true;
          }
        }
      }
    }

    // 3. For public endpoints, don't validate JWT
    if (isPublic || isPublicPath) {
      return true;
    }

    // 4. Validate JWT using passport's jwt strategy
    const jwtGuard = new (AuthGuard('jwt'))();
    try {
      const canActivate = await jwtGuard.canActivate(context);
      if (!canActivate) {
        return false;
      }
    } catch (error) {
      if (error instanceof UnauthorizedException || (error as any)?.name === 'UnauthorizedException') {
        throw new ForbiddenException('Authentication required');
      }
      throw error;
    }

    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const userId = user.id;
    const isSuperadmin = user.role === UserRole.superadmin;

    // 5. Set organization context
    const orgIdHeader = request.headers['x-organization-id'] as string;
    const orgSlugHeader = request.headers['x-organization-slug'] as string;

    if (orgIdHeader) {
      if (isSuperadmin) {
        const org = await this.prisma.organization.findUnique({
          where: { id: orgIdHeader },
          select: { id: true, slug: true, status: true },
        });

        if (org && org.status === 'active') {
          request.organizationId = org.id;
          request.organizationSlug = org.slug;
          request.userOrgRole = 'orgadmin';
        }
      } else {
        const orgUser = await this.prisma.organizationUser.findUnique({
          where: {
            organizationId_userId: {
              organizationId: orgIdHeader,
              userId: userId,
            },
          },
        });

        if (orgUser) {
          request.organizationId = orgIdHeader;
          request.userOrgRole = orgUser.orgRole;
        }
      }
    } else if (orgSlugHeader) {
      const org = await this.prisma.organization.findUnique({
        where: { slug: orgSlugHeader },
        select: { id: true, slug: true, status: true },
      });

      if (org) {
        if (isSuperadmin && org.status === 'active') {
          request.organizationId = org.id;
          request.organizationSlug = org.slug;
          request.userOrgRole = 'orgadmin';
        } else {
          const orgUser = await this.prisma.organizationUser.findUnique({
            where: {
              organizationId_userId: {
                organizationId: org.id,
                userId: userId,
              },
            },
          });

          if (orgUser) {
            request.organizationId = org.id;
            request.organizationSlug = org.slug;
            request.userOrgRole = orgUser.orgRole;
          }
        }
      }
    }

    // 6. Superadmins bypass all checks
    if (isSuperadmin) {
      return true;
    }

    // 7. Check organization roles
    const requiredRoles = this.reflector.getAllAndOverride<OrganizationRole[]>(
      ORGANIZATION_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredRoles && requiredRoles.length > 0) {
      if (!request.organizationId || !request.userOrgRole) {
        throw new ForbiddenException('You do not have access to this organization');
      }

      const userOrgRole = request.userOrgRole as OrganizationRole;
      const hasRequiredRole = requiredRoles.some((role) =>
        hasOrgRoleOrHigher(userOrgRole, role),
      );

      if (!hasRequiredRole) {
        throw new ForbiddenException(
          `You need one of these organization roles: ${requiredRoles.join(', ')}`,
        );
      }
    }

    // 8. Check license expiration
    if (request.organizationId) {
      try {
        const isExpired = await this.licenseService.isExpired(request.organizationId);
        if (isExpired) {
          throw new ForbiddenException(
            'Your organization\'s license has expired. Please contact support to renew.',
          );
        }
      } catch (error) {
        if (error instanceof ForbiddenException) {
          throw error;
        }
        this.logger.warn(`License validation failed: ${error}`);
      }
    }

    // 9. Check required module
    const requiredModule = this.reflector.getAllAndOverride<string>(
      MODULE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredModule && request.organizationId) {
      try {
        const isEnabled = await this.licenseService.isModuleEnabled(
          requiredModule,
          request.organizationId,
        );

        if (!isEnabled) {
          const displayName = MODULE_DISPLAY_NAMES[requiredModule] || requiredModule;
          throw new ForbiddenException(
            `${displayName} module is not enabled for your organization`,
          );
        }
      } catch (error) {
        if (error instanceof ForbiddenException) {
          throw error;
        }
        this.logger.warn(`Module check failed: ${error}`);
      }
    }

    return true;
  }
}

export { RequiredModule } from '../../decorators/module.decorator';