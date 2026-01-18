# Data Caching System

This document describes the IndexedDB-based caching system for offline access and performance optimization.

**Requirements**: 10.5, 15.5 - Cache user profile, messages, doctor list for offline access

## Overview

The caching system provides:
- **Persistent storage** using IndexedDB for offline access
- **Automatic cache management** with TTL (Time To Live)
- **Cache invalidation strategies** for data consistency
- **Integration with tRPC queries** for seamless usage
- **Background refresh** to keep cache fresh

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Application Layer                     │
│                  (React Components)                      │
└────────────────────┬────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
┌────────▼────────┐    ┌────────▼────────┐
│  useDataCache   │    │ useCachedQuery  │
│     Hook        │    │      Hook       │
└────────┬────────┘    └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │
         ┌───────────▼───────────┐
         │  Cache Integration    │
         │   (cache-integration) │
         └───────────┬───────────┘
                     │
         ┌───────────▼───────────┐
         │   IndexedDB Layer     │
         │    (data-cache)       │
         └───────────────────────┘
```

## Core Components

### 1. IndexedDB Layer (`app/lib/data-cache.ts`)

Low-level IndexedDB operations:
- `setCacheData()` - Store data in cache
- `getCacheData()` - Retrieve data from cache
- `deleteCacheData()` - Remove specific cache entry
- `clearUserCache()` - Clear all cache for a user
- `clearExpiredCache()` - Remove expired entries
- `getCacheStats()` - Get cache statistics

### 2. Cache Integration (`app/lib/cache-integration.ts`)

Integrates caching with tRPC queries:
- `cachedQuery()` - Wrapper for tRPC queries with caching
- `invalidateQueryCache()` - Invalidate specific query cache
- `prefetchQuery()` - Prefetch data for offline access
- `getCachedQueryData()` - Get cached data without fetching

### 3. Cache Invalidation (`app/lib/cache-invalidation.ts`)

Strategies for keeping cache fresh:
- `invalidateOnMutation()` - Invalidate cache after mutations
- `invalidateOnReconnection()` - Invalidate time-sensitive data on reconnect
- `warmCache()` - Prefetch important data for offline use
- `performCacheCleanup()` - Remove expired cache entries

### 4. React Hooks

#### `useDataCache` (`app/hooks/useDataCache.ts`)
Main hook for cached data access:
```typescript
const { data, isLoading, isCached, error, refetch, invalidate } = useDataCache({
  userId: 'user-123',
  cacheKey: 'user_profile',
  fetchFn: async () => api.user.getMe.fetch(),
  enabled: true,
});
```

#### `useCachedQuery` (`app/hooks/useCachedQuery.ts`)
Simplified hook for tRPC queries:
```typescript
const { data, isLoading, error, refetch } = useCachedQuery(
  userId,
  'user.getMe',
  () => api.user.getMe.fetch()
);
```

#### `useBackgroundCacheRefresh` (`app/hooks/useDataCache.ts`)
Automatic background refresh:
```typescript
useBackgroundCacheRefresh(
  userId,
  'messages',
  () => api.message.getConversations.fetch(),
  { interval: 5 * 60 * 1000 } // 5 minutes
);
```

## Cache Keys

The system supports these cache keys:

| Cache Key | TTL | Description |
|-----------|-----|-------------|
| `user_profile` | 24 hours | User profile data |
| `messages` | 1 hour | Message conversations |
| `doctor_list` | 12 hours | List of doctors/connections |
| `appointments` | 30 minutes | Appointment data |
| `intake_sessions` | 1 hour | Intake session data |

## Usage Examples

### Basic Caching

```typescript
import { useDataCache } from '@/app/hooks/useDataCache';

function UserProfile() {
  const { user } = useUser();
  
  const { data, isLoading, isCached } = useDataCache({
    userId: user?.id || '',
    cacheKey: 'user_profile',
    fetchFn: async () => api.user.getMe.fetch(),
    enabled: !!user?.id,
  });

  return (
    <div>
      {isCached && <span>📦 From Cache</span>}
      {data && <p>{data.name}</p>}
    </div>
  );
}
```

### Cache Invalidation on Mutation

```typescript
import { invalidateOnMutation } from '@/app/lib/cache-invalidation';

function SendMessage() {
  const { user } = useUser();
  
  const sendMessage = api.message.send.useMutation({
    onSuccess: async () => {
      // Invalidate message cache
      await invalidateOnMutation(user!.id, 'message.send');
    },
  });

  return <button onClick={() => sendMessage.mutate({ text: 'Hello' })}>Send</button>;
}
```

### Cache Warming for Offline Access

```typescript
import { warmCache } from '@/app/lib/cache-invalidation';

