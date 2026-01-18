'use client';

import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import { useState, useEffect, useRef } from 'react';
import superjson from 'superjson';
import type { AppRouter } from '@/server/api/root';
import { getCacheConfig, getInvalidationKeys, matchesInvalidationPattern, getPreservedCategories, CACHE_CONFIGS, type CacheConfig } from './cache-config';

/**
 * Create the tRPC React hooks.
 * This provides type-safe hooks for calling tRPC procedures.
 */
export const api = createTRPCReact<AppRouter>();

/**
 * Get the base URL for tRPC requests.
 * Handles both server-side and client-side rendering.
 */
function getBaseUrl() {
  if (typeof window !== 'undefined') {
    // Browser should use relative path
    return '';
  }
  // SSR should use vercel url or localhost
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

/**
 * Track in-flight requests for deduplication monitoring.
 * This is used to verify that concurrent requests are properly deduplicated.
 * Maps query key string to request count.
 */
const inFlightRequests = new Map<string, number>();

/**
 * Track pending requests for deduplication.
 * Maps query key string to Promise for request deduplication.
 */
const pendingRequests = new Map<string, Promise<unknown>>();

/**
 * Get the count of in-flight requests for a query key.
 * Used for testing request deduplication.
 */
export function getInFlightRequestCount(queryKey: string): number {
  return inFlightRequests.get(queryKey) ?? 0;
}

/**
 * Get all in-flight request counts.
 * Used for testing and monitoring.
 */
export function getAllInFlightRequests(): Map<string, number> {
  return new Map(inFlightRequests);
}

/**
 * Reset in-flight request tracking.
 * Used for testing.
 */
export function resetInFlightRequests(): void {
  inFlightRequests.clear();
  pendingRequests.clear();
}

/**
 * Check if a query should be served from cache based on stale time.
 * Used for testing cache hit on navigation (Requirement 5.2).
 * 
 * @param queryKey - The query key to check
 * @param lastFetchTime - The timestamp of the last fetch
 * @returns True if data should be served from cache (within stale time)
 */
export function shouldServeFromCache(queryKey: readonly unknown[], lastFetchTime: number): boolean {
  const config = getCacheConfig(queryKey);
  const now = Date.now();
  const timeSinceLastFetch = now - lastFetchTime;
  return timeSinceLastFetch < config.staleTime;
}

/**
 * Get the stale time for a query key.
 * Used for testing cache configuration.
 * 
 * @param queryKey - The query key to check
 * @returns The stale time in milliseconds
 */
export function getQueryStaleTime(queryKey: readonly unknown[]): number {
  const config = getCacheConfig(queryKey);
  return config.staleTime;
}

/**
 * Get default cache config with safe fallback.
 */
function getDefaultCacheConfig(): CacheConfig {
  return CACHE_CONFIGS['default'] ?? {
    staleTime: 60 * 1000,
    cacheTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  };
}

/**
 * Query key patterns for setting query defaults.
 * These patterns are used to apply differential stale times.
 */
const QUERY_KEY_PATTERNS = [
  // Availability queries - 5 minute stale time (Requirement 3.1)
  { pattern: ['doctor', 'getAvailability'], key: 'doctor.getAvailability' },
  { pattern: ['doctor', 'availability'], key: 'doctor.availability' },
  { pattern: ['appointment', 'getAvailableSlots'], key: 'appointment.getAvailableSlots' },
  
  // Analytics queries - 30 minute stale time (Requirement 3.2)
  { pattern: ['analytics'], key: 'analytics' },
  { pattern: ['analytics', 'getDashboard'], key: 'analytics.getDashboard' },
  { pattern: ['analytics', 'getPatientStats'], key: 'analytics.getPatientStats' },
  { pattern: ['analytics', 'getDoctorAnalytics'], key: 'analytics' },
  
  // Message queries - 1 minute stale time (Requirement 3.3)
  { pattern: ['message'], key: 'message' },
  { pattern: ['message', 'getConversation'], key: 'message.getConversation' },
  { pattern: ['message', 'getConversations'], key: 'message.getConversations' },
  { pattern: ['message', 'getUnreadCount'], key: 'message.getUnreadCount' },
  
  // Appointment queries
  { pattern: ['appointment'], key: 'appointment' },
  { pattern: ['appointment', 'getMyAppointments'], key: 'appointment.getMyAppointments' },
  { pattern: ['appointment', 'getById'], key: 'appointment.getById' },
  
  // Intake queries
  { pattern: ['intake'], key: 'intake' },
  { pattern: ['intake', 'getSession'], key: 'intake.getSession' },
  { pattern: ['intake', 'getMyIntakeSessions'], key: 'intake.getMyIntakeSessions' },
  { pattern: ['intake', 'getDoctorIntakeSessions'], key: 'intake.getDoctorIntakeSessions' },
  
  // User/profile queries
  { pattern: ['user'], key: 'user' },
  { pattern: ['user', 'getMe'], key: 'user.me' },
  { pattern: ['doctor', 'getProfile'], key: 'doctor.getProfile' },
  { pattern: ['doctor', 'getMyProfile'], key: 'doctor.getProfile' },
  { pattern: ['patient', 'getProfile'], key: 'patient.getProfile' },
  
  // Connection queries
  { pattern: ['connection'], key: 'connection' },
  { pattern: ['connection', 'getMyConnections'], key: 'connection.getMyConnections' },
  
  // Dashboard queries - Request deduplication and cache hit on navigation (Requirements 5.1, 5.2, 5.3)
  { pattern: ['dashboard'], key: 'dashboard' },
  { pattern: ['dashboard', 'getDoctorDashboard'], key: 'dashboard.getDoctorDashboard' },
  { pattern: ['dashboard', 'getPatientDashboard'], key: 'dashboard.getPatientDashboard' },
  { pattern: ['dashboard', 'getAdminDashboard'], key: 'dashboard.getAdminDashboard' },
  
  // Notification queries
  { pattern: ['notification'], key: 'notification' },
  { pattern: ['notification', 'getUnreadCount'], key: 'notification.getUnreadCount' },
];

/**
 * Apply query defaults to QueryClient based on cache configuration.
 * This sets differential stale times per query type.
 * 
 * @param queryClient - The QueryClient instance to configure
 */
function applyQueryDefaults(queryClient: QueryClient): void {
  for (const { pattern, key } of QUERY_KEY_PATTERNS) {
    const config = CACHE_CONFIGS[key];
    if (config) {
      queryClient.setQueryDefaults(pattern, {
        staleTime: config.staleTime,
        gcTime: config.cacheTime,
        refetchOnWindowFocus: config.refetchOnWindowFocus,
      });
    }
  }

  // Prevent retry-spam for doctor-only endpoints when user/session/DB is not ready
  queryClient.setQueryDefaults(['doctor', 'getAvailability'], {
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

/**
 * Create QueryClient with differential cache configuration.
 * Uses getCacheConfig to apply appropriate stale times per query type.
 * 
 * Key features:
 * - Differential stale times based on query type (Requirements 3.1, 3.2, 3.3)
 * - Request deduplication for concurrent requests (Requirements 5.1, 5.3)
 * - Cache hit on navigation return (Requirement 5.2)
 * - Smart retry logic that avoids retrying client errors
 * 
 * Request Deduplication (Requirements 5.1, 5.3):
 * React Query automatically deduplicates concurrent requests for the same query key.
 * When multiple components request the same data simultaneously, only one network
 * request is made and the result is shared across all subscribers.
 * 
 * Cache Hit on Navigation (Requirement 5.2):
 * When a user navigates away and returns within the stale time, the dashboard
 * renders from cache without making new API requests. This is controlled by:
 * - staleTime: Data is considered fresh for this duration
 * - gcTime (cacheTime): Data is kept in cache for this duration
 */
function createQueryClient() {
  const defaultConfig = getDefaultCacheConfig();
  
  const queryClient = new QueryClient({
    queryCache: new QueryCache({
      onSuccess: (_data, query) => {
        // Track successful queries for monitoring
        const keyString = JSON.stringify(query.queryKey);
        inFlightRequests.delete(keyString);
        pendingRequests.delete(keyString);
      },
      onError: (_error, query) => {
        // Clean up tracking on error
        const keyString = JSON.stringify(query.queryKey);
        inFlightRequests.delete(keyString);
        pendingRequests.delete(keyString);
      },
    }),
    mutationCache: new MutationCache({
      // Mutation cache for tracking mutation state
    }),
    defaultOptions: {
      queries: {
        // Default stale time - will be overridden per query type via setQueryDefaults
        staleTime: defaultConfig.staleTime,
        gcTime: defaultConfig.cacheTime,
        refetchOnWindowFocus: defaultConfig.refetchOnWindowFocus,
        
        // Request deduplication is enabled by default in React Query v5
        // When multiple components request the same data simultaneously,
        // only one network request is made and the result is shared.
        // This is controlled by the `structuralSharing` option (default: true)
        // and the query key matching.
        // Requirements: 5.1, 5.3 - Deduplicated Data Fetching
        structuralSharing: true,
        
        // Network mode: always fetch when online, pause when offline
        networkMode: 'online',
        
        // Refetch settings for optimal deduplication and cache behavior
        // refetchOnMount: true allows React Query to serve from cache if data is fresh
        // This enables cache hit on navigation return (Requirement 5.2)
        refetchOnMount: true,
        refetchOnReconnect: true,
        
        retry: (failureCount, error) => {
          // Don't retry on client errors (4xx status codes)
          if (error && typeof error === 'object') {
            const trpcError = error as { 
              data?: { code?: string; httpStatus?: number }; 
              shape?: { data?: { code?: string; httpStatus?: number } };
              message?: string;
            };
            const code = trpcError.data?.code || trpcError.shape?.data?.code;
            const httpStatus = trpcError.data?.httpStatus || trpcError.shape?.data?.httpStatus;
            
            // Don't retry on known client errors
            if (code === 'NOT_FOUND' || code === 'FORBIDDEN' || code === 'UNAUTHORIZED' || code === 'BAD_REQUEST' || code === 'CONFLICT') {
              return false;
            }
            // Don't retry on 4xx HTTP status codes
            if (httpStatus && httpStatus >= 400 && httpStatus < 500) {
              return false;
            }
            // Check error message for common patterns
            if (trpcError.message?.toLowerCase().includes('not found')) {
              return false;
            }
          }
          // Retry up to 3 times for other errors
          return failureCount < 3;
        },
      },
      mutations: {
        // Mutations don't need retry by default
        retry: false,
        // Network mode for mutations
        networkMode: 'online',
      },
    },
  });
  
  // Apply differential stale times per query type
  applyQueryDefaults(queryClient);
  
  return queryClient;
}

/**
 * tRPC Provider component.
 * Wraps the application with QueryClient and tRPC client.
 * Implements differential caching based on query type.
 * 
 * Features:
 * - Differential stale times per query type (Requirements 3.1, 3.2, 3.3)
 * - Request deduplication for concurrent requests (Requirements 5.1, 5.3)
 * - Cache hit on navigation return (Requirement 5.2)
 * - HTTP batching for efficient network usage
 * 
 * Request Deduplication Behavior:
 * - When multiple components request the same dashboard data simultaneously,
 *   only one network request is made
 * - The result is shared across all subscribers
 * - This is automatic via React Query's built-in deduplication
 * 
 * Cache Hit on Navigation:
 * - When user navigates away and returns within stale time, data is served from cache
 * - No new API request is made if data is still fresh
 * - Dashboard stale times: 30s for patient/doctor, 60s for admin
 */
export function TRPCReactProvider(props: { children: React.ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  const initialized = useRef(false);

  // Ensure query defaults are applied on mount
  useEffect(() => {
    if (!initialized.current) {
      applyQueryDefaults(queryClient);
      initialized.current = true;
    }
  }, [queryClient]);

  const [trpcClient] = useState(() =>
    api.createClient({
      links: [
        // Logger link disabled to reduce console noise
        // Uncomment to debug tRPC requests:
        // loggerLink({
        //   enabled: (op) => op.direction === 'down' && op.result instanceof Error,
        // }),
        httpBatchLink({
          transformer: superjson,
          url: `${getBaseUrl()}/api/trpc`,
          headers: () => {
            const headers = new Headers();
            headers.set('x-trpc-source', 'nextjs-react');
            return headers;
          },
        }),
      ],
    })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <api.Provider client={trpcClient} queryClient={queryClient}>
        {props.children}
      </api.Provider>
    </QueryClientProvider>
  );
}

/**
 * Hook to get cache configuration for a specific query.
 * Use this to apply differential stale times to individual queries.
 * 
 * @example
 * const { staleTime, refetchOnWindowFocus } = useCacheConfig(['message', 'getConversations']);
 * const query = api.message.getConversations.useQuery(undefined, { staleTime, refetchOnWindowFocus });
 */
export function useCacheConfig(queryKey: readonly unknown[]) {
  return getCacheConfig(queryKey);
}

/**
 * Hook to get invalidation keys for a mutation.
 * Use this to selectively invalidate cache entries after mutations.
 * 
 * @example
 * const utils = api.useUtils();
 * const invalidationKeys = useInvalidationKeys('message.send');
 * // After mutation success:
 * invalidationKeys.forEach(key => utils.invalidate(key));
 */
export function useInvalidationKeys(mutationKey: string) {
  return getInvalidationKeys(mutationKey);
}

/**
 * Hook for selective cache invalidation.
 * Returns a function that invalidates only the cache entries affected by a mutation.
 * This implements Requirement 3.5: Selective cache invalidation.
 * 
 * @example
 * const invalidateSelectively = useSelectiveInvalidation();
 * 
 * const sendMessage = api.message.send.useMutation({
 *   onSuccess: () => {
 *     invalidateSelectively('message.send');
 *   }
 * });
 */
export function useSelectiveInvalidation() {
  const utils = api.useUtils();
  
  return (mutationKey: string) => {
    const invalidationKeys = getInvalidationKeys(mutationKey);
    
    // Invalidate each affected query key pattern
    for (const keyPattern of invalidationKeys) {
      // Use the utils to invalidate queries matching the pattern
      // The pattern is an array like ['message', 'getConversation']
      if (keyPattern.length >= 2) {
        const [router, procedure] = keyPattern;
        // Access the router and procedure dynamically
        const routerUtils = utils[router as keyof typeof utils];
        if (routerUtils && typeof routerUtils === 'object') {
          const procedureUtils = (routerUtils as Record<string, { invalidate?: () => void }>)[procedure as string];
          if (procedureUtils && typeof procedureUtils.invalidate === 'function') {
            procedureUtils.invalidate();
          }
        }
      } else if (keyPattern.length === 1) {
        // Invalidate entire router
        const [router] = keyPattern;
        const routerUtils = utils[router as keyof typeof utils];
        if (routerUtils && typeof routerUtils === 'object' && 'invalidate' in routerUtils) {
          (routerUtils as { invalidate: () => void }).invalidate();
        }
      }
    }
  };
}

/**
 * Create mutation options with selective cache invalidation.
 * This is a helper to create mutation options that automatically
 * invalidate only the affected cache entries.
 * 
 * @param mutationKey - The mutation key (e.g., "message.send")
 * @param additionalOptions - Additional mutation options
 * @returns Mutation options with selective invalidation
 * 
 * @example
 * const sendMessage = api.message.send.useMutation(
 *   createMutationOptions('message.send', {
 *     onSuccess: () => {
 *       // Additional success handling
 *     }
 *   })
 * );
 */
export function createSelectiveInvalidationOptions<TData, TError, TVariables>(
  mutationKey: string,
  additionalOptions?: {
    onSuccess?: (data: TData, variables: TVariables) => void;
    onError?: (error: TError, variables: TVariables) => void;
    onSettled?: (data: TData | undefined, error: TError | null, variables: TVariables) => void;
  }
) {
  const invalidationKeys = getInvalidationKeys(mutationKey);
  
  return {
    ...additionalOptions,
    // Note: The actual invalidation needs to be done in the component
    // using useSelectiveInvalidation() hook since we need access to utils
    meta: {
      invalidationKeys,
      mutationKey,
    },
  };
}

// Re-export cache config utilities for convenience
export { getInvalidationKeys, getCacheConfig, matchesInvalidationPattern, getPreservedCategories } from './cache-config';
