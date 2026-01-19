'use client';

import { useState, useEffect } from 'react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

/**
 * OfflineBanner Component
 * 
 * Displays a yellow banner at the top of the screen when offline.
 * Requirements: 10.1 - WHEN the System detects no internet connection 
 * THEN the System SHALL display a yellow banner "No internet - will sync when connected"
 */
export function OfflineBanner() {
  const { isOnline, wasOffline } = useNetworkStatus();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render anything until mounted to avoid hydration mismatch
  if (!mounted) {
    return null;
  }

  // Show syncing message briefly when coming back online
  if (wasOffline && isOnline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-green-500 text-white px-4 py-3 text-center font-medium">
        <span className="mr-2">⏳</span>
        Syncing your changes...
      </div>
    );
  }

  // Show offline banner when offline
  if (!isOnline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-white px-4 py-3 text-center font-medium">
        <span className="mr-2">📡</span>
        No internet - will sync when connected
      </div>
    );
  }

  return null;
}