function AppInitializer() {
  const { user } = useUser();

  useEffect(() => {
    if (!user?.id) return;

    // Prefetch important data for offline access
    warmCache(user.id, {
      profile: () => api.user.getMe.fetch(),
      messages: () => api.message.getConversations.fetch(),
      doctors: () => api.connection.getMyConnections.fetch(),
    });
  }, [user?.id]);

  return null;
}
```

### Checking Offline Availability

```typescript
import { useHasCache } from '@/app/hooks/useCachedQuery';

function OfflineIndicator() {
  const { user } = useUser();
  const { hasCache: hasProfile } = useHasCache(user?.id, 'user.getMe');
  const { hasCache: hasMessages } = useHasCache(user?.id, 'message.getConversations');

  return (
    <div>
      <p>Available offline:</p>
      <ul>
        <li>{hasProfile ? '✓' : '✗'} Profile</li>
        <li>{hasMessages ? '✓' : '✗'} Messages</li>
      </ul>
    </div>
  );
}
```

## Cache Invalidation Strategy

### Automatic Invalidation

The system automatically invalidates cache based on mutations:

```typescript
// When sending a message
'message.send' → invalidates ['message.getConversations', 'message.getConversation']

// When creating an appointment
'appointment.create' → invalidates ['appointment.getMyAppointments', 'doctor.list']

// When updating profile
'user.updateProfile' → invalidates ['user.getMe', 'doctor.getProfile']
```

### Manual Invalidation

```typescript
import { invalidateMessageCache, invalidateProfileCache } from '@/app/lib/cache-invalidation';

// Invalidate all message cache
await invalidateMessageCache(userId);

// Invalidate profile cache
await invalidateProfileCache(userId);
```

### Reconnection Strategy

When the app comes back online, invalidate time-sensitive data:

```typescript
import { invalidateOnReconnection } from '@/app/lib/cache-invalidation';

window.addEventListener('online', async () => {
  await invalidateOnReconnection(userId);
});
```

## Cache Cleanup

### Automatic Cleanup

Expired cache entries are automatically removed:

```typescript
import { performCacheCleanup } from '@/app/lib/cache-invalidation';

// Run on app start
useEffect(() => {
  performCacheCleanup();
}, []);

// Or use the hook for automatic periodic cleanup
useAutoCacheCleanup(60 * 60 * 1000); // Every hour
```

### Manual Cleanup

```typescript
import { clearUserCache, clearExpiredCache } from '@/app/lib/data-cache';

// Clear all cache for a user (e.g., on logout)
await clearUserCache(userId);

// Clear only expired entries
const deletedCount = await clearExpiredCache();
```

## Cache Statistics

Monitor cache usage:

```typescript
import { getCacheStats } from '@/app/lib/data-cache';

const stats = await getCacheStats(userId);
console.log(`Total entries: ${stats.totalEntries}`);
console.log(`Total size: ${stats.totalSize} bytes`);
console.log(`Oldest entry: ${stats.oldestEntry}`);
console.log(`Newest entry: ${stats.newestEntry}`);
```

## Best Practices

1. **Always provide userId**: Caching requires a user ID for data isolation
2. **Use appropriate cache keys**: Choose the right cache key for your data type
3. **Invalidate on mutations**: Always invalidate affected cache after mutations
4. **Warm cache on login**: Prefetch important data for offline access
5. **Clean up on logout**: Clear user cache when user logs out
6. **Monitor cache size**: Periodically check cache statistics
7. **Handle cache errors**: Always wrap cache operations in try-catch
8. **Test offline scenarios**: Verify app works with cached data

## Performance Considerations

- **Cache TTL**: Shorter TTL = fresher data, more network requests
- **Cache size**: Monitor total cache size to avoid storage limits
- **Prefetching**: Balance between offline availability and network usage
- **Invalidation**: Be selective to avoid unnecessary refetches

## Browser Support

IndexedDB is supported in all modern browsers:
- Chrome 24+
- Firefox 16+
- Safari 10+
- Edge 12+

For older browsers, the system gracefully falls back to network-only mode.

## Troubleshooting

### Cache not working
- Check if IndexedDB is available: `window.indexedDB`
- Verify userId is provided
- Check browser console for errors

### Stale data
- Verify cache TTL is appropriate
- Check invalidation rules are correct
- Manually invalidate cache if needed

### Storage quota exceeded
- Run cache cleanup: `performCacheCleanup()`
- Reduce cache TTL values
- Clear old user caches

## Testing

See `__tests__/properties/local-data-caching.property.test.ts` for property-based tests.

Key test scenarios:
- Cache hit/miss behavior
- TTL expiration
- Invalidation correctness
- Offline data availability
- Cache size limits
