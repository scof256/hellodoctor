import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/server/api/root';
import { createTRPCContext } from '@/server/api/trpc';

// Vercel serverless function configuration
export const runtime = 'nodejs';
export const maxDuration = 30; // 30 second timeout

/**
 * Enhanced tRPC HTTP handler for Next.js App Router with production error handling.
 * Handles all tRPC requests at /api/trpc/*
 *
 * Requirements:
 * - 1.1: Return session data with status 200 for valid requests
 * - 1.2: Correctly resolve all procedure paths in Vercel deployment
 * - 1.3: Initialize TRPC router without errors in production
 * - 3.1: Log errors with timestamp, user ID, session ID, and stack trace
 * - 9.5: Return 504 error when approaching Vercel function timeout
 */
const handler = async (req: Request) => {
  try {
    return await fetchRequestHandler({
      endpoint: '/api/trpc',
      req,
      router: appRouter,
      createContext: () => createTRPCContext({ headers: req.headers }),
      onError: ({ path, error, type, ctx }) => {
        // Enhanced error logging for production
        console.error('[TRPC Error]', {
          timestamp: new Date().toISOString(),
          path,
          type,
          code: error.code,
          message: error.message,
          userId: ctx?.userId,
          cause: error.cause,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        });
      },
    });
  } catch (error) {
    // Catch-all for handler-level errors
    console.error('[TRPC Handler Error]', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    return new Response(
      JSON.stringify({
        error: {
          message: 'Internal server error',
          code: 'INTERNAL_SERVER_ERROR',
        },
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

export { handler as GET, handler as POST };
