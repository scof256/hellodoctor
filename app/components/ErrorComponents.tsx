/**
 * Error UI Components
 * Requirements: 10.4, 19.1, 19.2, 19.3
 * 
 * Provides UI components for displaying errors:
 * - Inline form validation errors
 * - Retry buttons
 * - Error banners
 * - Error states
 */

'use client';

import React from 'react';
import { AlertCircle, RefreshCw, X } from 'lucide-react';
import type { FormattedError } from '@/app/lib/error-handler';

// ============================================================================
// INLINE FORM ERROR
// ============================================================================

export interface InlineErrorProps {
  error?: FormattedError | string;
  className?: string;
}

/**
 * Inline error message for form fields
 * Requirements: 19.1, 19.3 - Inline form validation errors, clear error messages with icons
 * 
 * @example
 * <InlineError error={validationResult.error} />
 */
export function InlineError({ error, className = '' }: InlineErrorProps) {
  if (!error) return null;

  const errorData = typeof error === 'string' 
    ? { message: error, icon: '❗' }
    : error;

  return (
    <div className={`flex items-start gap-2 mt-1 text-sm text-red-600 ${className}`}>
      {errorData.icon && (
        <span className="text-base flex-shrink-0" role="img" aria-label="error">
          {errorData.icon}
        </span>
      )}
      <span className="flex-1">{errorData.message}</span>
    </div>
  );
}

// ============================================================================
// RETRY BUTTON
// ============================================================================

export interface RetryButtonProps {
  onRetry: () => void;
  label?: string;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'text';
  className?: string;
}

/**
 * Retry button with loading state
 * Requirements: 10.4 - Retry buttons
 * 
 * @example
 * <RetryButton onRetry={handleRetry} loading={isRetrying} />
 */
export function RetryButton({
  onRetry,
  label = 'Try Again',
  loading = false,
  disabled = false,
  variant = 'primary',
  className = '',
}: RetryButtonProps) {
  const baseClasses = 'inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200';
  
  const variantClasses = {
    primary: 'bg-whatsapp-green text-white hover:bg-whatsapp-green-dark disabled:bg-gray-300 disabled:cursor-not-allowed',
    secondary: 'bg-white text-whatsapp-green border-2 border-whatsapp-green hover:bg-green-50 disabled:border-gray-300 disabled:text-gray-400 disabled:cursor-not-allowed',
    text: 'text-whatsapp-green hover:underline disabled:text-gray-400 disabled:cursor-not-allowed',
  };

  return (
    <button
      onClick={onRetry}
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      aria-label={loading ? 'Retrying...' : label}
    >
      <RefreshCw 
        className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
        aria-hidden="true"
      />
      <span>{loading ? 'Retrying...' : label}</span>
    </button>
  );
}

// ============================================================================
// ERROR BANNER
// ============================================================================

export interface ErrorBannerProps {
  error: FormattedError | string;
  onDismiss?: () => void;
  onRetry?: () => void;
  className?: string;
}

/**
 * Error banner for page-level errors
 * Requirements: 10.4 - Error toast notifications
 * 
 * @example
 * <ErrorBanner error={error} onRetry={handleRetry} onDismiss={handleDismiss} />
 */
