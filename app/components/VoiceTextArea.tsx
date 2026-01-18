'use client';

import { useState } from 'react';
import { Mic } from 'lucide-react';
import { VoiceInput } from './VoiceInput';

export interface VoiceTextAreaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  language?: string;
  disabled?: boolean;
  className?: string;
  textareaClassName?: string;
  showVoiceButton?: boolean;
  rows?: number;
}

/**
 * Textarea field with integrated voice input capability
 * Displays a microphone button that opens a voice input modal
 */
export function VoiceTextArea({
  value,
  onChange,
  placeholder = 'Type or speak...',
  language = 'en',
  disabled = false,
  className = '',
  textareaClassName = '',
  showVoiceButton = true,
  rows = 3,
}: VoiceTextAreaProps) {
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const handleTranscript = (transcript: string) => {
    // Append transcript to existing value with a space if value exists
    const newValue = value ? `${value} ${transcript}` : transcript;
    onChange(newValue);
    setShowVoiceModal(false);
    setVoiceError(null);
  };

  const handleError = (error: string) => {
    setVoiceError(error);
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          rows={rows}
          className={`
            w-full rounded-lg border border-gray-300 px-4 py-2 pr-12
            focus:border-medical-500 focus:outline-none focus:ring-2 focus:ring-medical-500
            disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500
            dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100
            resize-none
            ${textareaClassName}
          `}
        />
        
        {showVoiceButton && (
          <button
            type="button"
            onClick={() => setShowVoiceModal(true)}
            disabled={disabled}
            className="absolute right-2 top-2 rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-medical-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-700"
            aria-label="Voice input"
          >
            <Mic className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Voice error display */}
      {voiceError && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{voiceError}</p>
      )}

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
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <VoiceInput
              onTranscript={handleTranscript}
              onError={handleError}
              language={language}
              placeholder="Tap the microphone to start"
            />
          </div>
        </div>
      )}
    </div>
  );
}
