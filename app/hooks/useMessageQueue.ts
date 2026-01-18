'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { MessageWithStatus, PendingMessage, FailedMessage, Message } from '@/types';

interface MessageQueueConfig {
  maxRetries?: number;
  sessionId?: string; // Session ID for localStorage key
  autoRetryOnReconnect?: boolean; // Whether to auto-retry failed messages on network reconnection
  onSend: (message: PendingMessage) => Promise<{
    userMessage: Message;
    aiMessage: Message | null;
  }>;
  onRetryExhausted?: (message: FailedMessage) => void;
}

// Local storage schema for persisted messages
interface PersistedMessageQueue {
  sessionId: string;
  pendingMessages: PendingMessage[];
  failedMessages: FailedMessage[];
  lastUpdated: string;
}

// Storage key prefix for message queue persistence
const STORAGE_KEY_PREFIX = 'intake_message_queue_';

/**
 * Get the localStorage key for a session
 */
function getStorageKey(sessionId: string): string {
  return `${STORAGE_KEY_PREFIX}${sessionId}`;
}

/**
 * Save pending and failed messages to localStorage
 * Requirements: 5.4 - Persist pending messages to local storage
 */
function persistToStorage(
  sessionId: string,
  pendingMessages: Map<string, PendingMessage>,
  failedMessages: Map<string, FailedMessage>
): void {
  if (typeof window === 'undefined') return;
  
  try {
    const data: PersistedMessageQueue = {
      sessionId,
      pendingMessages: Array.from(pendingMessages.values()),
      failedMessages: Array.from(failedMessages.values()),
      lastUpdated: new Date().toISOString(),
    };
    localStorage.setItem(getStorageKey(sessionId), JSON.stringify(data));
  } catch (error) {
    console.warn('Failed to persist message queue to localStorage:', error);
  }
}

/**
 * Load persisted messages from localStorage
 * Requirements: 5.4 - Restore pending messages on hook initialization
 */
function loadFromStorage(sessionId: string): PersistedMessageQueue | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem(getStorageKey(sessionId));
    if (!stored) return null;
    
    const data = JSON.parse(stored) as PersistedMessageQueue;
    // Restore Date objects from ISO strings
    data.pendingMessages = data.pendingMessages.map(m => ({
      ...m,
      timestamp: new Date(m.timestamp),
    }));
    data.failedMessages = data.failedMessages.map(m => ({
      ...m,
      timestamp: new Date(m.timestamp),
      lastAttempt: new Date(m.lastAttempt),
    }));
    return data;
  } catch (error) {
    console.warn('Failed to load message queue from localStorage:', error);
    return null;
  }
}

/**
 * Clear persisted messages from localStorage
 * Requirements: 5.4 - Clear persisted messages when sent successfully
 */
function clearFromStorage(sessionId: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(getStorageKey(sessionId));
  } catch (error) {
    console.warn('Failed to clear message queue from localStorage:', error);
  }
}

/**
 * Hook for managing message queue with optimistic updates and retry functionality
 * Requirements: 2.1, 3.3, 3.4, 3.5, 5.4
 */
