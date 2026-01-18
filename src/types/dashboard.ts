/**
 * Dashboard Lean Response Types
 * 
 * These types define optimized response structures for dashboard views,
 * containing only the fields required for display. Large fields like
 * medicalData, clinicalHandover, doctorThought, and full message arrays
 * are explicitly excluded to minimize payload sizes.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */

import type { AppointmentStatus, ConnectionStatus, IntakeStatus } from './index';

/**
 * Lean appointment summary for dashboard display.
 * 
 * Included fields: id, scheduledAt, duration, status, connectionId, minimal patient/doctor info, Stream video fields
 * 
 * Excluded fields (from full Appointment entity):
 * - notes
 * - price
 * - paymentStatus
 * - paymentId
 * - bookedBy
 * - cancelledBy
 * - cancelReason
 * - createdAt
 * - updatedAt
 * 
 * Requirements: 2.1
 */
export interface AppointmentSummary {
  id: string;
  scheduledAt: Date;
  duration: number;
  status: AppointmentStatus;
  connectionId: string;
  intakeSessionId: string | null;
  isOnline: boolean;
  streamCallId: string | null;
  streamJoinUrl: string | null;
  patient?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
  } | null;
  doctor?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
    specialty: string | null;
    clinicName: string | null;
  } | null;
}

/**
 * Lean connection summary for dashboard display.
 * 
 * Included fields: id, status, connectedAt, minimal user info, intake status
 * 
 * Excluded fields (from full Connection entity):
 * - connectionSource
 * - disconnectedAt (unless status is 'disconnected')
 * - createdAt
 * - Full patient/doctor profile data
 * 
 * Requirements: 2.2
 */
export interface ConnectionSummary {
  id: string;
  status: ConnectionStatus;
  connectedAt: Date;
  patient?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
    email: string | null;
  } | null;
  doctor?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
    specialty: string | null;
    clinicName: string | null;
  } | null;
  intakeStatus?: {
    status: IntakeStatus;
    completeness: number;
    sessionId: string | null;
  } | null;
}

/**
 * Lean intake session summary for dashboard display.
 * 
 * Included fields: id, connectionId, status, completeness
 * 
 * Excluded fields (from full IntakeSession entity):
 * - medicalData (large JSON object with clinical information)
 * - clinicalHandover (SBAR data)
 * - doctorThought (differential diagnosis and reasoning)
 * - messages (full chat history)
 * - currentAgent
 * - startedAt
 * - completedAt
 * - reviewedAt
 * - reviewedBy
 * - createdAt
 * - updatedAt
 * 
 * Requirements: 2.3
 */
export interface IntakeSessionSummary {
  id: string;
  connectionId: string;
  status: IntakeStatus;
  completeness: number;
}

/**
 * Dashboard statistics for doctor dashboard.
 * Uses COUNT queries instead of fetching full records.
 * 
 * Requirements: 4.1, 4.2, 4.3
 */
export interface DoctorDashboardStats {
  totalPatients: number;
  todayAppointments: number;
  pendingReviews: number;
  newPatientsThisWeek: number;
}

/**
 * Dashboard statistics for patient dashboard.
 * Uses COUNT queries instead of fetching full records.
 * 
 * Requirements: 4.1
 */
export interface PatientDashboardStats {
  connectedDoctors: number;
  upcomingAppointments: number;
  completedIntakes: number;
}

/**
 * Dashboard statistics for admin dashboard.
 * Uses COUNT queries instead of fetching full records.
 * 
 * Requirements: 8.1
 */
export interface AdminDashboardStats {
  totalUsers: number;
  totalDoctors: number;
  totalPatients: number;
  todayAppointments: number;
  activeUsers: number;
  totalConnections: number;
  completedIntakes: number;
  pendingVerifications: number;
}

/**
 * Combined dashboard response for doctor.
 * All data fetched in parallel using Promise.all.
 * 
 * Requirements: 1.1
 */
export interface DoctorDashboardResponse {
  stats: DoctorDashboardStats;
  connections: ConnectionSummary[];
  appointments: AppointmentSummary[];
}

/**
 * Combined dashboard response for patient.
 * All data fetched in parallel using Promise.all.
 * 
 * Requirements: 1.2
 */
export interface PatientDashboardResponse {
  stats: PatientDashboardStats;
  connections: ConnectionSummary[];
  appointments: AppointmentSummary[];
}

/**
 * Activity feed item for admin dashboard.
 * Includes user info via JOINs.
 * 
 * Requirements: 8.2
 */
export interface ActivityFeedItem {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  createdAt: Date;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
  } | null;
}

/**
 * Pending doctor item for admin dashboard.
 * Includes user info via JOINs.
 * 
 * Requirements: 8.3
 */
export interface PendingDoctorItem {
  id: string;
  specialty: string | null;
  clinicName: string | null;
  createdAt: Date;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    imageUrl: string | null;
  };
}

/**
 * Combined dashboard response for admin.
 * All data fetched in parallel using Promise.all.
 * 
 * Requirements: 1.3
 */
export interface AdminDashboardResponse {
  stats: AdminDashboardStats;
  activity: ActivityFeedItem[];
  pendingDoctors: PendingDoctorItem[];
}

/**
 * List of fields explicitly excluded from dashboard responses.
 * Used for validation in property tests.
 * 
 * Requirements: 2.4
 */
export const EXCLUDED_DASHBOARD_FIELDS = [
  // IntakeSession excluded fields
  'medicalData',
  'clinicalHandover',
  'doctorThought',
  'messages',
  'currentAgent',
  'startedAt',
  'completedAt',
  'reviewedAt',
  'reviewedBy',
  
  // Appointment excluded fields
  'notes',
  'price',
  'paymentStatus',
  'paymentId',
  'bookedBy',
  'cancelledBy',
  'cancelReason',
  
  // Connection excluded fields
  'connectionSource',
  'disconnectedAt',
  
  // User excluded fields (from nested objects)
  'clerkId',
  'primaryRole',
  'updatedAt',
] as const;

/**
 * Type for excluded field names.
 */
export type ExcludedDashboardField = typeof EXCLUDED_DASHBOARD_FIELDS[number];
