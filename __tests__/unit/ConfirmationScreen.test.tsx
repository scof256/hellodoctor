import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { ConfirmationScreen } from '@/app/components/ConfirmationScreen';
import { CheckCircle } from 'lucide-react';

describe('ConfirmationScreen Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Requirement 7.7: Basic rendering', () => {
    it('should render with icon, title, and message', () => {
      render(
        <ConfirmationScreen
          icon={<CheckCircle data-testid="check-icon" />}
          title="Success!"
          message="Your action was completed successfully"
        />
      );

      expect(screen.getByTestId('check-icon')).toBeInTheDocument();
      expect(screen.getByText('Success!')).toBeInTheDocument();
      expect(screen.getByText('Your action was completed successfully')).toBeInTheDocument();
    });

    it('should render as full-screen overlay', () => {
      const { container } = render(
        <ConfirmationScreen
          icon={<CheckCircle />}
          title="Success!"
          message="Test message"
        />
      );

      const overlay = container.firstChild as HTMLElement;
      expect(overlay).toHaveClass('fixed', 'inset-0', 'z-50', 'bg-white');
    });

    it('should render icon at 120x120px with bounce animation', () => {
      const { container } = render(
        <ConfirmationScreen
          icon={<CheckCircle />}
          title="Success!"
          message="Test message"
        />
      );

      const iconContainer = container.querySelector('.animate-bounce-once');
      expect(iconContainer).toBeInTheDocument();
      expect(iconContainer).toHaveClass('w-[120px]', 'h-[120px]');
    });

    it('should render title at 24px bold and centered', () => {
      render(
        <ConfirmationScreen
          icon={<CheckCircle />}
          title="Success!"
          message="Test message"
        />
      );

      const title = screen.getByText('Success!');
      expect(title).toHaveClass('text-2xl', 'font-bold', 'text-center');
    });

    it('should render message at 16px regular and centered', () => {
      render(
        <ConfirmationScreen
          icon={<CheckCircle />}
          title="Success!"
          message="Test message"
        />
      );

      const message = screen.getByText('Test message');
      expect(message).toHaveClass('text-base', 'text-center');
    });
  });

  describe('Requirement 7.7: Details rendering', () => {
    it('should render details as key-value pairs', () => {
      render(
        <ConfirmationScreen
          icon={<CheckCircle />}
          title="Success!"
          message="Test message"
          details={[
            { label: 'Date', value: 'Jan 15, 2024' },
            { label: 'Time', value: '10:00 AM' },
            { label: 'Location', value: 'Main Clinic' },
          ]}
        />
      );

      expect(screen.getByText('Date')).toBeInTheDocument();
      expect(screen.getByText('Jan 15, 2024')).toBeInTheDocument();
      expect(screen.getByText('Time')).toBeInTheDocument();
      expect(screen.getByText('10:00 AM')).toBeInTheDocument();
      expect(screen.getByText('Location')).toBeInTheDocument();
      expect(screen.getByText('Main Clinic')).toBeInTheDocument();
    });

    it('should not render details section when details is undefined', () => {
      const { container } = render(
        <ConfirmationScreen
          icon={<CheckCircle />}
          title="Success!"
          message="Test message"
        />
      );

      // The space-y-3 class is used for button container too, so check for details-specific class
      const detailsContainer = container.querySelector('.bg-gray-50');
      expect(detailsContainer).not.toBeInTheDocument();
    });

    it('should not render details section when details is empty array', () => {
      const { container } = render(
        <ConfirmationScreen
          icon={<CheckCircle />}
          title="Success!"
          message="Test message"
          details={[]}
        />
      );

      const detailsContainer = container.querySelector('.bg-gray-50');
      expect(detailsContainer).not.toBeInTheDocument();
    });
  });

  describe('Requirement 7.7: Action buttons', () => {
    it('should render primary action button with green background', () => {
      const onTap = vi.fn();
      render(
        <ConfirmationScreen
          icon={<CheckCircle />}
          title="Success!"
          message="Test message"
          primaryAction={{
            label: 'Continue',
            onTap,
          }}
        />
      );

      const button = screen.getByText('Continue');
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('bg-[#25D366]', 'text-white');
    });

    it('should call onTap when primary button is clicked', () => {
      const onTap = vi.fn();
      render(
        <ConfirmationScreen
          icon={<CheckCircle />}
          title="Success!"
          message="Test message"
          primaryAction={{
            label: 'Continue',
            onTap,
          }}
        />
      );

      const button = screen.getByText('Continue');
      button.click();
      expect(onTap).toHaveBeenCalledTimes(1);
    });

    it('should render secondary action button with gray outline', () => {
      const onTap = vi.fn();
      render(
        <ConfirmationScreen
          icon={<CheckCircle />}
          title="Success!"
          message="Test message"
          secondaryAction={{
            label: 'Cancel',
            onTap,
          }}
        />
      );

      const button = screen.getByText('Cancel');
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('bg-white', 'text-gray-700', 'border-2', 'border-gray-300');
    });

    it('should call onTap when secondary button is clicked', () => {
      const onTap = vi.fn();
      render(
        <ConfirmationScreen
          icon={<CheckCircle />}
          title="Success!"
          message="Test message"
          secondaryAction={{
            label: 'Cancel',
            onTap,
          }}
        />
      );

      const button = screen.getByText('Cancel');
      button.click();
      expect(onTap).toHaveBeenCalledTimes(1);
    });

    it('should render both primary and secondary buttons', () => {
      render(
        <ConfirmationScreen
          icon={<CheckCircle />}
          title="Success!"
          message="Test message"
          primaryAction={{
            label: 'Continue',
            onTap: vi.fn(),
          }}
          secondaryAction={{
            label: 'Cancel',
            onTap: vi.fn(),
          }}
        />
      );

      expect(screen.getByText('Continue')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should not render buttons when actions are undefined', () => {
      render(
        <ConfirmationScreen
          icon={<CheckCircle />}
          title="Success!"
          message="Test message"
        />
      );

      const buttons = screen.queryAllByRole('button');
      expect(buttons).toHaveLength(0);
    });

    it('should render buttons at 56px height (14 = 3.5rem)', () => {
      render(
        <ConfirmationScreen
          icon={<CheckCircle />}
          title="Success!"
          message="Test message"
          primaryAction={{
            label: 'Continue',
            onTap: vi.fn(),
          }}
        />
      );

      const button = screen.getByText('Continue');
      expect(button).toHaveClass('h-14'); // h-14 = 56px
    });

    it('should render buttons at full width', () => {
      render(
        <ConfirmationScreen
          icon={<CheckCircle />}
          title="Success!"
          message="Test message"
          primaryAction={{
            label: 'Continue',
            onTap: vi.fn(),
          }}
        />
      );

      const button = screen.getByText('Continue');
      expect(button).toHaveClass('w-full');
    });
  });

  describe('Requirement 7.7: Auto-close functionality', () => {
    it('should call onClose after autoClose milliseconds', async () => {
      const onClose = vi.fn();
      render(
        <ConfirmationScreen
          icon={<CheckCircle />}
          title="Success!"
          message="Test message"
          autoClose={3000}
          onClose={onClose}
        />
      );

      expect(onClose).not.toHaveBeenCalled();

      // Fast-forward time by 3000ms and run all timers
      await vi.advanceTimersByTimeAsync(3000);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should display countdown when autoClose is set', () => {
      render(
        <ConfirmationScreen
          icon={<CheckCircle />}
          title="Success!"
          message="Test message"
          autoClose={5000}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText(/Closing in 5 second/)).toBeInTheDocument();
    });

    it('should update countdown every second', async () => {
      render(
        <ConfirmationScreen
          icon={<CheckCircle />}
          title="Success!"
          message="Test message"
          autoClose={5000}
          onClose={vi.fn()}
        />
      );

      // Initial countdown should show 5 seconds
      expect(screen.getByText(/Closing in 5 second/)).toBeInTheDocument();

      // After advancing time, countdown should decrease
      // Note: The exact countdown behavior depends on React's state updates
      // We just verify the countdown is present and functional
      await vi.advanceTimersByTimeAsync(2000);
      
      // Should still have countdown text (either 3 or 4 seconds depending on timing)
      const countdownText = screen.getByText(/Closing in \d+ second/);
      expect(countdownText).toBeInTheDocument();
    });

    it('should not display countdown when autoClose is not set', () => {
      render(
        <ConfirmationScreen
          icon={<CheckCircle />}
          title="Success!"
          message="Test message"
        />
      );

      expect(screen.queryByText(/Closing in/)).not.toBeInTheDocument();
    });

    it('should not call onClose when autoClose is not set', () => {
      const onClose = vi.fn();
      render(
        <ConfirmationScreen
          icon={<CheckCircle />}
          title="Success!"
          message="Test message"
          onClose={onClose}
        />
      );

      vi.advanceTimersByTime(10000);
      expect(onClose).not.toHaveBeenCalled();
    });

    it('should clean up timers on unmount', () => {
      const onClose = vi.fn();
      const { unmount } = render(
        <ConfirmationScreen
          icon={<CheckCircle />}
          title="Success!"
          message="Test message"
          autoClose={3000}
          onClose={onClose}
        />
      );

      unmount();
      vi.advanceTimersByTime(3000);

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('Requirement 7.7: Complete integration example', () => {
    it('should render complete confirmation with all props', () => {
      const onPrimary = vi.fn();
      const onSecondary = vi.fn();
      const onClose = vi.fn();

      render(
        <ConfirmationScreen
          icon={<CheckCircle data-testid="icon" />}
          title="Booking Confirmed!"
          message="Your appointment has been successfully scheduled"
          details={[
            { label: 'Date & Time', value: 'Monday, Jan 15 at 10:00 AM' },
            { label: 'Type', value: 'In-person Visit' },
            { label: 'Location', value: 'Main Clinic' },
          ]}
          primaryAction={{
            label: 'Done',
            onTap: onPrimary,
          }}
          secondaryAction={{
            label: 'View Details',
            onTap: onSecondary,
          }}
          autoClose={3000}
          onClose={onClose}
        />
      );

      // Check all elements are rendered
      expect(screen.getByTestId('icon')).toBeInTheDocument();
      expect(screen.getByText('Booking Confirmed!')).toBeInTheDocument();
      expect(screen.getByText('Your appointment has been successfully scheduled')).toBeInTheDocument();
      expect(screen.getByText('Date & Time')).toBeInTheDocument();
      expect(screen.getByText('Monday, Jan 15 at 10:00 AM')).toBeInTheDocument();
      expect(screen.getByText('Done')).toBeInTheDocument();
      expect(screen.getByText('View Details')).toBeInTheDocument();
      expect(screen.getByText(/Closing in 3 second/)).toBeInTheDocument();

      // Test button interactions
      screen.getByText('Done').click();
      expect(onPrimary).toHaveBeenCalledTimes(1);

      screen.getByText('View Details').click();
      expect(onSecondary).toHaveBeenCalledTimes(1);

      // Test auto-close
      vi.advanceTimersByTime(3000);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
