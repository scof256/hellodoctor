/**
 * Feature: site-performance-optimization, Property 4: Request Deduplication
 * 
 * For any set of K concurrent requests for the same data (same query key),
 * the number of actual network requests SHALL be exactly 1.
 * 
 * Validates: Requirements 3.4
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * This property test validates request deduplication by simulating
 * concurrent requests and verifying that only one network request is made.
 * 
 * React Query's deduplication works by:
 * 1. Tracking in-flight requests by query key
 * 2. When a new request comes in for the same key, returning the existing promise
 * 3. All subscribers receive the same response
 */

// Types for simulating request deduplication
interface QueryKey {
  router: string;
  procedure: string;
  input?: Record<string, unknown>;
}

interface RequestTracker {
  inFlightRequests: Map<string, Promise<unknown>>;
  requestCounts: Map<string, number>;
  completedRequests: Map<string, unknown>;
}

/**
 * Serialize a query key to a string for tracking.
 */
function serializeQueryKey(key: QueryKey): string {
  return JSON.stringify([key.router, key.procedure, key.input]);
}

/**
 * Create a new request tracker for testing.
 */
function createRequestTracker(): RequestTracker {
  return {
    inFlightRequests: new Map(),
    requestCounts: new Map(),
    completedRequests: new Map(),
  };
}

/**
 * Simulate making a request with deduplication (synchronous version for testing).
 * This mimics React Query's behavior.
 */
function makeDeduplicatedRequestSync<T>(
  tracker: RequestTracker,
  queryKey: QueryKey,
  data: T
): { data: T; isNewRequest: boolean } {
  const keyString = serializeQueryKey(queryKey);
  
  // Check if there's already an in-flight request for this key
  if (tracker.inFlightRequests.has(keyString)) {
    // Return existing data - this is deduplication!
    return { data, isNewRequest: false };
  }
  
  // No existing request, make a new one
  const currentCount = tracker.requestCounts.get(keyString) ?? 0;
  tracker.requestCounts.set(keyString, currentCount + 1);
  
  // Mark as in-flight
  tracker.inFlightRequests.set(keyString, Promise.resolve(data));
  
  return { data, isNewRequest: true };
}

/**
 * Complete an in-flight request (simulates request finishing).
 */
function completeRequest(tracker: RequestTracker, queryKey: QueryKey): void {
  const keyString = serializeQueryKey(queryKey);
  tracker.inFlightRequests.delete(keyString);
}

/**
 * Simulate making a request WITHOUT deduplication (old behavior).
 * Each call makes a new network request.
 */
function makeNonDeduplicatedRequestSync<T>(
  tracker: RequestTracker,
  queryKey: QueryKey,
  data: T
): { data: T; isNewRequest: boolean } {
  const keyString = serializeQueryKey(queryKey);
  
  // Always increment the request count
  const currentCount = tracker.requestCounts.get(keyString) ?? 0;
  tracker.requestCounts.set(keyString, currentCount + 1);
  
  return { data, isNewRequest: true };
}

// Arbitraries for generating test data
const routerArb = fc.constantFrom(
  'message',
  'appointment',
  'intake',
  'doctor',
  'patient',
  'connection',
  'notification',
  'analytics'
);

const procedureArb = fc.constantFrom(
  'getConversations',
  'getMyAppointments',
  'getSession',
  'getAvailability',
  'getMyConnections',
  'getUnreadCount',
  'getDashboard'
);

const inputArb = fc.option(
  fc.record({
    id: fc.uuid(),
    limit: fc.integer({ min: 1, max: 50 }),
  }),
  { nil: undefined }
);

const queryKeyArb = fc.record({
  router: routerArb,
  procedure: procedureArb,
  input: inputArb,
});

