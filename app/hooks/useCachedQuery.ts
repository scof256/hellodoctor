'use client';

import { useEffect, useState } from 'react';
import { cachedQuery, getCachedQueryData } from '../lib/cache-integration';

/**
 * Hook for using cached tRPC queries
 * 
 * This hook wraps tRPC queries with IndexedDB caching for offline access.
 * Requirements: 10.5, 15.5 - Cache frequently accessed data locally
 * 
 * @example
 * const { data, isLoading, error } = useCachedQuery(
 *   userId,
 *   'user.getMe',
 *   () => api.user.getMe.fetch()
 * );
 */
export function useCachedQuery<T>(
  userId: string | undefined,
  queryPath: string,
  fetchFn: () => Promise<T>,
  params?: Record<string, any>,
  options?: {
    enabled?: boolean;
    refetchInterval?: number;
  }
): {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  const { enabled = true, refetchInterval } = options || {};
  
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const result = await cachedQuery(userId, queryPath, fetchFn, params);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch data'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [userId, queryPath, enabled, JSON.stringify(params)]);

  // Set up refetch interval if specified
  useEffect(() => {
    if (!refetchInterval || !enabled) return;

    const intervalId = setInterval(fetchData, refetchInterval);
    return () => clearInterval(intervalId);
  }, [refetchInterval, enabled]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
  };
}

/**
 * Hook to check if data is available in cache (offline check)
 * 
 * @example
 * const { hasCache, isChecking } = useHasCache(userId, 'user.getMe');
 */
export function useHasCache(
  userId: string | undefined,
  queryPath: string,
  params?: Record<string, any>
): {
  hasCache: boolean;
  isChecking: boolean;
} {
  const [hasCache, setHasCache] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (!userId) {
      setIsChecking(false);
      return;
    }

    const checkCache = async () => {
      try {
        const cachedData = await getCachedQueryData(userId, queryPath, params);
        setHasCache(cachedData !== null);
      } catch (error) {
        console.error('Failed to check cache:', error);
        setHasCache(false);
      } finally {
        setIsChecking(false);
      }
    };

    checkCache();
  }, [userId, queryPath, JSON.stringify(params)]);

  return { hasCache, isChecking };
}
