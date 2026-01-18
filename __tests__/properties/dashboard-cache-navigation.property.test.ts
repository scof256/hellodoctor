/**
 * Feature: dashboard-performance-optimization, Property 8: Cache Hit on Navigation
 * 
 * For any dashboard navigation where the user returns within the stale time,
 * the dashboard SHALL render from cache without making new API requests.
 * 
 * Validates: Requirements 5.2
 * 
 * This property test validates that:
 * 1. Dashboard data is cached after initial fetch
 * 2. Returning within stale time serves data from cache
 * 3. No new API request is made when data is still fresh
 * 4. Stale times are correctly configured per dashboard type
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { CACHE_CONFIGS, getCacheConfig } from '../../src/trpc/cache-config';

// ============================================================================
// Types for simulating cache behavior on navigation
// ============================================================================

interface DashboardQueryKey {
  router: 'dashboard';
  procedure: 'getDoctorDashboard' | 'getPatientDashboard' | 'getAdminDashboard';
}

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
  staleTime: number;
}

interface CacheStore {
  entries: Map<string, CacheEntry<unknown>>;
  requestCounts: Map<string, number>;
}

// ============================================================================
// Helper functions
// ============================================================================

/**
 * Serialize a dashboard query key to a string for cache storage.
 */
function serializeDashboardQueryKey(key: DashboardQueryKey): string {
  return JSON.stringify([key.router, key.procedure]);
}

/**
 * Create a new cache store for testing.
 */
function createCacheStore(): CacheStore {
  return {
    entries: new Map(),
    requestCounts: new Map(),
  };
}

/**
 * Get the configured stale time for a dashboard query.
 * Uses the actual cache configuration from the application.
 */
function getDashboardStaleTime(procedure: DashboardQueryKey['procedure']): number {
  const configKey = `dashboard.${procedure}`;
  const config = CACHE_CONFIGS[configKey];
  return config?.staleTime ?? 30000; // Default to 30 seconds
}

/**
 * Check if cached data is still fresh (within stale time).
 * Requirement 5.2: Cache hit on navigation
 */
function isCacheFresh(entry: CacheEntry<unknown>, currentTime: number): boolean {
  const timeSinceFetch = currentTime - entry.fetchedAt;
  return timeSinceFetch < entry.staleTime;
}

/**
 * Simulate fetching dashboard data with caching behavior.
 * This mimics React Query's cache behavior for dashboard queries.
 * 
 * Requirement 5.2: When user navigates away and returns within stale time,
 * data is served from cache without making new API requests.
 */
function fetchDashboardWithCache<T>(
  cache: CacheStore,
  queryKey: DashboardQueryKey,
  fetchData: () => T,
  currentTime: number
): { data: T; fromCache: boolean; requestMade: boolean } {
  const keyString = serializeDashboardQueryKey(queryKey);
  const existingEntry = cache.entries.get(keyString);
  
  // Check if we have cached data that's still fresh
  if (existingEntry && isCacheFresh(existingEntry, currentTime)) {
    // Serve from cache - no new API request
    return {
      data: existingEntry.data as T,
      fromCache: true,
      requestMade: false,
    };
  }
  
  // Cache miss or stale - make new API request
  const data = fetchData();
  const staleTime = getDashboardStaleTime(queryKey.procedure);
  
  // Store in cache
  cache.entries.set(keyString, {
    data,
    fetchedAt: currentTime,
    staleTime,
  });
  
  // Track request count
  const currentCount = cache.requestCounts.get(keyString) ?? 0;
  cache.requestCounts.set(keyString, currentCount + 1);
  
  return {
    data,
    fromCache: false,
    requestMade: true,
  };
}

/**
 * Simulate user navigation away and back to dashboard.
 */
function simulateNavigation(
  cache: CacheStore,
  queryKey: DashboardQueryKey,
  fetchData: () => unknown,
  initialFetchTime: number,
  returnTime: number
): { fromCache: boolean; requestMade: boolean } {
  // Initial fetch (user visits dashboard)
  fetchDashboardWithCache(cache, queryKey, fetchData, initialFetchTime);
  
  // User navigates away... then returns
  const result = fetchDashboardWithCache(cache, queryKey, fetchData, returnTime);
  
  return {
    fromCache: result.fromCache,
    requestMade: result.requestMade,
  };
}

// ============================================================================
// Arbitraries for generating test data
// ============================================================================

const dashboardProcedureArb = fc.constantFrom(
  'getDoctorDashboard' as const,
  'getPatientDashboard' as const,
  'getAdminDashboard' as const
);

const dashboardQueryKeyArb: fc.Arbitrary<DashboardQueryKey> = fc.record({
  router: fc.constant('dashboard' as const),
  procedure: dashboardProcedureArb,
});

