import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/get-started(.*)',
  '/connect/(.*)',
  '/api/auth/webhook',
  '/api/uploadthing',
]);

// Define API routes that need CSRF protection
const isApiRoute = createRouteMatcher([
  '/api/(.*)',
  '/trpc/(.*)',
]);

// Allowed origins for CSRF protection
function getAllowedOrigins(): string[] {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const origins = [appUrl];
  
  // In development, also allow localhost variations
  if (process.env.NODE_ENV === 'development') {
    origins.push('http://localhost:3000', 'http://127.0.0.1:3000');
  }
  
  return origins;
}

// Validate request origin for CSRF protection
function validateOrigin(request: Request): boolean {
  const method = request.method.toUpperCase();
  
  // Only check state-changing methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return true;
  }
  
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const allowedOrigins = getAllowedOrigins();
  
  // Check Origin header
  if (origin) {
    return allowedOrigins.some(allowed => 
      origin === allowed || origin.startsWith(allowed.replace(/\/$/, ''))
    );
  }
  
  // Fall back to Referer header
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`;
      return allowedOrigins.some(allowed => 
        refererOrigin === allowed || refererOrigin.startsWith(allowed.replace(/\/$/, ''))
      );
    } catch {
      return false;
    }
  }
  
  // For API routes without origin (like webhooks), check for specific headers
  // Clerk webhooks have specific headers we can trust
  if (request.headers.get('svix-id')) {
    return true;
  }
  
  // UploadThing has its own authentication
  if (request.url.includes('/api/uploadthing')) {
    return true;
  }
  
  // In development, be more lenient
  if (process.env.NODE_ENV === 'development') {
    return true;
  }
  
  return false;
}

export default clerkMiddleware(async (auth, request) => {
  // CSRF protection for API routes (Requirement 16.3)
  if (isApiRoute(request)) {
    if (!validateOrigin(request)) {
      return new NextResponse(
        JSON.stringify({ error: 'Invalid request origin', code: 'CSRF_ERROR' }),
        { 
          status: 403, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }
  }
  
  // Protect all routes except public ones
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
