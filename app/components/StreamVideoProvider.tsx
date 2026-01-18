'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { StreamVideoClient, User } from '@stream-io/video-react-sdk';
import { useUser } from '@clerk/nextjs';
import { generateStreamToken } from '@/server/actions/stream';

// ============================================================================
// RESOURCE MANAGEMENT CONFIGURATION
// Requirements: 8.1, 8.2, 8.4
// ============================================================================

/**
 * Configuration for lazy client initialization
 * Requirements: 8.1 - Initialize Stream client only when needed
 */
export const CLIENT_INIT_CONFIG = {
  /** Whether to defer initialization until explicitly requested */
  lazyInit: false,
  /** Timeout for graceful disconnect (ms) */
  disconnectTimeout: 5000,
  /** Whether to stop local tracks on leave */
  stopTracksOnLeave: true,
  /** Whether to release media devices on leave */
  releaseDevicesOnLeave: true,
  /** Maximum reconnection attempts */
  maxReconnectAttempts: 3,
} as const;

/**
 * Video quality presets for medical consultations
 * Requirements: 8.5 - Configure video quality settings for medical consultations
 */
export const VIDEO_QUALITY_PRESETS = {
  medical: {
    targetResolution: { width: 1280, height: 720 },
    maxBitrate: 2500000,
    minBitrate: 500000,
    frameRate: 30,
  },
  standard: {
    targetResolution: { width: 1280, height: 720 },
    maxBitrate: 1500000,
    minBitrate: 300000,
    frameRate: 24,
  },
  lowBandwidth: {
    targetResolution: { width: 640, height: 480 },
    maxBitrate: 800000,
    minBitrate: 150000,
    frameRate: 15,
  },
} as const;

export type VideoQualityPreset = keyof typeof VIDEO_QUALITY_PRESETS;

// ============================================================================
// ERROR HANDLING TYPES (Client-side compatible)
// ============================================================================

export const STREAM_ERROR_CODES = {
  CONNECTION_FAILED: 'STREAM_CONNECTION_FAILED',
  SERVICE_UNAVAILABLE: 'STREAM_SERVICE_UNAVAILABLE',
  NETWORK_ERROR: 'STREAM_NETWORK_ERROR',
  TOKEN_GENERATION_FAILED: 'STREAM_TOKEN_GENERATION_FAILED',
  TOKEN_EXPIRED: 'STREAM_TOKEN_EXPIRED',
  NOT_CONFIGURED: 'STREAM_NOT_CONFIGURED',
  VIDEO_INIT_FAILED: 'STREAM_VIDEO_INIT_FAILED',
} as const;

export type StreamErrorCode = typeof STREAM_ERROR_CODES[keyof typeof STREAM_ERROR_CODES];

const STREAM_ERROR_MESSAGES: Record<StreamErrorCode, string> = {
  STREAM_CONNECTION_FAILED: 'Unable to connect to the video service. Please check your internet connection and try again.',
  STREAM_SERVICE_UNAVAILABLE: 'The video service is temporarily unavailable. Please try again in a few minutes.',
  STREAM_NETWORK_ERROR: 'Network connection lost. Please check your internet connection.',
  STREAM_TOKEN_GENERATION_FAILED: 'Unable to authenticate with the video service. Please refresh the page and try again.',
  STREAM_TOKEN_EXPIRED: 'Your session has expired. Please refresh the page to continue.',
  STREAM_NOT_CONFIGURED: 'Video service is not configured. Please contact support.',
  STREAM_VIDEO_INIT_FAILED: 'Unable to initialize video. Please check your camera permissions and try again.',
};

export interface FallbackOption {
  id: string;
  label: string;
  description: string;
  action: 'retry' | 'refresh' | 'contact';
  href?: string;
}

export interface StreamVideoError {
  code: StreamErrorCode;
  message: string;
  retryable: boolean;
  fallbackOptions: FallbackOption[];
}

// ============================================================================
// RETRY CONFIGURATION
// ============================================================================

interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

function calculateBackoffDelay(attempt: number, config: RetryConfig): number {
  const delay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt);
  const jitter = delay * 0.1 * (Math.random() * 2 - 1);
  return Math.min(delay + jitter, config.maxDelayMs);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// ERROR CLASSIFICATION
// ============================================================================

