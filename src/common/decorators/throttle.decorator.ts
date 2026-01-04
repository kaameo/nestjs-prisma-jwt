import { SetMetadata } from '@nestjs/common';

export const THROTTLE_KEY = 'throttle';

export interface ThrottleOptions {
  limit: number;
  ttl: number; // milliseconds
}

/**
 * Rate limiting decorator
 * @param limit - Maximum number of requests
 * @param ttl - Time window in milliseconds
 *
 * @example
 * @Throttle(5, 60000) // 5 requests per minute
 */
export const Throttle = (limit: number, ttl: number) =>
  SetMetadata(THROTTLE_KEY, { limit, ttl });
