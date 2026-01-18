'use client';

import dynamic from 'next/dynamic';
import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Loading skeleton for markdown content
 */
const MarkdownSkeleton: React.FC = () => (
  <div className="animate-pulse space-y-2">
    <div className="h-4 bg-slate-200 rounded w-3/4"></div>
    <div className="h-4 bg-slate-200 rounded w-1/2"></div>
    <div className="h-4 bg-slate-200 rounded w-5/6"></div>
  </div>
);

/**
 * Loading skeleton for modal components
 */
const ModalSkeleton: React.FC = () => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden p-6">
      <div className="animate-pulse space-y-4">
        <div className="h-6 bg-slate-200 rounded w-1/2"></div>
        <div className="h-4 bg-slate-200 rounded w-3/4"></div>
        <div className="h-32 bg-slate-200 rounded"></div>
        <div className="h-10 bg-slate-200 rounded"></div>
      </div>
    </div>
  </div>
);

/**
 * Loading skeleton for chat overlay
 */
const ChatOverlaySkeleton: React.FC = () => (
  <div className="fixed inset-0 z-[100] md:absolute md:inset-auto md:bottom-28 md:right-6 md:w-96 md:h-[500px] flex flex-col">
    <div className="flex flex-col h-full bg-white md:rounded-2xl shadow-2xl border border-indigo-100 overflow-hidden">
      <div className="bg-indigo-900 p-4 h-16 animate-pulse">
        <div className="h-4 bg-indigo-700 rounded w-1/3"></div>
      </div>
      <div className="flex-1 bg-slate-50 p-4 animate-pulse">
        <div className="space-y-3">
          <div className="h-12 bg-slate-200 rounded-xl w-3/4"></div>
          <div className="h-12 bg-slate-200 rounded-xl w-2/3 ml-auto"></div>
        </div>
      </div>
    </div>
  </div>
);

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
 * Lazy-loaded ReactMarkdown component
 * Only loaded when markdown content needs to be rendered
 * Requirements: 4.1
 */
export const LazyReactMarkdown = dynamic(
  () => import('react-markdown'),
  { 
    ssr: false, 
    loading: () => <MarkdownSkeleton />
  }
);

/**
 * Lazy-loaded BookingModal component
 * Only loaded when user opens the booking modal
 * Requirements: 4.4
 */
export const LazyBookingModal = dynamic(
  () => import('@/app/components/BookingModal'),
  { 
    ssr: false,
    loading: () => <ModalSkeleton />
  }
);

/**
 * Lazy-loaded DirectChatOverlay component
 * Only loaded when user opens the direct chat
 * Requirements: 4.4
 */
export const LazyDirectChatOverlay = dynamic(
  () => import('@/app/components/DirectChatOverlay'),
  { 
    ssr: false,
    loading: () => <ChatOverlaySkeleton />
  }
);

/**
 * Lazy-loaded DirectMessageModal component
 * Only loaded when doctor opens the direct message modal
 * Requirements: 4.4
 */
export const LazyDirectMessageModal = dynamic(
  () => import('@/app/components/DirectMessageModal'),
  { 
    ssr: false,
    loading: () => <ModalSkeleton />
  }
);

/**
 * Lazy-loaded StreamVideoProvider component
 * Only loaded when video functionality is needed
 * Requirements: 8.4 - Use lazy loading for meeting components
 */
export const LazyStreamVideoProvider = dynamic(
  () => import('@/app/components/StreamVideoProvider').then(mod => ({ default: mod.StreamVideoProvider })),
  { 
    ssr: false,
    loading: () => null // Provider doesn't need visual loading state
  }
);

/**
 * Export skeleton components for reuse
 */
export { MarkdownSkeleton, ModalSkeleton, ChatOverlaySkeleton, MeetingLoadingSkeleton };
