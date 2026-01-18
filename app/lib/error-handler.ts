/**
 * Error Handling Utilities
 * Requirements: 10.4, 19.1, 19.2, 19.3, 19.4, 19.6
 * 
 * Provides comprehensive error handling including:
 * - Retry logic with exponential backoff
 * - User-friendly error message formatting
 * - Form validation utilities
 * - Error classification and recovery strategies
 */

// ============================================================================
// RETRY LOGIC WITH EXPONENTIAL BACKOFF
// ============================================================================

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, 'shouldRetry' | 'onRetry'>> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

/**
 * Calculate exponential backoff delay with jitter
 * Requirements: 10.4 - Exponential backoff retry
 */
export function calculateRetryDelay(
  attempt: number,
  options: RetryOptions = {}
): number {
  const { baseDelayMs, maxDelayMs, backoffMultiplier } = {
    ...DEFAULT_RETRY_OPTIONS,
    ...options,
  };

  const delay = baseDelayMs * Math.pow(backoffMultiplier, attempt);
  
  // Add jitter (±10%) to prevent thundering herd
  const jitter = delay * 0.1 * (Math.random() * 2 - 1);
  
  return Math.min(delay + jitter, maxDelayMs);
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry an async operation with exponential backoff
 * Requirements: 10.4 - Retry logic with exponential backoff
 * 
 * @example
 * const result = await retryWithBackoff(
 *   () => fetch('/api/data'),
 *   { maxRetries: 3, onRetry: (err, attempt) => console.log(`Retry ${attempt}`) }
 * );
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries, shouldRetry, onRetry } = {
    ...DEFAULT_RETRY_OPTIONS,
    ...options,
  };

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Check if we should retry this error
      if (shouldRetry && !shouldRetry(error, attempt)) {
        throw error;
      }

      // Don't retry if we've exhausted attempts
      if (attempt >= maxRetries) {
        break;
      }

      const delayMs = calculateRetryDelay(attempt, options);

      // Notify callback if provided
      if (onRetry) {
        onRetry(error, attempt + 1, delayMs);
      }

      await sleep(delayMs);
    }
  }

  // All retries exhausted
  throw lastError;
}

// ============================================================================
// ERROR MESSAGE FORMATTING
// ============================================================================

export interface FormattedError {
  title: string;
  message: string;
  icon?: string;
  action?: {
    label: string;
    type: 'retry' | 'refresh' | 'navigate' | 'dismiss';
    href?: string;
  };
  severity: 'error' | 'warning' | 'info';
}

/**
 * Error message templates with emojis for WhatsApp-style UX
 * Requirements: 10.4 - Simple error messages with icons
 */
const ERROR_TEMPLATES: Record<string, FormattedError> = {
  // Network errors
  NETWORK_ERROR: {
    title: 'Connection Problem',
    message: 'No internet connection. Try again? 🔄',
    icon: '📡',
    action: { label: 'Try Again', type: 'retry' },
    severity: 'error',
  },
  OFFLINE: {
    title: 'You\'re Offline',
    message: 'No internet - will sync when connected 📡',
    icon: '📡',
    severity: 'warning',
  },
  TIMEOUT: {
    title: 'Taking Too Long',
    message: 'This is taking longer than expected. Try again? ⏱️',
    icon: '⏱️',
    action: { label: 'Try Again', type: 'retry' },
    severity: 'warning',
  },

  // Form validation errors
  REQUIRED_FIELD: {
    title: 'Missing Information',
    message: 'Please fill in all required fields ✏️',
    icon: '✏️',
    severity: 'error',
  },
  INVALID_PHONE: {
    title: 'Invalid Phone Number',
    message: 'Phone number should be 10 digits 📱',
    icon: '📱',
    severity: 'error',
  },
  INVALID_EMAIL: {
    title: 'Invalid Email',
    message: 'Please check your email address 📧',
    icon: '📧',
    severity: 'error',
  },
  INVALID_DATE: {
    title: 'Invalid Date',
    message: 'Please choose a valid date 📅',
    icon: '📅',
    severity: 'error',
  },
  PAST_DATE: {
    title: 'Date in the Past',
    message: 'Please choose a future date 📅',
    icon: '📅',
    severity: 'error',
  },

  // Upload errors
  FILE_TOO_LARGE: {
    title: 'File Too Big',
    message: 'Image too big. Please choose a smaller one 📸',
    icon: '📸',
    severity: 'error',
  },
  INVALID_FILE_TYPE: {
    title: 'Wrong File Type',
    message: 'Please choose a photo (JPG or PNG) 🖼️',
    icon: '🖼️',
    severity: 'error',
  },
  UPLOAD_FAILED: {
    title: 'Upload Failed',
    message: 'Upload failed. Try again? 🔄',
    icon: '📸',
    action: { label: 'Try Again', type: 'retry' },
    severity: 'error',
  },

  // Permission errors
  CAMERA_DENIED: {
    title: 'Camera Access Needed',
    message: 'Camera needed for photos. Enable in Settings? 📷',
    icon: '📷',
    severity: 'warning',
  },
  MICROPHONE_DENIED: {
    title: 'Microphone Access Needed',
    message: 'Microphone needed for voice. Enable in Settings? 🎤',
    icon: '🎤',
    severity: 'warning',
  },
  LOCATION_DENIED: {
    title: 'Location Access Needed',
    message: 'Location helps find nearby doctors. Enable? 📍',
    icon: '📍',
    severity: 'warning',
  },

  // Server errors
  SERVER_ERROR: {
    title: 'Something Went Wrong',
    message: 'Something went wrong. We\'re fixing it! 🔧',
    icon: '🔧',
    action: { label: 'Try Again', type: 'retry' },
    severity: 'error',
  },
  SERVICE_UNAVAILABLE: {
    title: 'Service Unavailable',
    message: 'Service temporarily unavailable. Try again later? ⏰',
    icon: '⏰',
    action: { label: 'Try Again', type: 'retry' },
    severity: 'error',
  },

  // Authentication errors
  SESSION_EXPIRED: {
    title: 'Session Expired',
    message: 'Your session expired. Please refresh the page 🔄',
    icon: '🔄',
    action: { label: 'Refresh', type: 'refresh' },
    severity: 'warning',
  },
  UNAUTHORIZED: {
    title: 'Not Authorized',
    message: 'Please sign in to continue 🔐',
    icon: '🔐',
    action: { label: 'Sign In', type: 'navigate', href: '/sign-in' },
    severity: 'error',
  },

  // Booking errors
  SLOT_UNAVAILABLE: {
    title: 'Time Slot Taken',
    message: 'This time is no longer available. Choose another? 📅',
    icon: '📅',
    severity: 'warning',
  },
  BOOKING_FAILED: {
    title: 'Booking Failed',
    message: 'Could not book appointment. Try again? 🔄',
    icon: '📅',
    action: { label: 'Try Again', type: 'retry' },
    severity: 'error',
  },

  // Default fallback
  UNKNOWN_ERROR: {
    title: 'Oops!',
    message: 'Something unexpected happened. Try again? 🔄',
    icon: '❗',
    action: { label: 'Try Again', type: 'retry' },
    severity: 'error',
  },
};

