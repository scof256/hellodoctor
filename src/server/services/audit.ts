/**
 * Audit Service
 * 
 * Provides functions for creating and managing audit log entries.
 * Captures user ID, action, resource, and metadata for all significant operations.
 * 
 * Requirements: 22.1, 22.2, 22.3, 22.4, 22.5
 */

import { db } from '@/server/db';
import { auditLogs, users } from '@/server/db/schema';
import { eq, desc, and, gte, lte, or, ilike, sql, count } from 'drizzle-orm';

// Audit action types
export type AuditAction =
  // Authentication events (22.1)
  | 'login'
  | 'logout'
  | 'login_failed'
  | 'password_reset'
  | 'session_expired'
  // User management
  | 'user_created'
  | 'user_updated'
  | 'user_deleted'
  | 'user_activated'
  | 'user_suspended'
  | 'user_role_changed'
  // Doctor operations
  | 'doctor_created'
  | 'doctor_updated'
  | 'doctor_approved'
  | 'doctor_rejected'
  | 'doctor_verification_revoked'
  // Patient operations
  | 'patient_created'
  | 'patient_updated'
  // Connection operations
  | 'connection_created'
  | 'connection_disconnected'
  | 'connection_blocked'
  // Appointment operations
  | 'appointment_created'
  | 'appointment_updated'
  | 'appointment_cancelled'
  | 'appointment_completed'
  | 'appointment_no_show'
  // Intake operations
  | 'intake_started'
  | 'intake_updated'
  | 'intake_completed'
  | 'intake_reviewed'
  | 'intake_session_created'
  | 'intake_session_deleted'
  | 'intake_session_name_updated'
  | 'intake_response_regenerated'
  | 'intake_reset'
  // Message operations
  | 'message_sent'
  | 'messages_read'
  // File operations
  | 'file_uploaded'
  | 'file_deleted'
  // Admin operations (22.3)
  | 'config_created'
  | 'config_updated'
  | 'configs_bulk_updated'
  | 'admin_impersonation_start'
  | 'admin_impersonation_end'
  // Team operations
  | 'team_member_invited'
  | 'team_member_removed'
  | 'team_member_role_changed'
  // Notification operations
  | 'notification_sent'
  | 'notification_read'
  // Generic operations
  | 'data_export'
  | 'data_import';

// Resource types that can be audited
export type AuditResourceType =
  | 'user'
  | 'doctor'
  | 'patient'
  | 'connection'
  | 'appointment'
  | 'intake_session'
  | 'message'
  | 'file'
  | 'notification'
  | 'platform_config'
  | 'team_member'
  | 'audit_log';

// Metadata interface for audit entries
export interface AuditMetadata {
  // Before/after values for updates (22.2)
  previousValue?: unknown;
  newValue?: unknown;
  // Additional context
  targetUserId?: string;
  targetUserEmail?: string;
  reason?: string;
  // Request context
  endpoint?: string;
  method?: string;
  statusCode?: number;
  responseTime?: number;
  // Custom fields
  [key: string]: unknown;
}

