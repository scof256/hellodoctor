'use client';

import { Loader2, Trash2, AlertTriangle } from 'lucide-react';

/**
 * DeleteConfirmationDialog Component
 * 
 * Confirmation dialog for session deletion.
 * Requirements: 4.1, 4.4
 */
export interface DeleteConfirmationDialogProps {
  isOpen: boolean;
  sessionId: string;
  hasLinkedAppointment: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}

export function DeleteConfirmationDialog({
  isOpen,
  sessionId,
  hasLinkedAppointment,
  onConfirm,
  onCancel,
  isDeleting,
}: DeleteConfirmationDialogProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            {hasLinkedAppointment ? (
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            ) : (
              <Trash2 className="w-5 h-5 text-red-600" />
            )}
          </div>
          <h2 id="delete-dialog-title" className="text-lg font-semibold text-slate-800">
            {hasLinkedAppointment ? 'Cannot Delete Session' : 'Delete Session?'}
          </h2>
        </div>
        
        {hasLinkedAppointment ? (
          <>
            <p className="text-slate-600 mb-6">
              This session has a linked appointment and cannot be deleted. 
              Please cancel the appointment first if you want to remove this session.
            </p>
            <div className="flex justify-end">
              <button
                onClick={onCancel}
                className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors"
              >
                Got it
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-slate-600 mb-2">
              This action cannot be undone. This will permanently delete:
            </p>
            <ul className="text-slate-600 mb-6 list-disc list-inside text-sm space-y-1">
              <li>The intake session</li>
              <li>All chat messages in this session</li>
              <li>Any medical data collected</li>
            </ul>
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default DeleteConfirmationDialog;