/**
 * Format an error into a user-friendly message
 * Requirements: 10.4 - Clear error messages with icons
 * 
 * @example
 * const formatted = formatError(new Error('Network error'));
 * // { title: 'Connection Problem', message: '...', icon: '📡', ... }
 */
export function formatError(error: unknown, context?: string): FormattedError {
  // Handle string error codes
  if (typeof error === 'string') {
    const template = ERROR_TEMPLATES[error.toUpperCase()];
    if (template) return template;
  }

  // Handle Error objects
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Network errors
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return ERROR_TEMPLATES.NETWORK_ERROR;
    }
    if (message.includes('timeout')) {
      return ERROR_TEMPLATES.TIMEOUT;
    }
    if (message.includes('offline')) {
      return ERROR_TEMPLATES.OFFLINE;
    }

    // Validation errors
    if (message.includes('required') || message.includes('missing')) {
      return ERROR_TEMPLATES.REQUIRED_FIELD;
    }
    if (message.includes('phone')) {
      return ERROR_TEMPLATES.INVALID_PHONE;
    }
    if (message.includes('email')) {
      return ERROR_TEMPLATES.INVALID_EMAIL;
    }

    // Upload errors
    if (message.includes('file') && message.includes('large')) {
      return ERROR_TEMPLATES.FILE_TOO_LARGE;
    }
    if (message.includes('file') && message.includes('type')) {
      return ERROR_TEMPLATES.INVALID_FILE_TYPE;
    }
    if (message.includes('upload')) {
      return ERROR_TEMPLATES.UPLOAD_FAILED;
    }

    // Permission errors
    if (message.includes('camera') || message.includes('video')) {
      return ERROR_TEMPLATES.CAMERA_DENIED;
    }
    if (message.includes('microphone') || message.includes('audio')) {
      return ERROR_TEMPLATES.MICROPHONE_DENIED;
    }
    if (message.includes('location')) {
      return ERROR_TEMPLATES.LOCATION_DENIED;
    }

    // Server errors
    if (message.includes('500') || message.includes('server error')) {
      return ERROR_TEMPLATES.SERVER_ERROR;
    }
    if (message.includes('503') || message.includes('unavailable')) {
      return ERROR_TEMPLATES.SERVICE_UNAVAILABLE;
    }

    // Auth errors
    if (message.includes('session') && message.includes('expired')) {
      return ERROR_TEMPLATES.SESSION_EXPIRED;
    }
    if (message.includes('unauthorized') || message.includes('401')) {
      return ERROR_TEMPLATES.UNAUTHORIZED;
    }

    // Booking errors
    if (message.includes('slot') || message.includes('unavailable')) {
      return ERROR_TEMPLATES.SLOT_UNAVAILABLE;
    }
    if (message.includes('booking')) {
      return ERROR_TEMPLATES.BOOKING_FAILED;
    }
  }

  // Handle objects with code property
  if (error && typeof error === 'object') {
    const errorObj = error as { code?: string; message?: string };
    if (errorObj.code) {
      const template = ERROR_TEMPLATES[errorObj.code.toUpperCase()];
      if (template) return template;
    }
    if (errorObj.message) {
      return formatError(errorObj.message, context);
    }
  }

  // Default fallback
  return ERROR_TEMPLATES.UNKNOWN_ERROR;
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  const formatted = formatError(error);
  return formatted.action?.type === 'retry';
}

