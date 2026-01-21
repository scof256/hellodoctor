'use client';

import React from 'react';
import { Play, Pause, Trash2 } from 'lucide-react';

export interface TranscriptSegment {
  id: string;
  timestamp: number;
  text: string;
  isPending: boolean;
  error?: string;
  audioBlob?: Blob;
  audioUrl?: string;
  isDeleted: boolean;
}

interface SegmentControlsProps {
  segment: TranscriptSegment;
  isPlaying: boolean;
  playbackProgress: number;
  onPlay: () => void;
  onPause: () => void;
  onDelete: () => void;
}

export function SegmentControls({
  segment,
  isPlaying,
  playbackProgress,
  onPlay,
  onPause,
  onDelete,
}: SegmentControlsProps) {
  const hasAudio = !!segment.audioUrl;

  return (
    <div className="flex items-center gap-2 mt-2">
      {/* Playback controls - only show if audio available */}
      {hasAudio && (
        <div className="flex items-center gap-2">
          <button
            onClick={isPlaying ? onPause : onPlay}
            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            title={isPlaying ? 'Pause audio' : 'Play audio'}
            aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4 ml-0.5" />
            )}
          </button>

          {/* Progress bar */}
          {isPlaying && (
            <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 transition-all duration-100"
                style={{ width: `${playbackProgress * 100}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Delete button */}
      <button
        onClick={onDelete}
        className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-700 hover:bg-red-200 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
        title="Delete segment"
        aria-label="Delete segment"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
