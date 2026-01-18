'use client';

import React, { useCallback, useState } from 'react';
import { useUploadThing } from '@/lib/uploadthing-client';
import { Image as ImageIcon, Loader2, X, Plus, AlertCircle } from 'lucide-react';

interface UploadedFile {
  url: string;
  name: string;
  size: number;
  type: string;
}

interface IntakeImageUploaderProps {
  sessionId: string;
  onFilesUploaded: (files: UploadedFile[]) => void;
  uploadedFiles: UploadedFile[];
  onRemoveFile: (index: number) => void;
  disabled?: boolean;
}

/**
 * Image uploader component for intake chat
 * Uses UploadThing for secure file uploads
 * Requirements: 11.2, 11.6, 11.8
 */
export const IntakeImageUploader: React.FC<IntakeImageUploaderProps> = ({
  sessionId,
  onFilesUploaded,
  uploadedFiles,
  onRemoveFile,
  disabled = false,
}) => {
  const [error, setError] = useState<string | null>(null);

  const { startUpload, isUploading } = useUploadThing('intakeImageUploader', {
    headers: {
      'x-session-id': sessionId,
    },
    onClientUploadComplete: (res) => {
      if (res) {
        const newFiles: UploadedFile[] = res.map((file) => ({
          url: file.ufsUrl,
          name: file.name,
          size: file.size,
          type: file.type,
        }));
        onFilesUploaded(newFiles);
        setError(null);
      }
    },
    onUploadError: (err) => {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload image. Please try again.');
    },
  });

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0) return;
      
      setError(null);
      const files = Array.from(e.target.files);
      
      // Validate file count
      if (uploadedFiles.length + files.length > 4) {
        setError('Maximum 4 images allowed per message');
        return;
      }

      // Validate file sizes
      const oversizedFiles = files.filter((f) => f.size > 8 * 1024 * 1024);
      if (oversizedFiles.length > 0) {
        setError('Each image must be under 8MB');
        return;
      }

      await startUpload(files);
      
      // Reset input
      e.target.value = '';
    },
    [startUpload, uploadedFiles.length]
  );

  return (
    <div className="space-y-2">
      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Uploaded files preview */}
      {uploadedFiles.length > 0 && (
        <div className="flex gap-2 overflow-x-auto items-center p-1">
          {uploadedFiles.map((file, index) => (
            <div
              key={`${file.url}-${index}`}
              className="relative group shrink-0 animate-in fade-in zoom-in duration-200"
            >
              <img
                src={file.url}
                alt={file.name}
                className="h-16 w-16 object-cover rounded-xl border border-slate-200 shadow-sm"
              />
              <button
                type="button"
                onClick={() => onRemoveFile(index)}
                disabled={disabled}
                className="absolute -top-2 -right-2 bg-white text-red-500 border border-slate-200 rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-md hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}

          {/* Add more button */}
          {uploadedFiles.length < 4 && (
            <label
              className={`h-16 w-16 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-slate-400 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-all shrink-0 gap-1 cursor-pointer ${
                disabled || isUploading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isUploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  <span className="text-[10px] font-bold uppercase">Add</span>
                </>
              )}
              <input
                type="file"
                className="hidden"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                disabled={disabled || isUploading}
              />
            </label>
          )}
        </div>
      )}

      {/* Upload button when no files */}
      {uploadedFiles.length === 0 && (
        <label
          className={`inline-flex items-center gap-2 p-3 text-slate-500 hover:bg-slate-100 rounded-full transition-colors cursor-pointer ${
            disabled || isUploading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          title="Upload photo"
        >
          {isUploading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <ImageIcon className="w-6 h-6" />
          )}
          <input
            type="file"
            className="hidden"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            disabled={disabled || isUploading}
          />
        </label>
      )}
    </div>
  );
};

export default IntakeImageUploader;
