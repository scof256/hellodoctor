'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Image as ImageIcon, FileText, Activity, Loader2, X, Check, AlertCircle } from 'lucide-react';
import { api } from '@/trpc/react';
import { useUploadThing } from '@/lib/uploadthing-client';
import { useToast } from '@/app/components/Toast';
import { DraftPersistenceService, SaveStatus } from './DraftPersistenceService';

interface MessageInputProps {
  connectionId: string;
  onMessageSent?: () => void;
  disabled?: boolean;
}

interface TestResultData {
  testType: string;
  results: string;
}

interface ExamFindingData {
  system: string;
  findings: string;
}

/**
 * MessageInput Component
 * 
 * Provides input interface for doctors to:
 * - Send text messages
 * - Upload images (test results, scans)
 * - Add structured test results
 * - Add structured exam findings
 * 
 * Features:
 * - Auto-resize textarea (Requirement 2.3)
 * - Image upload with drag-and-drop (Requirement 2.4)
 * - Test result button with modal (Requirement 5.1, 5.2)
 * - Exam finding button with modal (Requirement 5.3, 5.4)
 * - Submit button with loading state (Requirement 2.3)
 * - Draft persistence to local storage (Requirement 12.1, 12.2, 12.3)
 * 
 * All messages are sent with contextLayer: 'doctor-enhancement'
 * 
 * Requirements: 2.3, 2.4, 5.1, 5.2, 5.3, 5.4, 12.1, 12.2, 12.3
 */
