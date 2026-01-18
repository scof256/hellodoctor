/**
 * CSRF Protection utilities.
 * Requirements: 16.3
 * 
 * Next.js and tRPC provide built-in CSRF protection through:
 * 1. SameSite cookies (Clerk handles this)
 * 2. Origin/Referer header validation
 * 3. Custom header requirements for API calls
 * 
 * This module provides additional utilities for form-based CSRF protection.
 */

import { randomBytes, createHmac } from 'crypto';

// Secret key for CSRF token generation (should be in env vars in production)
const CSRF_SECRET = process.env.CSRF_SECRET || 'default-csrf-secret-change-in-production';

/**
 * Generate a CSRF token.
 * The token is a combination of a random value and a timestamp, signed with HMAC.
 */
export function generateCsrfToken(): string {
  const timestamp = Date.now().toString();
  const randomValue = randomBytes(16).toString('hex');
  const data = `${timestamp}:${randomValue}`;
  
  const hmac = createHmac('sha256', CSRF_SECRET);
  hmac.update(data);
  const signature = hmac.digest('hex');
  
  // Return base64 encoded token
  return Buffer.from(`${data}:${signature}`).toString('base64');
}

/**
 * Validate a CSRF token.
 * Checks the signature and ensures the token hasn't expired.
 */
export function validateCsrfToken(token: string, maxAgeMs: number = 3600000): boolean {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const parts = decoded.split(':');
    
    if (parts.length !== 3) {
      return false;
    }
    
    const [timestamp, randomValue, signature] = parts;
    
    // Check if token has expired (default 1 hour)
    const tokenAge = Date.now() - parseInt(timestamp!, 10);
    if (tokenAge > maxAgeMs) {
      return false;
    }
    
    // Verify signature
    const data = `${timestamp}:${randomValue}`;
    const hmac = createHmac('sha256', CSRF_SECRET);
    hmac.update(data);
    const expectedSignature = hmac.digest('hex');
    
    // Use timing-safe comparison
    return timingSafeEqual(signature!, expectedSignature);
  } catch {
    return false;
  }
}

/**
 * Timing-safe string comparison to prevent timing attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * Validate Origin/Referer headers for CSRF protection.
 * Returns true if the request origin matches the expected origin.
 */
export function validateOrigin(
  requestOrigin: string | null,
  requestReferer: string | null,
  allowedOrigins: string[]
): boolean {
  // Check Origin header first
  if (requestOrigin) {
    return allowedOrigins.some(allowed => 
      requestOrigin === allowed || requestOrigin.startsWith(allowed)
    );
  }
  
  // Fall back to Referer header
  if (requestReferer) {
    try {
      const refererUrl = new URL(requestReferer);
      const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`;
      return allowedOrigins.some(allowed => 
        refererOrigin === allowed || refererOrigin.startsWith(allowed)
      );
    } catch {
      return false;
    }
  }
  
  // No origin information available - reject for safety
  return false;
}

/**
 * Get allowed origins from environment.
 */
export function getAllowedOrigins(): string[] {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const origins = [appUrl];
  
  // Add additional allowed origins from env if specified
  const additionalOrigins = process.env.ALLOWED_ORIGINS;
  if (additionalOrigins) {
    origins.push(...additionalOrigins.split(',').map(o => o.trim()));
  }
  
  return origins;
}

/**
 * CSRF protection middleware helper for API routes.
 * Use this in API routes that handle form submissions.
 */
export function csrfProtection(request: Request): { valid: boolean; error?: string } {
  const method = request.method.toUpperCase();
  
  // Only check state-changing methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return { valid: true };
  }
  
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const allowedOrigins = getAllowedOrigins();
  
  // Validate origin
  if (!validateOrigin(origin, referer, allowedOrigins)) {
    return { 
      valid: false, 
      error: 'Invalid request origin' 
    };
  }
  
  // Check for custom header (tRPC adds this automatically)
  const contentType = request.headers.get('content-type');
  if (contentType && !contentType.includes('application/json')) {
    // For non-JSON requests, require a CSRF token
    const csrfToken = request.headers.get('x-csrf-token');
    if (!csrfToken || !validateCsrfToken(csrfToken)) {
      return { 
        valid: false, 
        error: 'Invalid or missing CSRF token' 
      };
    }
  }
  
  return { valid: true };
}
