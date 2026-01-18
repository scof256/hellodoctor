/**
 * Stream Video Error Handling Service
 * Requirements: 7.1, 7.2, 7.3, 7.4
 * 
 * Provides comprehensive error handling for Stream Video integration including:
 * - User-friendly error messages for Stream service failures
 * - Retry mechanisms with exponential backoff
 * - Fallback options for video initialization failures
 * - Proper error logging for debugging
 */

import { logError, ERROR_CODES, type ErrorCode } from '@/lib/errors';

// ============================================================================
// STREAM ERROR TYPES
// ============================================================================

export const STREAM_ERROR_CODES = {
  // Connection errors
  CONNECTION_FAILED: 'STREAM_CONNECTION_FAILED',
  SERVICE_UNAVAILABLE: 'STREAM_SERVICE_UNAVAILABLE',
  NETWORK_ERROR: 'STREAM_NETWORK_ERROR',
  
  // Authentication errors
  TOKEN_GENERATION_FAILED: 'STREAM_TOKEN_GENERATION_FAILED',
  TOKEN_EXPIRED: 'STREAM_TOKEN_EXPIRED',
  INVALID_CREDENTIALS: 'STREAM_INVALID_CREDENTIALS',
  
  // Meeting errors
  MEETING_NOT_FOUND: 'STREAM_MEETING_NOT_FOUND',
  MEETING_CREATION_FAILED: 'STREAM_MEETING_CREATION_FAILED',
  MEETING_JOIN_FAILED: 'STREAM_MEETING_JOIN_FAILED',
  MEETING_ENDED: 'STREAM_MEETING_ENDED',
  
  // Video/Audio errors
  VIDEO_INIT_FAILED: 'STREAM_VIDEO_INIT_FAILED',
  AUDIO_INIT_FAILED: 'STREAM_AUDIO_INIT_FAILED',
  MEDIA_PERMISSION_DENIED: 'STREAM_MEDIA_PERMISSION_DENIED',
  
  // Configuration errors
  NOT_CONFIGURED: 'STREAM_NOT_CONFIGURED',
  INVALID_CONFIG: 'STREAM_INVALID_CONFIG',
} as const;

export type StreamErrorCode = typeof STREAM_ERROR_CODES[keyof typeof STREAM_ERROR_CODES];

// ============================================================================
// USER-FRIENDLY ERROR MESSAGES
// ============================================================================

const STREAM_ERROR_MESSAGES: Record<StreamErrorCode, string> = {
  STREAM_CONNECTION_FAILED: 'Unable to connect to the video service. Please check your internet connection and try again.',
  STREAM_SERVICE_UNAVAILABLE: 'The video service is temporarily unavailable. Please try again in a few minutes.',
  STREAM_NETWORK_ERROR: 'Network connection lost. Please check your internet connection.',
  STREAM_TOKEN_GENERATION_FAILED: 'Unable to authenticate with the video service. Please refresh the page and try again.',
  STREAM_TOKEN_EXPIRED: 'Your session has expired. Please refresh the page to continue.',
  STREAM_INVALID_CREDENTIALS: 'Video service authentication failed. Please contact support if this persists.',
  STREAM_MEETING_NOT_FOUND: 'The meeting could not be found. It may have been cancelled or ended.',
  STREAM_MEETING_CREATION_FAILED: 'Unable to create the meeting room. Please try again.',
  STREAM_MEETING_JOIN_FAILED: 'Unable to join the meeting. Please try again or contact support.',
  STREAM_MEETING_ENDED: 'This meeting has ended.',
  STREAM_VIDEO_INIT_FAILED: 'Unable to initialize video. Please check your camera permissions and try again.',
  STREAM_AUDIO_INIT_FAILED: 'Unable to initialize audio. Please check your microphone permissions and try again.',
  STREAM_MEDIA_PERMISSION_DENIED: 'Camera or microphone access was denied. Please enable permissions in your browser settings.',
  STREAM_NOT_CONFIGURED: 'Video service is not configured. Please contact support.',
  STREAM_INVALID_CONFIG: 'Video service configuration is invalid. Please contact support.',
};

// ============================================================================
// FALLBACK OPTIONS
// ============================================================================

export interface FallbackOption {
  id: string;
  label: string;
  description: string;
  action: 'retry' | 'refresh' | 'contact' | 'alternative';
  href?: string;
}

