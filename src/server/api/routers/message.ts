import { z } from 'zod';
import { eq, and, desc, or, sql, gte, isNull } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { 
  directMessages, 
  connections, 
  users, 
  doctors, 
  patients,
  userRoles,
  notifications 
} from '@/server/db/schema';
import { notificationService } from '@/server/services/notification';
import { checkResponseSize, enforcePaginationLimit } from '@/server/lib/query-optimizer';
import type { ConversationSummary } from '@/types/api-responses';
import { MAX_PAGINATION_LIMIT } from '@/types/api-responses';

/**
 * Message Router
 * 
 * Handles direct messaging between patients and doctors.
 * Implements access control to ensure only connected parties can message.
 * 
 * Requirements: 13.1, 13.2, 13.3, 13.6, 13.7, 13.8, 23.4
 */
export const messageRouter = createTRPCRouter({
  /**
   * Get conversation messages for a connection.
   * Supports pagination for long conversations.
   * 
   * Requirements: 13.6, 13.7, 6.4
   */
  getConversation: protectedProcedure
    .input(z.object({
      connectionId: z.string().uuid(),
      limit: z.number().min(1).max(100).default(50),
      cursor: z.string().uuid().optional(), // For pagination
    }))
    .query(async ({ ctx, input }) => {
      // Enforce pagination limit (Requirement 6.4)
      const effectiveLimit = enforcePaginationLimit(input.limit, MAX_PAGINATION_LIMIT);
      
      // Verify user has access to this connection
      await verifyConnectionAccess(ctx.db, ctx.user.id, input.connectionId);

      const messages = await ctx.db
        .select({
          id: directMessages.id,
          connectionId: directMessages.connectionId,
          senderId: directMessages.senderId,
          content: directMessages.content,
          isRead: directMessages.isRead,
          readAt: directMessages.readAt,
          createdAt: directMessages.createdAt,
          sender: {
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            imageUrl: users.imageUrl,
            primaryRole: users.primaryRole,
          },
        })
        .from(directMessages)
        .innerJoin(users, eq(directMessages.senderId, users.id))
        .where(
          input.cursor
            ? and(
                eq(directMessages.connectionId, input.connectionId),
                sql`${directMessages.createdAt} < (SELECT created_at FROM direct_messages WHERE id = ${input.cursor})`
              )
            : eq(directMessages.connectionId, input.connectionId)
        )
        .orderBy(desc(directMessages.createdAt))
        .limit(effectiveLimit + 1);

      let nextCursor: string | undefined;
      if (messages.length > effectiveLimit) {
        const nextItem = messages.pop();
        nextCursor = nextItem?.id;
      }

      return {
        messages: messages.reverse(), // Return in chronological order
        nextCursor,
      };
    }),

  /**
   * Send a direct message to a connected party.
   * 
   * Requirements: 13.1, 13.2, 13.3, 23.4
   */
  send: protectedProcedure
    .input(z.object({
      connectionId: z.string().uuid(),
      content: z.string().min(1).max(5000),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify user has access to this connection and can send messages
      const accessInfo = await verifyConnectionAccess(ctx.db, ctx.user.id, input.connectionId);
      
      // Create the message
      const [message] = await ctx.db
        .insert(directMessages)
        .values({
          connectionId: input.connectionId,
          senderId: ctx.user.id,
          content: input.content,
        })
        .returning();

      if (!message) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to send message',
        });
      }

      // Create notification for recipient (Requirement 13.5)
      const senderName = notificationService.getUserDisplayName(ctx.user);
      const senderRole = accessInfo.accessType === 'patient' ? 'patient' : 
                         accessInfo.accessType === 'doctor' ? 'doctor' : 'clinic_admin';
      
      await notificationService.createMessageNotification(
        accessInfo.recipientUserId,
        input.connectionId,
        message.id,
        senderName,
        senderRole,
        input.content
      );

      return {
        message,
        recipientId: accessInfo.recipientUserId,
      };
    }),

  /**
   * Mark messages as read.
   * Marks all unread messages in a conversation from the other party as read.
   * 
   * Requirements: 13.8
   */
  markAsRead: protectedProcedure
    .input(z.object({
      connectionId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify user has access to this connection
      await verifyConnectionAccess(ctx.db, ctx.user.id, input.connectionId);

      // Mark all unread messages from other users as read
      const result = await ctx.db
        .update(directMessages)
        .set({
          isRead: true,
          readAt: new Date(),
        })
        .where(
          and(
            eq(directMessages.connectionId, input.connectionId),
            eq(directMessages.isRead, false),
            sql`${directMessages.senderId} != ${ctx.user.id}`
          )
        )
        .returning({ id: directMessages.id });

      await ctx.db
        .update(notifications)
        .set({
          isRead: true,
          readAt: new Date(),
        })
        .where(
          and(
            eq(notifications.userId, ctx.user.id),
            eq(notifications.type, 'message'),
            eq(notifications.isRead, false),
            sql`${notifications.data} ->> 'connectionId' = ${input.connectionId}`
          )
        );

      return {
        markedCount: result.length,
      };
    }),

  /**
   * Get unread message count for the current user.
   * 
   * Requirements: 13.4
   */
  getUnreadCount: protectedProcedure
    .query(async ({ ctx }) => {
      // Get all connections where user is involved
      const userConnections = await getUserConnections(ctx.db, ctx.user.id);
      
      if (userConnections.length === 0) {
        return { count: 0 };
      }

      const connectionIds = userConnections.map(c => c.id);

      // Count unread messages not sent by the current user
      const [result] = await ctx.db
        .select({
          count: sql<number>`count(*)::int`,
        })
        .from(directMessages)
        .where(
          and(
            sql`${directMessages.connectionId} IN (${sql.join(connectionIds.map(id => sql`${id}`), sql`, `)})`,
            eq(directMessages.isRead, false),
            sql`${directMessages.senderId} != ${ctx.user.id}`
          )
        );

      return {
        count: result?.count ?? 0,
      };
    }),

  /**
   * Get all conversations for the current user.
   * Returns connections with the latest message and unread count.
   * Returns lean response with only summary fields.
   * 
   * OPTIMIZED: Uses batched queries with window functions instead of N+1 queries.
   * - Single query for latest messages using ROW_NUMBER() window function
   * - Single query for unread counts using GROUP BY
   * 
   * Requirements: 13.4, 13.6, 6.2
   * Performance Requirements: 1.2
   */
  getConversations: protectedProcedure
    .query(async ({ ctx }) => {
      const userConnections = await getUserConnections(ctx.db, ctx.user.id);
      
      if (userConnections.length === 0) {
        return { conversations: [] };
      }

      const connectionIds = userConnections.map(c => c.id);

      const connectionIdList = sql.join(
        connectionIds.map((id) => sql`${id}`),
        sql`, `
      );

      // Batch query 1: Get latest message for each connection using window function
      // This replaces N individual queries with a single query
      const latestMessagesResult = await ctx.db.execute<{
        connection_id: string;
        id: string;
        content: string;
        sender_id: string;
        created_at: Date;
        is_read: boolean;
      }>(sql`
        SELECT connection_id, id, content, sender_id, created_at, is_read
        FROM (
          SELECT 
            connection_id,
            id,
            content,
            sender_id,
            created_at,
            is_read,
            ROW_NUMBER() OVER (PARTITION BY connection_id ORDER BY created_at DESC) as rn
          FROM direct_messages
          WHERE connection_id IN (${connectionIdList})
        ) ranked
        WHERE rn = 1
      `);

      // Build a map for O(1) lookup
      const latestMessageMap = new Map<string, {
        id: string;
        content: string;
        senderId: string;
        createdAt: Date;
        isRead: boolean;
      }>();
      
      for (const row of latestMessagesResult) {
        latestMessageMap.set(row.connection_id, {
          id: row.id,
          content: row.content,
          senderId: row.sender_id,
          createdAt: row.created_at,
          isRead: row.is_read,
        });
      }

      // Batch query 2: Get unread counts for all connections in a single query
      // This replaces N individual count queries with a single GROUP BY query
      const unreadCountsResult = await ctx.db.execute<{
        connection_id: string;
        unread_count: number;
      }>(sql`
        SELECT 
          connection_id,
          COUNT(*)::int as unread_count
        FROM direct_messages
        WHERE 
          connection_id IN (${connectionIdList})
          AND is_read = false
          AND sender_id != ${ctx.user.id}
        GROUP BY connection_id
      `);

      // Build a map for O(1) lookup
      const unreadCountMap = new Map<string, number>();
      for (const row of unreadCountsResult) {
        unreadCountMap.set(row.connection_id, row.unread_count);
      }

      // Transform to lean response format (Requirement 6.2)
      // Only include summary fields instead of full connection objects
      const conversations: ConversationSummary[] = userConnections.map((connection) => {
        const latestMsg = latestMessageMap.get(connection.id);
        return {
          connectionId: connection.id,
          otherParty: {
            userId: connection.otherParty.userId,
            firstName: connection.otherParty.firstName,
            lastName: connection.otherParty.lastName,
            imageUrl: connection.otherParty.imageUrl,
            role: connection.otherParty.role,
          },
          latestMessage: latestMsg ? {
            content: latestMsg.content,
            createdAt: latestMsg.createdAt,
            isRead: latestMsg.isRead,
            isFromMe: latestMsg.senderId === ctx.user.id,
          } : null,
          unreadCount: unreadCountMap.get(connection.id) ?? 0,
        };
      });

      // Sort by latest message date
      conversations.sort((a, b) => {
        if (!a.latestMessage && !b.latestMessage) return 0;
        if (!a.latestMessage) return 1;
        if (!b.latestMessage) return -1;
        return new Date(b.latestMessage.createdAt).getTime() - 
               new Date(a.latestMessage.createdAt).getTime();
      });

      const response = { conversations };
      
      // Check response size and log warning if needed (Requirement 6.5)
      checkResponseSize(response, 'message.getConversations');

      return response;
    }),
});


// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

type DbType = typeof import('@/server/db').db;

interface ConnectionAccessInfo {
  connectionId: string;
  patientUserId: string;
  doctorUserId: string;
  recipientUserId: string;
  accessType: 'patient' | 'doctor' | 'clinic_admin';
}

/**
 * Verify that a user has access to a connection for messaging.
 * 
 * Access is granted if:
 * 1. User is the patient in the connection
 * 2. User is the doctor in the connection
 * 3. User is a clinic_admin for the doctor in the connection (Requirement 23.4)
 * 
 * Requirements: 13.3, 23.4
 */
async function verifyConnectionAccess(
  db: DbType,
  userId: string,
  connectionId: string
): Promise<ConnectionAccessInfo> {
  // Get the connection with patient and doctor info
  const connection = await db
    .select({
      id: connections.id,
      patientId: connections.patientId,
      doctorId: connections.doctorId,
      status: connections.status,
      patientUserId: patients.userId,
      doctorUserId: doctors.userId,
    })
    .from(connections)
    .innerJoin(patients, eq(connections.patientId, patients.id))
    .innerJoin(doctors, eq(connections.doctorId, doctors.id))
    .where(eq(connections.id, connectionId))
    .limit(1)
    .then(rows => rows[0]);

  if (!connection) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Connection not found',
    });
  }

  if (connection.status !== 'active') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Cannot message on an inactive connection',
    });
  }

  // Check if user is the patient
  if (connection.patientUserId === userId) {
    return {
      connectionId: connection.id,
      patientUserId: connection.patientUserId,
      doctorUserId: connection.doctorUserId,
      recipientUserId: connection.doctorUserId,
      accessType: 'patient',
    };
  }

  // Check if user is the doctor
  if (connection.doctorUserId === userId) {
    return {
      connectionId: connection.id,
      patientUserId: connection.patientUserId,
      doctorUserId: connection.doctorUserId,
      recipientUserId: connection.patientUserId,
      accessType: 'doctor',
    };
  }

  // Check if user is a clinic_admin for this doctor (Requirement 23.4)
  const clinicAdminRole = await db
    .select()
    .from(userRoles)
    .where(
      and(
        eq(userRoles.userId, userId),
        eq(userRoles.role, 'clinic_admin'),
        eq(userRoles.doctorId, connection.doctorId),
        or(
          isNull(userRoles.effectiveUntil),
          gte(userRoles.effectiveUntil, new Date())
        )
      )
    )
    .limit(1)
    .then(rows => rows[0]);

  if (clinicAdminRole) {
    return {
      connectionId: connection.id,
      patientUserId: connection.patientUserId,
      doctorUserId: connection.doctorUserId,
      recipientUserId: connection.patientUserId,
      accessType: 'clinic_admin',
    };
  }

  throw new TRPCError({
    code: 'FORBIDDEN',
    message: 'You do not have access to this conversation',
  });
}

