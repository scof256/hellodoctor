import 'server-only';

import { headers } from 'next/headers';
import { cache } from 'react';
import { createCallerFactory, createTRPCContext } from '@/server/api/trpc';
import { appRouter } from '@/server/api/root';

/**
 * Create a server-side caller for tRPC procedures.
 * This allows calling tRPC procedures directly from Server Components.
 *
 * @example
 * ```tsx
 * // In a Server Component
 * import { api } from '@/trpc/server';
 *
 * export default async function Page() {
 *   const user = await api.user.getMe();
 *   return <div>{user.email}</div>;
 * }
 * ```
 */
const createContext = cache(async () => {
  const heads = new Headers(await headers());
  heads.set('x-trpc-source', 'rsc');

  return createTRPCContext({
    headers: heads,
  });
});

const createCaller = createCallerFactory(appRouter);

/**
 * Server-side tRPC API caller.
 * Use this in Server Components to call tRPC procedures directly.
 */
export const api = createCaller(createContext);
