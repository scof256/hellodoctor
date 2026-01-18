/**
 * Simple in-memory rate limiter for tRPC endpoints.
 * For production, consider using Redis-based rate limiting.
 * 
 * Requirements: 16.4
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  maxRequests: number;  // Maximum requests per window
}

// Default rate limit configurations by endpoint type
export const RATE_LIMIT_CONFIGS = {
  // Public endpoints - more restrictive
  public: { windowMs: 60 * 1000, maxRequests: 30 },  // 30 requests per minute
  
  // Authentication endpoints - very restrictive to prevent brute force
  auth: { windowMs: 15 * 60 * 1000, maxRequests: 10 },  // 10 requests per 15 minutes
  
  // Protected endpoints - standard limit
  protected: { windowMs: 60 * 1000, maxRequests: 60 },  // 60 requests per minute
  
  // Admin endpoints - higher limit for admin operations
  admin: { windowMs: 60 * 1000, maxRequests: 100 },  // 100 requests per minute
  
  // AI/Chat endpoints - lower limit due to resource intensity
  ai: { windowMs: 60 * 1000, maxRequests: 20 },  // 20 requests per minute
  
  // File upload endpoints - restrictive
  upload: { windowMs: 60 * 1000, maxRequests: 10 },  // 10 uploads per minute
} as const;

export type RateLimitType = keyof typeof RATE_LIMIT_CONFIGS;

class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000);
  }

  /**
   * Check if a request should be rate limited.
   * Returns true if the request is allowed, false if rate limited.
   */
  check(key: string, config: RateLimitConfig): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    // If no entry or window has expired, create new entry
    if (!entry || now >= entry.resetAt) {
      const newEntry: RateLimitEntry = {
        count: 1,
        resetAt: now + config.windowMs,
      };
      this.store.set(key, newEntry);
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetAt: newEntry.resetAt,
      };
    }

    // Check if limit exceeded
    if (entry.count >= config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.resetAt,
      };
    }

    // Increment count
    entry.count++;
    return {
      allowed: true,
      remaining: config.maxRequests - entry.count,
      resetAt: entry.resetAt,
    };
  }

  /**
   * Generate a rate limit key based on identifier and endpoint type.
   */
  generateKey(identifier: string, endpointType: RateLimitType, endpoint?: string): string {
    const parts = [identifier, endpointType];
    if (endpoint) {
      parts.push(endpoint);
    }
    return parts.join(':');
  }

  /**
   * Clean up expired entries to prevent memory leaks.
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.resetAt) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Stop the cleanup interval (for testing/shutdown).
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get current store size (for monitoring).
   */
  getStoreSize(): number {
    return this.store.size;
  }

  /**
   * Clear all entries (for testing).
   */
  clear(): void {
    this.store.clear();
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter();

/**
 * Rate limit check function for use in tRPC middleware.
 * 
 * @param identifier - User ID, IP address, or other unique identifier
 * @param type - Type of endpoint for rate limit configuration
 * @param endpoint - Optional specific endpoint name for granular limiting
 * @returns Object with allowed status and rate limit info
 */
export function checkRateLimit(
  identifier: string,
  type: RateLimitType,
  endpoint?: string
): { allowed: boolean; remaining: number; resetAt: number; retryAfter?: number } {
  const config = RATE_LIMIT_CONFIGS[type];
  const key = rateLimiter.generateKey(identifier, type, endpoint);
  const result = rateLimiter.check(key, config);

  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
    return { ...result, retryAfter };
  }

  return result;
}

/**
 * Get rate limit headers for HTTP response.
 */
export function getRateLimitHeaders(
  remaining: number,
  resetAt: number,
  limit: number
): Record<string, string> {
  return {
    'X-RateLimit-Limit': limit.toString(),
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(resetAt / 1000).toString(),
  };
}
