'use client';

import { Loader2, RotateCcw } from 'lucide-react';

/**
 * ResetConfirmationDialog Component
 * 
 * Modal dialog for confirming conversation reset.
 * Requirements: 4.2 - WHEN the reset button is clicked, THE Intake_Chatbot SHALL display a confirmation dialog
 */
export interface ResetDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isResetting: boolean;
}

export function ResetConfirmationDialog({
  isOpen,
  onConfirm,
  onCancel,
  isResetting,
}: ResetDialogProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-dialog-title"
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
            <RotateCcw className="w-5 h-5 text-amber-600" />
          </div>
          <h2 id="reset-dialog-title" className="text-lg font-semibold text-slate-800">
            Reset Conversation?
          </h2>
        </div>
        <p className="text-slate-600 mb-6">
          This will start a new intake session. Your previous conversation will be saved for your records.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isResetting}
            className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isResetting}
            className="flex-1 px-4 py-2.5 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isResetting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Resetting...
              </>
            ) : (
              'Reset'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ResetConfirmationDialog;
