import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/server/api/root';
import { createTRPCContext } from '@/server/api/trpc';

/**
 * tRPC HTTP handler for Next.js App Router.
 * Handles all tRPC requests at /api/trpc/*
 *
 * Requirements: 14.1 - Use Drizzle ORM for database operations via tRPC
 */
const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ headers: req.headers }),
    onError:
      process.env.NODE_ENV === 'development'
        ? ({ path, error }) => {
            console.error(
              `❌ tRPC failed on ${path ?? '<no-path>'} [${error.code}]: ${error.message}`
            );
            if (error.cause) {
              console.error(error.cause);
            }
            if (error.stack) {
              console.error(error.stack);
            }
          }
        : undefined,
  });

export { handler as GET, handler as POST };
