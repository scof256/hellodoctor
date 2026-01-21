/**
 * Skeleton Components for Loading States
 * 
 * Requirements: 10.6 - Display skeleton screens instead of blank pages during loading
 * 
 * These components provide visual placeholders while data is loading,
 * improving perceived performance and user experience.
 */

import React from 'react';

/**
 * StatsCardSkeleton
 * 
 * Skeleton for statistics cards showing metrics like patient count, appointments, etc.
 * Matches the layout of actual stats cards with icon, label, and value.
 */
export function StatsCardSkeleton() {
  return (
    <div className="rounded-xl border p-4 bg-slate-50 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-4 w-20 bg-slate-200 rounded mb-2"></div>
          <div className="h-8 w-12 bg-slate-200 rounded"></div>
        </div>
        <div className="p-3 rounded-lg bg-slate-200 w-11 h-11"></div>
      </div>
    </div>
  );
}

/**
 * DoctorCardSkeleton
 * 
 * Skeleton for doctor profile cards showing avatar, name, specialty, and action buttons.
 * Used in patient dashboard when loading doctor connections.
 */
export function DoctorCardSkeleton() {
  return (
    <div className="p-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-slate-200"></div>
        <div className="flex-1">
          <div className="h-4 w-32 bg-slate-200 rounded mb-2"></div>
          <div className="h-3 w-24 bg-slate-200 rounded"></div>
        </div>
        <div className="h-6 w-20 bg-slate-200 rounded-full"></div>
      </div>
      <div className="mt-3 flex gap-2">
        <div className="flex-1 h-9 bg-slate-200 rounded-lg"></div>
        <div className="w-10 h-9 bg-slate-200 rounded-lg"></div>
      </div>
    </div>
  );
}

/**
 * AppointmentCardSkeleton
 * 
 * Skeleton for appointment cards showing date/time, doctor info, and status.
 * Used in both patient and doctor dashboards when loading appointments.
 */
export function AppointmentCardSkeleton() {
  return (
    <div className="p-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-xl bg-slate-200"></div>
        <div className="flex-1">
          <div className="h-4 w-28 bg-slate-200 rounded mb-2"></div>
          <div className="h-3 w-20 bg-slate-200 rounded"></div>
        </div>
        <div className="h-6 w-16 bg-slate-200 rounded-full"></div>
      </div>
    </div>
  );
}

/**
 * MessageSkeleton
 * 
 * Skeleton for chat messages in messaging interface.
 * Shows placeholder for message bubbles with varying widths to simulate real messages.
 */
export function MessageSkeleton({ align = 'left', index = 0 }: { align?: 'left' | 'right', index?: number }) {
  const widths = ['w-3/4', 'w-2/3', 'w-1/2', 'w-5/6'];
  const randomWidth = widths[index % widths.length];

  return (
    <div className={`flex ${align === 'right' ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`${randomWidth} max-w-[80%]`}>
        <div className="flex items-start gap-2">
          {align === 'left' && (
            <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse flex-shrink-0"></div>
          )}
          <div className="flex-1">
            <div className={`rounded-2xl p-3 ${align === 'right' ? 'bg-green-100' : 'bg-slate-100'
              } animate-pulse`}>
              <div className="h-4 bg-slate-200 rounded mb-2"></div>
              <div className="h-4 bg-slate-200 rounded w-3/4"></div>
            </div>
            <div className="h-3 w-16 bg-slate-200 rounded mt-1 animate-pulse"></div>
          </div>
          {align === 'right' && (
            <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse flex-shrink-0"></div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * MessageListSkeleton
 * 
 * Skeleton for a list of messages, showing multiple message placeholders.
 * Alternates between left and right alignment to simulate conversation.
 */
export function MessageListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <MessageSkeleton key={i} align={i % 3 === 0 ? 'right' : 'left'} index={i} />
      ))}
    </div>
  );
}

/**
 * PatientCardSkeleton
 * 
 * Skeleton for patient cards in doctor dashboard.
 * Shows placeholder for patient avatar, name, and status.
 */
export function PatientCardSkeleton() {
  return (
    <div className="p-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-slate-200"></div>
        <div className="flex-1">
          <div className="h-4 w-32 bg-slate-200 rounded mb-2"></div>
          <div className="h-3 w-24 bg-slate-200 rounded"></div>
        </div>
        <div className="h-6 w-20 bg-slate-200 rounded-full"></div>
      </div>
    </div>
  );
}

/**
 * IntakeProgressCardSkeleton
 * 
 * Skeleton for intake progress cards showing completion status.
 * Used in patient dashboard when loading intake sessions.
 */
export function IntakeProgressCardSkeleton() {
  return (
    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-slate-200"></div>
        <div className="flex-1">
          <div className="h-4 w-24 bg-slate-200 rounded mb-1"></div>
          <div className="h-3 w-16 bg-slate-200 rounded"></div>
        </div>
      </div>
      <div className="h-2 bg-slate-200 rounded-full mb-2"></div>
      <div className="h-3 w-20 bg-slate-200 rounded"></div>
    </div>
  );
}

/**
 * QRCodeSkeleton
 * 
 * Skeleton for QR code display in doctor dashboard.
 * Shows placeholder for QR code image and instructions.
 */
export function QRCodeSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="h-5 w-24 bg-slate-200 rounded animate-pulse"></div>
        <div className="h-4 w-16 bg-slate-200 rounded animate-pulse"></div>
      </div>
      <div className="p-4 flex flex-col items-center">
        <div className="w-32 h-32 bg-slate-200 rounded-lg animate-pulse"></div>
        <div className="h-3 w-36 bg-slate-200 rounded mt-2 animate-pulse"></div>
      </div>
    </div>
  );
}

/**
 * ActionCardSkeleton
 * 
 * Skeleton for action cards in Simple Mode home screen.
 * Shows placeholder for large tappable cards with icons and text.
 */
export function ActionCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-slate-200"></div>
        <div className="flex-1">
          <div className="h-5 w-32 bg-slate-200 rounded mb-2"></div>
          <div className="h-4 w-24 bg-slate-200 rounded"></div>
        </div>
      </div>
    </div>
  );
}

/**
 * ConversationListSkeleton
 * 
 * Skeleton for conversation list in messaging interface.
 * Shows placeholders for conversation items with avatar, name, and preview.
 */
export function ConversationListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-slate-200"></div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <div className="h-4 w-28 bg-slate-200 rounded"></div>
                <div className="h-3 w-12 bg-slate-200 rounded"></div>
              </div>
              <div className="h-3 w-40 bg-slate-200 rounded"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
