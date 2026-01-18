'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getCacheData,
  setCacheData,
  deleteCacheData,
  isCacheValid,
  type CacheKey,
} from '../lib/data-cache';

interface UseDataCacheConfig<T> {
  userId: string;
  cacheKey: CacheKey;
  subKey?: string;
  fetchFn: () => Promise<T>;
  enabled?: boolean;
}

interface UseDataCacheReturn<T> {
  data: T | null;
  isLoading: boolean;
  isCached: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  invalidate: () => Promise<void>;
}

/**
 * Hook for managing cached data with automatic fetch and cache
 * 
 * Requirements: 10.5, 15.5 - Cache frequently accessed data locally
 */
export function useDataCache<T>(config: UseDataCacheConfig<T>): UseDataCacheReturn<T> {
  const { userId, cacheKey, subKey, fetchFn, enabled = true } = config;
  
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCached, setIsCached] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Load data from cache or fetch
  const loadData = useCallback(async () => {
    if (!enabled || !userId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Try to get from cache first
      const cachedData = await getCacheData<T>(userId, cacheKey, subKey);
      
      if (cachedData !== null) {
        setData(cachedData);
        setIsCached(true);
        setIsLoading(false);
        return;
      }

      // Cache miss, fetch fresh data
      setIsCached(false);
      const freshData = await fetchFn();
      setData(freshData);

      // Store in cache
      await setCacheData(userId, cacheKey, freshData, subKey);
      
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load data'));
      setIsLoading(false);
    }
  }, [userId, cacheKey, subKey, fetchFn, enabled]);

  // Load data on mount and when dependencies change
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refetch data (bypasses cache)
  const refetch = useCallback(async () => {
    if (!userId) return;

    try {
      setIsLoading(true);
      setError(null);

      const freshData = await fetchFn();
      setData(freshData);

      // Update cache
      await setCacheData(userId, cacheKey, freshData, subKey);
      setIsCached(true);
      
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to refetch data'));
      setIsLoading(false);
    }
  }, [userId, cacheKey, subKey, fetchFn]);

  // Invalidate cache and reload
  const invalidate = useCallback(async () => {
    if (!userId) return;

    try {
      await deleteCacheData(userId, cacheKey, subKey);
      setIsCached(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to invalidate cache'));
    }
  }, [userId, cacheKey, subKey, loadData]);

  return {
    data,
    isLoading,
    isCached,
    error,
    refetch,
    invalidate,
  };
}

/**
 * Hook for checking cache validity
 */
export function useCacheValidity(
  userId: string,
  cacheKey: CacheKey,
  subKey?: string
): { isValid: boolean; isChecking: boolean } {
  const [isValid, setIsValid] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (!userId) {
      setIsChecking(false);
      return;
    }

    const checkValidity = async () => {
      try {
        const valid = await isCacheValid(userId, cacheKey, subKey);
        setIsValid(valid);
      } catch (error) {
        console.error('Failed to check cache validity:', error);
        setIsValid(false);
      } finally {
        setIsChecking(false);
      }
    };

    checkValidity();
  }, [userId, cacheKey, subKey]);

  return { isValid, isChecking };
}

/**
 * Hook for background cache refresh
 * Automatically refreshes cache in the background when online
 * 
 * Requirements: 10.5, 15.5 - Keep cache fresh with background updates
 */
export function useBackgroundCacheRefresh<T>(
  userId: string,
  cacheKey: CacheKey,
  fetchFn: () => Promise<T>,
  options?: {
    enabled?: boolean;
    interval?: number; // milliseconds
    subKey?: string;
  }
): void {
  const { enabled = true, interval = 5 * 60 * 1000, subKey } = options || {};

  useEffect(() => {
    if (!enabled || !userId) return;

    const refreshCache = async () => {
      try {
        const freshData = await fetchFn();
        await setCacheData(userId, cacheKey, freshData, subKey);
      } catch (error) {
        console.error('Background cache refresh failed:', error);
      }
    };

    // Initial refresh
    refreshCache();

    // Set up interval for periodic refresh
    const intervalId = setInterval(refreshCache, interval);

    return () => clearInterval(intervalId);
  }, [userId, cacheKey, subKey, fetchFn, enabled, interval]);
}

