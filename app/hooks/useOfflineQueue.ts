'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNetworkStatus } from './useNetworkStatus';
import {
  enqueueAction,
  getPendingActions,
  processPendingActions,
  getPendingActionCount,
  type ActionType,
  type OfflineAction,
} from '../lib/offline-queue';

interface UseOfflineQueueConfig {
  userId: string;
  executors: Record<ActionType, (payload: any) => Promise<void>>;
  onSyncComplete?: (succeeded: number, failed: number) => void;
}

/**
 * Hook for managing offline action queue
 * 
 * Requirements: 10.2, 10.3 - Store failed actions, auto-sync when connection restored
 */
export function useOfflineQueue(config: UseOfflineQueueConfig) {
  const { userId, executors, onSyncComplete } = config;
  const { isOnline, wasOffline } = useNetworkStatus();
  
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<{ succeeded: number; failed: number } | null>(null);
  
  const isSyncingRef = useRef(false);

  // Load pending count on mount and when userId changes
  useEffect(() => {
    if (!userId) return;

    const loadCount = async () => {
      try {
        const count = await getPendingActionCount(userId);
        setPendingCount(count);
      } catch (error) {
        console.error('Failed to load pending action count:', error);
      }
    };

    loadCount();
  }, [userId]);

  // Auto-sync when connection is restored
  useEffect(() => {
    if (!userId || !wasOffline || !isOnline || isSyncingRef.current) return;

    const syncActions = async () => {
      if (isSyncingRef.current) return;
      
      isSyncingRef.current = true;
      setIsSyncing(true);

      try {
        const result = await processPendingActions(userId, executors);
        setLastSyncResult(result);
        
        // Update pending count
        const count = await getPendingActionCount(userId);
        setPendingCount(count);

        if (onSyncComplete) {
          onSyncComplete(result.succeeded, result.failed);
        }
      } catch (error) {
        console.error('Failed to sync pending actions:', error);
      } finally {
        setIsSyncing(false);
        isSyncingRef.current = false;
      }
    };

    syncActions();
  }, [userId, wasOffline, isOnline, executors, onSyncComplete]);

  // Add an action to the queue
  const addAction = useCallback(async (
    type: ActionType,
    payload: any
  ): Promise<string> => {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const actionId = await enqueueAction({
      userId,
      type,
      payload,
    });

    // Update pending count
    const count = await getPendingActionCount(userId);
    setPendingCount(count);

    return actionId;
  }, [userId]);

  // Manually trigger sync
  const syncNow = useCallback(async () => {
    if (!userId || isSyncingRef.current) return;

    isSyncingRef.current = true;
    setIsSyncing(true);

    try {
      const result = await processPendingActions(userId, executors);
      setLastSyncResult(result);
      
      // Update pending count
      const count = await getPendingActionCount(userId);
      setPendingCount(count);

      if (onSyncComplete) {
        onSyncComplete(result.succeeded, result.failed);
      }

      return result;
    } catch (error) {
      console.error('Failed to sync pending actions:', error);
      throw error;
    } finally {
      setIsSyncing(false);
      isSyncingRef.current = false;
    }
  }, [userId, executors, onSyncComplete]);

  // Get all pending actions
  const getPending = useCallback(async (): Promise<OfflineAction[]> => {
    if (!userId) return [];
    return getPendingActions(userId);
  }, [userId]);

  return {
    pendingCount,
    isSyncing,
    lastSyncResult,
    addAction,
    syncNow,
    getPending,
    hasPending: pendingCount > 0,
  };
}
