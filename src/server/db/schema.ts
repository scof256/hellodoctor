import { pgTable, uuid, text, timestamp, boolean, integer, jsonb, pgEnum, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { MedicalData, SBAR, DoctorThought } from '@/types';

// Enums
export const userRoleEnum = pgEnum('user_role', ['super_admin', 'doctor', 'clinic_admin', 'receptionist', 'patient']);
export const verificationStatusEnum = pgEnum('verification_status', ['pending', 'verified', 'rejected']);
export const appointmentStatusEnum = pgEnum('appointment_status', ['pending', 'confirmed', 'completed', 'cancelled', 'no_show']);
export const connectionStatusEnum = pgEnum('connection_status', ['active', 'disconnected', 'blocked']);
export const intakeStatusEnum = pgEnum('intake_status', ['not_started', 'in_progress', 'ready', 'reviewed']);

// Users table (synced with Clerk)
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkId: text('clerk_id').notNull().unique(),
  email: text('email').notNull(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  imageUrl: text('image_url'),
  primaryRole: userRoleEnum('primary_role').notNull().default('patient'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('users_clerk_id_idx').on(table.clerkId),
  index('users_email_idx').on(table.email),
]);

// Role assignments (users can have multiple roles)
export const userRoles = pgTable('user_roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: userRoleEnum('role').notNull(),
  grantedBy: uuid('granted_by').references(() => users.id),
  doctorId: uuid('doctor_id').references(() => doctors.id, { onDelete: 'cascade' }),
  effectiveFrom: timestamp('effective_from').notNull().defaultNow(),
  effectiveUntil: timestamp('effective_until'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('user_roles_user_id_idx').on(table.userId),
  index('user_roles_doctor_id_idx').on(table.doctorId),
]);

// Doctor profiles
export const doctors = pgTable('doctors', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  slug: text('slug').notNull().unique(),
  specialty: text('specialty'),
  clinicName: text('clinic_name'),
  bio: text('bio'),
  phone: text('phone'),
  address: text('address'),
  verificationStatus: verificationStatusEnum('verification_status').notNull().default('pending'),
  verifiedAt: timestamp('verified_at'),
  verifiedBy: uuid('verified_by').references(() => users.id),
  rejectionReason: text('rejection_reason'),
  consultationFee: integer('consultation_fee'),
  acceptsPayments: boolean('accepts_payments').notNull().default(false),
  appointmentDuration: integer('appointment_duration').notNull().default(30),
  bufferTime: integer('buffer_time').notNull().default(10),
  maxDailyAppointments: integer('max_daily_appointments').default(20),
  qrCodeUrl: text('qr_code_url'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('doctors_slug_idx').on(table.slug),
  uniqueIndex('doctors_user_id_idx').on(table.userId),
]);

// Doctor availability (weekly schedule)
export const doctorAvailability = pgTable('doctor_availability', {
  id: uuid('id').primaryKey().defaultRandom(),
  doctorId: uuid('doctor_id').notNull().references(() => doctors.id, { onDelete: 'cascade' }),
  dayOfWeek: integer('day_of_week').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  location: text('location'),
  isActive: boolean('is_active').notNull().default(true),
}, (table) => [
  index('doctor_availability_doctor_id_idx').on(table.doctorId),
]);

// Doctor blocked dates
export const doctorBlockedDates = pgTable('doctor_blocked_dates', {
  id: uuid('id').primaryKey().defaultRandom(),
  doctorId: uuid('doctor_id').notNull().references(() => doctors.id, { onDelete: 'cascade' }),
  date: timestamp('date').notNull(),
  reason: text('reason'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('doctor_blocked_dates_doctor_id_idx').on(table.doctorId),
]);

// Patient profiles
export const patients = pgTable('patients', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  dateOfBirth: timestamp('date_of_birth'),
  gender: text('gender'),
  phone: text('phone'),
  emergencyContact: text('emergency_contact'),
  emergencyPhone: text('emergency_phone'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('patients_user_id_idx').on(table.userId),
]);

// Patient-Doctor connections
export const connections = pgTable('connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  doctorId: uuid('doctor_id').notNull().references(() => doctors.id, { onDelete: 'cascade' }),
  status: connectionStatusEnum('status').notNull().default('active'),
  connectionSource: text('connection_source'),
  connectedAt: timestamp('connected_at').notNull().defaultNow(),
  disconnectedAt: timestamp('disconnected_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('connections_patient_id_idx').on(table.patientId),
  index('connections_doctor_id_idx').on(table.doctorId),
  uniqueIndex('connections_patient_doctor_idx').on(table.patientId, table.doctorId),
]);

// Follow-up counts type for tracking per-stage follow-ups
export type FollowUpCounts = Record<string, number>;

// Intake sessions
export const intakeSessions = pgTable('intake_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  connectionId: uuid('connection_id').notNull().references(() => connections.id, { onDelete: 'cascade' }),
  name: text('name'), // User-editable session name, max 255 chars, defaults to chief complaint
  status: intakeStatusEnum('status').notNull().default('not_started'),
  medicalData: jsonb('medical_data').$type<MedicalData>(),
  clinicalHandover: jsonb('clinical_handover').$type<SBAR>(),
  doctorThought: jsonb('doctor_thought').$type<DoctorThought>(),
  completeness: integer('completeness').notNull().default(0),
  currentAgent: text('current_agent').default('Triage'),
  // Question optimization tracking fields (Requirements: 2.4, 3.4)
  followUpCounts: jsonb('follow_up_counts').$type<FollowUpCounts>().default({}),
  answeredTopics: jsonb('answered_topics').$type<string[]>().default([]),
  consecutiveErrors: integer('consecutive_errors').notNull().default(0),
  // Termination tracking fields (Requirements: 1.4, 4.1, 4.2)
  aiMessageCount: integer('ai_message_count').notNull().default(0),
  hasOfferedConclusion: boolean('has_offered_conclusion').notNull().default(false),
  terminationReason: text('termination_reason'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  reviewedAt: timestamp('reviewed_at'),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('intake_sessions_connection_id_idx').on(table.connectionId),
  // Composite index for filtering by connection and status (Requirement 5.5)
  index('intake_sessions_connection_status_idx').on(table.connectionId, table.status),
]);

// Chat messages
export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => intakeSessions.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  content: text('content').notNull(),
  images: jsonb('images').$type<string[]>(),
  activeAgent: text('active_agent'),
  groundingMetadata: jsonb('grounding_metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('chat_messages_session_id_idx').on(table.sessionId),
  // Composite index for ordering messages by session and creation time (Requirement 5.4)
  index('chat_messages_session_created_idx').on(table.sessionId, table.createdAt),
]);

// Appointments
export const appointments = pgTable('appointments', {
  id: uuid('id').primaryKey().defaultRandom(),
  connectionId: uuid('connection_id').notNull().references(() => connections.id, { onDelete: 'cascade' }),
  intakeSessionId: uuid('intake_session_id').references(() => intakeSessions.id),
  scheduledAt: timestamp('scheduled_at').notNull(),
  duration: integer('duration').notNull(),
  isOnline: boolean('is_online').notNull().default(false),
  zoomMeetingId: text('zoom_meeting_id'),
  zoomJoinUrl: text('zoom_join_url'),
  zoomStartUrl: text('zoom_start_url'),
  zoomCreatedAt: timestamp('zoom_created_at'),
  streamCallId: text('stream_call_id'),
  streamJoinUrl: text('stream_join_url'),
  streamCreatedAt: timestamp('stream_created_at'),
  streamMetadata: jsonb('stream_metadata'),
  scribeIsActive: boolean('scribe_is_active').notNull().default(false),
  scribeActivatedAt: timestamp('scribe_activated_at'),
  scribeDeactivatedAt: timestamp('scribe_deactivated_at'),
  scribeTranscript: text('scribe_transcript'),
  scribeSummary: text('scribe_summary'),
  scribeSoap: text('scribe_soap'),
  scribeActionItems: text('scribe_action_items'),
  scribeRiskAssessment: text('scribe_risk_assessment'),
  scribeUpdatedAt: timestamp('scribe_updated_at'),
  status: appointmentStatusEnum('status').notNull().default('pending'),
  notes: text('notes'),
  price: integer('price'),
  paymentStatus: text('payment_status'),
  paymentId: text('payment_id'),
  bookedBy: uuid('booked_by').references(() => users.id),
  cancelledBy: uuid('cancelled_by').references(() => users.id),
  cancelReason: text('cancel_reason'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('appointments_connection_id_idx').on(table.connectionId),
  index('appointments_scheduled_at_idx').on(table.scheduledAt),
  // Composite index for filtering by connection and status (Requirement 5.1)
  index('appointments_connection_status_idx').on(table.connectionId, table.status),
  // Composite index for filtering by scheduled time and status (Requirement 5.2)
  index('appointments_scheduled_status_idx').on(table.scheduledAt, table.status),
]);

// Direct messages
export const directMessages = pgTable('direct_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  connectionId: uuid('connection_id').notNull().references(() => connections.id, { onDelete: 'cascade' }),
  senderId: uuid('sender_id').notNull().references(() => users.id),
  content: text('content').notNull(),
  isRead: boolean('is_read').notNull().default(false),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('direct_messages_connection_id_idx').on(table.connectionId),
  index('direct_messages_sender_id_idx').on(table.senderId),
  // Composite index for filtering by connection and read status (Requirement 5.3)
  index('direct_messages_connection_read_idx').on(table.connectionId, table.isRead),
]);

// Files
export const files = pgTable('files', {
  id: uuid('id').primaryKey().defaultRandom(),
  uploaderId: uuid('uploader_id').notNull().references(() => users.id),
  sessionId: uuid('session_id').references(() => intakeSessions.id),
  fileName: text('file_name').notNull(),
  fileType: text('file_type').notNull(),
  fileSize: integer('file_size').notNull(),
  url: text('url').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('files_uploader_id_idx').on(table.uploaderId),
  index('files_session_id_idx').on(table.sessionId),
]);

// Notifications
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  data: jsonb('data'),
  isRead: boolean('is_read').notNull().default(false),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('notifications_user_id_idx').on(table.userId),
]);

