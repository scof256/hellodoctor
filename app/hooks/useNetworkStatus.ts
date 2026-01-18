'use client';

import { useState, useEffect, useCallback } from 'react';

export interface NetworkStatus {
  isOnline: boolean;
  wasOffline: boolean; // Track if we were offline and just came back
}

/**
 * Hook to detect network status using navigator.onLine and online/offline events.
 * Requirements: 7.2 - IF the network connection is lost, THEN THE Intake_Chatbot SHALL indicate offline status
 */
export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [wasOffline, setWasOffline] = useState<boolean>(false);

  const handleOnline = useCallback(() => {
    setIsOnline(true);
    // Mark that we just came back online (for retry logic)
    setWasOffline(true);
    // Reset wasOffline after a short delay
    setTimeout(() => setWasOffline(false), 5000);
  }, []);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
  }, []);

  useEffect(() => {
    // Set initial state
    if (typeof navigator !== 'undefined') {
      setIsOnline(navigator.onLine);
    }

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  return { isOnline, wasOffline };
}
