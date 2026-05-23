import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Response } from 'express';
import { Reflector } from '@nestjs/core';
import { CacheControlMetadata } from './cache-control.decorator';

export interface CacheControlOptions {
  maxAge?: number; // in seconds
  isPrivate?: boolean;
  noCache?: boolean;
  noStore?: boolean;
  mustRevalidate?: boolean;
}

// Default cache durations
export const CACHE_DURATIONS = {
  short: 30, // 30 seconds
  medium: 300, // 5 minutes
  long: 900, // 15 minutes
  veryLong: 3600, // 1 hour
};

@Injectable()
export class HttpCacheInterceptor implements NestInterceptor {
  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        const response = context.switchToHttp().getResponse<Response>();
        const request = context.switchToHttp().getRequest();

        // Check if this is an organization-scoped request
        // If x-organization-id header is present, don't cache (or use private cache)
        const organizationId = request.headers['x-organization-id'];
        const isOrgScoped = !!organizationId;

        // Check for cache control metadata from decorator
        const cacheControl = this.reflector.get<CacheControlMetadata | null>('cacheControl', context.getHandler());
        if (cacheControl) {
          const directives: string[] = [];

          // For org-scoped endpoints, use private cache or no-cache
          if (isOrgScoped) {
            // Organization-specific data should not be cached by browsers/proxies
            // Let React Query handle client-side caching instead
            if (cacheControl.duration === 'none') {
              directives.push('no-cache', 'no-store');
            } else {
              // Use shorter cache for org-scoped data
              const maxAge = CACHE_DURATIONS[cacheControl.duration as keyof typeof CACHE_DURATIONS];
              directives.push(`max-age=${Math.min(maxAge || 60, 60)}`); // Cap at 60 seconds
              directives.push('private'); // Only cacheable by browser, not proxies
              directives.push('no-store'); // Don't store in shared caches
            }
          } else {
            // Non-org-scoped endpoints can use normal caching
            if (cacheControl.duration === 'none') {
              directives.push('no-cache', 'no-store');
            } else {
              const maxAge = CACHE_DURATIONS[cacheControl.duration as keyof typeof CACHE_DURATIONS];
              if (maxAge) {
                directives.push(`max-age=${maxAge}`);
                directives.push('must-revalidate');
              }

              if (cacheControl.isPrivate) {
                directives.push('private');
              } else {
                directives.push('public');
              }
            }
          }

          response.setHeader('Cache-Control', directives.join(', '));
        }

        return data;
      }),
    );
  }
}

// Helper to set cache headers from controller
export function setCacheControl(
  res: Response,
  options: CacheControlOptions = {}
): void {
  const directives: string[] = [];

  if (options.noCache) {
    directives.push('no-cache');
  } else if (options.noStore) {
    directives.push('no-store');
  } else {
    if (options.maxAge !== undefined) {
      directives.push(`max-age=${options.maxAge}`);
    }

    if (options.mustRevalidate) {
      directives.push('must-revalidate');
    }
  }

  if (options.isPrivate) {
    directives.push('private');
  } else {
    directives.push('public');
  }

  res.setHeader('Cache-Control', directives.join(', '));
}