const FALLBACK_OPTIONS: Record<StreamErrorCode, FallbackOption[]> = {
  STREAM_CONNECTION_FAILED: [
    { id: 'retry', label: 'Try Again', description: 'Attempt to reconnect to the video service', action: 'retry' },
    { id: 'refresh', label: 'Refresh Page', description: 'Reload the page to reset the connection', action: 'refresh' },
  ],
  STREAM_SERVICE_UNAVAILABLE: [
    { id: 'retry', label: 'Try Again', description: 'The service may be back online', action: 'retry' },
    { id: 'contact', label: 'Contact Support', description: 'Get help from our support team', action: 'contact', href: '/support' },
  ],
  STREAM_NETWORK_ERROR: [
    { id: 'retry', label: 'Reconnect', description: 'Try to reconnect when your connection is stable', action: 'retry' },
  ],
  STREAM_TOKEN_GENERATION_FAILED: [
    { id: 'refresh', label: 'Refresh Page', description: 'Reload to get a new authentication token', action: 'refresh' },
    { id: 'retry', label: 'Try Again', description: 'Attempt to generate a new token', action: 'retry' },
  ],
  STREAM_TOKEN_EXPIRED: [
    { id: 'refresh', label: 'Refresh Page', description: 'Reload to get a new session', action: 'refresh' },
  ],
  STREAM_INVALID_CREDENTIALS: [
    { id: 'contact', label: 'Contact Support', description: 'This may be a configuration issue', action: 'contact', href: '/support' },
  ],
  STREAM_MEETING_NOT_FOUND: [
    { id: 'alternative', label: 'View Appointments', description: 'Go back to your appointments', action: 'alternative', href: '/patient/appointments' },
  ],
  STREAM_MEETING_CREATION_FAILED: [
    { id: 'retry', label: 'Try Again', description: 'Attempt to create the meeting again', action: 'retry' },
    { id: 'contact', label: 'Contact Support', description: 'Get help if the issue persists', action: 'contact', href: '/support' },
  ],
  STREAM_MEETING_JOIN_FAILED: [
    { id: 'retry', label: 'Try Again', description: 'Attempt to join the meeting again', action: 'retry' },
    { id: 'refresh', label: 'Refresh Page', description: 'Reload and try joining again', action: 'refresh' },
  ],
  STREAM_MEETING_ENDED: [
    { id: 'alternative', label: 'View Appointments', description: 'Go back to your appointments', action: 'alternative', href: '/patient/appointments' },
  ],
  STREAM_VIDEO_INIT_FAILED: [
    { id: 'retry', label: 'Try Again', description: 'Attempt to initialize video again', action: 'retry' },
    { id: 'alternative', label: 'Join Audio Only', description: 'Join the meeting without video', action: 'alternative' },
  ],
  STREAM_AUDIO_INIT_FAILED: [
    { id: 'retry', label: 'Try Again', description: 'Attempt to initialize audio again', action: 'retry' },
    { id: 'contact', label: 'Contact Support', description: 'Get help with audio issues', action: 'contact', href: '/support' },
  ],
  STREAM_MEDIA_PERMISSION_DENIED: [
    { id: 'alternative', label: 'Enable Permissions', description: 'Open browser settings to enable camera/microphone', action: 'alternative' },
    { id: 'contact', label: 'Need Help?', description: 'Get help enabling permissions', action: 'contact', href: '/support' },
  ],
  STREAM_NOT_CONFIGURED: [
    { id: 'contact', label: 'Contact Support', description: 'Report this configuration issue', action: 'contact', href: '/support' },
  ],
  STREAM_INVALID_CONFIG: [
    { id: 'contact', label: 'Contact Support', description: 'Report this configuration issue', action: 'contact', href: '/support' },
  ],
};

// ============================================================================
// STREAM ERROR CLASS
// ============================================================================

export class StreamError extends Error {
  public readonly code: StreamErrorCode;
  public readonly originalError?: Error;
  public readonly retryable: boolean;
  public readonly fallbackOptions: FallbackOption[];

  constructor(
    code: StreamErrorCode,
    message?: string,
    originalError?: Error,
    retryable: boolean = true
  ) {
    super(message || STREAM_ERROR_MESSAGES[code]);
    this.code = code;
    this.originalError = originalError;
    this.retryable = retryable;
    this.fallbackOptions = FALLBACK_OPTIONS[code] || [];
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// ============================================================================
// RETRY CONFIGURATION
// ============================================================================

export interface RetryConfig {
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

// ============================================================================
// RETRY WITH EXPONENTIAL BACKOFF
// ============================================================================

/**
 * Calculate delay for exponential backoff
 */
export function calculateBackoffDelay(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  const delay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt);
  // Add jitter (±10%) to prevent thundering herd
  const jitter = delay * 0.1 * (Math.random() * 2 - 1);
  return Math.min(delay + jitter, config.maxDelayMs);
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry an async operation with exponential backoff
 * Requirements: 7.2
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  onRetry?: (attempt: number, error: Error, delayMs: number) => void
): Promise<T> {
  const fullConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= fullConfig.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if error is retryable
      if (error instanceof StreamError && !error.retryable) {
        throw error;
      }

      // Don't retry if we've exhausted attempts
      if (attempt >= fullConfig.maxRetries) {
        break;
      }

      const delayMs = calculateBackoffDelay(attempt, fullConfig);
      
      // Log retry attempt
      logStreamError(lastError, {
        context: 'retry',
        attempt: attempt + 1,
        maxRetries: fullConfig.maxRetries,
        delayMs,
      });

      // Notify callback if provided
      if (onRetry) {
        onRetry(attempt + 1, lastError, delayMs);
      }

      await sleep(delayMs);
    }
  }

  // All retries exhausted
  throw lastError;
}

// ============================================================================
// ERROR CLASSIFICATION
// ============================================================================