// Audit logs
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  action: text('action').notNull(),
  resourceType: text('resource_type').notNull(),
  resourceId: uuid('resource_id'),
  metadata: jsonb('metadata'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('audit_logs_user_id_idx').on(table.userId),
  index('audit_logs_created_at_idx').on(table.createdAt),
]);

// Platform configuration
export const platformConfig = pgTable('platform_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull().unique(),
  value: jsonb('value').notNull(),
  description: text('description'),
  updatedBy: uuid('updated_by').references(() => users.id),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Support tickets
export const supportTickets = pgTable('support_tickets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  subject: text('subject').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(),
  priority: text('priority').notNull().default('medium'),
  status: text('status').notNull().default('open'),
  assignedTo: uuid('assigned_to').references(() => users.id),
  resolvedAt: timestamp('resolved_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('support_tickets_user_id_idx').on(table.userId),
  index('support_tickets_status_idx').on(table.status),
]);

// Ticket responses
export const ticketResponses = pgTable('ticket_responses', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketId: uuid('ticket_id').notNull().references(() => supportTickets.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id),
  content: text('content').notNull(),
  isInternal: boolean('is_internal').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('ticket_responses_ticket_id_idx').on(table.ticketId),
]);


// Team invitations
export const teamInvitations = pgTable('team_invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  doctorId: uuid('doctor_id').notNull().references(() => doctors.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: userRoleEnum('role').notNull(),
  token: text('token').notNull().unique(),
  invitedBy: uuid('invited_by').notNull().references(() => users.id),
  expiresAt: timestamp('expires_at').notNull(),
  acceptedAt: timestamp('accepted_at'),
  acceptedBy: uuid('accepted_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('team_invitations_doctor_id_idx').on(table.doctorId),
  index('team_invitations_email_idx').on(table.email),
  uniqueIndex('team_invitations_token_idx').on(table.token),
]);
