'use client';

import dynamic from 'next/dynamic';
import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Loading skeleton for meeting components
 * Requirements: 8.4 - Lazy loading for meeting components
 */
const MeetingLoadingSkeleton: React.FC = () => (
  <div className="flex flex-col h-full bg-slate-900">
    {/* Video area skeleton */}
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        <div className="text-slate-400 text-sm">Loading meeting components...</div>
      </div>
    </div>
    
    {/* Controls skeleton */}
    <div className="flex items-center justify-center gap-4 p-4 bg-black bg-opacity-50">
      <div className="w-12 h-12 rounded-full bg-slate-700 animate-pulse" />
      <div className="w-12 h-12 rounded-full bg-slate-700 animate-pulse" />
      <div className="w-12 h-12 rounded-full bg-slate-700 animate-pulse" />
      <div className="w-12 h-12 rounded-full bg-red-900 animate-pulse" />
    </div>
  </div>
);

/**
 * Loading skeleton for video preview
 */
const VideoPreviewSkeleton: React.FC = () => (
  <div className="flex items-center justify-center h-full bg-slate-800">
    <div className="flex flex-col items-center gap-4">
      <div className="w-64 h-48 bg-slate-700 rounded-lg animate-pulse" />
      <div className="flex gap-2">
        <div className="w-10 h-10 rounded-full bg-slate-700 animate-pulse" />
        <div className="w-10 h-10 rounded-full bg-slate-700 animate-pulse" />
      </div>
    </div>
  </div>
);

/**
 * Lazy-loaded Meeting Page component
 * Only loaded when user navigates to a meeting
 * Requirements: 8.4 - Use lazy loading for meeting components
 */
export const LazyMeetingPage = dynamic(
  () => import('@/app/(dashboard)/meeting/[appointmentId]/page'),
  {
    ssr: false,
    loading: () => <MeetingLoadingSkeleton />
  }
);

/**
 * Export skeleton components for reuse
 */
export { MeetingLoadingSkeleton, VideoPreviewSkeleton };