describe('Property 4: Request Deduplication', () => {
  let tracker: RequestTracker;
  
  beforeEach(() => {
    tracker = createRequestTracker();
  });

  describe('Concurrent Request Deduplication', () => {
    it('for any K concurrent requests with same query key, exactly 1 network request SHALL be made', () => {
      fc.assert(
        fc.property(
          queryKeyArb,
          fc.integer({ min: 2, max: 20 }), // K concurrent requests
          (queryKey, concurrentCount) => {
            tracker = createRequestTracker();
            const keyString = serializeQueryKey(queryKey);
            const mockData = { id: queryKey.router, data: 'test' };
            
            // Simulate K concurrent requests (all while first is in-flight)
            const results: { data: typeof mockData; isNewRequest: boolean }[] = [];
            for (let i = 0; i < concurrentCount; i++) {
              results.push(makeDeduplicatedRequestSync(tracker, queryKey, mockData));
            }
            
            // All results should have the same data
            for (const result of results) {
              expect(result.data).toEqual(mockData);
            }
            
            // Only 1 actual network request should have been made
            const requestCount = tracker.requestCounts.get(keyString) ?? 0;
            expect(requestCount).toBe(1);
            
            // Only the first request should be marked as new
            expect(results[0].isNewRequest).toBe(true);
            for (let i = 1; i < results.length; i++) {
              expect(results[i].isNewRequest).toBe(false);
            }
            
            return true;
          }
        ),
        { numRuns: 25 }
      );
    });

    it('without deduplication, K concurrent requests would make K network requests', () => {
      fc.assert(
        fc.property(
          queryKeyArb,
          fc.integer({ min: 2, max: 10 }),
          (queryKey, concurrentCount) => {
            tracker = createRequestTracker();
            const keyString = serializeQueryKey(queryKey);
            const mockData = { id: queryKey.router, data: 'test' };
            
            // Make K concurrent requests WITHOUT deduplication
            for (let i = 0; i < concurrentCount; i++) {
              makeNonDeduplicatedRequestSync(tracker, queryKey, mockData);
            }
            
            // K network requests should have been made
            const requestCount = tracker.requestCounts.get(keyString) ?? 0;
            expect(requestCount).toBe(concurrentCount);
            
            return true;
          }
        ),
        { numRuns: 25 }
      );
    });
  });

  describe('Different Query Keys', () => {
    it('requests with different query keys SHALL make separate network requests', () => {
      fc.assert(
        fc.property(
          fc.array(queryKeyArb, { minLength: 2, maxLength: 10 }),
          (queryKeys) => {
            tracker = createRequestTracker();
            
            // Ensure all query keys are unique
            const uniqueKeys = new Map<string, QueryKey>();
            for (const key of queryKeys) {
              uniqueKeys.set(serializeQueryKey(key), key);
            }
            
            const uniqueQueryKeys = Array.from(uniqueKeys.values());
            if (uniqueQueryKeys.length < 2) {
              return true; // Skip if not enough unique keys
            }
            
            // Make one request per unique key
            for (const key of uniqueQueryKeys) {
              makeDeduplicatedRequestSync(tracker, key, { router: key.router });
            }
            
            // Each unique key should have exactly 1 request
            for (const key of uniqueQueryKeys) {
              const keyString = serializeQueryKey(key);
              const requestCount = tracker.requestCounts.get(keyString) ?? 0;
              expect(requestCount).toBe(1);
            }
            
            // Total requests should equal number of unique keys
            let totalRequests = 0;
            for (const count of tracker.requestCounts.values()) {
              totalRequests += count;
            }
            expect(totalRequests).toBe(uniqueQueryKeys.length);
            
            return true;
          }
        ),
        { numRuns: 25 }
      );
    });
  });

  describe('Sequential Requests After Completion', () => {
    it('sequential requests after completion SHALL make new network requests', () => {
      fc.assert(
        fc.property(
          queryKeyArb,
          fc.integer({ min: 2, max: 5 }),
          (queryKey, sequentialCount) => {
            tracker = createRequestTracker();
            const keyString = serializeQueryKey(queryKey);
            const mockData = { id: queryKey.router, data: 'test' };
            
            // Make sequential requests (completing each before the next)
            for (let i = 0; i < sequentialCount; i++) {
              makeDeduplicatedRequestSync(tracker, queryKey, mockData);
              completeRequest(tracker, queryKey); // Complete before next request
            }
            
            // Each sequential request should make a new network request
            const requestCount = tracker.requestCounts.get(keyString) ?? 0;
            expect(requestCount).toBe(sequentialCount);
            
            return true;
          }
        ),
        { numRuns: 25 }
      );
    });
  });

  describe('Mixed Concurrent and Sequential', () => {
    it('mixed concurrent batches SHALL deduplicate within each batch', () => {
      fc.assert(
        fc.property(
          queryKeyArb,
          fc.integer({ min: 2, max: 5 }), // batch count
          fc.integer({ min: 2, max: 5 }), // requests per batch
          (queryKey, batchCount, requestsPerBatch) => {
            tracker = createRequestTracker();
            const keyString = serializeQueryKey(queryKey);
            const mockData = { id: queryKey.router, data: 'test' };
            
            // Make multiple batches of concurrent requests
            for (let batch = 0; batch < batchCount; batch++) {
              // Make concurrent requests within batch
              for (let i = 0; i < requestsPerBatch; i++) {
                makeDeduplicatedRequestSync(tracker, queryKey, mockData);
              }
              // Complete the batch before starting next
              completeRequest(tracker, queryKey);
            }
            
            // Should have exactly batchCount network requests
            const requestCount = tracker.requestCounts.get(keyString) ?? 0;
            expect(requestCount).toBe(batchCount);
            
            return true;
          }
        ),
        { numRuns: 25 }
      );
    });
  });

  describe('Deduplication Efficiency', () => {
    it('deduplication SHALL reduce network requests by (K-1) for K concurrent requests', () => {
      fc.assert(
        fc.property(
          queryKeyArb,
          fc.integer({ min: 2, max: 20 }),
          (queryKey, concurrentCount) => {
            const deduplicatedTracker = createRequestTracker();
            const nonDeduplicatedTracker = createRequestTracker();
            const keyString = serializeQueryKey(queryKey);
            const mockData = { id: queryKey.router };
            
            // Make concurrent requests with deduplication
            for (let i = 0; i < concurrentCount; i++) {
              makeDeduplicatedRequestSync(deduplicatedTracker, queryKey, mockData);
            }
            
            // Make concurrent requests without deduplication
            for (let i = 0; i < concurrentCount; i++) {
              makeNonDeduplicatedRequestSync(nonDeduplicatedTracker, queryKey, mockData);
            }
            
            const deduplicatedCount = deduplicatedTracker.requestCounts.get(keyString) ?? 0;
            const nonDeduplicatedCount = nonDeduplicatedTracker.requestCounts.get(keyString) ?? 0;
            
            // Deduplication should save (K-1) requests
            const savedRequests = nonDeduplicatedCount - deduplicatedCount;
            expect(savedRequests).toBe(concurrentCount - 1);
            
            return true;
          }
        ),
        { numRuns: 25 }
      );
    });
  });
});
