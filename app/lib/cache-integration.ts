'use client';

/**
 * Cache Integration for tRPC Queries
 * 
 * Integrates IndexedDB caching with tRPC queries for offline access.
 * Requirements: 10.5, 15.5 - Cache user profile, messages, doctor list
 */

import { getCacheData, setCacheData, type CacheKey } from './data-cache';

/**
 * Mapping of tRPC query paths to cache keys
 */
const QUERY_TO_CACHE_KEY_MAP: Record<string, CacheKey> = {
  'user.getMe': 'user_profile',
  'user.me': 'user_profile',
  'doctor.getProfile': 'user_profile',
  'doctor.getMyProfile': 'user_profile',
  'patient.getProfile': 'user_profile',
  'message.getConversations': 'messages',
  'message.getConversation': 'messages',
  'doctor.list': 'doctor_list',
  'connection.getMyConnections': 'doctor_list',
  'appointment.getMyAppointments': 'appointments',
  'appointment.getById': 'appointments',
  'intake.getMyIntakeSessions': 'intake_sessions',
  'intake.getSession': 'intake_sessions',
  'intake.getDoctorIntakeSessions': 'intake_sessions',
};

/**
 * Get cache key for a tRPC query path
 */
export function getCacheKeyForQuery(queryPath: string): CacheKey | null {
  return QUERY_TO_CACHE_KEY_MAP[queryPath] || null;
}

/**
 * Generate sub-key for parameterized queries
 */
export function generateSubKey(params: Record<string, any> | undefined): string | undefined {
  if (!params || Object.keys(params).length === 0) {
    return undefined;
  }
  
  // Create a stable string representation of params
  const sortedKeys = Object.keys(params).sort();
  const keyParts = sortedKeys.map(key => `${key}:${params[key]}`);
  return keyParts.join('|');
}

/**
 * Wrapper for tRPC queries that adds IndexedDB caching
 * 
 * This function wraps the original fetch function to:
 * 1. Check IndexedDB cache first
 * 2. Return cached data if available and valid
 * 3. Fetch fresh data if cache miss
 * 4. Update cache with fresh data
 * 
 * @param userId - Current user ID
 * @param queryPath - tRPC query path (e.g., 'user.getMe')
 * @param fetchFn - Original fetch function
 * @param params - Query parameters
 * @returns Cached or fresh data
 */
export async function cachedQuery<T>(
  userId: string | undefined,
  queryPath: string,
  fetchFn: () => Promise<T>,
  params?: Record<string, any>
): Promise<T> {
  // If no userId, just fetch without caching
  if (!userId) {
    return fetchFn();
  }

  const cacheKey = getCacheKeyForQuery(queryPath);
  
  // If query is not cacheable, just fetch
  if (!cacheKey) {
    return fetchFn();
  }

  const subKey = generateSubKey(params);

  try {
    // Try to get from cache first
    const cachedData = await getCacheData<T>(userId, cacheKey, subKey);
    
    if (cachedData !== null) {
      // Return cached data immediately
      // Optionally trigger background refresh (handled by useBackgroundCacheRefresh)
      return cachedData;
    }
  } catch (error) {
    console.error('Cache read error:', error);
    // Continue to fetch if cache read fails
  }

  // Cache miss or error, fetch fresh data
  const freshData = await fetchFn();

  // Store in cache (fire and forget)
  setCacheData(userId, cacheKey, freshData, subKey).catch(error => {
    console.error('Cache write error:', error);
  });

  return freshData;
}

/**
 * Invalidate cache for a specific query
 * 
 * @param userId - Current user ID
 * @param queryPath - tRPC query path
 * @param params - Query parameters
 */
export async function invalidateQueryCache(
  userId: string,
  queryPath: string,
  params?: Record<string, any>
): Promise<void> {
  const cacheKey = getCacheKeyForQuery(queryPath);
  if (!cacheKey) return;

  const subKey = generateSubKey(params);
  
  const { deleteCacheData } = await import('./data-cache');
  await deleteCacheData(userId, cacheKey, subKey);
}

/**
 * Prefetch and cache data for offline access
 * 
 * @param userId - Current user ID
 * @param queryPath - tRPC query path
 * @param fetchFn - Fetch function
 * @param params - Query parameters
 */
export async function prefetchQuery<T>(
  userId: string,
  queryPath: string,
  fetchFn: () => Promise<T>,
  params?: Record<string, any>
): Promise<void> {
  const cacheKey = getCacheKeyForQuery(queryPath);
  if (!cacheKey) return;

  const subKey = generateSubKey(params);

  try {
    const data = await fetchFn();
    await setCacheData(userId, cacheKey, data, subKey);
  } catch (error) {
    console.error('Prefetch error:', error);
  }
}

/**
 * Get cached data without fetching
 * Useful for checking if data is available offline
 * 
 * @param userId - Current user ID
 * @param queryPath - tRPC query path
 * @param params - Query parameters
 * @returns Cached data or null
 */
export async function getCachedQueryData<T>(
  userId: string,
  queryPath: string,
  params?: Record<string, any>
): Promise<T | null> {
  const cacheKey = getCacheKeyForQuery(queryPath);
  if (!cacheKey) return null;

  const subKey = generateSubKey(params);

  try {
    return await getCacheData<T>(userId, cacheKey, subKey);
  } catch (error) {
    console.error('Cache read error:', error);
    return null;
  }
}
