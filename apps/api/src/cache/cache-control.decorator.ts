import { SetMetadata } from '@nestjs/common';
import { CACHE_DURATIONS } from './http-cache.interceptor';

export type CacheDuration = 'short' | 'medium' | 'long' | 'veryLong' | 'none';

export interface CacheControlMetadata {
  duration: CacheDuration;
  isPrivate?: boolean;
}

/**
 * Decorator to set cache headers on controller responses
 *
 * Usage:
 * @CacheControl('long')  // Cache for 15 minutes (public)
 * @CacheControl('short', { isPrivate: true })  // Cache for 30 seconds (private)
 * @CacheControl('none')  // no-cache
 */
export const CacheControl = (duration: CacheDuration, options?: { isPrivate?: boolean }) =>
  SetMetadata('cacheControl', { duration, isPrivate: options?.isPrivate });

/**
 * Get max-age in seconds from duration string
 */
export function getMaxAgeFromDuration(duration: CacheDuration): number | null {
  switch (duration) {
    case 'short':
      return CACHE_DURATIONS.short;
    case 'medium':
      return CACHE_DURATIONS.medium;
    case 'long':
      return CACHE_DURATIONS.long;
    case 'veryLong':
      return CACHE_DURATIONS.veryLong;
    case 'none':
      return null;
  }
}
