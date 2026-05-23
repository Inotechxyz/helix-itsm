import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PrismaService } from './prisma.service';
import { UserRole } from '@helix/shared';
import { OrganizationRole, hasOrgRoleOrHigher } from '@helix/shared';
import { ORGANIZATION_ROLES_KEY } from '../decorators/organization-roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Guard to set organization context and validate access
 *
 * This guard runs AFTER JwtAuthGuard and sets the organization context
 * from the x-organization-id header. For superadmins, it allows
 * access to any organization. For regular users, it validates membership.
 */
@Injectable()
export class OrganizationContextGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Skip public endpoints (like /auth/login, /auth/register)
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;

    // If no user (shouldn't happen after JwtAuthGuard), deny access
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const userId = user.id;
    const isSuperadmin = user.role === UserRole.superadmin;

    // Check for organization in header
    const orgIdHeader = request.headers['x-organization-id'] as string;
    const orgSlugHeader = request.headers['x-organization-slug'] as string;

    if (orgIdHeader) {
      // Superadmins can access any organization
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
        // Superadmins can access any organization
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