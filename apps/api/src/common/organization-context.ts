import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from './prisma.service';
import { UserRole } from '@helix/shared';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      organizationId?: string;
      organizationSlug?: string;
      userOrgRole?: string;
    }
  }
}

@Injectable()
export class OrganizationContextMiddleware implements NestMiddleware {
  constructor(private prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const orgIdHeader = req.headers['x-organization-id'] as string;

    // Skip for public routes (handle both /v1 prefix and without)
    const publicRoutes = [
      '/health',
      '/api-docs',
      '/v1/auth/login',
      '/v1/auth/register',
      '/v1/auth/org/login',
      '/v1/auth/org/switch',
      '/v1/auth/org/',
      '/organizations/slug',
    ];
    const requestPath = req.path;
    if (publicRoutes.some((route) => requestPath.startsWith(route))) {
      return next();
    }

    // Skip if no authenticated user
    const user = (req as any).user;
    if (!user?.id) {
      return next();
    }

    const userId = user.id;
    const isSuperadmin = user.role === UserRole.superadmin;

    // Check for organization in header (for multi-org access)
    const orgSlugHeader = req.headers['x-organization-slug'] as string;

    if (orgIdHeader) {
      // Superadmins can access any organization
      if (isSuperadmin) {
        const org = await this.prisma.organization.findUnique({
          where: { id: orgIdHeader },
          select: { id: true, slug: true, status: true },
        });

        if (org && org.status === 'active') {
          req.organizationId = org.id;
          req.organizationSlug = org.slug;
          req.userOrgRole = 'orgadmin'; // Superadmins have admin access
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
          req.organizationId = orgIdHeader;
          req.userOrgRole = orgUser.orgRole;
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
          req.organizationId = org.id;
          req.organizationSlug = org.slug;
          req.userOrgRole = 'orgadmin';
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
            req.organizationId = org.id;
            req.organizationSlug = org.slug;
            req.userOrgRole = orgUser.orgRole;
          }
        }
      }
    }

    next();
  }
}