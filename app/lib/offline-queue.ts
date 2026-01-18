'use client';

/**
 * Offline Action Queue
 * 
 * Generic queue for storing and retrying failed actions when offline.
 * Requirements: 10.2, 10.3 - Store failed actions in IndexedDB, implement retry logic with exponential backoff
 */

export type ActionType = 'message' | 'booking' | 'profile_update' | 'form_submission';

export interface OfflineAction {
  id: string;
  userId: string;
  type: ActionType;
  payload: any;
  createdAt: Date;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed' | 'completed';
  lastAttempt?: Date;
  error?: string;
}

const DB_NAME = 'HelloDoctorOfflineQueue';
const DB_VERSION = 1;
const STORE_NAME = 'actions';
const MAX_RETRIES = 5;

/**
 * Initialize IndexedDB
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
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

/**
 * Add an action to the offline queue
 */
export async function enqueueAction(action: Omit<OfflineAction, 'id' | 'createdAt' | 'retryCount' | 'status'>): Promise<string> {
  const db = await initDB();
  
  const fullAction: OfflineAction = {
    ...action,
    id: `action-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    createdAt: new Date(),
    retryCount: 0,
    status: 'pending',
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(fullAction);

    request.onsuccess = () => resolve(fullAction.id);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all pending actions for a user
 */
export async function getPendingActions(userId: string): Promise<OfflineAction[]> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('userId');
    const request = index.getAll(userId);

    request.onsuccess = () => {
      const actions = request.result as OfflineAction[];
      // Filter for pending or failed actions, convert dates
      const pending = actions
        .filter(a => a.status === 'pending' || a.status === 'failed')
        .map(a => ({
          ...a,
          createdAt: new Date(a.createdAt),
          lastAttempt: a.lastAttempt ? new Date(a.lastAttempt) : undefined,
        }))
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      resolve(pending);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Update an action's status
 */
export async function updateActionStatus(
  actionId: string,
  status: OfflineAction['status'],
  error?: string
): Promise<void> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const getRequest = store.get(actionId);

    getRequest.onsuccess = () => {
      const action = getRequest.result as OfflineAction;
      if (!action) {
        reject(new Error('Action not found'));
        return;
      }

      action.status = status;
      action.lastAttempt = new Date();
      if (error) {
        action.error = error;
      }

      const updateRequest = store.put(action);
      updateRequest.onsuccess = () => resolve();
      updateRequest.onerror = () => reject(updateRequest.error);
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

/**
 * Increment retry count for an action
 */
export async function incrementRetryCount(actionId: string): Promise<number> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const getRequest = store.get(actionId);

    getRequest.onsuccess = () => {
      const action = getRequest.result as OfflineAction;
      if (!action) {
        reject(new Error('Action not found'));
        return;
      }

      action.retryCount += 1;
      action.lastAttempt = new Date();

      const updateRequest = store.put(action);
      updateRequest.onsuccess = () => resolve(action.retryCount);
      updateRequest.onerror = () => reject(updateRequest.error);
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

/**
 * Delete an action from the queue
 */
export async function deleteAction(actionId: string): Promise<void> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(actionId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Calculate exponential backoff delay in milliseconds
 * Requirements: 10.3 - Exponential backoff (1s, 2s, 4s, 8s, 16s, max 30s)
 */
export function calculateBackoffDelay(retryCount: number): number {
  const baseDelay = 1000; // 1 second
  const maxDelay = 30000; // 30 seconds
  const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
  return delay;
}

/**
 * Retry an action with exponential backoff
 */
export async function retryAction(
  action: OfflineAction,
  executor: (payload: any) => Promise<void>
): Promise<boolean> {
  // Check if max retries reached
  if (action.retryCount >= MAX_RETRIES) {
    await updateActionStatus(action.id, 'failed', `Max retries (${MAX_RETRIES}) reached`);
    return false;
  }

  // Calculate backoff delay
  const delay = calculateBackoffDelay(action.retryCount);
  
  // Wait for backoff period
  await new Promise(resolve => setTimeout(resolve, delay));

  try {
    // Update status to syncing
    await updateActionStatus(action.id, 'syncing');
    
    // Increment retry count
    await incrementRetryCount(action.id);

    // Execute the action
    await executor(action.payload);

    // Mark as completed and delete from queue
    await updateActionStatus(action.id, 'completed');
    await deleteAction(action.id);

    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await updateActionStatus(action.id, 'failed', errorMessage);
    return false;
  }
}

/**
 * Process all pending actions for a user
 * Requirements: 10.3 - Auto-sync when connection restored
 */
export async function processPendingActions(
  userId: string,
  executors: Record<ActionType, (payload: any) => Promise<void>>
): Promise<{ succeeded: number; failed: number }> {
  const actions = await getPendingActions(userId);
  
  let succeeded = 0;
  let failed = 0;

  for (const action of actions) {
    const executor = executors[action.type];
    if (!executor) {
      console.warn(`No executor found for action type: ${action.type}`);
      failed++;
      continue;
    }

    const success = await retryAction(action, executor);
    if (success) {
      succeeded++;
    } else {
      failed++;
    }
  }

  return { succeeded, failed };
}

/**
 * Clear all completed actions
 */
export async function clearCompletedActions(): Promise<void> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('status');
    const request = index.openCursor(IDBKeyRange.only('completed'));

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
 * Get count of pending actions
 */
export async function getPendingActionCount(userId: string): Promise<number> {
  const actions = await getPendingActions(userId);
  return actions.length;
}
