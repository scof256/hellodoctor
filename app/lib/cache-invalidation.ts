'use client';

/**
 * Cache Invalidation Strategy
 * 
 * Defines when and how to invalidate cached data.
 * Requirements: 10.5, 15.5 - Implement cache invalidation strategy
 */

import { useEffect } from 'react';
import { invalidateCachePattern, clearUserCache, clearExpiredCache } from './data-cache';
import { invalidateQueryCache } from './cache-integration';

/**
 * Invalidation rules for mutations
 * Maps mutation types to the queries they should invalidate
 */
const INVALIDATION_RULES: Record<string, string[]> = {
  // User profile mutations
  'user.updateProfile': ['user.getMe', 'user.me', 'doctor.getProfile', 'patient.getProfile'],
  'user.updateSettings': ['user.getMe', 'user.me'],
  
  // Message mutations
  'message.send': ['message.getConversations', 'message.getConversation'],
  'message.markAsRead': ['message.getConversations', 'message.getConversation'],
  'message.delete': ['message.getConversations', 'message.getConversation'],
  
  // Appointment mutations
  'appointment.create': ['appointment.getMyAppointments', 'doctor.list', 'connection.getMyConnections'],
  'appointment.update': ['appointment.getMyAppointments', 'appointment.getById'],
  'appointment.cancel': ['appointment.getMyAppointments', 'appointment.getById'],
  'appointment.complete': ['appointment.getMyAppointments', 'appointment.getById'],
  
  // Intake mutations
  'intake.createSession': ['intake.getMyIntakeSessions', 'intake.getDoctorIntakeSessions'],
  'intake.updateSession': ['intake.getMyIntakeSessions', 'intake.getSession', 'intake.getDoctorIntakeSessions'],
  'intake.completeSession': ['intake.getMyIntakeSessions', 'intake.getSession', 'intake.getDoctorIntakeSessions'],
  
  // Connection mutations
  'connection.create': ['connection.getMyConnections', 'doctor.list'],
  'connection.update': ['connection.getMyConnections'],
  'connection.delete': ['connection.getMyConnections', 'doctor.list'],
};

/**
 * Invalidate cache based on mutation type
 * 
 * @param userId - Current user ID
 * @param mutationType - Type of mutation (e.g., 'message.send')
 * @param params - Mutation parameters (for targeted invalidation)
 */
export async function invalidateOnMutation(
  userId: string,
  mutationType: string,
  params?: Record<string, any>
): Promise<void> {
  const queriesToInvalidate = INVALIDATION_RULES[mutationType] || [];

  // Invalidate each affected query
  for (const queryPath of queriesToInvalidate) {
    try {
      // For parameterized queries, invalidate specific cache entries
      if (params && (queryPath.includes('getConversation') || queryPath.includes('getById'))) {
        await invalidateQueryCache(userId, queryPath, params);
      } else {
        // For list queries, invalidate all entries
        await invalidateQueryCache(userId, queryPath);
      }
    } catch (error) {
      console.error(`Failed to invalidate cache for ${queryPath}:`, error);
    }
  }
}

/**
 * Invalidate all message-related cache
 * Useful when receiving new messages or after reconnection
 */
export async function invalidateMessageCache(userId: string): Promise<void> {
  await invalidateCachePattern(userId, /messages/);
}

/**
 * Invalidate all appointment-related cache
 * Useful after booking or canceling appointments
 */
export async function invalidateAppointmentCache(userId: string): Promise<void> {
  await invalidateCachePattern(userId, /appointments/);
}

/**
 * Invalidate user profile cache
 * Useful after profile updates
 */
export async function invalidateProfileCache(userId: string): Promise<void> {
  await invalidateCachePattern(userId, /user_profile/);
}

/**
 * Clear all cache for a user
 * Useful on logout or when switching users
 */
export async function clearAllUserCache(userId: string): Promise<void> {
  await clearUserCache(userId);
}

/**
 * Periodic cache cleanup
 * Removes expired cache entries to free up storage
 * Should be called periodically (e.g., on app start or every hour)
 */
export async function performCacheCleanup(): Promise<number> {
  try {
    const deletedCount = await clearExpiredCache();
    console.log(`Cache cleanup: removed ${deletedCount} expired entries`);
    return deletedCount;
  } catch (error) {
    console.error('Cache cleanup failed:', error);
    return 0;
  }
}

/**
 * Hook for automatic cache cleanup
 * Runs cleanup on mount and periodically
 */
export function useAutoCacheCleanup(intervalMs: number = 60 * 60 * 1000): void {
  if (typeof window === 'undefined') return;

  useEffect(() => {
    // Run cleanup on mount
    performCacheCleanup();

    // Set up periodic cleanup
    const intervalId = setInterval(performCacheCleanup, intervalMs);

    // Cleanup on unmount
    return () => clearInterval(intervalId);
  }, [intervalMs]);
}

/**
 * Strategy for cache invalidation on network reconnection
 * Invalidates time-sensitive data when coming back online
 */
export async function invalidateOnReconnection(userId: string): Promise<void> {
  // Invalidate time-sensitive data
  await Promise.all([
    invalidateMessageCache(userId),
    invalidateAppointmentCache(userId),
    // Profile data is less time-sensitive, keep it cached
  ]);
}

/**
 * Strategy for cache warming
 * Prefetch and cache important data for offline access
 */
export async function warmCache(
  userId: string,
  fetchFunctions: {
    profile?: () => Promise<any>;
    messages?: () => Promise<any>;
    doctors?: () => Promise<any>;
    appointments?: () => Promise<any>;
  }
): Promise<void> {
  const { prefetchQuery } = await import('./cache-integration');

  const prefetchPromises: Promise<void>[] = [];

  if (fetchFunctions.profile) {
    prefetchPromises.push(
      prefetchQuery(userId, 'user.getMe', fetchFunctions.profile)
    );
  }

  if (fetchFunctions.messages) {
    prefetchPromises.push(
      prefetchQuery(userId, 'message.getConversations', fetchFunctions.messages)
    );
  }

  if (fetchFunctions.doctors) {
    prefetchPromises.push(
      prefetchQuery(userId, 'connection.getMyConnections', fetchFunctions.doctors)
    );
  }

  if (fetchFunctions.appointments) {
    prefetchPromises.push(
      prefetchQuery(userId, 'appointment.getMyAppointments', fetchFunctions.appointments)
    );
  }

  await Promise.allSettled(prefetchPromises);
}
