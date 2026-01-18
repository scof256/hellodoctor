/**
 * Feature: site-performance-optimization, Property 5: Cache Invalidation Selectivity
 * 
 * For any mutation that affects cached data, only cache entries with matching
 * query keys SHALL be invalidated, and unrelated cache entries SHALL remain unchanged.
 * 
 * Validates: Requirements 3.5
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  getInvalidationKeys,
  getPreservedCategories,
  matchesInvalidationPattern,
} from '../../src/trpc/cache-config';

/**
 * This property test validates selective cache invalidation by verifying that:
 * 1. Mutations only invalidate related cache entries
 * 2. Unrelated cache entries remain unchanged
 * 3. The invalidation patterns correctly match query keys
 */

// Types for simulating cache behavior
interface CacheEntry {
  queryKey: string[];
  data: unknown;
  isValid: boolean;
}

interface CacheStore {
  entries: Map<string, CacheEntry>;
}

/**
 * Serialize a query key to a string for cache storage.
 */
function serializeCacheKey(queryKey: string[]): string {
  return JSON.stringify(queryKey);
}

/**
 * Create a new cache store for testing.
 */
function createCacheStore(): CacheStore {
  return {
    entries: new Map(),
  };
}

/**
 * Add an entry to the cache.
 */
function setCacheEntry(store: CacheStore, queryKey: string[], data: unknown): void {
  const key = serializeCacheKey(queryKey);
  store.entries.set(key, { queryKey, data, isValid: true });
}

/**
 * Invalidate cache entries matching the given patterns.
 */
function invalidateCache(store: CacheStore, patterns: string[][]): string[] {
  const invalidatedKeys: string[] = [];
  
  for (const [key, entry] of store.entries) {
    for (const pattern of patterns) {
      if (matchesInvalidationPattern(entry.queryKey, pattern)) {
        entry.isValid = false;
        invalidatedKeys.push(key);
        break;
      }
    }
  }
  
  return invalidatedKeys;
}

/**
 * Get all valid cache entries.
 */
function getValidEntries(store: CacheStore): CacheEntry[] {
  return Array.from(store.entries.values()).filter(e => e.isValid);
}

/**
 * Get all invalid cache entries.
 */
function getInvalidEntries(store: CacheStore): CacheEntry[] {
  return Array.from(store.entries.values()).filter(e => !e.isValid);
}

// All known mutations with their invalidation mappings
const KNOWN_MUTATIONS = [
  'message.send',
  'message.markAsRead',
  'appointment.create',
  'appointment.cancel',
  'appointment.reschedule',
  'appointment.markArrived',
  'appointment.markCompleted',
  'appointment.markNoShow',
  'intake.create',
  'intake.sendMessage',
  'intake.markAsReviewed',
  'intake.resetSession',
  'intake.storeFileMetadata',
  'connection.create',
  'connection.disconnect',
  'notification.markAsRead',
  'notification.markAllAsRead',
  'doctor.setAvailability',
  'doctor.blockDate',
  'doctor.unblockDate',
  'doctor.updateProfile',
  'doctor.regenerateQRCode',
  'support.create',
  'support.respond',
  'support.assignTicket',
  'support.updateStatus',
  'admin.updateUserStatus',
  'admin.updateUserRole',
  'admin.verifyDoctor',
  'admin.updateConfigs',
];

// Sample query keys for each category
const SAMPLE_QUERY_KEYS: Record<string, string[][]> = {
  message: [
    ['message', 'getConversation', 'conn-123'],
    ['message', 'getConversations'],
    ['message', 'getUnreadCount'],
  ],
  appointment: [
    ['appointment', 'getMyAppointments'],
    ['appointment', 'getById', 'apt-456'],
    ['appointment', 'getAvailableSlots', 'doc-789'],
  ],
  intake: [
    ['intake', 'getSession', 'session-123'],
    ['intake', 'getMyIntakeSessions'],
    ['intake', 'getDoctorIntakeSessions'],
  ],
  connection: [
    ['connection', 'getMyConnections'],
  ],
  notification: [
    ['notification', 'getUnreadCount'],
    ['notification', 'getMyNotifications'],
  ],
  doctor: [
    ['doctor', 'getAvailability', 'doc-123'],
    ['doctor', 'getMyProfile'],
    ['doctor', 'getProfile', 'doc-456'],
    ['doctor', 'getBySlug', 'dr-smith'],
    ['doctor', 'getBlockedDates'],
    ['doctor', 'getQRCode'],
    ['doctor', 'getQRCodeDownload'],
  ],
  user: [
    ['user', 'me'],
    ['user', 'getById', 'user-123'],
  ],
  analytics: [
    ['analytics', 'getDashboard'],
    ['analytics', 'getPatientStats'],
  ],
  support: [
    ['support', 'getMyTickets'],
    ['support', 'getTicketById', 'ticket-123'],
    ['support', 'getAllTickets'],
  ],
  admin: [
    ['admin', 'getUsers'],
    ['admin', 'getUserById', 'user-456'],
    ['admin', 'getDoctors'],
    ['admin', 'getConfig'],
  ],
};