export function useMessageQueue(config: MessageQueueConfig) {
  const { maxRetries = 3, sessionId = 'default', autoRetryOnReconnect = true, onSend, onRetryExhausted } = config;
  
  const [messages, setMessages] = useState<MessageWithStatus[]>([]);
  const [pendingMessages, setPendingMessages] = useState<Map<string, PendingMessage>>(new Map());
  const [failedMessages, setFailedMessages] = useState<Map<string, FailedMessage>>(new Map());
  const [isProcessing, setIsProcessing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const processingRef = useRef(false);
  const queueRef = useRef<PendingMessage[]>([]);
  const sessionIdRef = useRef(sessionId);
  
  // Update sessionId ref when it changes
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);
  
  // Restore pending messages from localStorage on initialization
  // Requirements: 5.4 - Restore pending messages on hook initialization
  useEffect(() => {
    if (isInitialized || !sessionId) return;
    
    const persisted = loadFromStorage(sessionId);
    if (persisted) {
      // Restore pending messages
      if (persisted.pendingMessages.length > 0) {
        const pendingMap = new Map<string, PendingMessage>();
        const optimisticMessages: MessageWithStatus[] = [];
        
        for (const msg of persisted.pendingMessages) {
          pendingMap.set(msg.tempId, msg);
          optimisticMessages.push({
            id: msg.tempId,
            tempId: msg.tempId,
            role: 'user',
            text: msg.content,
            images: msg.images,
            timestamp: msg.timestamp,
            status: 'sending',
            retryCount: msg.retryCount,
          });
          // Add to processing queue
          queueRef.current.push(msg);
        }
        
        setPendingMessages(pendingMap);
        setMessages(prev => [...prev, ...optimisticMessages]);
      }
      
      // Restore failed messages
      if (persisted.failedMessages.length > 0) {
        const failedMap = new Map<string, FailedMessage>();
        const failedOptimisticMessages: MessageWithStatus[] = [];
        
        for (const msg of persisted.failedMessages) {
          failedMap.set(msg.tempId, msg);
          failedOptimisticMessages.push({
            id: msg.tempId,
            tempId: msg.tempId,
            role: 'user',
            text: msg.content,
            images: msg.images,
            timestamp: msg.timestamp,
            status: 'failed',
            error: msg.error,
            retryCount: msg.retryCount,
          });
        }
        
        setFailedMessages(failedMap);
        setMessages(prev => [...prev, ...failedOptimisticMessages]);
      }
    }
    
    setIsInitialized(true);
  }, [sessionId, isInitialized]);
  
  // Persist to localStorage whenever pending or failed messages change
  // Requirements: 5.4 - Save pending messages to localStorage on queue changes
  useEffect(() => {
    if (!isInitialized || !sessionId) return;
    
    // Only persist if there are messages to persist
    if (pendingMessages.size > 0 || failedMessages.size > 0) {
      persistToStorage(sessionId, pendingMessages, failedMessages);
    } else {
      // Clear storage when all messages are sent successfully
      clearFromStorage(sessionId);
    }
  }, [pendingMessages, failedMessages, sessionId, isInitialized]);
  
  // Store retryAllFailed in a ref so we can use it in the effect without causing re-renders
  const retryAllFailedRef = useRef<() => void>(() => {});
  
  // Auto-retry failed messages when network reconnects
  // Requirements: 3.4, 5.3 - Automatically retry all failed messages when reconnecting
  useEffect(() => {
    if (!autoRetryOnReconnect || typeof window === 'undefined') return;
    
    const handleOnline = () => {
      // Only retry if there are failed messages and we're initialized
      if (failedMessages.size > 0 && isInitialized) {
        console.log('Network reconnected, retrying failed messages...');
        retryAllFailedRef.current();
      }
    };
    
    window.addEventListener('online', handleOnline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [autoRetryOnReconnect, failedMessages.size, isInitialized]);

  // Generate a temporary ID for optimistic updates
  const generateTempId = useCallback(() => {
    return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }, []);

  // Add a message to the queue and display it optimistically
  const enqueue = useCallback((content: string, images?: string[]) => {
    const tempId = generateTempId();
    const timestamp = new Date();
    
    const pendingMessage: PendingMessage = {
      tempId,
      content,
      images,
      timestamp,
      retryCount: 0,
    };

    // Add to pending messages
    setPendingMessages(prev => new Map(prev).set(tempId, pendingMessage));
    
    // Add optimistic message to UI immediately
    const optimisticMessage: MessageWithStatus = {
      id: tempId,
      tempId,
      role: 'user',
      text: content,
      images,
      timestamp,
      status: 'sending',
      retryCount: 0,
    };
    
    setMessages(prev => [...prev, optimisticMessage]);
    
    // Add to processing queue
    queueRef.current.push(pendingMessage);
    
    // Start processing if not already
    processQueue();
    
    return tempId;
  }, [generateTempId]);

  // Process the next message in the queue
  const processQueue = useCallback(async () => {
    if (processingRef.current || queueRef.current.length === 0) {
      return;
    }
    
    processingRef.current = true;
    setIsProcessing(true);
    
    const message = queueRef.current.shift();
    if (!message) {
      processingRef.current = false;
      setIsProcessing(false);
      return;
    }
    
    try {
      const result = await onSend(message);
      
      // Update the optimistic message with the real data
      setMessages(prev => {
        const newMessages = prev.map(m => {
          if (m.tempId === message.tempId) {
            return {
              ...m,
              id: result.userMessage.id,
              status: 'sent' as const,
              error: undefined,
            };
          }
          return m;
        });
        
        // Add AI response if present
        if (result.aiMessage) {
          newMessages.push({
            ...result.aiMessage,
            status: 'sent' as const,
          });
        }
        
        return newMessages;
      });
      
      // Remove from pending
      setPendingMessages(prev => {
        const next = new Map(prev);
        next.delete(message.tempId);
        return next;
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      
      // Mark message as failed
      setMessages(prev => prev.map(m => {
        if (m.tempId === message.tempId) {
          return {
            ...m,
            status: 'failed' as const,
            error: errorMessage,
          };
        }
        return m;
      }));
      
      // Add to failed messages
      const failedMessage: FailedMessage = {
        ...message,
        error: errorMessage,
        lastAttempt: new Date(),
      };
      
      setFailedMessages(prev => new Map(prev).set(message.tempId, failedMessage));
      
      // Remove from pending
      setPendingMessages(prev => {
        const next = new Map(prev);
        next.delete(message.tempId);
        return next;
      });
    }
    
    processingRef.current = false;
    setIsProcessing(false);
    
    // Process next message if any
    if (queueRef.current.length > 0) {
      processQueue();
    }
  }, [onSend]);

  // Retry a failed message
  // Requirements: 3.3 - Limit retry attempts to 3 per message
  const retry = useCallback(async (tempId: string) => {
    const failedMessage = failedMessages.get(tempId);
    if (!failedMessage) {
      return false;
    }
    
    // Check if max retries reached
    // Requirements: 3.3 - Update message status to 'permanently_failed' when limit reached
    if (failedMessage.retryCount >= maxRetries) {
      console.warn(`Max retries (${maxRetries}) reached for message ${tempId}`);
      
      // Update message status to permanently_failed
      setMessages(prev => prev.map(m => {
        if (m.tempId === tempId) {
          return {
            ...m,
            status: 'permanently_failed' as const,
            error: `Max retries (${maxRetries}) reached`,
          };
        }
        return m;
      }));
      
      // Call onRetryExhausted callback if provided
      if (onRetryExhausted) {
        onRetryExhausted(failedMessage);
      }
      
      return false;
    }
    
    // Remove from failed messages
    setFailedMessages(prev => {
      const next = new Map(prev);
      next.delete(tempId);
      return next;
    });
    
    // Update message status to sending
    setMessages(prev => prev.map(m => {
      if (m.tempId === tempId) {
        return {
          ...m,
          status: 'sending' as const,
          error: undefined,
          retryCount: (m.retryCount || 0) + 1,
        };
      }
      return m;
    }));
    
    // Re-add to pending and queue
    const retryMessage: PendingMessage = {
      ...failedMessage,
      retryCount: failedMessage.retryCount + 1,
    };
    
    setPendingMessages(prev => new Map(prev).set(tempId, retryMessage));
    queueRef.current.push(retryMessage);
    
    // Start processing
    processQueue();
    
    return true;
  }, [failedMessages, maxRetries, processQueue, onRetryExhausted]);
  
  // Retry all failed messages in order
  // Requirements: 3.4, 5.3 - Auto-retry failed messages when network reconnects, maintaining order
  const retryAllFailed = useCallback(async () => {
    // Get failed messages sorted by timestamp to maintain original order
    const sortedFailed = Array.from(failedMessages.values())
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    // Retry each message in order
    for (const failedMessage of sortedFailed) {
      // Skip if max retries already reached
      if (failedMessage.retryCount >= maxRetries) {
        // Mark as permanently failed
        setMessages(prev => prev.map(m => {
          if (m.tempId === failedMessage.tempId) {
            return {
              ...m,
              status: 'permanently_failed' as const,
              error: `Max retries (${maxRetries}) reached`,
            };
          }
          return m;
        }));
        
        if (onRetryExhausted) {
          onRetryExhausted(failedMessage);
        }
        continue;
      }
      
      // Remove from failed messages
      setFailedMessages(prev => {
        const next = new Map(prev);
        next.delete(failedMessage.tempId);
        return next;
      });
      
      // Update message status to sending
      setMessages(prev => prev.map(m => {
        if (m.tempId === failedMessage.tempId) {
          return {
            ...m,
            status: 'sending' as const,
            error: undefined,
            retryCount: (m.retryCount || 0) + 1,
          };
        }
        return m;
      }));
      
      // Re-add to pending and queue
      const retryMessage: PendingMessage = {
        ...failedMessage,
        retryCount: failedMessage.retryCount + 1,
      };
      
      setPendingMessages(prev => new Map(prev).set(failedMessage.tempId, retryMessage));
      queueRef.current.push(retryMessage);
    }
    
    // Start processing if not already
    processQueue();
  }, [failedMessages, maxRetries, processQueue, onRetryExhausted]);
  
  // Check if a message has reached max retries
  const hasReachedMaxRetries = useCallback((tempId: string): boolean => {
    const failedMessage = failedMessages.get(tempId);
    if (!failedMessage) {
      // Check in messages array for permanently_failed status
      const message = messages.find(m => m.tempId === tempId);
      return message?.status === 'permanently_failed';
    }
    return failedMessage.retryCount >= maxRetries;
  }, [failedMessages, messages, maxRetries]);
  
  // Update the ref whenever retryAllFailed changes
  useEffect(() => {
    retryAllFailedRef.current = retryAllFailed;
  }, [retryAllFailed]);

  // Get all pending messages
  const getPending = useCallback(() => {
    return Array.from(pendingMessages.values());
  }, [pendingMessages]);

  // Get all failed messages
  const getFailed = useCallback(() => {
    return Array.from(failedMessages.values());
  }, [failedMessages]);

  // Clear all messages and queues
  const clear = useCallback(() => {
    setMessages([]);
    setPendingMessages(new Map());
    setFailedMessages(new Map());
    queueRef.current = [];
  }, []);

  // Initialize messages from server data
  const initializeMessages = useCallback((serverMessages: Message[]) => {
    const messagesWithStatus: MessageWithStatus[] = serverMessages.map(m => ({
      ...m,
      status: 'sent' as const,
    }));
    setMessages(messagesWithStatus);
  }, []);

  // Add a message directly (for AI responses received separately)
  const addMessage = useCallback((message: Message) => {
    const messageWithStatus: MessageWithStatus = {
      ...message,
      status: 'sent',
    };
    setMessages(prev => [...prev, messageWithStatus]);
  }, []);

  return {
    messages,
    isProcessing,
    enqueue,
    retry,
    retryAllFailed,
    hasReachedMaxRetries,
    getPending,
    getFailed,
    clear,
    initializeMessages,
    addMessage,
    hasPending: pendingMessages.size > 0,
    hasFailed: failedMessages.size > 0,
    maxRetries,
  };
}
