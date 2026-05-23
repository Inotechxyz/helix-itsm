import { Injectable, ExecutionContext, ForbiddenException, UnauthorizedException, CanActivate, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PrismaService } from '../../common/prisma.service';
import { UserRole } from '@helix/shared';
import { IS_PUBLIC_KEY } from '../../decorators/public.decorator';
import { ORGANIZATION_ROLES_KEY } from '../../decorators/organization-roles.decorator';
import { OrganizationRole, hasOrgRoleOrHigher } from '@helix/shared';

/**
 * Combined JWT Auth + Organization Context Guard
 *
 * This guard combines JwtAuthGuard and OrganizationContextGuard functionality
 * to ensure proper execution order:
 * 1. First, validate JWT and set req.user
 * 2. Then, set organization context from header
 *
 * Use this guard instead of @UseGuards(JwtAuthGuard, OrganizationContextGuard)
 */
@Injectable()
export class JwtAuthWithOrgGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthWithOrgGuard.name);

  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if this is a public endpoint using decorator
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Also check by path as a fallback for public endpoints
    const request = context.switchToHttp().getRequest<Request>();
    const path = request.url || request.originalUrl || '';
    // Handle versioned paths like /v1/organizations/public
    const isPublicPath = path.includes('organizations/public') ||
                         path.includes('organizations/invitations/') ||
                         path.includes('organizations/slug/');

    // Debug logging
    const handlerName = context.getHandler().name;
    const className = context.getClass().name;
    this.logger.debug(`Checking: ${className}.${handlerName}`);
    this.logger.debug(`Path: ${path}, isPublic decorator: ${isPublic}, isPublicPath: ${isPublicPath}`);

    // Check for internal API key (service-to-service auth from chatbot)
    const internalApiKey = request.headers['x-internal-api-key'] as string;
    const chatbotServiceCall = request.headers['x-chatbot-service'] === 'true';
    const internalApiKeyConfigured = process.env.INTERNAL_API_KEY;

    // If this is a service-to-service call with internal API key
    if (chatbotServiceCall && internalApiKey && internalApiKeyConfigured) {
      // Validate the internal API key
      if (internalApiKey === internalApiKeyConfigured) {
        // Set organization context from headers
        const orgId = request.headers['x-organization-id'] as string;
        const userId = request.headers['x-user-id'] as string;
        const userEmail = request.headers['x-user-email'] as string;

        if (orgId) {
          // Validate user belongs to organization
          const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, role: true },
          });

          if (user) {
            // Check membership
            const orgUser = await this.prisma.organizationUser.findUnique({
              where: {
                organizationId_userId: {
                  organizationId: orgId,
                  userId: userId,
                },
              },
            });

            if (orgUser || user.role === UserRole.superadmin) {
              // Cast to any to allow partial user object for internal service calls
              (request as any).user = {
                id: userId,
                email: userEmail || '',
                firstName: '',
                lastName: '',
                role: user.role,
              };
              request.organizationId = orgId;
              request.userOrgRole = orgUser?.orgRole || 'orgadmin';
              this.logger.debug(`Internal service call authenticated: userId=${userId}, orgId=${orgId}`);
              return true;
            }
          }
        }
      }
    }

    // For public endpoints, don't validate JWT at all - just allow
    if (isPublic || isPublicPath) {
      this.logger.debug(`Allowing public endpoint: ${className}.${handlerName}`);
      return true;
    }

    // For protected endpoints, validate JWT using passport's jwt strategy
    const jwtGuard = new (AuthGuard('jwt'))();
    try {
      const canActivate = await jwtGuard.canActivate(context);
      if (!canActivate) {
        return false;
      }
    } catch (error) {
      // If authentication fails, throw appropriate error
      if (error instanceof UnauthorizedException || (error as any)?.name === 'UnauthorizedException') {
        throw new ForbiddenException('Authentication required');
      }
      throw error;
    }

    const user = request.user;

    // If no user after JWT validation, deny access
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const userId = user.id;
    const isSuperadmin = user.role === UserRole.superadmin;

    // Check for organization in header
    const orgIdHeader = request.headers['x-organization-id'] as string;
    const orgSlugHeader = request.headers['x-organization-slug'] as string;

    if (orgIdHeader) {
      if (isSuperadmin) {
        // Superadmins can access any organization
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
        // Regular users: validate user belongs to this organization
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
      // Look up organization by slug
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
          // Regular users: validate membership
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

    // For superadmins, always allow access
    if (isSuperadmin) {
      return true;
    }

    // Check if organization roles are required for this route
    const requiredRoles = this.reflector.getAllAndOverride<OrganizationRole[]>(
      ORGANIZATION_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no organization roles required, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Check if user has organization context
    if (!request.organizationId || !request.userOrgRole) {
      throw new ForbiddenException(
        'You do not have access to this organization',
      );
    }

    // Check if user has required role in organization
    const userOrgRole = request.userOrgRole as OrganizationRole;
    const hasRequiredRole = requiredRoles.some((role) =>
      hasOrgRoleOrHigher(userOrgRole, role),
    );

    if (!hasRequiredRole) {
      throw new ForbiddenException(
        `You need one of these organization roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}