/**
 * Check if an error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  if (typeof error === 'string') {
    return error.toUpperCase() === 'NETWORK_ERROR' || error.toUpperCase() === 'OFFLINE';
  }
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes('network') || message.includes('fetch') || message.includes('offline');
  }
  return false;
}

// ============================================================================
// FORM VALIDATION
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  error?: FormattedError;
}

/**
 * Validate phone number (Ugandan format)
 * Requirements: 19.4 - Auto-formatting (phone numbers)
 */
export function validatePhone(phone: string): ValidationResult {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // Check if it's a valid Ugandan phone number
  // Should be 10 digits (0XXXXXXXXX) or 12 digits (+256XXXXXXXXX)
  if (digits.length === 10 && digits.startsWith('0')) {
    return { valid: true };
  }
  if (digits.length === 12 && digits.startsWith('256')) {
    return { valid: true };
  }

  return {
    valid: false,
    error: ERROR_TEMPLATES.INVALID_PHONE,
  };
}

/**
 * Format phone number to Ugandan format
 * Requirements: 19.4 - Auto-formatting (phone numbers)
 * 
 * @example
 * formatPhone('0712345678') // '0712 345 678'
 * formatPhone('256712345678') // '+256 712 345 678'
 */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 10 && digits.startsWith('0')) {
    // Format: 0712 345 678
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }

  if (digits.length === 12 && digits.startsWith('256')) {
    // Format: +256 712 345 678
    return `+${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }

  return phone;
}

/**
 * Validate email address
 * Requirements: 19.1 - Real-time validation
 */
export function validateEmail(email: string): ValidationResult {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    return {
      valid: false,
      error: ERROR_TEMPLATES.INVALID_EMAIL,
    };
  }

  return { valid: true };
}

/**
 * Validate required field
 * Requirements: 19.1 - Real-time validation
 */
export function validateRequired(value: string, fieldName?: string): ValidationResult {
  if (!value || value.trim().length === 0) {
    return {
      valid: false,
      error: fieldName
        ? {
            ...ERROR_TEMPLATES.REQUIRED_FIELD,
            message: `Please enter your ${fieldName} ✏️`,
          }
        : ERROR_TEMPLATES.REQUIRED_FIELD,
    };
  }

  return { valid: true };
}

/**
 * Validate date is in the future
 * Requirements: 19.3 - Clear error messages
 */
export function validateFutureDate(date: Date): ValidationResult {
  const now = new Date();
  now.setHours(0, 0, 0, 0); // Reset to start of day

  const inputDate = new Date(date);
  inputDate.setHours(0, 0, 0, 0);

  if (inputDate < now) {
    return {
      valid: false,
      error: ERROR_TEMPLATES.PAST_DATE,
    };
  }

  return { valid: true };
}

/**
 * Validate file size
 * Requirements: 19.6 - File validation
 */
export function validateFileSize(file: File, maxSizeMB: number = 8): ValidationResult {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: ERROR_TEMPLATES.FILE_TOO_LARGE,
    };
  }

  return { valid: true };
}

/**
 * Validate file type
 * Requirements: 19.6 - File validation
 */
export function validateFileType(
  file: File,
  allowedTypes: string[] = ['image/jpeg', 'image/png', 'image/heic']
): ValidationResult {
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: ERROR_TEMPLATES.INVALID_FILE_TYPE,
    };
  }

  return { valid: true };
}

/**
 * Auto-format name (capitalize first letter of each word)
 * Requirements: 19.4 - Auto-formatting (names)
 */
export function formatName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Validate and format a form field
 * Requirements: 19.1, 19.2, 19.4 - Real-time validation, auto-formatting
 */
export function validateAndFormat(
  value: string,
  type: 'phone' | 'email' | 'name' | 'required' | 'date',
  options?: { fieldName?: string; maxSizeMB?: number }
): { value: string; result: ValidationResult } {
  let formattedValue = value;
  let result: ValidationResult = { valid: true };

  switch (type) {
    case 'phone':
      result = validatePhone(value);
      if (result.valid) {
        formattedValue = formatPhone(value);
      }
      break;

    case 'email':
      result = validateEmail(value);
      formattedValue = value.trim().toLowerCase();
      break;

    case 'name':
      formattedValue = formatName(value);
      result = validateRequired(formattedValue, options?.fieldName);
      break;

    case 'required':
      result = validateRequired(value, options?.fieldName);
      break;

    case 'date':
      try {
        const date = new Date(value);
        result = validateFutureDate(date);
      } catch {
        result = {
          valid: false,
          error: ERROR_TEMPLATES.INVALID_DATE,
        };
      }
      break;
  }

  return { value: formattedValue, result };
}
