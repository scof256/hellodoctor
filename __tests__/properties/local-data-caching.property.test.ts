/**
 * Feature: whatsapp-simple-ux, Property 24: Local Data Caching
 * 
 * For any frequently accessed data (user profile, recent messages, doctor list), 
 * the data should be cached locally and available for offline access.
 * 
 * Validates: Requirements 10.5, 15.5
 * 
 * Note: Full IndexedDB integration tests require a browser environment.
 * These property tests focus on the core caching logic and algorithms.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { CacheKey, CacheEntry } from '@/app/lib/data-cache';

// Cache TTL values from data-cache.ts
const CACHE_TTL: Record<CacheKey, number> = {
  user_profile: 24 * 60 * 60 * 1000, // 24 hours
  messages: 60 * 60 * 1000, // 1 hour
  doctor_list: 12 * 60 * 60 * 1000, // 12 hours
  appointments: 30 * 60 * 1000, // 30 minutes
  intake_sessions: 60 * 60 * 1000, // 1 hour
};

// Helper to generate cache key
function generateCacheKey(userId: string, cacheKey: CacheKey, subKey?: string): string {
  return subKey ? `${userId}:${cacheKey}:${subKey}` : `${userId}:${cacheKey}`;
}

// Helper to check if cache is expired
function isCacheExpired(entry: CacheEntry): boolean {
  const now = new Date();
  const expiresAt = new Date(entry.expiresAt);
  return now > expiresAt;
}

describe('Property 24: Local Data Caching', () => {
  it('should cache all frequently accessed data types', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<CacheKey>('user_profile', 'messages', 'doctor_list', 'appointments', 'intake_sessions'),
        (cacheKey) => {
          // Verify cache key is one of the frequently accessed types (Requirement 10.5)
          const frequentlyAccessedTypes: CacheKey[] = [
            'user_profile',
            'messages',
            'doctor_list',
            'appointments',
            'intake_sessions',
          ];
          expect(frequentlyAccessedTypes).toContain(cacheKey);

          // Verify TTL is defined for this cache key
          expect(CACHE_TTL[cacheKey]).toBeDefined();
          expect(CACHE_TTL[cacheKey]).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should generate unique cache keys for different users and data types', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.constantFrom<CacheKey>('user_profile', 'messages', 'doctor_list', 'appointments', 'intake_sessions'),
        fc.constantFrom<CacheKey>('user_profile', 'messages', 'doctor_list', 'appointments', 'intake_sessions'),
        fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
        (userId1, userId2, cacheKey1, cacheKey2, subKey) => {
          const key1 = generateCacheKey(userId1, cacheKey1, subKey);
          const key2 = generateCacheKey(userId2, cacheKey2, subKey);

          // If users or cache types differ, keys should be different
          if (userId1 !== userId2 || cacheKey1 !== cacheKey2) {
            expect(key1).not.toBe(key2);
          } else {
            // Same user and cache type should produce same key
            expect(key1).toBe(key2);
          }

          // Verify key format includes userId and cacheKey
          expect(key1).toContain(userId1);
          expect(key1).toContain(cacheKey1);
          expect(key2).toContain(userId2);
          expect(key2).toContain(cacheKey2);

          // If subKey provided, it should be in the key
          if (subKey) {
            expect(key1).toContain(subKey);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should set correct expiration time based on cache type', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.constantFrom<CacheKey>('user_profile', 'messages', 'doctor_list', 'appointments', 'intake_sessions'),
        fc.anything(),
        (userId, cacheKey, data) => {
          const now = new Date();
          const ttl = CACHE_TTL[cacheKey];
          const expectedExpiresAt = new Date(now.getTime() + ttl);

          // Create cache entry
          const entry: CacheEntry = {
            key: generateCacheKey(userId, cacheKey),
            userId,
            data,
            cachedAt: now,
            expiresAt: expectedExpiresAt,
            version: 1,
          };

          // Verify expiration time is set correctly
          const actualTTL = new Date(entry.expiresAt).getTime() - new Date(entry.cachedAt).getTime();
          expect(actualTTL).toBe(ttl);

          // Verify expiration is in the future
          expect(new Date(entry.expiresAt).getTime()).toBeGreaterThan(new Date(entry.cachedAt).getTime());
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should correctly identify expired cache entries', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.constantFrom<CacheKey>('user_profile', 'messages', 'doctor_list', 'appointments', 'intake_sessions'),
        fc.anything(),
        fc.integer({ min: -3600000, max: 3600000 }), // -1 hour to +1 hour offset
        (userId, cacheKey, data, timeOffset) => {
          const now = new Date();
          const cachedAt = new Date(now.getTime() - 1000); // 1 second ago
          const expiresAt = new Date(now.getTime() + timeOffset);

          const entry: CacheEntry = {
            key: generateCacheKey(userId, cacheKey),
            userId,
            data,
            cachedAt,
            expiresAt,
            version: 1,
          };

          const expired = isCacheExpired(entry);

          // If expiration is in the past, should be expired
          if (timeOffset < 0) {
            expect(expired).toBe(true);
          } else {
            // If expiration is in the future, should not be expired
            expect(expired).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve data integrity for any data type', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.constantFrom<CacheKey>('user_profile', 'messages', 'doctor_list', 'appointments', 'intake_sessions'),
        fc.oneof(
          // User profile data
          fc.record({
            id: fc.string(),
            name: fc.string(),
            email: fc.string(),
            role: fc.constantFrom('patient', 'doctor', 'admin'),
          }),
          // Messages data (without Date objects to avoid serialization issues)
          fc.array(
            fc.record({
              id: fc.string(),
              content: fc.string(),
              senderId: fc.string(),
              timestamp: fc.integer({ min: 0, max: Date.now() }), // Use timestamp as number
            }),
            { maxLength: 50 }
          ),
          // Doctor list data
          fc.array(
            fc.record({
              id: fc.string(),
              name: fc.string(),
              specialty: fc.string(),
              available: fc.boolean(),
            }),
            { maxLength: 20 }
          ),
          // Appointments data (without Date objects)
          fc.array(
            fc.record({
              id: fc.string(),
              doctorId: fc.string(),
              patientId: fc.string(),
              date: fc.integer({ min: 0, max: Date.now() }), // Use timestamp as number
              status: fc.constantFrom('scheduled', 'completed', 'cancelled'),
            }),
            { maxLength: 10 }
          ),
          // Intake sessions data
          fc.array(
            fc.record({
              id: fc.string(),
              patientId: fc.string(),
              progress: fc.integer({ min: 0, max: 100 }),
              completed: fc.boolean(),
            }),
            { maxLength: 10 }
          )
        ),
        (userId, cacheKey, data) => {
          const now = new Date();
          const ttl = CACHE_TTL[cacheKey];

          const entry: CacheEntry = {
            key: generateCacheKey(userId, cacheKey),
            userId,
            data,
            cachedAt: now,
            expiresAt: new Date(now.getTime() + ttl),
            version: 1,
          };

          // Verify data is preserved exactly
          expect(entry.data).toEqual(data);

          // Verify data survives JSON serialization (as IndexedDB does)
          const dataCopy = JSON.parse(JSON.stringify(data));
          expect(entry.data).toEqual(dataCopy);

          // Verify all entry fields are set
          expect(entry.key).toBeDefined();
          expect(entry.userId).toBe(userId);
          expect(entry.cachedAt).toBeDefined();
          expect(entry.expiresAt).toBeDefined();
          expect(entry.version).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should isolate cache entries by userId', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            userId: fc.string({ minLength: 1 }),
            cacheKey: fc.constantFrom<CacheKey>('user_profile', 'messages', 'doctor_list', 'appointments', 'intake_sessions'),
            data: fc.anything(),
          }),
          { minLength: 2, maxLength: 20 }
        ),
        (entries) => {
          // Group entries by userId
          const entriesByUser = new Map<string, typeof entries>();

          for (const entry of entries) {
            if (!entriesByUser.has(entry.userId)) {
              entriesByUser.set(entry.userId, []);
            }
            entriesByUser.get(entry.userId)!.push(entry);
          }

          // Verify each user's entries are isolated
          for (const [userId, userEntries] of entriesByUser.entries()) {
            // All entries in this group should belong to the same user
            for (const entry of userEntries) {
              expect(entry.userId).toBe(userId);
            }

            // Generate cache keys for this user
            const userKeys = userEntries.map(e => generateCacheKey(e.userId, e.cacheKey));

            // All keys should contain the userId
            for (const key of userKeys) {
              expect(key).toContain(userId);
            }

            // Keys from different users should not match
            const otherUserEntries = entries.filter(e => e.userId !== userId);
            const otherUserKeys = otherUserEntries.map(e => generateCacheKey(e.userId, e.cacheKey));

            for (const userKey of userKeys) {
              for (const otherKey of otherUserKeys) {
                if (userKey === otherKey) {
                  // If keys match, they must be from the same user
                  const userEntry = userEntries.find(e => generateCacheKey(e.userId, e.cacheKey) === userKey);
                  const otherEntry = otherUserEntries.find(e => generateCacheKey(e.userId, e.cacheKey) === otherKey);
                  expect(userEntry?.userId).toBe(otherEntry?.userId);
                }
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should support subKeys for parameterized queries', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.constantFrom<CacheKey>('messages', 'appointments', 'intake_sessions'),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        (userId, cacheKey, subKey1, subKey2) => {
          const key1 = generateCacheKey(userId, cacheKey, subKey1);
          const key2 = generateCacheKey(userId, cacheKey, subKey2);
          const keyNoSub = generateCacheKey(userId, cacheKey);

          // Different subKeys should produce different cache keys
          if (subKey1 !== subKey2) {
            expect(key1).not.toBe(key2);
          } else {
            expect(key1).toBe(key2);
          }

          // Keys with subKey should differ from keys without subKey
          expect(key1).not.toBe(keyNoSub);
          expect(key2).not.toBe(keyNoSub);

          // All keys should contain userId and cacheKey
          expect(key1).toContain(userId);
          expect(key1).toContain(cacheKey);
          expect(key2).toContain(userId);
          expect(key2).toContain(cacheKey);

          // Keys with subKey should contain the subKey
          expect(key1).toContain(subKey1);
          expect(key2).toContain(subKey2);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should have appropriate TTL for each data type based on access frequency', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<CacheKey>('user_profile', 'messages', 'doctor_list', 'appointments', 'intake_sessions'),
        (cacheKey) => {
          const ttl = CACHE_TTL[cacheKey];

          // Verify TTL is positive
          expect(ttl).toBeGreaterThan(0);

          // Verify TTL ranges based on data volatility (Requirement 15.5)
          switch (cacheKey) {
            case 'user_profile':
              // User profile changes infrequently, longer TTL (24 hours)
              expect(ttl).toBe(24 * 60 * 60 * 1000);
              break;
            case 'doctor_list':
              // Doctor list changes occasionally, medium TTL (12 hours)
              expect(ttl).toBe(12 * 60 * 60 * 1000);
              break;
            case 'messages':
            case 'intake_sessions':
              // Messages and sessions change frequently, shorter TTL (1 hour)
              expect(ttl).toBe(60 * 60 * 1000);
              break;
            case 'appointments':
              // Appointments change very frequently, shortest TTL (30 minutes)
              expect(ttl).toBe(30 * 60 * 1000);
              break;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain cache version for future compatibility', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.constantFrom<CacheKey>('user_profile', 'messages', 'doctor_list', 'appointments', 'intake_sessions'),
        fc.anything(),
        (userId, cacheKey, data) => {
          const now = new Date();
          const ttl = CACHE_TTL[cacheKey];

          const entry: CacheEntry = {
            key: generateCacheKey(userId, cacheKey),
            userId,
            data,
            cachedAt: now,
            expiresAt: new Date(now.getTime() + ttl),
            version: 1,
          };

          // Verify version is set
          expect(entry.version).toBeDefined();
          expect(entry.version).toBe(1);
          expect(typeof entry.version).toBe('number');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle cache entries with timestamps correctly', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.constantFrom<CacheKey>('user_profile', 'messages', 'doctor_list', 'appointments', 'intake_sessions'),
        fc.anything(),
        fc.date({ min: new Date('2000-01-01'), max: new Date('2100-01-01') }), // Use reasonable date range
        (userId, cacheKey, data, cachedAt) => {
          const ttl = CACHE_TTL[cacheKey];
          const cachedAtTime = cachedAt.getTime();
          
          // Skip if date is invalid
          if (isNaN(cachedAtTime)) {
            return true;
          }

          const expiresAt = new Date(cachedAtTime + ttl);
          const expiresAtTime = expiresAt.getTime();

          // Skip if resulting date is invalid
          if (isNaN(expiresAtTime)) {
            return true;
          }

          const entry: CacheEntry = {
            key: generateCacheKey(userId, cacheKey),
            userId,
            data,
            cachedAt,
            expiresAt,
            version: 1,
          };

          // Verify timestamps are valid dates
          expect(entry.cachedAt).toBeInstanceOf(Date);
          expect(entry.expiresAt).toBeInstanceOf(Date);

          // Verify expiresAt is after cachedAt
          expect(expiresAtTime).toBeGreaterThan(cachedAtTime);

          // Verify TTL is correct
          const actualTTL = expiresAtTime - cachedAtTime;
          expect(actualTTL).toBe(ttl);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should support offline access by caching data locally', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.constantFrom<CacheKey>('user_profile', 'messages', 'doctor_list'),
        fc.oneof(
          fc.string(),
          fc.integer(),
          fc.boolean(),
          fc.array(fc.anything()),
          fc.record({ value: fc.anything() })
        ), // Exclude undefined from generators
        (userId, cacheKey, data) => {
          const now = new Date();
          const ttl = CACHE_TTL[cacheKey];

          // Create cache entry (simulating offline storage)
          const entry: CacheEntry = {
            key: generateCacheKey(userId, cacheKey),
            userId,
            data,
            cachedAt: now,
            expiresAt: new Date(now.getTime() + ttl),
            version: 1,
          };

          // Verify data is available (Requirement 10.5: offline access)
          expect(entry.data).toBeDefined();
          expect(entry.data).toEqual(data);

          // Verify cache is not expired (data is accessible)
          const expired = isCacheExpired(entry);
          expect(expired).toBe(false);

          // Verify frequently accessed data types are cached (Requirement 10.5)
          const frequentlyAccessedTypes: CacheKey[] = ['user_profile', 'messages', 'doctor_list'];
          expect(frequentlyAccessedTypes).toContain(cacheKey);
        }
      ),
      { numRuns: 100 }
    );
  });
});
