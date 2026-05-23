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
 */
@Injectable()
export class JwtAuthWithOrgGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthWithOrgGuard.name);

  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if this is a public endpoint
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<Request>();
    const path = request.url || request.originalUrl || '';

    // Debug logging
    const handlerName = context.getHandler().name;
    const className = context.getClass().name;
    this.logger.debug(`Checking: ${className}.${handlerName}`);

    // For public endpoints, allow
    if (isPublic) {
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
      if (error instanceof UnauthorizedException || (error as any)?.name === 'UnauthorizedException') {
        throw new ForbiddenException('Authentication required');
      }
      throw error;
    }

    const user = request.user as any;

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

    // For superadmins, always allow
    if (isSuperadmin) {
      return true;
    }

    // Check if organization roles are required
    const requiredRoles = this.reflector.getAllAndOverride<OrganizationRole[]>(
      ORGANIZATION_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    if (!request.organizationId || !request.userOrgRole) {
      throw new ForbiddenException(
        'You do not have access to this organization',
      );
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

    return true;
  }
}