interface UserConnection {
  id: string;
  patientId: string;
  doctorId: string;
  status: string;
  otherParty: {
    userId: string;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
    role: 'patient' | 'doctor';
    specialty?: string | null;
    clinicName?: string | null;
  };
}

/**
 * Get all active connections for a user.
 * Returns connections where the user is either the patient, doctor, or clinic_admin.
 * 
 * OPTIMIZED: Uses a single UNION query instead of separate queries per role type.
 * - Combines patient, doctor, and clinic_admin connection queries into one
 * - Reduces query count from 5+ to 1
 * 
 * Performance Requirements: 1.4
 */
async function getUserConnections(
  db: DbType,
  userId: string
): Promise<UserConnection[]> {
  // Single UNION query to get all connections for the user across all roles
  const connectionsResult = await db.execute<{
    connection_id: string;
    patient_id: string;
    doctor_id: string;
    connection_status: string;
    other_party_user_id: string;
    other_party_first_name: string | null;
    other_party_last_name: string | null;
    other_party_image_url: string | null;
    other_party_role: 'patient' | 'doctor';
    specialty: string | null;
    clinic_name: string | null;
    source: 'patient' | 'doctor' | 'clinic_admin';
  }>(sql`
    -- Connections where user is the patient (other party is doctor)
    SELECT 
      c.id as connection_id,
      c.patient_id,
      c.doctor_id,
      c.status as connection_status,
      u.id as other_party_user_id,
      u.first_name as other_party_first_name,
      u.last_name as other_party_last_name,
      u.image_url as other_party_image_url,
      'doctor'::text as other_party_role,
      d.specialty,
      d.clinic_name,
      'patient'::text as source
    FROM connections c
    INNER JOIN patients p ON c.patient_id = p.id
    INNER JOIN doctors d ON c.doctor_id = d.id
    INNER JOIN users u ON d.user_id = u.id
    WHERE p.user_id = ${userId}
      AND c.status = 'active'
    
    UNION ALL
    
    -- Connections where user is the doctor (other party is patient)
    SELECT 
      c.id as connection_id,
      c.patient_id,
      c.doctor_id,
      c.status as connection_status,
      u.id as other_party_user_id,
      u.first_name as other_party_first_name,
      u.last_name as other_party_last_name,
      u.image_url as other_party_image_url,
      'patient'::text as other_party_role,
      NULL as specialty,
      NULL as clinic_name,
      'doctor'::text as source
    FROM connections c
    INNER JOIN doctors d ON c.doctor_id = d.id
    INNER JOIN patients p ON c.patient_id = p.id
    INNER JOIN users u ON p.user_id = u.id
    WHERE d.user_id = ${userId}
      AND c.status = 'active'
    
    UNION ALL
    
    -- Connections where user is a clinic_admin (other party is patient)
    SELECT 
      c.id as connection_id,
      c.patient_id,
      c.doctor_id,
      c.status as connection_status,
      u.id as other_party_user_id,
      u.first_name as other_party_first_name,
      u.last_name as other_party_last_name,
      u.image_url as other_party_image_url,
      'patient'::text as other_party_role,
      NULL as specialty,
      NULL as clinic_name,
      'clinic_admin'::text as source
    FROM connections c
    INNER JOIN user_roles ur ON c.doctor_id = ur.doctor_id
    INNER JOIN patients p ON c.patient_id = p.id
    INNER JOIN users u ON p.user_id = u.id
    WHERE ur.user_id = ${userId}
      AND ur.role = 'clinic_admin'
      AND (ur.effective_until IS NULL OR ur.effective_until >= NOW())
      AND c.status = 'active'
      -- Exclude if user is already the doctor (handled by doctor query above)
      AND NOT EXISTS (
        SELECT 1 FROM doctors d2 
        WHERE d2.id = c.doctor_id AND d2.user_id = ${userId}
      )
  `);

  // Transform and deduplicate results
  const seenConnectionIds = new Set<string>();
  const result: UserConnection[] = [];

  for (const row of connectionsResult) {
    // Skip duplicates (can happen if user has multiple roles for same connection)
    if (seenConnectionIds.has(row.connection_id)) {
      continue;
    }
    seenConnectionIds.add(row.connection_id);

    result.push({
      id: row.connection_id,
      patientId: row.patient_id,
      doctorId: row.doctor_id,
      status: row.connection_status,
      otherParty: {
        userId: row.other_party_user_id,
        firstName: row.other_party_first_name,
        lastName: row.other_party_last_name,
        imageUrl: row.other_party_image_url,
        role: row.other_party_role,
        specialty: row.specialty ?? undefined,
        clinicName: row.clinic_name ?? undefined,
      },
    });
  }

  return result;
}
