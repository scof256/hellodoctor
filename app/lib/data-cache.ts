'use client';

/**
 * Data Caching System
 * 
 * Cache frequently accessed data for offline access and performance.
 * Requirements: 10.5, 15.5 - Cache user profile, messages, doctor list
 */

export type CacheKey = 'user_profile' | 'messages' | 'doctor_list' | 'appointments' | 'intake_sessions';

export interface CacheEntry<T = any> {
  key: string;
  userId: string;
  data: T;
  cachedAt: Date;
  expiresAt: Date;
  version: number;
}

const DB_NAME = 'HelloDoctorCache';
const DB_VERSION = 1;
const STORE_NAME = 'cache';

// Cache TTL (Time To Live) in milliseconds
const CACHE_TTL: Record<CacheKey, number> = {
  user_profile: 24 * 60 * 60 * 1000, // 24 hours
  messages: 60 * 60 * 1000, // 1 hour
  doctor_list: 12 * 60 * 60 * 1000, // 12 hours
  appointments: 30 * 60 * 1000, // 30 minutes
  intake_sessions: 60 * 60 * 1000, // 1 hour
};

/**
 * Initialize IndexedDB for caching
 */
function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not available'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('expiresAt', 'expiresAt', { unique: false });
        store.createIndex('cachedAt', 'cachedAt', { unique: false });
      }
    };
  });
}

/**
 * Generate cache key
 */
function generateCacheKey(userId: string, cacheKey: CacheKey, subKey?: string): string {
  return subKey ? `${userId}:${cacheKey}:${subKey}` : `${userId}:${cacheKey}`;
}

/**
 * Set data in cache
 */
export async function setCacheData<T>(
  userId: string,
  cacheKey: CacheKey,
  data: T,
  subKey?: string
): Promise<void> {
  const db = await initDB();
  
  const key = generateCacheKey(userId, cacheKey, subKey);
  const now = new Date();
  const ttl = CACHE_TTL[cacheKey];
  
  const entry: CacheEntry<T> = {
    key,
    userId,
    data,
    cachedAt: now,
    expiresAt: new Date(now.getTime() + ttl),
    version: 1,
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(entry);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get data from cache
 */
export async function getCacheData<T>(
  userId: string,
  cacheKey: CacheKey,
  subKey?: string
): Promise<T | null> {
  const db = await initDB();
  const key = generateCacheKey(userId, cacheKey, subKey);

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onsuccess = () => {
      const entry = request.result as CacheEntry<T> | undefined;
      
      if (!entry) {
        resolve(null);
        return;
      }

      // Check if cache is expired
      const now = new Date();
      const expiresAt = new Date(entry.expiresAt);
      
      if (now > expiresAt) {
        // Cache expired, delete it
        deleteCacheData(userId, cacheKey, subKey).catch(console.error);
        resolve(null);
        return;
      }

      resolve(entry.data);
    };
    
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete specific cache entry
 */
export async function deleteCacheData(
  userId: string,
  cacheKey: CacheKey,
  subKey?: string
): Promise<void> {
  const db = await initDB();
  const key = generateCacheKey(userId, cacheKey, subKey);

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear all cache for a user
 */
export async function clearUserCache(userId: string): Promise<void> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('userId');
    const request = index.openCursor(IDBKeyRange.only(userId));

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear expired cache entries
 */
export async function clearExpiredCache(): Promise<number> {
  const db = await initDB();
  const now = new Date();
  let deletedCount = 0;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('expiresAt');
    const request = index.openCursor(IDBKeyRange.upperBound(now));

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        deletedCount++;
        cursor.continue();
      } else {
        resolve(deletedCount);
      }
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Get cache statistics
 */
export async function getCacheStats(userId: string): Promise<{
  totalEntries: number;
  totalSize: number;
  oldestEntry: Date | null;
  newestEntry: Date | null;
}> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('userId');
    const request = index.getAll(userId);

    request.onsuccess = () => {
      const entries = request.result as CacheEntry[];
      
      if (entries.length === 0) {
        resolve({
          totalEntries: 0,
          totalSize: 0,
          oldestEntry: null,
          newestEntry: null,
        });
        return;
      }

      // Calculate total size (approximate)
      const totalSize = entries.reduce((sum, entry) => {
        return sum + JSON.stringify(entry.data).length;
      }, 0);

      // Find oldest and newest entries
      const dates = entries.map(e => new Date(e.cachedAt));
      const oldestEntry = new Date(Math.min(...dates.map(d => d.getTime())));
      const newestEntry = new Date(Math.max(...dates.map(d => d.getTime())));

      resolve({
        totalEntries: entries.length,
        totalSize,
        oldestEntry,
        newestEntry,
      });
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Check if cache exists and is valid
 */
export async function isCacheValid(
  userId: string,
  cacheKey: CacheKey,
  subKey?: string
): Promise<boolean> {
  const data = await getCacheData(userId, cacheKey, subKey);
  return data !== null;
}

/**
 * Prefetch and cache data
 * Useful for preloading data before it's needed
 */
export async function prefetchAndCache<T>(
  userId: string,
  cacheKey: CacheKey,
  fetchFn: () => Promise<T>,
  subKey?: string
): Promise<T> {
  // Check if valid cache exists
  const cachedData = await getCacheData<T>(userId, cacheKey, subKey);
  if (cachedData !== null) {
    return cachedData;
  }

  // Fetch fresh data
  const freshData = await fetchFn();
  
  // Store in cache
  await setCacheData(userId, cacheKey, freshData, subKey);
  
  return freshData;
}

/**
 * Invalidate cache by key pattern
 */
export async function invalidateCachePattern(
  userId: string,
  pattern: RegExp
): Promise<number> {
  const db = await initDB();
  let deletedCount = 0;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('userId');
    const request = index.openCursor(IDBKeyRange.only(userId));

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        const entry = cursor.value as CacheEntry;
        if (pattern.test(entry.key)) {
          cursor.delete();
          deletedCount++;
        }
        cursor.continue();
      } else {
        resolve(deletedCount);
      }
    };

    request.onerror = () => reject(request.error);
  });
}

