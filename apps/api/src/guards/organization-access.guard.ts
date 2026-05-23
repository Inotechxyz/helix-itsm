import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { UserRole, OrganizationRole, hasOrgRoleOrHigher } from '@helix/shared';
import { ORGANIZATION_ROLES_KEY } from '../decorators/organization-roles.decorator';

/**
 * Guard to validate user has access to the requested organization
 *
 * This guard:
 * 1. Checks if the user is a SuperAdmin (global access)
 * 2. For non-SuperAdmins, checks if they have organization context
 * 3. Validates organization roles if @OrganizationRoles decorator is used
 */
@Injectable()
export class OrganizationAccessGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;

    // If no user, deny access
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    // SuperAdmin has global access
    if (user.role === UserRole.superadmin) {
      return true;
    }

    // Check if organization context is required for this route
    const requiredRoles = this.reflector.getAllAndOverride<OrganizationRole[]>(
      ORGANIZATION_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no organization roles required, just check if user has org context
    if (!requiredRoles || requiredRoles.length === 0) {
      if (!request.organizationId) {
        // User without org context can still access if they're not org-specific
        return true;
      }
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
