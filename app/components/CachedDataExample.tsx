'use client';

/**
 * Example component demonstrating IndexedDB caching usage
 * 
 * This component shows how to:
 * 1. Use cached queries for offline access
 * 2. Check cache availability
 * 3. Invalidate cache on mutations
 * 4. Warm cache for offline use
 * 
 * Requirements: 10.5, 15.5 - Cache user profile, messages, doctor list
 */

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useDataCache } from '../hooks/useDataCache';
import { useHasCache } from '../hooks/useCachedQuery';
import { warmCache, performCacheCleanup, invalidateOnMutation } from '../lib/cache-invalidation';
import { api } from '@/trpc/react';

// Simple skeleton for profile loading
const ProfileSkeleton = () => (
  <div className="animate-pulse space-y-2">
    <div className="h-4 bg-slate-200 rounded w-32"></div>
    <div className="h-4 bg-slate-200 rounded w-48"></div>
  </div>
);

// Simple skeleton for messages loading
const MessagesSkeleton = () => (
  <div className="animate-pulse space-y-2">
    <div className="h-4 bg-slate-200 rounded w-40"></div>
  </div>
);

/**
 * Example: Cached User Profile
 */
export function CachedUserProfile() {
  const { user } = useUser();
  const userId = user?.id;

  // Note: In real usage, you would use tRPC's useQuery hook directly
  // This is just an example of how the cache system works
  const {
    data: profile,
    isLoading,
    isCached,
    error,
    refetch,
  } = useDataCache({
    userId: userId || '',
    cacheKey: 'user_profile',
    fetchFn: async () => {
      // Example fetch function - replace with actual API call
      const response = await fetch('/api/user/me');
      return response.json();
    },
    enabled: !!userId,
  });

  // Check if data is available offline
  const { hasCache } = useHasCache(userId, 'user.getMe');

  return (
    <div>
      <div className="flex items-center gap-2">
        <h2>User Profile</h2>
        {isCached && <span className="text-xs text-green-600">📦 Cached</span>}
        {hasCache && <span className="text-xs text-blue-600">💾 Available Offline</span>}
      </div>
      
      {isLoading && <ProfileSkeleton />}
      {error && <p className="text-red-600">Error: {error.message}</p>}
      {profile && (
        <div>
          <p>Name: {profile.name}</p>
          <p>Email: {profile.email}</p>
        </div>
      )}
      
      <button onClick={refetch} className="mt-2 px-4 py-2 bg-blue-500 text-white rounded">
        Refresh
      </button>
    </div>
  );
}

/**
 * Example: Cached Messages with Invalidation
 */
export function CachedMessages() {
  const { user } = useUser();
  const userId = user?.id;

  const {
    data: conversations,
    isLoading,
    isCached,
    refetch,
  } = useDataCache({
    userId: userId || '',
    cacheKey: 'messages',
    fetchFn: async () => {
      // Example fetch function - replace with actual API call
      const response = await fetch('/api/messages/conversations');
      return response.json();
    },
    enabled: !!userId,
  });

  // Example: Invalidate cache after sending a message
  const sendMessage = api.message.send.useMutation({
    onSuccess: async () => {
      if (userId) {
        // Invalidate message cache
        await invalidateOnMutation(userId, 'message.send');
        // Refetch to get fresh data
        await refetch();
      }
    },
  });

  return (
    <div>
      <div className="flex items-center gap-2">
        <h2>Messages</h2>
        {isCached && <span className="text-xs text-green-600">📦 From Cache</span>}
      </div>
      
      {isLoading && <MessagesSkeleton />}
      {conversations && (
        <div>
          <p>Total conversations: {conversations.length}</p>
          {/* Render conversations */}
        </div>
      )}
    </div>
  );
}

/**
 * Example: Cache Warming on App Start
 */
export function CacheWarmer() {
  const { user } = useUser();
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;

    // Warm cache with important data for offline access
    warmCache(userId, {
      profile: async () => {
        const response = await fetch('/api/user/me');
        return response.json();
      },
      messages: async () => {
        const response = await fetch('/api/messages/conversations');
        return response.json();
      },
      doctors: async () => {
        const response = await fetch('/api/connections');
        return response.json();
      },
      appointments: async () => {
        const response = await fetch('/api/appointments?limit=10');
        return response.json();
      },
    }).catch(error => {
      console.error('Cache warming failed:', error);
    });

    // Perform cache cleanup on mount
    performCacheCleanup();
  }, [userId]);

  return null; // This is a utility component, no UI
}

/**
 * Example: Offline Indicator with Cache Status
 */
export function OfflineIndicatorWithCache() {
  const { user } = useUser();
  const userId = user?.id;
  const [isOnline, setIsOnline] = useState(true);

  // Check what data is available offline
  const { hasCache: hasProfile } = useHasCache(userId, 'user.getMe');
  const { hasCache: hasMessages } = useHasCache(userId, 'message.getConversations');
  const { hasCache: hasDoctors } = useHasCache(userId, 'connection.getMyConnections');

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="bg-yellow-100 border-l-4 border-yellow-500 p-4">
      <p className="font-bold">You're offline</p>
      <p className="text-sm">Available offline:</p>
      <ul className="text-sm mt-2">
        <li>{hasProfile ? '✓' : '✗'} Your profile</li>
        <li>{hasMessages ? '✓' : '✗'} Recent messages</li>
        <li>{hasDoctors ? '✓' : '✗'} Doctor list</li>
      </ul>
    </div>
  );
}
