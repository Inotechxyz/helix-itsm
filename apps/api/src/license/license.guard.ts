import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
  Inject,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { LicenseService } from '@inotechxyz/protected-license';

/**
 * Extended Request interface with organization context
 */
interface RequestWithOrg {
  organizationId?: string;
  user?: { id?: string; role?: string };
  url?: string;
  originalUrl?: string;
}

/**
 * License Guard - Validates that the organization's license is not expired
 *
 * This guard should be used after JwtAuthWithOrgGuard to validate the license.
 * It checks if the organization has a valid, non-expired license.
 *
 * Superadmins bypass license checks.
 */
@Injectable()
export class LicenseGuard implements CanActivate {
  private readonly logger = new Logger(LicenseGuard.name);

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
    @Optional() private reflector?: Reflector,
    private licenseService?: LicenseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get Reflector and LicenseService from context if not injected
    if (!this.reflector) {
      this.reflector = context.switchToHttp().getRequest().app?.get?.(Reflector);
    }

    // Check if this is a public endpoint (decorator-based)
    const isPublic = this.reflector?.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithOrg>();
    const path = request.url || request.originalUrl || '';

    // Check if this is a public path (path-based)
    const isPublicPath = this.publicPaths.some(p => path.includes(p));

    if (isPublicPath) {
      return true;
    }

    // Get user from request (set by JwtAuthWithOrgGuard)
    const user = request.user;
    const isSuperadmin = user?.role === 'superadmin';

    // Superadmins bypass license checks
    if (isSuperadmin) {
      return true;
    }

    // Get organization from request context
    const organizationId = request.organizationId;

    // If no organization context, let the request proceed
    if (!organizationId) {
      return true;
    }

    try {
      // Check if license is expired
      const isExpired = await this.licenseService!.isExpired(organizationId);
      this.logger.debug(`License check for org ${organizationId}: expired=${isExpired}`);

      if (isExpired) {
        throw new ForbiddenException(
          'Your organization\'s license has expired. Please contact support to renew.',
        );
      }

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      // If license service fails (e.g., Redis down), allow request but log warning
      this.logger.warn(`License validation failed, allowing request: ${error}`);
      return true;
    }
  }
}