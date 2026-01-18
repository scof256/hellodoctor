/**
 * Cache Configuration Module
 * 
 * Defines differential stale times for different query types.
 * Provides cache configuration helpers for React Query.
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

export interface CacheConfig {
  staleTime: number;
  cacheTime: number;
  refetchOnWindowFocus: boolean;
}

/**
 * Cache configurations for different query types.
 * 
 * - availability: 5 minutes (changes infrequently)
 * - analytics: 30 minutes (aggregated data, expensive to compute)
 * - messages: 1 minute (real-time communication)
 * - appointments: 2 minutes (moderate update frequency)
 * - intake: 30 seconds (active session data)
 * - user: 10 minutes (profile data, rarely changes)
 * - default: 1 minute
 */
export const CACHE_CONFIGS: Record<string, CacheConfig> = {
  // Doctor availability - changes infrequently
  'doctor.availability': {
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  },
  'doctor.getAvailability': {
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  },
  'appointment.getAvailableSlots': {
    staleTime: 2 * 60 * 1000, // 2 minutes (slots can be booked)
    cacheTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  },
  
  // Analytics - expensive to compute, rarely changes
  'analytics': {
    staleTime: 30 * 60 * 1000, // 30 minutes
    cacheTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
  },
  'analytics.getDashboard': {
    staleTime: 30 * 60 * 1000,
    cacheTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  },
  'analytics.getPatientStats': {
    staleTime: 30 * 60 * 1000,
    cacheTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  },
  
  // Messages - real-time communication
  'message': {
    staleTime: 60 * 1000, // 1 minute
    cacheTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  },
  'message.getConversation': {
    staleTime: 30 * 1000, // 30 seconds
    cacheTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  },
  'message.getConversations': {
    staleTime: 60 * 1000,
    cacheTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  },
  'message.getUnreadCount': {
    staleTime: 30 * 1000, // 30 seconds
    cacheTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  },
  
  // Appointments - moderate update frequency
  'appointment': {
    staleTime: 2 * 60 * 1000, // 2 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: true,
  },
  'appointment.getMyAppointments': {
    staleTime: 2 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
  },
  'appointment.getById': {
    staleTime: 2 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  },
  
  // Intake sessions - active session data
  'intake': {
    staleTime: 30 * 1000, // 30 seconds
    cacheTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  },
  'intake.getSession': {
    staleTime: 30 * 1000,
    cacheTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  },
  'intake.getMyIntakeSessions': {
    staleTime: 60 * 1000,
    cacheTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  },
  'intake.getDoctorIntakeSessions': {
    staleTime: 60 * 1000,
    cacheTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  },
  
  // User/profile data - rarely changes
  'user': {
    staleTime: 10 * 60 * 1000, // 10 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
  },
  'user.me': {
    staleTime: 10 * 60 * 1000,
    cacheTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  },
  'doctor.getProfile': {
    staleTime: 10 * 60 * 1000,
    cacheTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  },
  'patient.getProfile': {
    staleTime: 10 * 60 * 1000,
    cacheTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  },
  
  // Connections - moderate frequency
  'connection': {
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 15 * 60 * 1000, // 15 minutes
    refetchOnWindowFocus: false,
  },
  'connection.getMyConnections': {
    staleTime: 5 * 60 * 1000,
    cacheTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  },
  
  // Dashboard - optimized for quick loading with reasonable freshness
  // Requirements: 4.4, 5.1, 5.2, 5.3, 8.4
  // Request deduplication: concurrent requests for same data are deduplicated by React Query
  // Cache hit on navigation: data served from cache when returning within stale time
  'dashboard': {
    staleTime: 30 * 1000, // 30 seconds - serves from cache on navigation return
    cacheTime: 60 * 1000, // 1 minute - keeps data in cache for deduplication
    refetchOnWindowFocus: true,
  },
  'dashboard.stats': {
    staleTime: 30 * 1000, // 30 seconds for patient/doctor stats
    cacheTime: 60 * 1000, // 1 minute
    refetchOnWindowFocus: false,
  },
  'dashboard.admin.stats': {
    staleTime: 60 * 1000, // 60 seconds for admin stats
    cacheTime: 120 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
  },
  'dashboard.getDoctorDashboard': {
    staleTime: 30 * 1000, // 30 seconds - enables cache hit on navigation return (Req 5.2)
    cacheTime: 60 * 1000, // 1 minute - keeps data for deduplication (Req 5.1, 5.3)
    refetchOnWindowFocus: true,
  },
  'dashboard.getPatientDashboard': {
    staleTime: 30 * 1000, // 30 seconds - enables cache hit on navigation return (Req 5.2)
    cacheTime: 60 * 1000, // 1 minute - keeps data for deduplication (Req 5.1, 5.3)
    refetchOnWindowFocus: true,
  },
  'dashboard.getAdminDashboard': {
    staleTime: 60 * 1000, // 60 seconds for admin - enables cache hit on navigation return (Req 5.2)
    cacheTime: 120 * 1000, // 2 minutes - keeps data for deduplication (Req 5.1, 5.3)
    refetchOnWindowFocus: false,
  },
  'dashboard.connections': {
    staleTime: 30 * 1000, // 30 seconds
    cacheTime: 60 * 1000, // 1 minute
    refetchOnWindowFocus: true,
  },
  'dashboard.appointments': {
    staleTime: 30 * 1000, // 30 seconds
    cacheTime: 60 * 1000, // 1 minute
    refetchOnWindowFocus: true,
  },
  
  // Notifications - real-time
  'notification': {
    staleTime: 30 * 1000, // 30 seconds
    cacheTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  },
  'notification.getUnreadCount': {
    staleTime: 30 * 1000,
    cacheTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  },
  
  // Default configuration
  'default': {
    staleTime: 60 * 1000, // 1 minute
    cacheTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  },
};

