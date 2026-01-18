'use client';

import { useState, useRef, useCallback } from 'react';
import { Send, Image as ImageIcon, Loader2, X, Plus, AlertCircle, Mic } from 'lucide-react';
import { useUploadThing } from '@/lib/uploadthing-client';
import { VoiceInput } from './VoiceInput';

interface UploadedFile {
  url: string;
  name: string;
  size: number;
  type: string;
}

interface InputAreaProps {
  onSendMessage: (content: string, images?: string[]) => void;
  isSending: boolean;
  isDisabled?: boolean;
  sessionId?: string | null;
  placeholder?: string;
}

/**
 * Sticky input area component for chat messages
 * Requirements: 1.4 - Input area fixed at bottom of chat area
 * Requirements: 4.1 - Reset button included (handled by parent)
 */
export function InputArea({
  onSendMessage,
  isSending,
  isDisabled = false,
  sessionId,
  placeholder = 'Describe your symptoms...',
}: InputAreaProps) {
  const [input, setInput] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // UploadThing hook
  const { startUpload, isUploading } = useUploadThing('intakeImageUploader', {
    headers: sessionId ? { 'x-session-id': sessionId } : undefined,
    onClientUploadComplete: (res) => {
      if (res) {
        const newFiles: UploadedFile[] = res.map((file) => ({
          url: file.ufsUrl,
          name: file.name,
          size: file.size,
          type: file.type,
        }));
        setUploadedFiles((prev) => [...prev, ...newFiles]);
        setUploadError(null);
      }
    },
    onUploadError: (err) => {
      console.error('Upload error:', err);
      setUploadError(err.message || 'Failed to upload image');
    },
  });

  const handleSendMessage = useCallback(() => {
    if ((!input.trim() && uploadedFiles.length === 0) || isSending || isDisabled) return;
    
    const imageUrls = uploadedFiles.map((f) => f.url);
    onSendMessage(input.trim() || '[Image uploaded]', imageUrls.length > 0 ? imageUrls : undefined);
    setInput('');
    setUploadedFiles([]);
  }, [input, uploadedFiles, isSending, isDisabled, onSendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    setUploadError(null);
    const files = Array.from(e.target.files);
    
    if (uploadedFiles.length + files.length > 4) {
      setUploadError('Maximum 4 images allowed');
      e.target.value = '';
      return;
    }

    const oversizedFiles = files.filter((f) => f.size > 8 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      setUploadError('Each image must be under 8MB');
      e.target.value = '';
      return;
    }

    await startUpload(files);
    e.target.value = '';
  }, [startUpload, uploadedFiles.length]);

  const canSend = (input.trim() || uploadedFiles.length > 0) && !isSending && !isUploading && !isDisabled;

  const handleVoiceTranscript = (transcript: string) => {
    // Append transcript to existing input with a space if input exists
    const newInput = input ? `${input} ${transcript}` : transcript;
    setInput(newInput);
    setShowVoiceModal(false);
    setVoiceError(null);
  };

  const handleVoiceError = (error: string) => {
    setVoiceError(error);
  };

  return (
    <div className="sticky bottom-0 bg-white border-t border-slate-200 px-3 py-2.5 sm:px-4 sm:py-3 z-20">
      <div className="max-w-3xl mx-auto">
        {/* Upload error */}
        {uploadError && (
          <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg mb-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{uploadError}</span>
            <button onClick={() => setUploadError(null)} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Uploaded files preview */}
        {uploadedFiles.length > 0 && (
          <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
            {uploadedFiles.map((file, i) => (
              <div key={`${file.url}-${i}`} className="relative shrink-0">
                <img src={file.url} className="h-14 w-14 object-cover rounded-lg border border-slate-200" alt={file.name} />
                <button
                  onClick={() => setUploadedFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  disabled={isSending || isUploading}
                  className="absolute -top-1.5 -right-1.5 bg-white text-red-500 border border-slate-200 rounded-full w-5 h-5 flex items-center justify-center shadow-sm hover:bg-red-50"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {uploadedFiles.length < 4 && (
              <label className="h-14 w-14 flex items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-slate-400 hover:text-medical-600 hover:border-medical-400 cursor-pointer shrink-0">
                {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                <input type="file" className="hidden" accept="image/*" multiple onChange={handleFileSelect} disabled={isSending || isUploading} />
              </label>
            )}
          </div>
        )}

        {/* Input row */}
        <div className="flex items-end gap-1.5 sm:gap-2">
          <label className="p-2 sm:p-2.5 text-slate-500 hover:text-medical-600 hover:bg-slate-100 rounded-full cursor-pointer transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
            {isUploading ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> : <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5" />}
            <input type="file" className="hidden" accept="image/*" multiple onChange={handleFileSelect} disabled={isSending || isUploading || isDisabled} />
          </label>
          
          <button
            type="button"
            onClick={() => setShowVoiceModal(true)}
            disabled={isSending || isUploading || isDisabled}
            className="p-2 sm:p-2.5 text-slate-500 hover:text-medical-600 hover:bg-slate-100 rounded-full transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Voice input"
          >
            <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="w-full bg-slate-100 border-0 rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5 text-slate-800 focus:ring-2 focus:ring-medical-500 resize-none"
              rows={1}
              disabled={isSending || isUploading || isDisabled}
            />
          </div>
          
          <button
            onClick={handleSendMessage}
            disabled={!canSend}
            className="p-2 sm:p-2.5 bg-medical-600 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-medical-700 transition-colors shadow-md min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <Send className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>

      {/* Voice input modal */}
      {showVoiceModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={() => setShowVoiceModal(false)}
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Voice Input
              </h3>
              <button
                type="button"
                onClick={() => setShowVoiceModal(false)}
                className="rounded-full p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {voiceError && (
              <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {voiceError}
              </div>
            )}

            <VoiceInput
              onTranscript={handleVoiceTranscript}
              onError={handleVoiceError}
              language="en"
              placeholder="Tap the microphone to start"
            />
          </div>
        </div>
      )}
    </div>
  );
}
