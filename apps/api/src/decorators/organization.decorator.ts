import { createParamDecorator, ExecutionContext, BadRequestException } from '@nestjs/common';
import { Request } from 'express';

/**
 * Get the current organization ID from the request context
 */
export const OrganizationId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.organizationId;
  },
);

/**
 * Get the current organization ID - REQUIRED. Throws if not present.
 * Use this for business data endpoints to prevent data leaking across organizations.
 */
export const RequiredOrganizationId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    if (!request.organizationId) {
      throw new BadRequestException('Organization ID is required for this endpoint');
    }
    return request.organizationId;
  },
);

/**
 * Get the current organization slug from the request context
 */
export const OrganizationSlug = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.organizationSlug;
  },
);

/**
 * Get the current user's organization role from the request context
 */
export const UserOrgRole = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.userOrgRole;
  },
);

/**
 * Get the full organization context (id, slug, role)
 */
export const OrganizationContext = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return {
      organizationId: request.organizationId,
      organizationSlug: request.organizationSlug,
      userOrgRole: request.userOrgRole,
    };
  },
);