export function ErrorBanner({
  error,
  onDismiss,
  onRetry,
  className = '',
}: ErrorBannerProps) {
  const errorData = typeof error === 'string'
    ? { title: 'Error', message: error, severity: 'error' as const }
    : error;

  const severityColors = {
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };

  return (
    <div
      className={`
        ${severityColors[errorData.severity]}
        border rounded-xl p-4 shadow-sm
        ${className}
      `}
      role="alert"
    >
      <div className="flex items-start gap-3">
        {errorData.icon && (
          <span className="text-2xl flex-shrink-0" role="img" aria-label="error icon">
            {errorData.icon}
          </span>
        )}
        
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base">{errorData.title}</h3>
          <p className="text-sm mt-1">{errorData.message}</p>
          
          {(onRetry || errorData.action) && (
            <div className="mt-3 flex gap-2">
              {onRetry && (
                <RetryButton
                  onRetry={onRetry}
                  variant="secondary"
                  className="text-sm py-1.5 px-3"
                />
              )}
              {errorData.action && !onRetry && errorData.action.type === 'retry' && (
                <button
                  onClick={onRetry}
                  className="text-sm font-medium underline hover:no-underline"
                >
                  {errorData.action.label}
                </button>
              )}
            </div>
          )}
        </div>

        {onDismiss && (
          <button
            onClick={onDismiss}
            className="flex-shrink-0 p-1 rounded-full hover:bg-black/5 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// OFFLINE BANNER
// ============================================================================

export interface OfflineBannerProps {
  className?: string;
}

/**
 * Offline banner displayed when no internet connection
 * Requirements: 10.1 - Display yellow banner when offline
 * 
 * @example
 * {isOffline && <OfflineBanner />}
 */
export function OfflineBanner({ className = '' }: OfflineBannerProps) {
  return (
    <div
      className={`
        bg-yellow-50 border-b-2 border-yellow-200 px-4 py-3
        ${className}
      `}
      role="alert"
    >
      <div className="flex items-center justify-center gap-2 text-yellow-800">
        <span className="text-lg" role="img" aria-label="offline">
          📡
        </span>
        <span className="font-medium text-sm">
          No internet - will sync when connected
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// ERROR STATE
// ============================================================================

export interface ErrorStateProps {
  error: FormattedError | string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Full error state for empty states or failed loads
 * Requirements: 10.4 - Error handling with retry
 * 
 * @example
 * <ErrorState error={error} onRetry={handleRetry} />
 */
export function ErrorState({
  error,
  onRetry,
  className = '',
}: ErrorStateProps) {
  const errorData = typeof error === 'string'
    ? { title: 'Error', message: error, icon: '❗', severity: 'error' as const }
    : error;

  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center ${className}`}>
      {errorData.icon && (
        <div className="text-6xl mb-4" role="img" aria-label="error icon">
          {errorData.icon}
        </div>
      )}
      
      <h2 className="text-xl font-bold text-slate-800 mb-2">
        {errorData.title}
      </h2>
      
      <p className="text-slate-600 mb-6 max-w-md">
        {errorData.message}
      </p>

      {onRetry && (
        <RetryButton onRetry={onRetry} variant="primary" />
      )}
    </div>
  );
}

// ============================================================================
// FORM FIELD WITH ERROR
// ============================================================================

export interface FormFieldProps {
  label: string;
  error?: FormattedError | string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * Form field wrapper with label and error display
 * Requirements: 19.1, 19.3 - Real-time validation, clear error messages
 * 
 * @example
 * <FormField label="Phone Number" error={phoneError} required>
 *   <input type="tel" />
 * </FormField>
 */
export function FormField({
  label,
  error,
  required = false,
  children,
  className = '',
}: FormFieldProps) {
  const hasError = !!error;

  return (
    <div className={`space-y-1 ${className}`}>
      <label className="block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      <div className={hasError ? 'ring-2 ring-red-500 rounded-lg' : ''}>
        {children}
      </div>
      
      <InlineError error={error} />
    </div>
  );
}

// ============================================================================
// LOADING ERROR STATE
// ============================================================================

export interface LoadingErrorStateProps {
  loading: boolean;
  error?: FormattedError | string | null;
  onRetry?: () => void;
  children: React.ReactNode;
  loadingComponent?: React.ReactNode;
  className?: string;
}

/**
 * Wrapper component that handles loading and error states
 * Requirements: 10.4 - Error handling with retry
 * 
 * @example
 * <LoadingErrorState loading={isLoading} error={error} onRetry={refetch}>
 *   <DataDisplay data={data} />
 * </LoadingErrorState>
 */
export function LoadingErrorState({
  loading,
  error,
  onRetry,
  children,
  loadingComponent,
  className = '',
}: LoadingErrorStateProps) {
  if (loading) {
    return (
      <div className={className}>
        {loadingComponent || (
          <div className="flex items-center justify-center p-8" role="status">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-whatsapp-green" />
          </div>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className={className}>
        <ErrorState error={error} onRetry={onRetry} />
      </div>
    );
  }

  return <div className={className}>{children}</div>;
}

// ============================================================================
// ERROR BOUNDARY FALLBACK
// ============================================================================

export interface ErrorBoundaryFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

/**
 * Fallback UI for React Error Boundaries
 * Requirements: 10.4 - Error handling
 * 
 * @example
 * <ErrorBoundary FallbackComponent={ErrorBoundaryFallback}>
 *   <App />
 * </ErrorBoundary>
 */
export function ErrorBoundaryFallback({
  error,
  resetErrorBoundary,
}: ErrorBoundaryFallbackProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8">
        <div className="text-center">
          <div className="text-6xl mb-4">😕</div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">
            Oops! Something went wrong
          </h1>
          <p className="text-slate-600 mb-6">
            We're sorry, but something unexpected happened. Please try refreshing the page.
          </p>
          
          {process.env.NODE_ENV === 'development' && (
            <details className="text-left mb-6 p-4 bg-red-50 rounded-lg">
              <summary className="cursor-pointer font-medium text-red-800 mb-2">
                Error Details (Development Only)
              </summary>
              <pre className="text-xs text-red-700 overflow-auto">
                {error.message}
                {'\n\n'}
                {error.stack}
              </pre>
            </details>
          )}

          <div className="flex gap-3 justify-center">
            <RetryButton
              onRetry={resetErrorBoundary}
              label="Try Again"
              variant="primary"
            />
            <button
              onClick={() => window.location.href = '/'}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