// Arbitraries for generating test data
const mutationArb = fc.constantFrom(...KNOWN_MUTATIONS);

const categoryArb = fc.constantFrom(
  'message',
  'appointment',
  'intake',
  'connection',
  'notification',
  'doctor',
  'user',
  'analytics',
  'support',
  'admin'
);

describe('Property 5: Cache Invalidation Selectivity', () => {
  let cacheStore: CacheStore;

  beforeEach(() => {
    cacheStore = createCacheStore();
  });

  describe('Selective Invalidation', () => {
    it('mutations SHALL only invalidate cache entries with matching query keys', () => {
      fc.assert(
        fc.property(mutationArb, (mutationKey) => {
          cacheStore = createCacheStore();
          
          // Populate cache with entries from all categories
          for (const [category, queryKeys] of Object.entries(SAMPLE_QUERY_KEYS)) {
            for (const queryKey of queryKeys) {
              setCacheEntry(cacheStore, queryKey, { category, data: 'test' });
            }
          }
          
          const totalEntriesBefore = cacheStore.entries.size;
          
          // Get invalidation patterns for this mutation
          const invalidationPatterns = getInvalidationKeys(mutationKey);
          
          // Perform invalidation
          invalidateCache(cacheStore, invalidationPatterns);
          
          // Verify: invalidated entries should match patterns
          const invalidEntries = getInvalidEntries(cacheStore);
          for (const entry of invalidEntries) {
            const matchesAnyPattern = invalidationPatterns.some(pattern =>
              matchesInvalidationPattern(entry.queryKey, pattern)
            );
            expect(matchesAnyPattern).toBe(true);
          }
          
          // Verify: valid entries should NOT match any pattern
          const validEntries = getValidEntries(cacheStore);
          for (const entry of validEntries) {
            const matchesAnyPattern = invalidationPatterns.some(pattern =>
              matchesInvalidationPattern(entry.queryKey, pattern)
            );
            expect(matchesAnyPattern).toBe(false);
          }
          
          // Total entries should remain the same (just validity changed)
          expect(cacheStore.entries.size).toBe(totalEntriesBefore);
          
          return true;
        }),
        { numRuns: 25 }
      );
    });

    it('unrelated cache entries SHALL remain unchanged after mutation', () => {
      fc.assert(
        fc.property(mutationArb, (mutationKey) => {
          cacheStore = createCacheStore();
          
          // Get preserved categories for this mutation
          const preservedCategories = getPreservedCategories(mutationKey);
          
          // Populate cache with entries from preserved categories
          for (const category of preservedCategories) {
            const queryKeys = SAMPLE_QUERY_KEYS[category] ?? [];
            for (const queryKey of queryKeys) {
              setCacheEntry(cacheStore, queryKey, { category, data: 'preserved' });
            }
          }
          
          const entriesBefore = Array.from(cacheStore.entries.values()).map(e => ({
            key: serializeCacheKey(e.queryKey),
            isValid: e.isValid,
          }));
          
          // Perform invalidation
          const invalidationPatterns = getInvalidationKeys(mutationKey);
          invalidateCache(cacheStore, invalidationPatterns);
          
          // All entries from preserved categories should still be valid
          const validEntries = getValidEntries(cacheStore);
          expect(validEntries.length).toBe(entriesBefore.length);
          
          return true;
        }),
        { numRuns: 25 }
      );
    });
  });

  describe('Pattern Matching', () => {
    it('matchesInvalidationPattern SHALL return true only for prefix matches', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 5 }),
          fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 5 }),
          (queryKey, pattern) => {
            const matches = matchesInvalidationPattern(queryKey, pattern);
            
            if (pattern.length > queryKey.length) {
              // Pattern longer than query key should never match
              expect(matches).toBe(false);
            } else {
              // Check if pattern is actually a prefix
              const isPrefix = pattern.every((part, i) => queryKey[i] === part);
              expect(matches).toBe(isPrefix);
            }
            
            return true;
          }
        ),
        { numRuns: 25 }
      );
    });

    it('empty pattern SHALL match all query keys', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 5 }),
          (queryKey) => {
            const emptyPattern: string[] = [];
            const matches = matchesInvalidationPattern(queryKey, emptyPattern);
            expect(matches).toBe(true);
            return true;
          }
        ),
        { numRuns: 25 }
      );
    });

    it('exact match pattern SHALL match only that specific query key', () => {
      fc.assert(
        fc.property(categoryArb, (category) => {
          const queryKeys = SAMPLE_QUERY_KEYS[category] ?? [];
          if (queryKeys.length === 0) return true;
          
          // Pick a random query key as the exact pattern
          const exactPattern = queryKeys[0]!;
          
          // It should match itself
          expect(matchesInvalidationPattern(exactPattern, exactPattern)).toBe(true);
          
          // It should not match query keys from other categories
          for (const [otherCategory, otherKeys] of Object.entries(SAMPLE_QUERY_KEYS)) {
            if (otherCategory === category) continue;
            for (const otherKey of otherKeys) {
              const matches = matchesInvalidationPattern(otherKey, exactPattern);
              // Should only match if it happens to be a prefix (unlikely for different categories)
              const isPrefix = exactPattern.every((part, i) => otherKey[i] === part);
              expect(matches).toBe(isPrefix);
            }
          }
          
          return true;
        }),
        { numRuns: 25 }
      );
    });
  });

  describe('Invalidation Coverage', () => {
    it('message mutations SHALL only invalidate message-related queries', () => {
      const messageMutations = ['message.send', 'message.markAsRead'];
      
      for (const mutation of messageMutations) {
        const invalidationKeys = getInvalidationKeys(mutation);
        const preservedCategories = getPreservedCategories(mutation);
        
        // Message mutations should preserve most other categories
        expect(preservedCategories).toContain('user');
        expect(preservedCategories).toContain('analytics');
        expect(preservedCategories).toContain('admin');
        expect(preservedCategories).toContain('support');
        
        // Should invalidate message-related keys
        const invalidatesMessage = invalidationKeys.some(k => k[0] === 'message');
        expect(invalidatesMessage).toBe(true);
      }
    });

    it('appointment mutations SHALL invalidate appointment and availability queries', () => {
      const appointmentMutations = [
        'appointment.create',
        'appointment.cancel',
        'appointment.reschedule',
      ];
      
      for (const mutation of appointmentMutations) {
        const invalidationKeys = getInvalidationKeys(mutation);
        
        // Should invalidate appointment-related keys
        const invalidatesAppointment = invalidationKeys.some(k => k[0] === 'appointment');
        expect(invalidatesAppointment).toBe(true);
        
        // Should preserve unrelated categories
        const preservedCategories = getPreservedCategories(mutation);
        expect(preservedCategories).toContain('message');
        expect(preservedCategories).toContain('user');
        expect(preservedCategories).toContain('support');
      }
    });

    it('intake mutations SHALL only invalidate intake-related queries', () => {
      const intakeMutations = [
        'intake.create',
        'intake.sendMessage',
        'intake.markAsReviewed',
        'intake.resetSession',
      ];
      
      for (const mutation of intakeMutations) {
        const invalidationKeys = getInvalidationKeys(mutation);
        const preservedCategories = getPreservedCategories(mutation);
        
        // Should invalidate intake-related keys
        const invalidatesIntake = invalidationKeys.some(k => k[0] === 'intake');
        expect(invalidatesIntake).toBe(true);
        
        // Should preserve most other categories
        expect(preservedCategories).toContain('message');
        expect(preservedCategories).toContain('user');
        expect(preservedCategories).toContain('analytics');
      }
    });
  });

  describe('Preserved Categories Correctness', () => {
    it('getPreservedCategories SHALL return categories not in invalidation keys', () => {
      fc.assert(
        fc.property(mutationArb, (mutationKey) => {
          const invalidationKeys = getInvalidationKeys(mutationKey);
          const preservedCategories = getPreservedCategories(mutationKey);
          
          // Get invalidated categories
          const invalidatedCategories = new Set<string>();
          for (const key of invalidationKeys) {
            if (key[0]) invalidatedCategories.add(key[0]);
          }
          
          // Preserved categories should not overlap with invalidated categories
          for (const preserved of preservedCategories) {
            expect(invalidatedCategories.has(preserved)).toBe(false);
          }
          
          // Together they should cover all known categories
          const allCategories = new Set([
            'message', 'appointment', 'intake', 'connection',
            'notification', 'doctor', 'user', 'analytics', 'support', 'admin', 'dashboard'
          ]);
          
          for (const cat of allCategories) {
            const isInvalidated = invalidatedCategories.has(cat);
            const isPreserved = preservedCategories.includes(cat);
            // Each category should be either invalidated or preserved, not both
            expect(isInvalidated !== isPreserved).toBe(true);
          }
          
          return true;
        }),
        { numRuns: 25 }
      );
    });
  });

  describe('Unknown Mutations', () => {
    it('unknown mutations SHALL return empty invalidation keys', () => {
      const unknownMutations = [
        'unknown.mutation',
        'foo.bar',
        'nonexistent.action',
      ];
      
      for (const mutation of unknownMutations) {
        const invalidationKeys = getInvalidationKeys(mutation);
        expect(invalidationKeys).toEqual([]);
        
        // All categories should be preserved for unknown mutations
        // Categories: message, appointment, intake, connection, notification, doctor, user, analytics, support, admin, dashboard
        const preservedCategories = getPreservedCategories(mutation);
        expect(preservedCategories.length).toBe(11); // All 11 categories
      }
    });
  });
});