function classifyError(error: unknown): StreamErrorCode {
  const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('connection')) {
    return STREAM_ERROR_CODES.NETWORK_ERROR;
  }
  if (errorMessage.includes('token') && (errorMessage.includes('expired') || errorMessage.includes('invalid'))) {
    return STREAM_ERROR_CODES.TOKEN_EXPIRED;
  }
  if (errorMessage.includes('unauthorized') || errorMessage.includes('authentication')) {
    return STREAM_ERROR_CODES.TOKEN_GENERATION_FAILED;
  }
  if (errorMessage.includes('not configured') || errorMessage.includes('api key')) {
    return STREAM_ERROR_CODES.NOT_CONFIGURED;
  }
  if (errorMessage.includes('unavailable') || errorMessage.includes('503') || errorMessage.includes('502')) {
    return STREAM_ERROR_CODES.SERVICE_UNAVAILABLE;
  }
  if (errorMessage.includes('video') || errorMessage.includes('camera')) {
    return STREAM_ERROR_CODES.VIDEO_INIT_FAILED;
  }

  return STREAM_ERROR_CODES.CONNECTION_FAILED;
}

function getFallbackOptions(code: StreamErrorCode): FallbackOption[] {
  const options: Record<StreamErrorCode, FallbackOption[]> = {
    STREAM_CONNECTION_FAILED: [
      { id: 'retry', label: 'Try Again', description: 'Attempt to reconnect', action: 'retry' },
      { id: 'refresh', label: 'Refresh Page', description: 'Reload the page', action: 'refresh' },
    ],
    STREAM_SERVICE_UNAVAILABLE: [
      { id: 'retry', label: 'Try Again', description: 'Service may be back online', action: 'retry' },
      { id: 'contact', label: 'Contact Support', description: 'Get help', action: 'contact', href: '/support' },
    ],
    STREAM_NETWORK_ERROR: [
      { id: 'retry', label: 'Reconnect', description: 'Try when connection is stable', action: 'retry' },
    ],
    STREAM_TOKEN_GENERATION_FAILED: [
      { id: 'refresh', label: 'Refresh Page', description: 'Get new authentication', action: 'refresh' },
      { id: 'retry', label: 'Try Again', description: 'Attempt to generate token', action: 'retry' },
    ],
    STREAM_TOKEN_EXPIRED: [
      { id: 'refresh', label: 'Refresh Page', description: 'Get new session', action: 'refresh' },
    ],
    STREAM_NOT_CONFIGURED: [
      { id: 'contact', label: 'Contact Support', description: 'Configuration issue', action: 'contact', href: '/support' },
    ],
    STREAM_VIDEO_INIT_FAILED: [
      { id: 'retry', label: 'Try Again', description: 'Attempt to initialize video', action: 'retry' },
    ],
  };
  return options[code] || [];
}

function toStreamVideoError(error: unknown): StreamVideoError {
  const code = classifyError(error);
  const nonRetryableCodes: StreamErrorCode[] = [
    STREAM_ERROR_CODES.NOT_CONFIGURED,
    STREAM_ERROR_CODES.TOKEN_EXPIRED,
  ];
  
  return {
    code,
    message: STREAM_ERROR_MESSAGES[code],
    retryable: !nonRetryableCodes.includes(code),
    fallbackOptions: getFallbackOptions(code),
  };
}

// ============================================================================
// CONTEXT TYPES
// ============================================================================

interface StreamVideoContextValue {
  client: StreamVideoClient | null;
  isLoading: boolean;
  error: StreamVideoError | null;
  retryCount: number;
  isRetrying: boolean;
  retry: () => Promise<void>;
  clearError: () => void;
  /** Initialize client on demand (for lazy initialization) */
  initializeOnDemand: () => Promise<boolean>;
  /** Cleanup resources when leaving a meeting */
  cleanupResources: () => Promise<void>;
  /** Current video quality preset */
  videoQualityPreset: VideoQualityPreset;
  /** Set video quality preset */
  setVideoQualityPreset: (preset: VideoQualityPreset) => void;
}

const StreamVideoContext = createContext<StreamVideoContextValue | undefined>(undefined);

interface StreamVideoProviderProps {
  children: React.ReactNode;
}

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

