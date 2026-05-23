import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from '../../common/prisma.service';
import { UserRole } from '@helix/shared';

// Cookie name for caching user context
const USER_CONTEXT_COOKIE = 'helix_user_context';
// Cache duration in milliseconds (5 minutes)
const USER_CONTEXT_TTL = 5 * 60 * 1000;

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  organizationId?: string;
}

export interface CachedUserContext {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  avatarUrl?: string | null;
  teams: { id: string; name: string; type: string; isPrimary: boolean; organizationId: string | null }[];
  organizationId: string | null;
  organizationSlug: string | null;
  orgRole: string | null;
  organizations: {
    organizationId: string;
    organizationName: string;
    organizationSlug: string;
    organizationStatus: string;
    orgRole: string;
  }[];
  cachedAt: number; // timestamp when cached
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private prisma: PrismaService,
    config: ConfigService,
  ) {
    super();
    this.jwtSecret = config.get('JWT_SECRET') || '';
  }

  private jwtSecret: string;

  async validate(req: Request): Promise<any> {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);

    // Verify JWT token
    try {
      const jwt = require('jsonwebtoken');
      const payload = jwt.verify(token, this.jwtSecret) as JwtPayload;

      // Try to get cached user context from cookie
      const cachedContext = this.getCachedContext(req);

      // If cache is valid (within TTL), use it
      if (cachedContext && this.isCacheValid(cachedContext)) {
        // Even with cache, we need to verify user still exists and is active
        const isValid = await this.prisma.user.findUnique({
          where: { id: payload.sub },
          select: { id: true, isActive: true },
        });

        if (isValid && isValid.isActive) {
          // Update organization from payload if it changed
          if (payload.organizationId && cachedContext.organizationId !== payload.organizationId) {
            return this.refreshContext(req, payload, cachedContext);
          }
          return cachedContext;
        }
      }

      // Cache miss or expired - fetch from database
      return await this.fetchAndCacheUserContext(req, payload);
    } catch {
      return null;
    }
  }

  private getCachedContext(req: Request): CachedUserContext | null {
    try {
      const cookies = req.headers.cookie?.split(';') || [];
      const userContextCookie = cookies.find((c) => c.trim().startsWith(`${USER_CONTEXT_COOKIE}=`));

      if (userContextCookie) {
        const cookieValue = userContextCookie.split('=')[1];
        return JSON.parse(decodeURIComponent(cookieValue));
      }
    } catch {
      // Cookie parsing failed, return null
    }
    return null;
  }

  private isCacheValid(context: CachedUserContext): boolean {
    const now = Date.now();
    return now - context.cachedAt < USER_CONTEXT_TTL;
  }

  private setCachedContext(res: any, context: CachedUserContext): void {
    if (res && res.cookie) {
      const contextCopy = { ...context, cachedAt: Date.now() };
      res.cookie(USER_CONTEXT_COOKIE, JSON.stringify(contextCopy), {
        httpOnly: false, // Allow frontend to read (but not modify)
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: USER_CONTEXT_TTL,
        path: '/',
      });
    }
  }

  private clearCachedContext(res: any): void {
    if (res && res.clearCookie) {
      res.clearCookie(USER_CONTEXT_COOKIE, { path: '/' });
    }
  }

  private async fetchAndCacheUserContext(req: Request, payload: JwtPayload): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        teams: {
          include: { team: true },
        },
        organizationUsers: {
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

    if (!user || !user.isActive) {
      return null;
    }

    // Get primary organization from payload or first org membership
    let currentOrganization = null;
    if (payload.organizationId) {
      currentOrganization = user.organizationUsers.find(
        (ou) => ou.organizationId === payload.organizationId,
      );
    } else if (user.organizationUsers.length > 0) {
      currentOrganization = user.organizationUsers[0];
    }

    const context: CachedUserContext = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      avatarUrl: user.avatarUrl,
      teams: user.teams.map((ut) => ({
        id: ut.team.id,
        name: ut.team.name,
        type: ut.team.type,
        isPrimary: ut.isPrimary,
        organizationId: ut.team.organizationId,
      })),
      organizationId: currentOrganization?.organizationId || null,
      organizationSlug: currentOrganization?.organization?.slug || null,
      orgRole: currentOrganization?.orgRole || null,
      organizations: user.organizationUsers.map((ou) => ({
        organizationId: ou.organizationId,
        organizationName: ou.organization.name,
        organizationSlug: ou.organization.slug,
        organizationStatus: ou.organization.status,
        orgRole: ou.orgRole,
      })),
      cachedAt: Date.now(),
    };

    // Cache the context in response cookie
    const res = req.res;
    if (res) {
      this.setCachedContext(res, context);
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      avatarUrl: user.avatarUrl,
      teams: context.teams,
      organizationId: context.organizationId,
      organizationSlug: context.organizationSlug,
      orgRole: context.orgRole,
      organizations: context.organizations,
    };
  }

  private async refreshContext(req: Request, payload: JwtPayload, cachedContext: CachedUserContext): Promise<any> {
    // Organization changed, update the context
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        organizationUsers: {
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

    if (!user || !user.isActive) {
      return null;
    }

    // Find the new organization
    const newOrg = user.organizationUsers.find((ou) => ou.organizationId === payload.organizationId);

    // Update cached context
    cachedContext.organizationId = newOrg?.organizationId || null;
    cachedContext.organizationSlug = newOrg?.organization?.slug || null;
    cachedContext.orgRole = newOrg?.orgRole || null;
    cachedContext.cachedAt = Date.now();

    // Re-cache the updated context
    const res = req.res;
    if (res) {
      this.setCachedContext(res, cachedContext);
    }

    return cachedContext;
  }
}