// Mock dashboard data generator
const dashboardDataArb = fc.record({
  stats: fc.record({
    totalPatients: fc.integer({ min: 0, max: 1000 }),
    todayAppointments: fc.integer({ min: 0, max: 50 }),
    pendingReviews: fc.integer({ min: 0, max: 100 }),
  }),
  connections: fc.array(fc.record({ id: fc.uuid() }), { minLength: 0, maxLength: 5 }),
  appointments: fc.array(fc.record({ id: fc.uuid() }), { minLength: 0, maxLength: 5 }),
});

// ============================================================================
// Property Tests
// ============================================================================

describe('Feature: dashboard-performance-optimization, Property 8: Cache Hit on Navigation', () => {
  let cache: CacheStore;
  
  beforeEach(() => {
    cache = createCacheStore();
  });

  describe('Cache Configuration Verification', () => {
    it('dashboard stale times SHALL be correctly configured', () => {
      // Verify doctor dashboard stale time (30 seconds)
      const doctorConfig = getCacheConfig(['dashboard', 'getDoctorDashboard']);
      expect(doctorConfig.staleTime).toBe(30 * 1000);
      
      // Verify patient dashboard stale time (30 seconds)
      const patientConfig = getCacheConfig(['dashboard', 'getPatientDashboard']);
      expect(patientConfig.staleTime).toBe(30 * 1000);
      
      // Verify admin dashboard stale time (60 seconds)
      const adminConfig = getCacheConfig(['dashboard', 'getAdminDashboard']);
      expect(adminConfig.staleTime).toBe(60 * 1000);
    });
  });

  describe('Cache Hit on Navigation Return (Requirement 5.2)', () => {
    it('for any return within stale time, dashboard SHALL render from cache without new API request', () => {
      fc.assert(
        fc.property(
          dashboardQueryKeyArb,
          dashboardDataArb,
          fc.integer({ min: 1000, max: 1000000000 }), // initial fetch time
          (queryKey, mockData, initialTime) => {
            cache = createCacheStore();
            const staleTime = getDashboardStaleTime(queryKey.procedure);
            
            // Generate a return time within stale time
            // Return between 1ms and (staleTime - 1ms) after initial fetch
            const maxReturnDelay = staleTime - 1;
            const returnDelay = Math.floor(Math.random() * maxReturnDelay) + 1;
            const returnTime = initialTime + returnDelay;
            
            const result = simulateNavigation(
              cache,
              queryKey,
              () => mockData,
              initialTime,
              returnTime
            );
            
            // Should serve from cache
            expect(result.fromCache).toBe(true);
            // Should NOT make new API request
            expect(result.requestMade).toBe(false);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any return after stale time, dashboard SHALL make new API request', () => {
      fc.assert(
        fc.property(
          dashboardQueryKeyArb,
          dashboardDataArb,
          fc.integer({ min: 1000, max: 1000000000 }), // initial fetch time
          (queryKey, mockData, initialTime) => {
            cache = createCacheStore();
            const staleTime = getDashboardStaleTime(queryKey.procedure);
            
            // Return after stale time has passed
            const returnTime = initialTime + staleTime + 1;
            
            const result = simulateNavigation(
              cache,
              queryKey,
              () => mockData,
              initialTime,
              returnTime
            );
            
            // Should NOT serve from cache (data is stale)
            expect(result.fromCache).toBe(false);
            // Should make new API request
            expect(result.requestMade).toBe(true);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Stale Time Boundary Behavior', () => {
    it('return at exactly stale time boundary SHALL make new API request', () => {
      fc.assert(
        fc.property(
          dashboardQueryKeyArb,
          dashboardDataArb,
          fc.integer({ min: 1000, max: 1000000000 }),
          (queryKey, mockData, initialTime) => {
            cache = createCacheStore();
            const staleTime = getDashboardStaleTime(queryKey.procedure);
            
            // Return at exactly stale time
            const returnTime = initialTime + staleTime;
            
            const result = simulateNavigation(
              cache,
              queryKey,
              () => mockData,
              initialTime,
              returnTime
            );
            
            // At exactly stale time, data is considered stale
            expect(result.fromCache).toBe(false);
            expect(result.requestMade).toBe(true);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('return 1ms before stale time SHALL serve from cache', () => {
      fc.assert(
        fc.property(
          dashboardQueryKeyArb,
          dashboardDataArb,
          fc.integer({ min: 1000, max: 1000000000 }),
          (queryKey, mockData, initialTime) => {
            cache = createCacheStore();
            const staleTime = getDashboardStaleTime(queryKey.procedure);
            
            // Return 1ms before stale time
            const returnTime = initialTime + staleTime - 1;
            
            const result = simulateNavigation(
              cache,
              queryKey,
              () => mockData,
              initialTime,
              returnTime
            );
            
            // Just before stale time, data is still fresh
            expect(result.fromCache).toBe(true);
            expect(result.requestMade).toBe(false);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Multiple Navigation Cycles', () => {
    it('multiple returns within stale time SHALL all serve from cache', () => {
      fc.assert(
        fc.property(
          dashboardQueryKeyArb,
          dashboardDataArb,
          fc.integer({ min: 1000, max: 1000000000 }),
          fc.integer({ min: 2, max: 5 }), // number of navigation cycles
          (queryKey, mockData, initialTime, cycleCount) => {
            cache = createCacheStore();
            const staleTime = getDashboardStaleTime(queryKey.procedure);
            const keyString = serializeDashboardQueryKey(queryKey);
            
            // Initial fetch
            fetchDashboardWithCache(cache, queryKey, () => mockData, initialTime);
            
            // Multiple returns within stale time
            const results: { fromCache: boolean; requestMade: boolean }[] = [];
            for (let i = 0; i < cycleCount; i++) {
              // Each return is within stale time from initial fetch
              const returnDelay = Math.floor((staleTime - 1) * (i + 1) / (cycleCount + 1));
              const returnTime = initialTime + returnDelay;
              
              const result = fetchDashboardWithCache(cache, queryKey, () => mockData, returnTime);
              results.push({ fromCache: result.fromCache, requestMade: result.requestMade });
            }
            
            // All returns should be from cache
            for (const result of results) {
              expect(result.fromCache).toBe(true);
              expect(result.requestMade).toBe(false);
            }
            
            // Only 1 API request should have been made (the initial fetch)
            const requestCount = cache.requestCounts.get(keyString) ?? 0;
            expect(requestCount).toBe(1);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Dashboard Type Specific Stale Times', () => {
    it('doctor dashboard SHALL have 30 second stale time', () => {
      const queryKey: DashboardQueryKey = { router: 'dashboard', procedure: 'getDoctorDashboard' };
      const staleTime = getDashboardStaleTime(queryKey.procedure);
      expect(staleTime).toBe(30 * 1000);
    });

    it('patient dashboard SHALL have 30 second stale time', () => {
      const queryKey: DashboardQueryKey = { router: 'dashboard', procedure: 'getPatientDashboard' };
      const staleTime = getDashboardStaleTime(queryKey.procedure);
      expect(staleTime).toBe(30 * 1000);
    });

    it('admin dashboard SHALL have 60 second stale time', () => {
      const queryKey: DashboardQueryKey = { router: 'dashboard', procedure: 'getAdminDashboard' };
      const staleTime = getDashboardStaleTime(queryKey.procedure);
      expect(staleTime).toBe(60 * 1000);
    });

    it('admin dashboard cache hit window SHALL be longer than patient/doctor', () => {
      fc.assert(
        fc.property(
          dashboardDataArb,
          fc.integer({ min: 1000, max: 1000000000 }),
          (mockData, initialTime) => {
            const doctorCache = createCacheStore();
            const adminCache = createCacheStore();
            
            const doctorKey: DashboardQueryKey = { router: 'dashboard', procedure: 'getDoctorDashboard' };
            const adminKey: DashboardQueryKey = { router: 'dashboard', procedure: 'getAdminDashboard' };
            
            // Return at 45 seconds (after doctor stale time, before admin stale time)
            const returnTime = initialTime + 45 * 1000;
            
            const doctorResult = simulateNavigation(
              doctorCache,
              doctorKey,
              () => mockData,
              initialTime,
              returnTime
            );
            
            const adminResult = simulateNavigation(
              adminCache,
              adminKey,
              () => mockData,
              initialTime,
              returnTime
            );
            
            // Doctor dashboard should be stale (30s < 45s)
            expect(doctorResult.fromCache).toBe(false);
            expect(doctorResult.requestMade).toBe(true);
            
            // Admin dashboard should still be fresh (60s > 45s)
            expect(adminResult.fromCache).toBe(true);
            expect(adminResult.requestMade).toBe(false);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Data Consistency on Cache Hit', () => {
    it('cached data SHALL be identical to originally fetched data', () => {
      fc.assert(
        fc.property(
          dashboardQueryKeyArb,
          dashboardDataArb,
          fc.integer({ min: 1000, max: 1000000000 }),
          (queryKey, mockData, initialTime) => {
            cache = createCacheStore();
            const staleTime = getDashboardStaleTime(queryKey.procedure);
            
            // Initial fetch
            const initialResult = fetchDashboardWithCache(
              cache,
              queryKey,
              () => mockData,
              initialTime
            );
            
            // Return within stale time
            const returnTime = initialTime + Math.floor(staleTime / 2);
            const cachedResult = fetchDashboardWithCache(
              cache,
              queryKey,
              () => ({ ...mockData, modified: true }), // Different data if fetched
              returnTime
            );
            
            // Cached data should be identical to initial fetch
            expect(cachedResult.data).toEqual(initialResult.data);
            expect(cachedResult.fromCache).toBe(true);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