/**
 * Classify an error into a StreamErrorCode
 */
export function classifyStreamError(error: unknown): StreamErrorCode {
  if (error instanceof StreamError) {
    return error.code;
  }

  const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  // Network errors
  if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('connection')) {
    return STREAM_ERROR_CODES.NETWORK_ERROR;
  }

  // Authentication errors
  if (errorMessage.includes('token') && (errorMessage.includes('expired') || errorMessage.includes('invalid'))) {
    return STREAM_ERROR_CODES.TOKEN_EXPIRED;
  }
  if (errorMessage.includes('unauthorized') || errorMessage.includes('authentication')) {
    return STREAM_ERROR_CODES.TOKEN_GENERATION_FAILED;
  }

  // Meeting errors
  if (errorMessage.includes('not found') || errorMessage.includes('404')) {
    return STREAM_ERROR_CODES.MEETING_NOT_FOUND;
  }
  if (errorMessage.includes('ended') || errorMessage.includes('closed')) {
    return STREAM_ERROR_CODES.MEETING_ENDED;
  }

  // Media errors
  if (errorMessage.includes('permission') && (errorMessage.includes('camera') || errorMessage.includes('microphone'))) {
    return STREAM_ERROR_CODES.MEDIA_PERMISSION_DENIED;
  }
  if (errorMessage.includes('video') && errorMessage.includes('fail')) {
    return STREAM_ERROR_CODES.VIDEO_INIT_FAILED;
  }
  if (errorMessage.includes('audio') && errorMessage.includes('fail')) {
    return STREAM_ERROR_CODES.AUDIO_INIT_FAILED;
  }

  // Configuration errors
  if (errorMessage.includes('not configured') || errorMessage.includes('api key')) {
    return STREAM_ERROR_CODES.NOT_CONFIGURED;
  }

  // Service availability
  if (errorMessage.includes('unavailable') || errorMessage.includes('503') || errorMessage.includes('502')) {
    return STREAM_ERROR_CODES.SERVICE_UNAVAILABLE;
  }

  // Default to connection failed
  return STREAM_ERROR_CODES.CONNECTION_FAILED;
}

/**
 * Convert any error to a StreamError
 */
export function toStreamError(error: unknown): StreamError {
  if (error instanceof StreamError) {
    return error;
  }

  const code = classifyStreamError(error);
  const originalError = error instanceof Error ? error : new Error(String(error));
  
  // Determine if error is retryable
  const nonRetryableCodes: StreamErrorCode[] = [
    STREAM_ERROR_CODES.NOT_CONFIGURED,
    STREAM_ERROR_CODES.INVALID_CONFIG,
    STREAM_ERROR_CODES.INVALID_CREDENTIALS,
    STREAM_ERROR_CODES.MEETING_ENDED,
    STREAM_ERROR_CODES.MEDIA_PERMISSION_DENIED,
  ];
  const retryable = !nonRetryableCodes.includes(code);

  return new StreamError(code, undefined, originalError, retryable);
}

// ============================================================================
// ERROR LOGGING
// ============================================================================

/**
 * Log Stream-specific errors with context
 * Requirements: 7.4
 */
export function logStreamError(
  error: unknown,
  context?: Record<string, unknown>
): void {
  const streamError = toStreamError(error);
  
  const logContext = {
    streamErrorCode: streamError.code,
    retryable: streamError.retryable,
    originalMessage: streamError.originalError?.message,
    ...context,
  };

  // Use the existing error logging utility
  logError(streamError, logContext);

  // Additional Stream-specific logging in development
  if (process.env.NODE_ENV === 'development') {
    console.group('[Stream Error]');
    console.error('Code:', streamError.code);
    console.error('Message:', streamError.message);
    console.error('Retryable:', streamError.retryable);
    console.error('Fallback Options:', streamError.fallbackOptions);
    if (streamError.originalError) {
      console.error('Original Error:', streamError.originalError);
    }
    if (context) {
      console.error('Context:', context);
    }
    console.groupEnd();
  }
}

// ============================================================================
// ERROR RESPONSE HELPERS
// ============================================================================

export interface StreamErrorResponse {
  code: StreamErrorCode;
  message: string;
  retryable: boolean;
  fallbackOptions: FallbackOption[];
}

/**
 * Get a safe error response for the client
 */
export function getStreamErrorResponse(error: unknown): StreamErrorResponse {
  const streamError = toStreamError(error);
  
  return {
    code: streamError.code,
    message: streamError.message,
    retryable: streamError.retryable,
    fallbackOptions: streamError.fallbackOptions,
  };
}

/**
 * Check if an error is a Stream error
 */
export function isStreamError(error: unknown): error is StreamError {
  return error instanceof StreamError;
}

/**
 * Get user-friendly message for a Stream error code
 */
export function getStreamErrorMessage(code: StreamErrorCode): string {
  return STREAM_ERROR_MESSAGES[code] || 'An unexpected error occurred with the video service.';
}

/**
 * Get fallback options for a Stream error code
 */
export function getStreamFallbackOptions(code: StreamErrorCode): FallbackOption[] {
  return FALLBACK_OPTIONS[code] || [];
}