export default function MessageInput({
  connectionId,
  onMessageSent,
  disabled = false,
}: MessageInputProps) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTestResultModal, setShowTestResultModal] = useState(false);
  const [showExamFindingModal, setShowExamFindingModal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [storageWarningShown, setStorageWarningShown] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const draftServiceRef = useRef<DraftPersistenceService | null>(null);

  // Toast hook
  const { addToast } = useToast();

  // tRPC mutations
  const addMessageMutation = api.intake.addMessage.useMutation();
  const addImageMessageMutation = api.intake.addImageMessage.useMutation();

  // UploadThing hook for image uploads
  const { startUpload, isUploading } = useUploadThing('intakeImageUploader', {
    onClientUploadComplete: (files) => {
      if (files && files.length > 0) {
        const file = files[0];
        if (file?.url) {
          handleImageUploadComplete(file.url);
        }
      }
      setUploadProgress(null);
    },
    onUploadError: (error) => {
      console.error('Upload error:', error);
      addToast({ type: 'error', title: `Image upload failed: ${error.message}` });
      setUploadProgress(null);
    },
    onUploadProgress: (progress) => {
      setUploadProgress(progress);
    },
  });

  // Initialize draft persistence service (Requirement 12.1, 12.2, 12.3, 12.4, 12.5)
  useEffect(() => {
    const draftService = new DraftPersistenceService({
      onSaveStatusChange: (status) => {
        setSaveStatus(status);
      },
      onStorageUnavailable: () => {
        if (!storageWarningShown) {
          addToast({ type: 'warning', title: 'Draft auto-save is unavailable. Your messages will not be saved.' });
          setStorageWarningShown(true);
        }
      },
    }, {
      debounceMs: 2000, // 2 seconds
      expiryMs: 24 * 60 * 60 * 1000, // 24 hours
      storageKey: `intake-draft-${connectionId}`,
    });

    draftServiceRef.current = draftService;

    // Load draft on mount (Requirement 12.2)
    const savedDraft = draftService.loadDraft(connectionId);
    if (savedDraft) {
      setContent(savedDraft);
    }

    // Cleanup on unmount
    return () => {
      draftService.cleanup();
    };
  }, [connectionId, addToast, storageWarningShown]);

  // Auto-resize textarea (Requirement 2.3)
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [content]);

  // Handle text input change
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    
    // Save draft using DraftPersistenceService (Requirement 12.1)
    if (draftServiceRef.current) {
      draftServiceRef.current.saveDraft(newContent, connectionId);
    }
  };

  // Handle text message submission
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (!content.trim() || isSubmitting || disabled) return;

    setIsSubmitting(true);
    try {
      await addMessageMutation.mutateAsync({
        connectionId,
        content: content.trim(),
        messageType: 'text',
      });

      setContent('');
      
      // Clear draft using DraftPersistenceService (Requirement 12.4)
      if (draftServiceRef.current) {
        draftServiceRef.current.clearDraft(connectionId);
      }
      
      addToast({ type: 'success', title: 'Message sent' });
      onMessageSent?.();
    } catch (error) {
      console.error('Failed to send message:', error);
      addToast({ type: 'error', title: 'Failed to send message. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle image upload
  const handleImageUpload = async (files: File[]) => {
    if (files.length === 0) return;

    const file = files[0];
    if (!file) return;

    // Validate file type (Requirement 2.4)
    const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      addToast({ type: 'error', title: 'Invalid file type. Please upload JPEG, PNG, or PDF files.' });
      return;
    }

    // Validate file size (8MB limit)
    if (file.size > 8 * 1024 * 1024) {
      addToast({ type: 'error', title: 'File too large. Maximum size is 8MB.' });
      return;
    }

    try {
      setUploadProgress(0);
      await startUpload([file]);
    } catch (error) {
      console.error('Upload failed:', error);
      addToast({ type: 'error', title: 'Image upload failed. Please try again.' });
      setUploadProgress(null);
    }
  };

  // Handle image upload completion
  const handleImageUploadComplete = async (imageUrl: string) => {
    try {
      await addImageMessageMutation.mutateAsync({
        connectionId,
        imageUrl,
        messageType: 'image',
      });

      addToast({ type: 'success', title: 'Image uploaded' });
      onMessageSent?.();
    } catch (error) {
      console.error('Failed to send image message:', error);
      addToast({ type: 'error', title: 'Failed to send image. Please try again.' });
    }
  };

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleImageUpload(files);
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle drag and drop (Requirement 2.4)
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    handleImageUpload(files);
  };

  // Handle test result submission
  const handleTestResultSubmit = async (data: TestResultData) => {
    try {
      await addMessageMutation.mutateAsync({
        connectionId,
        content: `**Test Result: ${data.testType}**\n\n${data.results}`,
        messageType: 'test-result',
        metadata: {
          testType: data.testType,
        },
      });

      setShowTestResultModal(false);
      addToast({ type: 'success', title: 'Test result added' });
      onMessageSent?.();
    } catch (error) {
      console.error('Failed to add test result:', error);
      addToast({ type: 'error', title: 'Failed to add test result. Please try again.' });
    }
  };

  // Handle exam finding submission
  const handleExamFindingSubmit = async (data: ExamFindingData) => {
    try {
      await addMessageMutation.mutateAsync({
        connectionId,
        content: `**Exam Finding: ${data.system}**\n\n${data.findings}`,
        messageType: 'exam-finding',
        metadata: {
          examSystem: data.system,
        },
      });

      setShowExamFindingModal(false);
      addToast({ type: 'success', title: 'Exam finding added' });
      onMessageSent?.();
    } catch (error) {
      console.error('Failed to add exam finding:', error);
      addToast({ type: 'error', title: 'Failed to add exam finding. Please try again.' });
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Ctrl/Cmd + Enter
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isLoading = isSubmitting || isUploading || uploadProgress !== null;

  return (
    <>
      <div
        className={`
          flex-shrink-0 border-t border-gray-200 bg-white p-4 z-10
          ${isDragging ? 'bg-purple-50 border-purple-300' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Upload progress indicator */}
        {uploadProgress !== null && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-sm text-purple-600 mb-1">
              <span>Uploading image...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Drag and drop overlay */}
        {isDragging && (
          <div className="absolute inset-0 bg-purple-100/50 border-2 border-dashed border-purple-400 rounded-lg flex items-center justify-center z-10">
            <div className="text-center">
              <ImageIcon className="w-12 h-12 text-purple-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-purple-700">Drop image here</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Textarea input */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              onKeyDown={handleKeyDown}
              placeholder="Type your message... (Ctrl+Enter to send)"
              disabled={disabled || isLoading}
              className="
                w-full px-4 py-3 pr-12
                border border-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent
                resize-none
                disabled:bg-gray-50 disabled:text-gray-500
                min-h-[60px] max-h-[200px]
              "
              rows={1}
            />
            
            {/* Save status indicator (Requirement 12.4) */}
            <div className="absolute bottom-2 right-2 flex items-center gap-2">
              {saveStatus === 'saving' && (
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Saving...
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="text-xs text-emerald-600 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Saved
                </span>
              )}
              {saveStatus === 'error' && (
                <span className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Save failed
                </span>
              )}
              {content.length > 0 && saveStatus === 'idle' && (
                <span className="text-xs text-gray-400">
                  {content.length}
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {/* Image upload button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || isLoading}
                className="
                  inline-flex items-center gap-2 px-4 py-3 min-h-[44px] min-w-[44px]
                  text-sm font-medium text-gray-700
                  bg-white border border-gray-300 rounded-lg
                  hover:bg-gray-50 hover:border-gray-400
                  focus:outline-none focus:ring-2 focus:ring-purple-500
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors
                "
                title="Upload image"
              >
                <ImageIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Image</span>
              </button>

              {/* Test result button */}
              <button
                type="button"
                onClick={() => setShowTestResultModal(true)}
                disabled={disabled || isLoading}
                className="
                  inline-flex items-center gap-2 px-4 py-3 min-h-[44px] min-w-[44px]
                  text-sm font-medium text-gray-700
                  bg-white border border-gray-300 rounded-lg
                  hover:bg-gray-50 hover:border-gray-400
                  focus:outline-none focus:ring-2 focus:ring-purple-500
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors
                "
                title="Add test result"
              >
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">Test Result</span>
              </button>

              {/* Exam finding button */}
              <button
                type="button"
                onClick={() => setShowExamFindingModal(true)}
                disabled={disabled || isLoading}
                className="
                  inline-flex items-center gap-2 px-4 py-3 min-h-[44px] min-w-[44px]
                  text-sm font-medium text-gray-700
                  bg-white border border-gray-300 rounded-lg
                  hover:bg-gray-50 hover:border-gray-400
                  focus:outline-none focus:ring-2 focus:ring-purple-500
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors
                "
                title="Add exam finding"
              >
                <Activity className="w-4 h-4" />
                <span className="hidden sm:inline">Exam Finding</span>
              </button>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={!content.trim() || disabled || isLoading}
              className="
                inline-flex items-center gap-2 px-5 py-3 min-h-[44px]
                text-sm font-medium text-white
                bg-purple-600 rounded-lg
                hover:bg-purple-700
                focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors
              "
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          onChange={handleFileInputChange}
          className="hidden"
        />
      </div>

      {/* Test Result Modal */}
      {showTestResultModal && (
        <TestResultModal
          onSubmit={handleTestResultSubmit}
          onClose={() => setShowTestResultModal(false)}
        />
      )}

      {/* Exam Finding Modal */}
      {showExamFindingModal && (
        <ExamFindingModal
          onSubmit={handleExamFindingSubmit}
          onClose={() => setShowExamFindingModal(false)}
        />
      )}
    </>
  );
}

/**
 * Test Result Modal Component
 * Structured input for test results
 */
function TestResultModal({
  onSubmit,
  onClose,
}: {
  onSubmit: (data: TestResultData) => void;
  onClose: () => void;
}) {
  const [testType, setTestType] = useState('');
  const [results, setResults] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (testType.trim() && results.trim()) {
      onSubmit({ testType: testType.trim(), results: results.trim() });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Add Test Result</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label htmlFor="testType" className="block text-sm font-medium text-gray-700 mb-2">
              Test Type *
            </label>
            <input
              id="testType"
              type="text"
              value={testType}
              onChange={(e) => setTestType(e.target.value)}
              placeholder="e.g., Complete Blood Count, Chest X-Ray"
              className="
                w-full px-4 py-2
                border border-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent
              "
              required
            />
          </div>

          <div>
            <label htmlFor="results" className="block text-sm font-medium text-gray-700 mb-2">
              Results *
            </label>
            <textarea
              id="results"
              value={results}
              onChange={(e) => setResults(e.target.value)}
              placeholder="Enter test results, findings, and interpretation..."
              rows={8}
              className="
                w-full px-4 py-2
                border border-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent
                resize-none
              "
              required
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="
                px-5 py-3 min-h-[44px] text-sm font-medium text-gray-700
                bg-white border border-gray-300 rounded-lg
                hover:bg-gray-50
                focus:outline-none focus:ring-2 focus:ring-purple-500
              "
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!testType.trim() || !results.trim()}
              className="
                px-5 py-3 min-h-[44px] text-sm font-medium text-white
                bg-purple-600 rounded-lg
                hover:bg-purple-700
                focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              Add Test Result
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Exam Finding Modal Component
 * Structured input for physical examination findings
 */
function ExamFindingModal({
  onSubmit,
  onClose,
}: {
  onSubmit: (data: ExamFindingData) => void;
  onClose: () => void;
}) {
  const [system, setSystem] = useState('');
  const [findings, setFindings] = useState('');

  const commonSystems = [
    'General',
    'Cardiovascular',
    'Respiratory',
    'Gastrointestinal',
    'Neurological',
    'Musculoskeletal',
    'Skin',
    'HEENT (Head, Eyes, Ears, Nose, Throat)',
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (system.trim() && findings.trim()) {
      onSubmit({ system: system.trim(), findings: findings.trim() });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Add Exam Finding</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label htmlFor="system" className="block text-sm font-medium text-gray-700 mb-2">
              Body System *
            </label>
            <select
              id="system"
              value={system}
              onChange={(e) => setSystem(e.target.value)}
              className="
                w-full px-4 py-2
                border border-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent
              "
              required
            >
              <option value="">Select a system...</option>
              {commonSystems.map((sys) => (
                <option key={sys} value={sys}>
                  {sys}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="findings" className="block text-sm font-medium text-gray-700 mb-2">
              Findings *
            </label>
            <textarea
              id="findings"
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
              placeholder="Describe physical examination findings..."
              rows={8}
              className="
                w-full px-4 py-2
                border border-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent
                resize-none
              "
              required
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="
                px-5 py-3 min-h-[44px] text-sm font-medium text-gray-700
                bg-white border border-gray-300 rounded-lg
                hover:bg-gray-50
                focus:outline-none focus:ring-2 focus:ring-purple-500
              "
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!system.trim() || !findings.trim()}
              className="
                px-5 py-3 min-h-[44px] text-sm font-medium text-white
                bg-purple-600 rounded-lg
                hover:bg-purple-700
                focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              Add Exam Finding
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
