/**
 * User-friendly error message mapping
 * Requirements: 7.1, 7.4 - Display user-friendly error messages
 */

export interface FriendlyError {
  title: string;
  message: string;
  action?: string;
}

// Map error codes/messages to user-friendly messages
const ERROR_MAP: Record<string, FriendlyError> = {
  // Network errors
  'NETWORK_ERROR': {
    title: 'Connection Issue',
    message: "We couldn't reach our servers. Please check your internet connection.",
    action: 'Try again',
  },
  'FETCH_ERROR': {
    title: 'Connection Issue',
    message: "We couldn't reach our servers. Please check your internet connection.",
    action: 'Try again',
  },
  
  // AI service errors
  'AI_SERVICE_UNAVAILABLE': {
    title: 'AI Assistant Unavailable',
    message: 'Our AI assistant is temporarily unavailable. Please try again in a moment.',
    action: 'Retry',
  },
  'GEMINI_ERROR': {
    title: 'AI Assistant Unavailable',
    message: 'Our AI assistant is temporarily unavailable. Please try again in a moment.',
    action: 'Retry',
  },
  
  // Session errors
  'SESSION_EXPIRED': {
    title: 'Session Expired',
    message: 'Your session has expired. Please refresh the page to continue.',
    action: 'Refresh',
  },
  'SESSION_NOT_FOUND': {
    title: 'Session Not Found',
    message: 'We could not find your intake session. Please try starting a new one.',
    action: 'Start New',
  },
  
  // Validation errors
  'MESSAGE_TOO_LONG': {
    title: 'Message Too Long',
    message: 'Your message is too long. Please shorten it and try again.',
  },
  'INVALID_INPUT': {
    title: 'Invalid Input',
    message: 'Please check your input and try again.',
  },
  
  // Authentication errors
  'UNAUTHORIZED': {
    title: 'Not Authorized',
    message: 'You are not authorized to perform this action. Please sign in again.',
    action: 'Sign In',
  },
  'FORBIDDEN': {
    title: 'Access Denied',
    message: 'You do not have permission to access this resource.',
  },
  
  // Server errors
  'INTERNAL_SERVER_ERROR': {
    title: 'Something Went Wrong',
    message: 'An unexpected error occurred. Please try again later.',
    action: 'Try again',
  },
  'SERVICE_UNAVAILABLE': {
    title: 'Service Unavailable',
    message: 'Our service is temporarily unavailable. Please try again later.',
    action: 'Try again',
  },
};

/**
 * Get a user-friendly error message from an error object or string
 */
export function getFriendlyError(error: unknown): FriendlyError {
  // Handle string errors
  if (typeof error === 'string') {
    const mapped = ERROR_MAP[error.toUpperCase().replace(/\s+/g, '_')];
    if (mapped) return mapped;
    
    // Check if the string contains known error patterns
    const lowerError = error.toLowerCase();
    if (lowerError.includes('network') || lowerError.includes('fetch')) {
      return ERROR_MAP['NETWORK_ERROR']!;
    }
    if (lowerError.includes('ai') || lowerError.includes('gemini')) {
      return ERROR_MAP['AI_SERVICE_UNAVAILABLE']!;
    }
    if (lowerError.includes('session') && lowerError.includes('expired')) {
      return ERROR_MAP['SESSION_EXPIRED']!;
    }
    if (lowerError.includes('unauthorized') || lowerError.includes('not authorized')) {
      return ERROR_MAP['UNAUTHORIZED']!;
    }
    
    return {
      title: 'Error',
      message: error,
    };
  }
  
  // Handle Error objects
  if (error instanceof Error) {
    const errorName = error.name?.toUpperCase().replace(/\s+/g, '_');
    const mapped = ERROR_MAP[errorName];
    if (mapped) return mapped;
    
    // Check message for patterns
    return getFriendlyError(error.message);
  }
  
  // Handle objects with code property (like tRPC errors)
  if (error && typeof error === 'object') {
    const errorObj = error as { code?: string; message?: string };
    if (errorObj.code) {
      const mapped = ERROR_MAP[errorObj.code];
      if (mapped) return mapped;
    }
    if (errorObj.message) {
      return getFriendlyError(errorObj.message);
    }
  }
  
  // Default fallback
  return {
    title: 'Something Went Wrong',
    message: 'An unexpected error occurred. Please try again.',
    action: 'Try again',
  };
}

/**
 * Check if an error is a network-related error
 */
export function isNetworkError(error: unknown): boolean {
  if (typeof error === 'string') {
    const lower = error.toLowerCase();
    return lower.includes('network') || lower.includes('fetch') || lower.includes('offline');
  }
  if (error instanceof Error) {
    return isNetworkError(error.message);
  }
  return false;
}

/**
 * Check if an error is transient (should show toast) vs persistent (should show inline)
 */
export function isTransientError(error: unknown): boolean {
  const friendly = getFriendlyError(error);
  // Transient errors are ones that might resolve on retry
  const transientTitles = ['Connection Issue', 'AI Assistant Unavailable', 'Service Unavailable'];
  return transientTitles.includes(friendly.title);
}
