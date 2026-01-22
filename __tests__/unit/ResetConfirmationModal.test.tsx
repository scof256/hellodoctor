/**
 * Unit tests for ResetConfirmationModal component
 * 
 * Tests the modal display, button behavior, and user interactions
 * Requirements: 1.2, 7.2, 7.3, 7.4, 7.5
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { ResetConfirmationModal } from '@/app/components/ResetConfirmationModal';

describe('ResetConfirmationModal', () => {
  const mockOnConfirm = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Modal Visibility', () => {
    it('should not render when isOpen is false', () => {
      render(
        <ResetConfirmationModal
          isOpen={false}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
          isResetting={false}
        />
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      render(
        <ResetConfirmationModal
          isOpen={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
          isResetting={false}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('Modal Content (Requirement 7.2)', () => {
    it('should display the modal title', () => {
      render(
        <ResetConfirmationModal
          isOpen={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
          isResetting={false}
        />
      );

      expect(screen.getByText('Reset Intake Session?')).toBeInTheDocument();
    });

    it('should display warning message about data clearing', () => {
      render(
        <ResetConfirmationModal
          isOpen={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
          isResetting={false}
        />
      );

      expect(
        screen.getByText(/This will clear all your intake data and chat history/i)
      ).toBeInTheDocument();
    });

    it('should display warning that action cannot be undone', () => {
      render(
        <ResetConfirmationModal
          isOpen={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
          isResetting={false}
        />
      );

      expect(screen.getByText(/This action cannot be undone/i)).toBeInTheDocument();
    });

    it('should display reset icon', () => {
      render(
        <ResetConfirmationModal
          isOpen={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
          isResetting={false}
        />
      );

      // Check for the icon container with amber background
      const iconContainer = screen.getByRole('dialog').querySelector('.bg-amber-100');
      expect(iconContainer).toBeInTheDocument();
    });
  });

  describe('Modal Buttons (Requirement 7.3)', () => {
    it('should display Cancel button', () => {
      render(
        <ResetConfirmationModal
          isOpen={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
          isResetting={false}
        />
      );

      expect(screen.getByRole('button', { name: /cancel reset/i })).toBeInTheDocument();
    });

    it('should display Reset Session button', () => {
      render(
        <ResetConfirmationModal
          isOpen={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
          isResetting={false}
        />
      );

      expect(screen.getByRole('button', { name: /confirm reset/i })).toBeInTheDocument();
    });

    it('should have both buttons visible simultaneously', () => {
      render(
        <ResetConfirmationModal
          isOpen={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
          isResetting={false}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel reset/i });
      const confirmButton = screen.getByRole('button', { name: /confirm reset/i });

      expect(cancelButton).toBeInTheDocument();
      expect(confirmButton).toBeInTheDocument();
    });
  });

  describe('Cancel Action (Requirement 7.4)', () => {
    it('should call onCancel when Cancel button is clicked', () => {
      render(
        <ResetConfirmationModal
          isOpen={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
          isResetting={false}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel reset/i });
      fireEvent.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it('should call onCancel when clicking outside the modal', () => {
      render(
        <ResetConfirmationModal
          isOpen={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
          isResetting={false}
        />
      );

      const backdrop = screen.getByRole('dialog');
      fireEvent.click(backdrop);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it('should NOT call onCancel when clicking inside the modal content', () => {
      render(
        <ResetConfirmationModal
          isOpen={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
          isResetting={false}
        />
      );

      const modalContent = screen.getByRole('dialog').querySelector('.bg-white');
      if (modalContent) {
        fireEvent.click(modalContent);
      }

      expect(mockOnCancel).not.toHaveBeenCalled();
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });
  });

  describe('Confirm Action (Requirement 7.5)', () => {
    it('should call onConfirm when Reset Session button is clicked', () => {
      render(
        <ResetConfirmationModal
          isOpen={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
          isResetting={false}
        />
      );

      const confirmButton = screen.getByRole('button', { name: /confirm reset/i });
      fireEvent.click(confirmButton);

      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
      expect(mockOnCancel).not.toHaveBeenCalled();
    });
  });

  describe('Loading State', () => {
    it('should disable Cancel button when isResetting is true', () => {
      render(
        <ResetConfirmationModal
          isOpen={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
          isResetting={true}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel reset/i });
      expect(cancelButton).toBeDisabled();
    });

    it('should disable Reset Session button when isResetting is true', () => {
      render(
        <ResetConfirmationModal
          isOpen={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
          isResetting={true}
        />
      );

      const confirmButton = screen.getByRole('button', { name: /confirm reset/i });
      expect(confirmButton).toBeDisabled();
    });

    it('should show loading text when isResetting is true', () => {
      render(
        <ResetConfirmationModal
          isOpen={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
          isResetting={true}
        />
      );

      expect(screen.getByText(/Resetting\.\.\./i)).toBeInTheDocument();
    });

    it('should show normal text when isResetting is false', () => {
      render(
        <ResetConfirmationModal
          isOpen={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
          isResetting={false}
        />
      );

      expect(screen.getByText('Reset Session')).toBeInTheDocument();
      expect(screen.queryByText(/Resetting\.\.\./i)).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(
        <ResetConfirmationModal
          isOpen={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
          isResetting={false}
        />
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'reset-modal-title');
    });

    it('should have accessible button labels', () => {
      render(
        <ResetConfirmationModal
          isOpen={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
          isResetting={false}
        />
      );

      expect(screen.getByRole('button', { name: /cancel reset/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /confirm reset/i })).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('should have warning/amber color scheme', () => {
      render(
        <ResetConfirmationModal
          isOpen={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
          isResetting={false}
        />
      );

      const confirmButton = screen.getByRole('button', { name: /confirm reset/i });
      expect(confirmButton.className).toMatch(/amber/);
    });

    it('should have proper modal backdrop styling', () => {
      render(
        <ResetConfirmationModal
          isOpen={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
          isResetting={false}
        />
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog.className).toMatch(/bg-black\/50/);
    });
  });
});