/**
 * Get cache configuration for a query key.
 * Matches against the most specific key first, then falls back to category, then default.
 * 
 * @param queryKey - The query key array from React Query
 * @returns The cache configuration for this query
 */
export function getCacheConfig(queryKey: readonly unknown[]): CacheConfig {
  // Build potential keys to match against
  const keyParts = queryKey.filter((part): part is string => typeof part === 'string');
  
  // Try exact match with 3 parts first (e.g., "dashboard.admin.stats")
  const threePartKey = keyParts.slice(0, 3).join('.');
  if (CACHE_CONFIGS[threePartKey]) {
    return CACHE_CONFIGS[threePartKey]!;
  }
  
  // Try exact match with 2 parts (e.g., "message.getConversation")
  const twoPartKey = keyParts.slice(0, 2).join('.');
  if (CACHE_CONFIGS[twoPartKey]) {
    return CACHE_CONFIGS[twoPartKey]!;
  }
  
  // Try category match (e.g., "message")
  const categoryKey = keyParts[0];
  if (categoryKey && CACHE_CONFIGS[categoryKey]) {
    return CACHE_CONFIGS[categoryKey]!;
  }
  
  // Fall back to default
  return CACHE_CONFIGS['default'] ?? {
    staleTime: 60 * 1000,
    cacheTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  };
}

/**
 * Get invalidation keys for a mutation.
 * Returns the query keys that should be invalidated when a mutation occurs.
 * This enables selective cache invalidation - only affected entries are invalidated.
 * 
 * @param mutationKey - The mutation key (e.g., "message.send")
 * @returns Array of query key prefixes to invalidate
 * 
 * Requirement 3.5: Selective cache invalidation
 */