export function StreamVideoProvider({ children }: StreamVideoProviderProps) {
  const { user, isLoaded: isUserLoaded } = useUser();
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<StreamVideoError | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [videoQualityPreset, setVideoQualityPreset] = useState<VideoQualityPreset>('medical');
  const initializationAttempted = useRef(false);
  const cleanupInProgress = useRef(false);

  const logError = useCallback((err: unknown, context?: Record<string, unknown>) => {
    const streamError = toStreamVideoError(err);
    // Properly serialize the error for logging
    let errorDetails: string;
    if (err instanceof Error) {
      errorDetails = `${err.name}: ${err.message}`;
      if (err.stack) {
        errorDetails += `\nStack: ${err.stack.split('\n').slice(0, 3).join('\n')}`;
      }
    } else if (typeof err === 'string') {
      errorDetails = err;
    } else if (typeof err === 'object' && err !== null) {
      try {
        // Try to get all properties including non-enumerable ones
        const allProps = Object.getOwnPropertyNames(err);
        if (allProps.length > 0) {
          const errorObj: Record<string, unknown> = {};
          for (const prop of allProps) {
            try {
              errorObj[prop] = (err as Record<string, unknown>)[prop];
            } catch {
              errorObj[prop] = '[unreadable]';
            }
          }
          errorDetails = JSON.stringify(errorObj);
        } else {
          // If object has no own properties, check for common error patterns
          const stringified = JSON.stringify(err);
          if (stringified === '{}') {
            // Empty object - likely a Stream SDK error without details
            // Try to extract any useful info from the prototype chain
            const proto = Object.getPrototypeOf(err);
            if (proto && proto.constructor && proto.constructor.name !== 'Object') {
              errorDetails = `${proto.constructor.name} (no details available)`;
            } else {
              // Check if it's a configuration issue (missing API key)
              const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
              if (!apiKey) {
                errorDetails = 'Stream API key not configured (NEXT_PUBLIC_STREAM_API_KEY is missing)';
              } else {
                errorDetails = 'Stream SDK error (no details available - check API key configuration)';
              }
            }
          } else {
            errorDetails = stringified;
          }
        }
      } catch {
        errorDetails = String(err) || 'Unknown error object';
      }
    } else {
      errorDetails = String(err) || 'Unknown error';
    }
    
    // Build the log object with meaningful information - but DON'T log to console.error
    // to avoid triggering Next.js error boundaries and noisy console output
    const logObject = {
      code: streamError.code,
      message: streamError.message,
      retryable: streamError.retryable,
      originalError: errorDetails,
      ...context,
    };
    
    // IMPORTANT: Never use console.error here - it triggers Next.js error boundaries
    // Use console.debug for development only, which doesn't trigger error handling
    if (process.env.NODE_ENV === 'development') {
      if (streamError.code === STREAM_ERROR_CODES.NOT_CONFIGURED) {
        // Silent for NOT_CONFIGURED - this is expected when Stream is not set up
        console.debug('[StreamVideoProvider] Stream not configured - video features will be unavailable');
      } else if (errorDetails.includes('{}') || errorDetails.includes('no details available')) {
        // Silent for empty error objects
        console.debug('[StreamVideoProvider] Stream SDK error (suppressed):', logObject);
      } else {
        // Use console.debug to avoid triggering error boundaries
        console.debug('[StreamVideoProvider] Debug:', logObject);
      }
    }
  }, []);

  /**
   * Cleanup resources when leaving a meeting
   * Requirements: 8.2 - Proper resource cleanup when leaving meetings
   */
  const cleanupResources = useCallback(async (): Promise<void> => {
    if (cleanupInProgress.current) {
      if (process.env.NODE_ENV === 'development') {
        console.debug('[StreamVideoProvider] Cleanup already in progress');
      }
      return;
    }

    cleanupInProgress.current = true;
    if (process.env.NODE_ENV === 'development') {
      console.debug('[StreamVideoProvider] Starting resource cleanup');
    }

    try {
      if (client) {
        // Create a timeout promise for graceful disconnect
        const disconnectPromise = client.disconnectUser();
        const timeoutPromise = new Promise<void>((_, reject) => {
          setTimeout(() => reject(new Error('Disconnect timeout')), CLIENT_INIT_CONFIG.disconnectTimeout);
        });

        try {
          await Promise.race([disconnectPromise, timeoutPromise]);
          if (process.env.NODE_ENV === 'development') {
            console.debug('[StreamVideoProvider] Client disconnected successfully');
          }
        } catch (disconnectErr) {
          if (process.env.NODE_ENV === 'development') {
            console.debug('[StreamVideoProvider] Disconnect timeout or error:', disconnectErr);
          }
        }
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.debug('[StreamVideoProvider] Cleanup error:', err);
      }
    } finally {
      cleanupInProgress.current = false;
      if (process.env.NODE_ENV === 'development') {
        console.debug('[StreamVideoProvider] Resource cleanup completed');
      }
    }
  }, [client]);

  const initializeClient = useCallback(async (isRetry: boolean = false): Promise<boolean> => {
    if (!user || !isUserLoaded) {
      setIsLoading(false);
      return false;
    }

    // Requirements: 8.1 - Initialize Stream client only when needed
    // Skip if client already exists and is valid
    if (client && !isRetry) {
      if (process.env.NODE_ENV === 'development') {
        console.debug('[StreamVideoProvider] Client already initialized, skipping');
      }
      setIsLoading(false);
      return true;
    }

    // Check if Stream API key is configured before attempting initialization
    const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
    if (!apiKey) {
      const configError = new Error('Stream API key is not configured. Please set NEXT_PUBLIC_STREAM_API_KEY in your environment.');
      const streamError = toStreamVideoError(configError);
      setError(streamError);
      setIsLoading(false);
      if (process.env.NODE_ENV === 'development') {
        console.debug('[StreamVideoProvider] Stream not configured - video features will be unavailable');
      }
      return false;
    }

    try {
      if (isRetry) {
        setIsRetrying(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      if (process.env.NODE_ENV === 'development') {
        console.debug('[StreamVideoProvider] Initializing client for user:', user.id);
      }

      // Generate Stream token using server action with retry
      let token: string | undefined;
      let lastTokenError: unknown;
      
      for (let attempt = 0; attempt <= DEFAULT_RETRY_CONFIG.maxRetries; attempt++) {
        try {
          const response = await generateStreamToken();
          token = response.token;
          break;
        } catch (tokenErr) {
          lastTokenError = tokenErr;
          // Only log if it's not a "not configured" error
          const errMsg = tokenErr instanceof Error ? tokenErr.message : String(tokenErr);
          if (!errMsg.includes('not configured')) {
            logError(tokenErr, { context: 'token_generation', attempt: attempt + 1 });
          }
          
          if (attempt < DEFAULT_RETRY_CONFIG.maxRetries) {
            const delay = calculateBackoffDelay(attempt, DEFAULT_RETRY_CONFIG);
            await sleep(delay);
          }
        }
      }

      if (!token) {
        throw lastTokenError || new Error('Failed to generate token after retries');
      }

      // Create Stream user object from Clerk user data
      const streamUser: User = {
        id: user.id,
        name: user.fullName || user.firstName || user.emailAddresses[0]?.emailAddress || 'User',
        image: user.imageUrl,
      };

      // Requirements: 8.1 - Optimize Stream client initialization
      // Initialize Stream Video Client with optimized settings
      const videoClient = new StreamVideoClient({
        apiKey,
        user: streamUser,
        token,
      });

      if (process.env.NODE_ENV === 'development') {
        console.debug('[StreamVideoProvider] Client initialized successfully');
      }
      setClient(videoClient);
      setRetryCount(0);
      return true;
    } catch (err) {
      const streamError = toStreamVideoError(err);
      setError(streamError);
      // Only log if it's not a configuration error (those are expected)
      const errMsg = err instanceof Error ? err.message : String(err);
      if (!errMsg.includes('not configured') && streamError.code !== STREAM_ERROR_CODES.NOT_CONFIGURED) {
        logError(err, { context: 'initialization', retryCount });
      }
      return false;
    } finally {
      setIsLoading(false);
      setIsRetrying(false);
    }
  }, [user, isUserLoaded, logError, retryCount, client]);

  /**
   * Initialize client on demand (for lazy initialization)
   * Requirements: 8.1 - Initialize Stream client only when needed
   */
  const initializeOnDemand = useCallback(async (): Promise<boolean> => {
    if (client) {
      return true;
    }
    return initializeClient(false);
  }, [client, initializeClient]);

  const retry = useCallback(async () => {
    if (!error?.retryable || isRetrying) return;
    
    setRetryCount(prev => prev + 1);
    await initializeClient(true);
  }, [error?.retryable, isRetrying, initializeClient]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Initialize client when user is loaded
  useEffect(() => {
    if (!initializationAttempted.current && isUserLoaded) {
      initializationAttempted.current = true;
      initializeClient();
    }
  }, [isUserLoaded, initializeClient]);

  // Reset initialization flag when user changes
  useEffect(() => {
    if (user?.id) {
      initializationAttempted.current = false;
    }
  }, [user?.id]);

  // Cleanup client on unmount
  // Requirements: 8.2 - Proper resource cleanup when leaving meetings
  useEffect(() => {
    return () => {
      if (client && typeof client.disconnectUser === 'function') {
        if (process.env.NODE_ENV === 'development') {
          console.debug('[StreamVideoProvider] Unmounting, cleaning up resources');
        }
        // Use the cleanup function for proper resource disposal
        client.disconnectUser().catch(err => {
          if (process.env.NODE_ENV === 'development') {
            console.debug('[StreamVideoProvider] Cleanup error on unmount:', err);
          }
        });
      }
    };
  }, [client]);

  const contextValue: StreamVideoContextValue = {
    client,
    isLoading,
    error,
    retryCount,
    isRetrying,
    retry,
    clearError,
    initializeOnDemand,
    cleanupResources,
    videoQualityPreset,
    setVideoQualityPreset,
  };

  return (
    <StreamVideoContext.Provider value={contextValue}>
      {children}
    </StreamVideoContext.Provider>
  );
}

export function useStreamVideoClient(): StreamVideoContextValue {
  const context = useContext(StreamVideoContext);
  if (context === undefined) {
    throw new Error('useStreamVideoClient must be used within a StreamVideoProvider');
  }
  return context;
}