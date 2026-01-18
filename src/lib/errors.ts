/**
 * Error handling utilities.
 * Requirements: 16.7
 * 
 * Ensures errors don't leak sensitive information while providing
 * useful feedback to users and developers.
 */

import { TRPCError } from '@trpc/server';
import { ZodError } from 'zod';

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Application-specific error codes.
 */
export const ERROR_CODES = {
  // Authentication errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  
  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  
  // Rate limiting
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  
  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  
  // Business logic errors
  OPERATION_NOT_ALLOWED: 'OPERATION_NOT_ALLOWED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

/**
 * User-friendly error messages that don't leak sensitive information.
 */
const USER_FRIENDLY_MESSAGES: Record<ErrorCode, string> = {
  UNAUTHORIZED: 'Please sign in to continue.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  SESSION_EXPIRED: 'Your session has expired. Please sign in again.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  INVALID_INPUT: 'The provided information is invalid.',
  NOT_FOUND: 'The requested resource was not found.',
  CONFLICT: 'This action conflicts with existing data.',
  ALREADY_EXISTS: 'This resource already exists.',
  TOO_MANY_REQUESTS: 'Too many requests. Please wait a moment and try again.',
  INTERNAL_ERROR: 'Something went wrong. Please try again later.',
  SERVICE_UNAVAILABLE: 'Service is temporarily unavailable. Please try again later.',
  DATABASE_ERROR: 'A database error occurred. Please try again later.',
  EXTERNAL_SERVICE_ERROR: 'An external service is unavailable. Please try again later.',
  OPERATION_NOT_ALLOWED: 'This operation is not allowed.',
  INSUFFICIENT_PERMISSIONS: 'You do not have sufficient permissions.',
};

// ============================================================================
// ERROR CLASSES
// ============================================================================

/**
 * Base application error class.
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message?: string,
    statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
    super(message || USER_FRIENDLY_MESSAGES[code]);
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error with field-specific details.
 */
export class ValidationError extends AppError {
  public readonly fieldErrors: Record<string, string[]>;

  constructor(fieldErrors: Record<string, string[]>, message?: string) {
    super('VALIDATION_ERROR', message, 400, { fieldErrors });
    this.fieldErrors = fieldErrors;
  }
}

/**
 * Not found error.
 */
export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id 
      ? `${resource} with ID ${id} not found`
      : `${resource} not found`;
    super('NOT_FOUND', message, 404, { resource, id });
  }
}

/**
 * Conflict error (e.g., duplicate resource).
 */
export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('CONFLICT', message, 409, details);
  }
}

// ============================================================================
// ERROR HANDLING UTILITIES
// ============================================================================

/**
 * Convert any error to a safe, user-friendly format.
 * Ensures sensitive information is not leaked.
 */
export function toSafeError(error: unknown): {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
} {
  // Handle AppError
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message,
      details: error.details,
    };
  }

  // Handle ZodError
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of error.issues) {
      const path = issue.path.join('.');
      if (!fieldErrors[path]) {
        fieldErrors[path] = [];
      }
      fieldErrors[path].push(issue.message);
    }
    return {
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: { fieldErrors },
    };
  }

  // Handle TRPCError
  if (error instanceof TRPCError) {
    const codeMap: Record<string, ErrorCode> = {
      UNAUTHORIZED: 'UNAUTHORIZED',
      FORBIDDEN: 'FORBIDDEN',
      NOT_FOUND: 'NOT_FOUND',
      CONFLICT: 'CONFLICT',
      TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
      BAD_REQUEST: 'VALIDATION_ERROR',
      INTERNAL_SERVER_ERROR: 'INTERNAL_ERROR',
    };
    const code = codeMap[error.code] || 'INTERNAL_ERROR';
    return {
      code,
      message: USER_FRIENDLY_MESSAGES[code],
    };
  }

  // Handle generic Error
  if (error instanceof Error) {
    // Log the actual error for debugging (in production, send to error tracking)
    console.error('Unhandled error:', error);
    
    // Return generic message to user
    return {
      code: 'INTERNAL_ERROR',
      message: USER_FRIENDLY_MESSAGES.INTERNAL_ERROR,
    };
  }

  // Handle unknown error types
  console.error('Unknown error type:', error);
  return {
    code: 'INTERNAL_ERROR',
    message: USER_FRIENDLY_MESSAGES.INTERNAL_ERROR,
  };
}

/**
 * Convert AppError to TRPCError for use in tRPC procedures.
 */
export function toTRPCError(error: AppError): TRPCError {
  const codeMap: Record<ErrorCode, TRPCError['code']> = {
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    SESSION_EXPIRED: 'UNAUTHORIZED',
    VALIDATION_ERROR: 'BAD_REQUEST',
    INVALID_INPUT: 'BAD_REQUEST',
    NOT_FOUND: 'NOT_FOUND',
    CONFLICT: 'CONFLICT',
    ALREADY_EXISTS: 'CONFLICT',
    TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
    INTERNAL_ERROR: 'INTERNAL_SERVER_ERROR',
    SERVICE_UNAVAILABLE: 'INTERNAL_SERVER_ERROR',
    DATABASE_ERROR: 'INTERNAL_SERVER_ERROR',
    EXTERNAL_SERVICE_ERROR: 'INTERNAL_SERVER_ERROR',
    OPERATION_NOT_ALLOWED: 'FORBIDDEN',
    INSUFFICIENT_PERMISSIONS: 'FORBIDDEN',
  };

  return new TRPCError({
    code: codeMap[error.code],
    message: error.message,
    cause: error,
  });
}

/**
 * Log error with appropriate level and context.
 * In production, this should send to an error tracking service.
 */
export function logError(
  error: unknown,
  context?: Record<string, unknown>
): void {
  const safeError = toSafeError(error);
  
  // Determine log level based on error type
  const isOperational = error instanceof AppError && error.isOperational;
  
  if (isOperational) {
    // Operational errors are expected and logged at warn level
    console.warn('Operational error:', {
      ...safeError,
      context,
    });
  } else {
    // Programming errors are logged at error level
    console.error('Unexpected error:', {
      ...safeError,
      context,
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

/**
 * Wrap an async function with error handling.
 */
export function withErrorHandling<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  context?: Record<string, unknown>
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      logError(error, context);
      throw error;
    }
  }) as T;
}