export function getInvalidationKeys(mutationKey: string): string[][] {
  const invalidationMap: Record<string, string[][]> = {
    // Message mutations - only invalidate message-related queries
    'message.send': [['message', 'getConversation'], ['message', 'getConversations'], ['message', 'getUnreadCount']],
    'message.markAsRead': [['message', 'getUnreadCount'], ['message', 'getConversations']],
    
    // Appointment mutations - invalidate appointments and availability
    'appointment.create': [['appointment', 'getMyAppointments'], ['appointment', 'getAvailableSlots'], ['dashboard', 'getDoctorDashboard'], ['dashboard', 'getPatientDashboard']],
    'appointment.cancel': [['appointment', 'getMyAppointments'], ['appointment', 'getById'], ['appointment', 'getAvailableSlots'], ['dashboard', 'getDoctorDashboard'], ['dashboard', 'getPatientDashboard']],
    'appointment.reschedule': [['appointment', 'getMyAppointments'], ['appointment', 'getById'], ['appointment', 'getAvailableSlots'], ['dashboard', 'getDoctorDashboard'], ['dashboard', 'getPatientDashboard']],
    'appointment.markArrived': [['appointment', 'getMyAppointments'], ['appointment', 'getById'], ['dashboard', 'getDoctorDashboard']],
    'appointment.markCompleted': [['appointment', 'getMyAppointments'], ['appointment', 'getById'], ['analytics'], ['dashboard', 'getDoctorDashboard']],
    'appointment.markNoShow': [['appointment', 'getMyAppointments'], ['appointment', 'getById'], ['analytics'], ['dashboard', 'getDoctorDashboard']],
    
    // Intake mutations - only invalidate intake-related queries
    'intake.create': [['intake', 'getMyIntakeSessions'], ['intake', 'getDoctorIntakeSessions'], ['dashboard', 'getDoctorDashboard'], ['dashboard', 'getPatientDashboard']],
    'intake.sendMessage': [['intake', 'getSession'], ['intake', 'getDoctorIntakeSessions'], ['intake', 'getMyIntakeSessions']],
    'intake.markAsReviewed': [['intake', 'getSession'], ['intake', 'getDoctorIntakeSessions'], ['dashboard', 'getDoctorDashboard']],
    'intake.resetSession': [['intake', 'getSession'], ['intake', 'getMyIntakeSessions'], ['dashboard', 'getPatientDashboard']],
    'intake.regenerateResponse': [['intake', 'getSession'], ['intake', 'getMyIntakeSessions']],
    'intake.storeFileMetadata': [['intake', 'getSession']],
    
    // Connection mutations - invalidate connections and related queries
    'connection.create': [['connection', 'getMyConnections'], ['message', 'getConversations'], ['dashboard', 'getDoctorDashboard'], ['dashboard', 'getPatientDashboard']],
    'connection.disconnect': [['connection', 'getMyConnections'], ['message', 'getConversations'], ['dashboard', 'getDoctorDashboard'], ['dashboard', 'getPatientDashboard']],
    
    // Notification mutations - only invalidate notification queries
    'notification.markAsRead': [['notification', 'getUnreadCount'], ['notification', 'getMyNotifications']],
    'notification.markAllAsRead': [['notification', 'getUnreadCount'], ['notification', 'getMyNotifications']],
    
    // Doctor mutations - invalidate doctor-related queries
    'doctor.setAvailability': [['doctor', 'getAvailability'], ['appointment', 'getAvailableSlots']],
    'doctor.blockDate': [['doctor', 'getBlockedDates'], ['appointment', 'getAvailableSlots']],
    'doctor.unblockDate': [['doctor', 'getBlockedDates'], ['appointment', 'getAvailableSlots']],
    'doctor.updateProfile': [['doctor', 'getMyProfile'], ['doctor', 'getProfile'], ['doctor', 'getBySlug']],
    'doctor.regenerateQRCode': [['doctor', 'getQRCode'], ['doctor', 'getQRCodeDownload']],
    
    // Support ticket mutations
    'support.create': [['support', 'getMyTickets']],
    'support.respond': [['support', 'getTicketById'], ['support', 'getMyTickets'], ['support', 'getAllTickets']],
    'support.assignTicket': [['support', 'getTicketById'], ['support', 'getAllTickets']],
    'support.updateStatus': [['support', 'getTicketById'], ['support', 'getMyTickets'], ['support', 'getAllTickets']],
    
    // Admin mutations
    'admin.updateUserStatus': [['admin', 'getUsers'], ['admin', 'getUserById']],
    'admin.updateUserRole': [['admin', 'getUsers'], ['admin', 'getUserById']],
    'admin.verifyDoctor': [['admin', 'getDoctors'], ['doctor', 'getMyProfile']],
    'admin.updateConfigs': [['admin', 'getConfig']],
  };
  
  return invalidationMap[mutationKey] ?? [];
}

/**
 * Check if a query key matches an invalidation pattern.
 * Used for selective cache invalidation.
 * 
 * @param queryKey - The full query key to check
 * @param pattern - The invalidation pattern to match against
 * @returns True if the query key matches the pattern
 */
export function matchesInvalidationPattern(queryKey: readonly unknown[], pattern: string[]): boolean {
  // Pattern must be a prefix of the query key
  if (pattern.length > queryKey.length) {
    return false;
  }
  
  for (let i = 0; i < pattern.length; i++) {
    if (queryKey[i] !== pattern[i]) {
      return false;
    }
  }
  
  return true;
}

/**
 * Get all query keys that should NOT be invalidated for a mutation.
 * This is the inverse of getInvalidationKeys - useful for verifying selective invalidation.
 * 
 * @param mutationKey - The mutation key
 * @returns Array of query categories that should remain unchanged
 */
export function getPreservedCategories(mutationKey: string): string[] {
  const allCategories = ['message', 'appointment', 'intake', 'connection', 'notification', 'doctor', 'user', 'analytics', 'support', 'admin', 'dashboard'];
  const invalidationKeys = getInvalidationKeys(mutationKey);
  
  // Get categories that are being invalidated
  const invalidatedCategories = new Set<string>();
  for (const key of invalidationKeys) {
    if (key[0]) {
      invalidatedCategories.add(key[0]);
    }
  }
  
  // Return categories that are NOT being invalidated
  return allCategories.filter(cat => !invalidatedCategories.has(cat));
}
