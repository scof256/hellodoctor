'use client';

import React, { useCallback, useState } from 'react';
import { useUploadThing } from '@/lib/uploadthing-client';
import { Camera, Loader2, X, Upload, AlertCircle, Trash2 } from 'lucide-react';
import { api } from '@/trpc/react';

interface ProfilePhotoUploaderProps {
  currentPhotoUrl?: string | null;
  onPhotoUploaded?: (url: string, key: string) => void;
  onPhotoDeleted?: () => void;
  disabled?: boolean;
}

/**
 * Profile photo uploader component for doctor profiles
 * Uses UploadThing for secure file uploads with drag-and-drop support
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */
export const ProfilePhotoUploader: React.FC<ProfilePhotoUploaderProps> = ({
  currentPhotoUrl,
  onPhotoUploaded,
  onPhotoDeleted,
  disabled = false,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const { startUpload, isUploading } = useUploadThing('doctorProfilePhotoUploader', {
    onClientUploadComplete: (res) => {
      if (res && res[0]) {
        const file = res[0];
        onPhotoUploaded?.(file.ufsUrl, file.key);
        setError(null);
        setUploadProgress(0);
      }
    },
    onUploadError: (err) => {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload photo. Please try again.');
      setUploadProgress(0);
    },
    onUploadProgress: (progress) => {
      setUploadProgress(progress);
    },
  });

  const deletePhotoMutation = api.doctor.deleteProfilePhoto.useMutation({
    onSuccess: () => {
      onPhotoDeleted?.();
      setError(null);
    },
    onError: (err) => {
      setError(err.message || 'Failed to delete photo. Please try again.');
    },
  });

  // Validate file type (client-side)
  const validateFileType = (file: File): boolean => {
    const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!acceptedTypes.includes(file.type)) {
      setError('Please upload a valid image file (JPEG, PNG, WebP, or GIF)');
      return false;
    }
    return true;
  };

  // Validate file size (client-side)
  const validateFileSize = (file: File): boolean => {
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setError('Image size must be under 5MB');
      return false;
    }
    return true;
  };

  const handleFileSelect = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      setError(null);
      const file = files[0];

      // Validate file type
      if (!validateFileType(file)) {
        return;
      }

      // Validate file size
      if (!validateFileSize(file)) {
        return;
      }

      await startUpload([file]);
    },
    [startUpload]
  );

  const handleInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0) return;
      const files = Array.from(e.target.files);
      await handleFileSelect(files);
      // Reset input
      e.target.value = '';
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      await handleFileSelect(files);
    },
    [handleFileSelect]
  );

  const handleDelete = useCallback(async () => {
    if (window.confirm('Are you sure you want to delete your profile photo?')) {
      deletePhotoMutation.mutate();
    }
  }, [deletePhotoMutation]);

  return (
    <div className="space-y-4">
      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-4 py-3 rounded-lg border border-red-200">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Photo preview and upload area */}
      <div className="flex flex-col items-center gap-4">
        {/* Current photo preview */}
        {currentPhotoUrl && (
          <div className="relative group">
            <img
              src={currentPhotoUrl}
              alt="Profile photo"
              className="w-32 h-32 rounded-full object-cover border-4 border-slate-200 shadow-lg"
            />
            {!disabled && !isUploading && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deletePhotoMutation.isPending}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Delete photo"
              >
                {deletePhotoMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        )}

        {/* Upload area */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative w-full max-w-md border-2 border-dashed rounded-xl p-8 transition-all ${
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100'
          } ${disabled || isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <label className="flex flex-col items-center gap-3 cursor-pointer">
            {isUploading ? (
              <>
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-600 h-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-sm text-slate-600 font-medium">
                  Uploading... {uploadProgress}%
                </p>
              </>
            ) : (
              <>
                {currentPhotoUrl ? (
                  <Camera className="w-12 h-12 text-slate-400" />
                ) : (
                  <Upload className="w-12 h-12 text-slate-400" />
                )}
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-700">
                    {currentPhotoUrl ? 'Change photo' : 'Upload photo'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Drag and drop or click to browse
                  </p>
                  <p className="text-xs text-slate-400 mt-2">
                    JPEG, PNG, WebP, or GIF • Max 5MB
                  </p>
                </div>
              </>
            )}
            <input
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleInputChange}
              disabled={disabled || isUploading}
            />
          </label>
        </div>
      </div>
    </div>
  );
};

export default ProfilePhotoUploader;
