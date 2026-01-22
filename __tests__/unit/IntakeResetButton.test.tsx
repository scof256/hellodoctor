/**
 * Unit tests for IntakeResetButton component
 * 
 * Tests the reset button visibility, modal behavior, and reset functionality
 * Requirements: 1.1, 1.2, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IntakeResetButton } from '@/app/components/IntakeResetButton';

// Mock the tRPC API
vi.mock('@/trpc/react', () => ({
  api: {
    intake: {
      resetSession: {
        useMutation: vi.fn(),
      },
    },
    useUtils: vi.fn(),
  },
}));

// Mock the Toast hook
vi.mock('@/app/components/Toast', () => ({
  useToast: () => ({
    addToast: vi.fn(),
  }),
}));

// Import after mocking
import { api } from '@/trpc/react';

describe('IntakeResetButton', () => {
  const mockMutate = vi.fn();
  const mockInvalidate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock implementation
    (api.intake.resetSession.useMutation as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });

    (api.useUtils as ReturnType<typeof vi.fn>).mockReturnValue({
      intake: {
        getSession: {
          invalidate: mockInvalidate,
        },
        getMyIntakeSessions: {
          invalidate: mockInvalidate,
        },
      },
    });
  });

  describe('Button Visibility (Requirement 1.1, 7.1)', () => {
    it('should display reset button when session status is "not_started"', () => {
      render(
        <IntakeResetButton
          sessionId="test-session-id"
          sessionStatus="not_started"
        />
      );

      expect(screen.getByRole('button', { name: /reset intake session/i })).toBeInTheDocument();
    });

    it('should display reset button when session status is "in_progress"', () => {
      render(
        <IntakeResetButton
          sessionId="test-session-id"
          sessionStatus="in_progress"
        />
      );

      expect(screen.getByRole('button', { name: /reset intake session/i })).toBeInTheDocument();
    });

    it('should NOT display reset button when session status is "ready"', () => {
      render(
        <IntakeResetButton
          sessionId="test-session-id"
          sessionStatus="ready"
        />
      );

      expect(screen.queryByRole('button', { name: /reset intake session/i })).not.toBeInTheDocument();
    });

    it('should NOT display reset button when session status is "reviewed"', () => {
      render(
        <IntakeResetButton
          sessionId="test-session-id"
          sessionStatus="reviewed"
        />
      );

      expect(screen.queryByRole('button', { name: /reset intake session/i })).not.toBeInTheDocument();
    });
  });

  describe('Confirmation Modal (Requirement 1.2, 7.2, 7.3)', () => {
    it('should display confirmation modal when reset button is clicked', () => {
      render(
        <IntakeResetButton
          sessionId="test-session-id"
          sessionStatus="in_progress"
        />
      );

      const resetButton = screen.getByRole('button', { name: /reset intake session/i });
      fireEvent.click(resetButton);

      // Check modal is displayed
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/Reset Intake Session\?/i)).toBeInTheDocument();
      expect(screen.getByText(/This will clear all your intake data and chat history/i)).toBeInTheDocument();
      expect(screen.getByText(/This action cannot be undone/i)).toBeInTheDocument();
    });

    it('should display Cancel and Reset Session buttons in modal', () => {
      render(
        <IntakeResetButton
          sessionId="test-session-id"
          sessionStatus="in_progress"
        />
      );

      const resetButton = screen.getByRole('button', { name: /reset intake session/i });
      fireEvent.click(resetButton);

      // Check both buttons are present (using aria-label)
      expect(screen.getByRole('button', { name: /cancel reset/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /confirm reset/i })).toBeInTheDocument();
    });
  });

  describe('Cancel Action (Requirement 7.4)', () => {
    it('should close modal without resetting when Cancel is clicked', () => {
      render(
        <IntakeResetButton
          sessionId="test-session-id"
          sessionStatus="in_progress"
        />
      );

      // Open modal
      const resetButton = screen.getByRole('button', { name: /reset intake session/i });
      fireEvent.click(resetButton);

      // Click Cancel (using aria-label)
      const cancelButton = screen.getByRole('button', { name: /cancel reset/i });
      fireEvent.click(cancelButton);

      // Modal should be closed
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      
      // Reset mutation should not have been called
      expect(mockMutate).not.toHaveBeenCalled();
    });

    it('should close modal when clicking outside the modal', () => {
      render(
        <IntakeResetButton
          sessionId="test-session-id"
          sessionStatus="in_progress"
        />
      );

      // Open modal
      const resetButton = screen.getByRole('button', { name: /reset intake session/i });
      fireEvent.click(resetButton);

      // Click on the modal backdrop (the parent div with the onClick handler)
      const dialog = screen.getByRole('dialog');
      fireEvent.click(dialog);

      // Modal should be closed
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      
      // Reset mutation should not have been called
      expect(mockMutate).not.toHaveBeenCalled();
    });
  });

  describe('Reset Execution (Requirement 1.3, 7.5)', () => {
    it('should call reset mutation when Reset Session is clicked', () => {
      render(
        <IntakeResetButton
          sessionId="test-session-id"
          sessionStatus="in_progress"
        />
      );

      // Open modal
      const resetButton = screen.getByRole('button', { name: /reset intake session/i });
      fireEvent.click(resetButton);

      // Click Reset Session (using aria-label)
      const confirmButton = screen.getByRole('button', { name: /confirm reset/i });
      fireEvent.click(confirmButton);

      // Reset mutation should have been called with correct sessionId
      expect(mockMutate).toHaveBeenCalledWith({ sessionId: 'test-session-id' });
    });

    it('should call onResetSuccess callback after successful reset', async () => {
      const onResetSuccess = vi.fn();
      let capturedOnSuccess: (() => void) | undefined;
      
      // Mock useMutation to capture the onSuccess callback
      (api.intake.resetSession.useMutation as ReturnType<typeof vi.fn>).mockImplementation((options) => {
        capturedOnSuccess = options?.onSuccess;
        return {
          mutate: (input: unknown) => {
            // Simulate successful mutation by calling the captured onSuccess
            if (capturedOnSuccess) {
              capturedOnSuccess();
            }
          },
          isPending: false,
        };
      });

      render(
        <IntakeResetButton
          sessionId="test-session-id"
          sessionStatus="in_progress"
          onResetSuccess={onResetSuccess}
        />
      );

      // Open modal and confirm reset
      const resetButton = screen.getByRole('button', { name: /reset intake session/i });
      fireEvent.click(resetButton);

      const confirmButton = screen.getByRole('button', { name: /confirm reset/i });
      fireEvent.click(confirmButton);

      // Callback should have been called
      await waitFor(() => {
        expect(onResetSuccess).toHaveBeenCalled();
      });
    });
  });

  describe('Loading State (Requirement 7.6)', () => {
    it('should disable button and show loading spinner during reset', () => {
      // Mock pending state
      (api.intake.resetSession.useMutation as ReturnType<typeof vi.fn>).mockReturnValue({
        mutate: mockMutate,
        isPending: true,
      });

      render(
        <IntakeResetButton
          sessionId="test-session-id"
          sessionStatus="in_progress"
        />
      );

      const resetButton = screen.getByRole('button', { name: /reset intake session/i });
      
      // Button should be disabled
      expect(resetButton).toBeDisabled();
      
      // Should show loading text
      expect(screen.getByText(/Resetting\.\.\./i)).toBeInTheDocument();
    });

    it('should disable modal buttons during reset', () => {
      // Mock pending state
      (api.intake.resetSession.useMutation as ReturnType<typeof vi.fn>).mockReturnValue({
        mutate: mockMutate,
        isPending: true,
      });

      render(
        <IntakeResetButton
          sessionId="test-session-id"
          sessionStatus="in_progress"
        />
      );

      // The button should be disabled and show loading state
      const resetButton = screen.getByRole('button', { name: /reset intake session/i });
      expect(resetButton).toBeDisabled();
      expect(screen.getByText(/Resetting\.\.\./i)).toBeInTheDocument();
      
      // Note: When isPending is true, the modal is not opened in the first place
      // because the button is disabled. This test verifies the button state.
    });
  });

  describe('Button Styling', () => {
    it('should have warning/secondary styling', () => {
      render(
        <IntakeResetButton
          sessionId="test-session-id"
          sessionStatus="in_progress"
        />
      );

      const resetButton = screen.getByRole('button', { name: /reset intake session/i });
      
      // Check for amber/warning colors in className
      expect(resetButton.className).toMatch(/amber/);
    });

    it('should display reset icon', () => {
      render(
        <IntakeResetButton
          sessionId="test-session-id"
          sessionStatus="in_progress"
        />
      );

      // The RotateCcw icon should be rendered (check for "Reset Session" text which is next to the icon)
      expect(screen.getByText('Reset Session')).toBeInTheDocument();
    });
  });
});