// Input for creating an audit log entry
export interface CreateAuditLogInput {
  userId?: string | null;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId?: string | null;
  metadata?: AuditMetadata | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

// Audit log entry type
export type AuditLogEntry = typeof auditLogs.$inferSelect;

// Enriched audit log with user info
export interface EnrichedAuditLog extends AuditLogEntry {
  user?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
}


// Query filters for audit logs
export interface AuditLogFilters {
  userId?: string;
  action?: AuditAction;
  resourceType?: AuditResourceType;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Create an audit log entry.
 * 
 * Requirements: 22.1, 22.2, 22.3, 22.4, 22.5
 */
export async function log(input: CreateAuditLogInput): Promise<AuditLogEntry> {
  const [entry] = await db
    .insert(auditLogs)
    .values({
      userId: input.userId ?? null,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      metadata: input.metadata ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    })
    .returning();

  if (!entry) {
    throw new Error('Failed to create audit log entry');
  }

  return entry;
}

/**
 * Create an audit log entry for authentication events.
 * 
 * Requirements: 22.1
 */
export async function logAuthEvent(
  action: 'login' | 'logout' | 'login_failed' | 'password_reset' | 'session_expired',
  userId: string | null,
  metadata?: AuditMetadata,
  ipAddress?: string,
  userAgent?: string
): Promise<AuditLogEntry> {
  return log({
    userId,
    action,
    resourceType: 'user',
    resourceId: userId,
    metadata: {
      ...metadata,
      eventType: 'authentication',
    },
    ipAddress,
    userAgent,
  });
}

/**
 * Create an audit log entry for data modifications.
 * Captures before/after values.
 * 
 * Requirements: 22.2
 */
export async function logDataModification(
  userId: string,
  action: AuditAction,
  resourceType: AuditResourceType,
  resourceId: string,
  previousValue: unknown,
  newValue: unknown,
  additionalMetadata?: Record<string, unknown>
): Promise<AuditLogEntry> {
  return log({
    userId,
    action,
    resourceType,
    resourceId,
    metadata: {
      previousValue,
      newValue,
      ...additionalMetadata,
    },
  });
}

/**
 * Create an audit log entry for admin actions.
 * 
 * Requirements: 22.3
 */
export async function logAdminAction(
  adminUserId: string,
  action: AuditAction,
  resourceType: AuditResourceType,
  resourceId: string | null,
  metadata?: AuditMetadata,
  ipAddress?: string,
  userAgent?: string
): Promise<AuditLogEntry> {
  return log({
    userId: adminUserId,
    action,
    resourceType,
    resourceId,
    metadata: {
      ...metadata,
      isAdminAction: true,
    },
    ipAddress,
    userAgent,
  });
}

/**
 * Query audit logs with filters.
 * 
 * Requirements: 22.6
 */
export async function queryAuditLogs(filters: AuditLogFilters): Promise<{
  logs: EnrichedAuditLog[];
  total: number;
}> {
  const {
    userId,
    action,
    resourceType,
    resourceId,
    startDate,
    endDate,
    search,
    limit = 50,
    offset = 0,
  } = filters;

  // Build where conditions
  const conditions = [];

  if (userId) {
    conditions.push(eq(auditLogs.userId, userId));
  }

  if (action) {
    conditions.push(eq(auditLogs.action, action));
  }

  if (resourceType) {
    conditions.push(eq(auditLogs.resourceType, resourceType));
  }

  if (resourceId) {
    conditions.push(eq(auditLogs.resourceId, resourceId));
  }

  if (startDate) {
    conditions.push(gte(auditLogs.createdAt, startDate));
  }

  if (endDate) {
    conditions.push(lte(auditLogs.createdAt, endDate));
  }

  if (search) {
    conditions.push(
      or(
        ilike(auditLogs.action, `%${search}%`),
        ilike(auditLogs.resourceType, `%${search}%`)
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Get logs with pagination
  const logs = await db.query.auditLogs.findMany({
    where: whereClause,
    orderBy: [desc(auditLogs.createdAt)],
    limit,
    offset,
  });

  // Get total count
  const [totalResult] = await db
    .select({ count: count() })
    .from(auditLogs)
    .where(whereClause);

  // Enrich with user info
  const enrichedLogs: EnrichedAuditLog[] = await Promise.all(
    logs.map(async (logEntry) => {
      let user = null;
      if (logEntry.userId) {
        const userRecord = await db.query.users.findFirst({
          where: eq(users.id, logEntry.userId),
        });
        if (userRecord) {
          user = {
            id: userRecord.id,
            email: userRecord.email,
            firstName: userRecord.firstName,
            lastName: userRecord.lastName,
          };
        }
      }
      return { ...logEntry, user };
    })
  );

  return {
    logs: enrichedLogs,
    total: totalResult?.count ?? 0,
  };
}

/**
 * Get audit logs for a specific resource.
 */
export async function getResourceAuditHistory(
  resourceType: AuditResourceType,
  resourceId: string,
  limit = 50
): Promise<EnrichedAuditLog[]> {
  const result = await queryAuditLogs({
    resourceType,
    resourceId,
    limit,
  });
  return result.logs;
}

/**
 * Get audit logs for a specific user.
 */
export async function getUserAuditHistory(
  userId: string,
  limit = 50
): Promise<EnrichedAuditLog[]> {
  const result = await queryAuditLogs({
    userId,
    limit,
  });
  return result.logs;
}

/**
 * Get recent audit logs for the platform.
 */
export async function getRecentAuditLogs(limit = 100): Promise<EnrichedAuditLog[]> {
  const result = await queryAuditLogs({ limit });
  return result.logs;
}

/**
 * Export audit logs to CSV format.
 * 
 * Requirements: 22.8
 */
export function exportToCSV(logs: EnrichedAuditLog[]): string {
  const headers = [
    'ID',
    'Timestamp',
    'User ID',
    'User Email',
    'Action',
    'Resource Type',
    'Resource ID',
    'IP Address',
    'User Agent',
    'Metadata',
  ];

  const rows = logs.map((log) => [
    log.id,
    log.createdAt.toISOString(),
    log.userId ?? '',
    log.user?.email ?? '',
    log.action,
    log.resourceType,
    log.resourceId ?? '',
    log.ipAddress ?? '',
    log.userAgent ?? '',
    JSON.stringify(log.metadata ?? {}),
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');

  return csvContent;
}

/**
 * Get audit log statistics for a date range.
 */
export async function getAuditStats(
  startDate: Date,
  endDate: Date
): Promise<{
  totalLogs: number;
  byAction: Record<string, number>;
  byResourceType: Record<string, number>;
  byUser: { userId: string; email: string; count: number }[];
}> {
  const conditions = [
    gte(auditLogs.createdAt, startDate),
    lte(auditLogs.createdAt, endDate),
  ];

  const whereClause = and(...conditions);

  // Get total count
  const [totalResult] = await db
    .select({ count: count() })
    .from(auditLogs)
    .where(whereClause);

  // Get counts by action
  const actionCounts = await db
    .select({
      action: auditLogs.action,
      count: count(),
    })
    .from(auditLogs)
    .where(whereClause)
    .groupBy(auditLogs.action);

  // Get counts by resource type
  const resourceTypeCounts = await db
    .select({
      resourceType: auditLogs.resourceType,
      count: count(),
    })
    .from(auditLogs)
    .where(whereClause)
    .groupBy(auditLogs.resourceType);

  // Get top users by activity
  const userCounts = await db
    .select({
      userId: auditLogs.userId,
      count: count(),
    })
    .from(auditLogs)
    .where(and(whereClause, sql`${auditLogs.userId} IS NOT NULL`))
    .groupBy(auditLogs.userId)
    .orderBy(desc(count()))
    .limit(10);

  // Enrich user counts with email
  const enrichedUserCounts = await Promise.all(
    userCounts.map(async (uc) => {
      if (!uc.userId) return null;
      const user = await db.query.users.findFirst({
        where: eq(users.id, uc.userId),
      });
      return {
        userId: uc.userId,
        email: user?.email ?? 'Unknown',
        count: uc.count,
      };
    })
  );

  return {
    totalLogs: totalResult?.count ?? 0,
    byAction: Object.fromEntries(actionCounts.map((ac) => [ac.action, ac.count])),
    byResourceType: Object.fromEntries(resourceTypeCounts.map((rc) => [rc.resourceType, rc.count])),
    byUser: enrichedUserCounts.filter((u): u is NonNullable<typeof u> => u !== null),
  };
}

// Export the audit service as a singleton-like object
export const auditService = {
  log,
  logAuthEvent,
  logDataModification,
  logAdminAction,
  queryAuditLogs,
  getResourceAuditHistory,
  getUserAuditHistory,
  getRecentAuditLogs,
  exportToCSV,
  getAuditStats,
};
