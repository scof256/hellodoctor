'use client';

import { Loader2, RotateCcw } from 'lucide-react';

/**
 * ResetConfirmationModal Component
 * 
 * Confirmation modal for intake session reset.
 * Displays a warning message and provides Cancel/Reset actions.
 * 
 * Requirements: 1.2, 7.2, 7.3, 7.4, 7.5
 */
export interface ResetConfirmationModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isResetting: boolean;
}

export function ResetConfirmationModal({
  isOpen,
  onConfirm,
  onCancel,
  isResetting,
}: ResetConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-modal-title"
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <RotateCcw className="w-6 h-6 text-amber-600" />
          </div>
          <h2 id="reset-modal-title" className="text-xl font-bold text-slate-800">
            Reset Intake Session?
          </h2>
        </div>

        {/* Warning Message (Requirement: 7.2) */}
        <div className="mb-6">
          <p className="text-slate-700 mb-3">
            This will clear all your intake data and chat history. You'll start fresh from the beginning.
          </p>
          <p className="text-sm text-amber-700 font-medium bg-amber-50 border border-amber-200 rounded-lg p-3">
            ⚠️ This action cannot be undone.
          </p>
        </div>

        {/* Action Buttons (Requirement: 7.3) */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isResetting}
            className="flex-1 px-4 py-2.5 border-2 border-slate-300 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Cancel reset"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isResetting}
            className="flex-1 px-4 py-2.5 bg-amber-600 text-white font-medium rounded-xl hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            aria-label="Confirm reset"
          >
            {isResetting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Resetting...
              </>
            ) : (
              'Reset Session'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ResetConfirmationModal;
