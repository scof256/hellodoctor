'use client';

import { useState } from 'react';
import { RotateCcw, Loader2 } from 'lucide-react';
import { api } from '@/trpc/react';
import { useToast } from './Toast';
import { ResetConfirmationModal } from './ResetConfirmationModal';

/**
 * IntakeResetButton Component
 * 
 * Displays a reset button for intake sessions that allows patients to clear
 * their session data and start fresh. Only visible for sessions with status
 * 'not_started' or 'in_progress'.
 * 
 * Requirements: 1.1, 7.1, 7.6
 */
export interface IntakeResetButtonProps {
  sessionId: string;
  sessionStatus: 'not_started' | 'in_progress' | 'ready' | 'reviewed';
  onResetSuccess?: () => void;
}

export function IntakeResetButton({
  sessionId,
  sessionStatus,
  onResetSuccess,
}: IntakeResetButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { addToast } = useToast();
  const utils = api.useUtils();

  // Only show button for resettable statuses (Requirement: 1.1, 7.1)
  const canReset = sessionStatus === 'not_started' || sessionStatus === 'in_progress';

  const resetMutation = api.intake.resetSession.useMutation({
    onSuccess: () => {
      // Invalidate queries to refresh data
      utils.intake.getSession.invalidate({ sessionId });
      utils.intake.getMyIntakeSessions.invalidate();
      
      // Show success message (Requirement: 7.5)
      addToast({
        type: 'success',
        title: 'Session Reset',
        message: 'Your intake session has been reset successfully.',
        duration: 4000,
      });

      // Close modal
      setIsModalOpen(false);

      // Call optional callback
      onResetSuccess?.();
    },
    onError: (error) => {
      // Show error message (Requirement: 7.7)
      addToast({
        type: 'error',
        title: 'Reset Failed',
        message: error.message || 'Failed to reset intake session. Please try again.',
        duration: 5000,
      });
    },
  });

  const handleResetClick = () => {
    // Open confirmation modal (Requirement: 1.2, 7.2)
    setIsModalOpen(true);
  };

  const handleConfirmReset = () => {
    // Execute reset mutation (Requirement: 1.3, 7.5)
    resetMutation.mutate({ sessionId });
  };

  const handleCancelReset = () => {
    // Close modal without resetting (Requirement: 7.4)
    setIsModalOpen(false);
  };

  // Don't render button if session cannot be reset
  if (!canReset) {
    return null;
  }

  return (
    <>
      {/* Reset Button (Requirement: 7.1, 7.6) */}
      <button
        type="button"
        onClick={handleResetClick}
        disabled={resetMutation.isPending}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 hover:border-amber-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Reset intake session"
      >
        {resetMutation.isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Resetting...</span>
          </>
        ) : (
          <>
            <RotateCcw className="w-4 h-4" />
            <span>Reset Session</span>
          </>
        )}
      </button>

      {/* Confirmation Modal (Requirement: 1.2, 7.2, 7.3, 7.4, 7.5) */}
      <ResetConfirmationModal
        isOpen={isModalOpen}
        onConfirm={handleConfirmReset}
        onCancel={handleCancelReset}
        isResetting={resetMutation.isPending}
      />
    </>
  );
}

export default IntakeResetButton;
