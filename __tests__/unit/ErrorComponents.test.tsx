/**
 * Unit Tests for Error Components
 * Requirements: 10.4, 19.1, 19.3
 * 
 * Tests:
 * - Error message display
 * - Retry button functionality
 * - Form field error display
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  InlineError,
  RetryButton,
  ErrorBanner,
  OfflineBanner,
  ErrorState,
  FormField,
  LoadingErrorState,
  ErrorBoundaryFallback,
} from '@/app/components/ErrorComponents';
import type { FormattedError } from '@/app/lib/error-handler';

// ============================================================================
// INLINE ERROR TESTS
// ============================================================================

describe('InlineError', () => {
  it('should render error message with icon', () => {
    // Requirements: 19.3 - Clear error messages with icons
    const error: FormattedError = {
      title: 'Invalid Phone',
      message: 'Phone number should be 10 digits 📱',
      icon: '📱',
      severity: 'error',
    };

    render(<InlineError error={error} />);

    expect(screen.getByText(/Phone number should be 10 digits/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'error' })).toHaveTextContent('📱');
  });

  it('should render string error', () => {
    render(<InlineError error="This field is required" />);

    expect(screen.getByText('This field is required')).toBeInTheDocument();
  });

  it('should not render when error is undefined', () => {
    const { container } = render(<InlineError error={undefined} />);

    expect(container.firstChild).toBeNull();
  });

  it('should apply custom className', () => {
    const { container } = render(<InlineError error="Error" className="custom-class" />);

    expect(container.firstChild).toHaveClass('custom-class');
  });
});

// ============================================================================
// RETRY BUTTON TESTS
// ============================================================================

describe('RetryButton', () => {
  it('should render retry button with label', () => {
    // Requirements: 10.4 - Retry buttons
    const onRetry = vi.fn();
    render(<RetryButton onRetry={onRetry} />);

    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
  });

  it('should call onRetry when clicked', () => {
    const onRetry = vi.fn();
    render(<RetryButton onRetry={onRetry} />);

    fireEvent.click(screen.getByRole('button'));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('should show loading state', () => {
    const onRetry = vi.fn();
    render(<RetryButton onRetry={onRetry} loading={true} />);

    expect(screen.getByRole('button', { name: 'Retrying...' })).toBeInTheDocument();
    expect(screen.getByText('Retrying...')).toBeInTheDocument();
  });

  it('should be disabled when loading', () => {
    const onRetry = vi.fn();
    render(<RetryButton onRetry={onRetry} loading={true} />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('should be disabled when disabled prop is true', () => {
    const onRetry = vi.fn();
    render(<RetryButton onRetry={onRetry} disabled={true} />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('should render custom label', () => {
    const onRetry = vi.fn();
    render(<RetryButton onRetry={onRetry} label="Retry Now" />);

    expect(screen.getByText('Retry Now')).toBeInTheDocument();
  });

  it('should support different variants', () => {
    const onRetry = vi.fn();
    const { rerender } = render(<RetryButton onRetry={onRetry} variant="primary" />);
    
    let button = screen.getByRole('button');
    expect(button).toHaveClass('bg-whatsapp-green');

    rerender(<RetryButton onRetry={onRetry} variant="secondary" />);
    button = screen.getByRole('button');
    expect(button).toHaveClass('border-whatsapp-green');

    rerender(<RetryButton onRetry={onRetry} variant="text" />);
    button = screen.getByRole('button');
    expect(button).toHaveClass('text-whatsapp-green');
  });
});

// ============================================================================
// ERROR BANNER TESTS
// ============================================================================

describe('ErrorBanner', () => {
  it('should render error banner with formatted error', () => {
    // Requirements: 10.4 - Error display
    const error: FormattedError = {
      title: 'Connection Problem',
      message: 'No internet connection',
      icon: '📡',
      severity: 'error',
    };

    render(<ErrorBanner error={error} />);

    expect(screen.getByText('Connection Problem')).toBeInTheDocument();
    expect(screen.getByText('No internet connection')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'error icon' })).toHaveTextContent('📡');
  });

  it('should render string error', () => {
    render(<ErrorBanner error="Something went wrong" />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('should show retry button when onRetry provided', () => {
    const onRetry = vi.fn();
    const error: FormattedError = {
      title: 'Error',
      message: 'Failed',
      severity: 'error',
    };

    render(<ErrorBanner error={error} onRetry={onRetry} />);

    const retryButton = screen.getByRole('button', { name: /Try Again/i });
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalled();
  });

  it('should show dismiss button when onDismiss provided', () => {
    const onDismiss = vi.fn();
    const error: FormattedError = {
      title: 'Error',
      message: 'Failed',
      severity: 'error',
    };

    render(<ErrorBanner error={error} onDismiss={onDismiss} />);

    const dismissButton = screen.getByRole('button', { name: 'Dismiss' });
    expect(dismissButton).toBeInTheDocument();

    fireEvent.click(dismissButton);
    expect(onDismiss).toHaveBeenCalled();
  });

  it('should apply severity colors', () => {
    const { rerender, container } = render(
      <ErrorBanner error={{ title: 'Error', message: 'Test', severity: 'error' }} />
    );
    expect(container.firstChild).toHaveClass('bg-red-50');

    rerender(<ErrorBanner error={{ title: 'Warning', message: 'Test', severity: 'warning' }} />);
    expect(container.firstChild).toHaveClass('bg-yellow-50');

    rerender(<ErrorBanner error={{ title: 'Info', message: 'Test', severity: 'info' }} />);
    expect(container.firstChild).toHaveClass('bg-blue-50');
  });
});

// ============================================================================
// OFFLINE BANNER TESTS
// ============================================================================

describe('OfflineBanner', () => {
  it('should render offline banner', () => {
    // Requirements: 10.1 - Offline banner
    render(<OfflineBanner />);

    expect(screen.getByText(/No internet - will sync when connected/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'offline' })).toHaveTextContent('📡');
  });

  it('should have alert role', () => {
    render(<OfflineBanner />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});

// ============================================================================
// ERROR STATE TESTS
// ============================================================================

describe('ErrorState', () => {
  it('should render error state with icon and message', () => {
    const error: FormattedError = {
      title: 'Something Went Wrong',
      message: 'Please try again',
      icon: '❗',
      severity: 'error',
    };

    render(<ErrorState error={error} />);

    expect(screen.getByText('Something Went Wrong')).toBeInTheDocument();
    expect(screen.getByText('Please try again')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'error icon' })).toHaveTextContent('❗');
  });

  it('should show retry button when onRetry provided', () => {
    const onRetry = vi.fn();
    const error: FormattedError = {
      title: 'Error',
      message: 'Failed',
      severity: 'error',
    };

    render(<ErrorState error={error} onRetry={onRetry} />);

    const retryButton = screen.getByRole('button', { name: 'Try Again' });
    fireEvent.click(retryButton);

    expect(onRetry).toHaveBeenCalled();
  });
});

// ============================================================================
// FORM FIELD TESTS
// ============================================================================

describe('FormField', () => {
  it('should render label and children', () => {
    // Requirements: 19.1 - Form field with label
    render(
      <FormField label="Phone Number">
        <input type="tel" />
      </FormField>
    );

    expect(screen.getByText('Phone Number')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('should show required indicator', () => {
    render(
      <FormField label="Email" required>
        <input type="email" />
      </FormField>
    );

    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('should display error message', () => {
    // Requirements: 19.3 - Display error messages
    const error: FormattedError = {
      title: 'Invalid Email',
      message: 'Please check your email address 📧',
      icon: '📧',
      severity: 'error',
    };

    render(
      <FormField label="Email" error={error}>
        <input type="email" />
      </FormField>
    );

    expect(screen.getByText(/Please check your email address/)).toBeInTheDocument();
  });

  it('should apply error styling when error present', () => {
    const error: FormattedError = {
      title: 'Error',
      message: 'Invalid',
      severity: 'error',
    };

    const { container } = render(
      <FormField label="Field" error={error}>
        <input type="text" />
      </FormField>
    );

    const errorRing = container.querySelector('.ring-red-500');
    expect(errorRing).toBeInTheDocument();
  });
});

// ============================================================================
// LOADING ERROR STATE TESTS
// ============================================================================

describe('LoadingErrorState', () => {
  it('should show loading state', () => {
    render(
      <LoadingErrorState loading={true} error={null}>
        <div>Content</div>
      </LoadingErrorState>
    );

    expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument();
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('should show error state', () => {
    const error: FormattedError = {
      title: 'Error',
      message: 'Failed to load',
      severity: 'error',
    };

    render(
      <LoadingErrorState loading={false} error={error}>
        <div>Content</div>
      </LoadingErrorState>
    );

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('should show children when not loading and no error', () => {
    render(
      <LoadingErrorState loading={false} error={null}>
        <div>Content</div>
      </LoadingErrorState>
    );

    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('should show custom loading component', () => {
    render(
      <LoadingErrorState
        loading={true}
        error={null}
        loadingComponent={<div>Custom Loading</div>}
      >
        <div>Content</div>
      </LoadingErrorState>
    );

    expect(screen.getByText('Custom Loading')).toBeInTheDocument();
  });

  it('should call onRetry when retry button clicked', () => {
    const onRetry = vi.fn();
    const error: FormattedError = {
      title: 'Error',
      message: 'Failed',
      severity: 'error',
    };

    render(
      <LoadingErrorState loading={false} error={error} onRetry={onRetry}>
        <div>Content</div>
      </LoadingErrorState>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(onRetry).toHaveBeenCalled();
  });
});

// ============================================================================
// ERROR BOUNDARY FALLBACK TESTS
// ============================================================================

describe('ErrorBoundaryFallback', () => {
  it('should render error boundary fallback', () => {
    const error = new Error('Test error');
    const resetErrorBoundary = vi.fn();

    render(<ErrorBoundaryFallback error={error} resetErrorBoundary={resetErrorBoundary} />);

    expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
  });

  it('should call resetErrorBoundary when try again clicked', () => {
    const error = new Error('Test error');
    const resetErrorBoundary = vi.fn();

    render(<ErrorBoundaryFallback error={error} resetErrorBoundary={resetErrorBoundary} />);

    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(resetErrorBoundary).toHaveBeenCalled();
  });

  it('should show error details in development', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const error = new Error('Test error message');
    const resetErrorBoundary = vi.fn();

    render(<ErrorBoundaryFallback error={error} resetErrorBoundary={resetErrorBoundary} />);

    expect(screen.getByText(/Test error message/)).toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });
});
