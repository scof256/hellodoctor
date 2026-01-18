/**
 * Lean API Response Types
 * 
 * These types define optimized response structures that include only
 * the fields required by the client, reducing payload sizes.
 * 
 * Requirements: 6.1, 6.2, 6.3
 */

import type { AppointmentStatus } from './index';

/**
 * Lean appointment response with only required fields.
 * Used for list views and summaries where full entity data is not needed.
 * 
 * Requirements: 6.1
 */
export interface AppointmentSummary {
  id: string;
  connectionId: string;
  intakeSessionId: string | null;
  scheduledAt: Date;
  duration: number;
  isOnline: boolean;
  zoomJoinUrl: string | null;
  streamCallId: string | null;
  streamJoinUrl: string | null;
  scribeIsActive: boolean;
  status: AppointmentStatus;
  notes: string | null;
  doctor: {
    id: string;
    clinicName: string | null;
    user: {
      firstName: string | null;
      lastName: string | null;
      imageUrl: string | null;
    };
  } | null;
  patient: {
    id: string;
    user: {
      firstName: string | null;
      lastName: string | null;
      imageUrl: string | null;
    };
  } | null;
}

/**
 * Lean conversation response with only summary fields.
 * Used for conversation list views.
 * 
 * Requirements: 6.2
 */
export interface ConversationSummary {
  connectionId: string;
  otherParty: {
    userId: string;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
    role: 'patient' | 'doctor';
  };
  latestMessage: {
    content: string;
    createdAt: Date;
    isRead: boolean;
    isFromMe: boolean;
  } | null;
  unreadCount: number;
}

/**
 * Analytics field selection options.
 * Allows clients to request only specific metrics.
 * 
 * Requirements: 6.3
 */
export interface AnalyticsFieldSelection {
  includeTimeSeries?: boolean;
  includeSummary?: boolean;
  includeTotals?: boolean;
}

/**
 * Lean user growth analytics response.
 * Supports field selection for optimized payloads.
 * 
 * Requirements: 6.3
 */
export interface UserGrowthSummary {
  timeSeries?: Array<{
    date: string;
    total: number;
    doctors: number;
    patients: number;
  }>;
  totals?: {
    users: number;
    doctors: number;
    patients: number;
  };
  period: {
    startDate: string;
    endDate: string;
    granularity: string;
  };
}

/**
 * Lean appointment stats analytics response.
 * Supports field selection for optimized payloads.
 * 
 * Requirements: 6.3
 */
export interface AppointmentStatsSummary {
  timeSeries?: Array<{
    date: string;
    total: number;
    completed: number;
    cancelled: number;
    noShow: number;
    pending: number;
    confirmed: number;
  }>;
  summary?: {
    total: number;
    completed: number;
    cancelled: number;
    noShow: number;
    completionRate: number;
    cancellationRate: number;
    noShowRate: number;
  };
  period: {
    startDate: string;
    endDate: string;
    granularity: string;
  };
}

/**
 * Lean intake stats analytics response.
 * Supports field selection for optimized payloads.
 * 
 * Requirements: 6.3
 */
export interface IntakeStatsSummary {
  timeSeries?: Array<{
    date: string;
    total: number;
    completed: number;
    inProgress: number;
    avgCompleteness: number;
  }>;
  summary?: {
    totalSessions: number;
    completedSessions: number;
    avgCompleteness: number;
    totalMessages: number;
    avgMessagesPerSession: number;
    avgSessionDurationMinutes: number;
    completionRate: number;
  };
  period: {
    startDate: string;
    endDate: string;
    granularity: string;
  };
}

/**
 * Maximum pagination limit constant.
 * All list endpoints should enforce this limit.
 * 
 * Requirements: 6.4
 */
export const MAX_PAGINATION_LIMIT = 50;

/**
 * Response size warning threshold in KB.
 * Responses exceeding this size should trigger a warning.
 * 
 * Requirements: 6.5
 */
export const RESPONSE_SIZE_WARNING_THRESHOLD_KB = 100;
