import { z } from 'zod';
import { eq, and, desc, gte, or, asc } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure, patientProcedure, doctorProcedure } from '../trpc';
import { 
  intakeSessions, 
  chatMessages, 
  connections, 
  patients, 
  doctors, 
  users,
  files,
  appointments,
} from '@/server/db/schema';

// Aliased table references for JOINs (Requirements: 1.1)
// These allow us to join the users table twice - once for doctor, once for patient
import { INITIAL_MEDICAL_DATA, INITIAL_THOUGHT } from '@/types';
import type { MedicalData, SBAR, DoctorThought, Message, AgentRole, FollowUpCounts, TrackingState, ContextLayer } from '@/types';
import { sendAIMessage, generateClinicalHandover } from '../../services/ai';
import { calculateIntakeCompleteness, mergeMedicalData, determineAgent } from '../../services/intake-utils';
import { notificationService } from '../../services/notification';
import { auditService } from '../../services/audit';
import { checkResponseSize, enforcePaginationLimit } from '@/server/lib/query-optimizer';
import { MAX_PAGINATION_LIMIT } from '@/types/api-responses';
import * as crypto from 'crypto';
// Question optimization tracking imports (Requirements: 2.1, 2.4, 3.1, 3.4, 4.1, 4.2, 5.3)
import {
  getFollowUpCountForAgent,
  incrementFollowUpCountForAgent,
  isFollowUpLimitReachedForAgent,
  getNextAgentOnLimitReached,
  extractAnsweredTopics,
  markTopicsAnswered,
  containsNewInformation,
  detectCompletionPhrase,
  getFallbackMessageForAgent,
  incrementConsecutiveErrors,
  resetConsecutiveErrors,
  // Termination detection imports (Requirements: 1.2, 4.1, 4.2, 6.1, 6.2)
  detectTerminationSignal,
  shouldOfferConclusion,
  shouldForceHandover,
  detectUncertaintyPhrase,
  detectNegativeResponse,
  isBriefResponse,
  MESSAGE_LIMITS,
} from '../../services/question-tracking';

// --- DEDUPLICATION CONFIGURATION ---
const DEDUPLICATION_WINDOW_MS = 5000; // 5 second window for duplicate detection

/**
 * Generate a content hash for deduplication.
 * Uses SHA-256 to create a deterministic hash of the message content.
 */
function generateContentHash(content: string, sessionId: string): string {
  return crypto
    .createHash('sha256')
    .update(`${sessionId}:${content}`)
    .digest('hex')
    .substring(0, 16); // Use first 16 chars for efficiency
}

/**
 * Log invalid/empty AI responses for debugging.
 * Implements Requirement 4.3 - Log all empty or malformed responses with context.
 */
function logInvalidResponse(
  sessionId: string,
  userId: string,
  response: unknown,
  error: string
): void {
  console.error('[intake.sendMessage] Invalid AI response:', {
    timestamp: new Date().toISOString(),
    sessionId,
    userId,
    error,
    responseType: typeof response,
    responsePreview: typeof response === 'string' 
      ? response.substring(0, 200) 
      : JSON.stringify(response)?.substring(0, 200),
  });
}

type SessionWithMedicalData = Record<string, unknown> & {
  medicalData?: unknown;
  clinicalHandover?: unknown;
};

function redactSessionForPatient<T extends SessionWithMedicalData>(
  session: T | null | undefined
): (Omit<T, 'medicalData' | 'clinicalHandover'> & { medicalData: MedicalData | null; clinicalHandover: null }) | null | undefined {
  if (!session) return session;
  const md = (session.medicalData as MedicalData | null | undefined) ?? null;
  const redactedMedicalData: MedicalData | null = md
    ? { ...md, clinicalHandover: null, ucgRecommendations: null }
    : null;
  return {
    ...session,
    medicalData: redactedMedicalData,
    clinicalHandover: null,
  };
}

// Input validation schemas
const createIntakeSchema = z.object({
  connectionId: z.string().uuid(),
});

const getSessionSchema = z.object({
  sessionId: z.string().uuid(),
});

const sendMessageSchema = z.object({
  sessionId: z.string().uuid(),
  content: z.string().min(1),
  images: z.array(z.string()).optional(),
});

export const intakeRouter = createTRPCRouter({
  /**
   * Create a new intake session for a patient-doctor connection.
   * Requirements: 7.1, 7.7
   */
  create: patientProcedure
    .input(createIntakeSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.patient) {
        // This can happen if the user hasn't been set up as a patient yet
        // The auto-patient API should have created this, but there might be a race condition
        console.error(`[intake.create] No patient profile for user ${ctx.user.id} (${ctx.user.email}). User primaryRole: ${ctx.user.primaryRole}`);
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Patient profile not found. Please try refreshing the page or reconnecting with the doctor.',
        });
      }

      // Verify the connection exists and belongs to this patient
      const connection = await ctx.db.query.connections.findFirst({
        where: and(
          eq(connections.id, input.connectionId),
          eq(connections.patientId, ctx.patient.id),
          eq(connections.status, 'active')
        ),
      });

      if (!connection) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Connection not found or not active.',
        });
      }

      // Check if there's already an active intake session for this connection
      const existingSession = await ctx.db.query.intakeSessions.findFirst({
        where: and(
          eq(intakeSessions.connectionId, input.connectionId),
          eq(intakeSessions.status, 'in_progress')
        ),
      });

      if (existingSession) {
        // Return existing session instead of creating a new one (Requirement 7.5 - resumable)
        return redactSessionForPatient(existingSession);
      }

      // Create new intake session
      // INITIAL_MEDICAL_DATA already has currentAgent: 'VitalsTriageAgent' and vitalsStageCompleted: false
      const result = await ctx.db
        .insert(intakeSessions)
        .values({
          connectionId: input.connectionId,
          status: 'not_started',
          medicalData: INITIAL_MEDICAL_DATA,
          doctorThought: INITIAL_THOUGHT,
          completeness: 0,
          currentAgent: INITIAL_MEDICAL_DATA.currentAgent, // Use currentAgent from INITIAL_MEDICAL_DATA
        })
        .returning();

      const newSession = result[0];
      if (!newSession) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create intake session.',
        });
      }

      // Log the intake session creation
      await auditService.log({
        userId: ctx.user.id,
        action: 'intake_started',
        resourceType: 'intake_session',
        resourceId: newSession.id,
        metadata: {
          connectionId: input.connectionId,
        },
      });

      return redactSessionForPatient(newSession);
    }),

  /**
   * Get an intake session with all messages.
   * 
   * OPTIMIZED: Uses JOINs to fetch all related data in 2 queries instead of 7+.
   * - Query 1: Session + Connection + Doctor + Patient + Users (single JOIN query)
   * - Query 2: Messages for session (single query)
   * 
   * Requirements: 7.2, 7.5
   * Performance Requirements: 1.1, 1.2, 1.3
   */
  getSession: protectedProcedure
    .input(getSessionSchema)
    .query(async ({ ctx, input }) => {
      const startTime = Date.now();
      
      try {
        // Log query start (Requirements: 3.1, 3.2)
        console.log('[intake.getSession] Starting', {
          timestamp: new Date().toISOString(),
          sessionId: input.sessionId,
          userId: ctx.user.id,
        });

        const perfStartTime = process.env.NODE_ENV === 'development' ? performance.now() : 0;

        // Create aliased table references for doctor and patient users
        const doctorUsers = alias(users, 'doctorUsers');
        const patientUsers = alias(users, 'patientUsers');

        // Query 1: Session with all related data via JOINs (Requirements: 1.1, 1.3)
        const sessionWithData = await ctx.db
          .select({
            // Session fields
            id: intakeSessions.id,
            connectionId: intakeSessions.connectionId,
            name: intakeSessions.name,
            status: intakeSessions.status,
            medicalData: intakeSessions.medicalData,
            clinicalHandover: intakeSessions.clinicalHandover,
            doctorThought: intakeSessions.doctorThought,
            completeness: intakeSessions.completeness,
            currentAgent: intakeSessions.currentAgent,
            startedAt: intakeSessions.startedAt,
            completedAt: intakeSessions.completedAt,
            reviewedAt: intakeSessions.reviewedAt,
            reviewedBy: intakeSessions.reviewedBy,
            createdAt: intakeSessions.createdAt,
            updatedAt: intakeSessions.updatedAt,
            // Connection fields
            connectionStatus: connections.status,
            patientId: connections.patientId,
            doctorId: connections.doctorId,
            // Doctor fields
            doctorSpecialty: doctors.specialty,
            doctorClinicName: doctors.clinicName,
            doctorUserId: doctors.userId,
            // Doctor user fields
            doctorFirstName: doctorUsers.firstName,
            doctorLastName: doctorUsers.lastName,
            doctorImageUrl: doctorUsers.imageUrl,
            // Patient fields
            patientUserId: patients.userId,
            // Patient user fields
            patientFirstName: patientUsers.firstName,
            patientLastName: patientUsers.lastName,
            patientImageUrl: patientUsers.imageUrl,
          })
          .from(intakeSessions)
          .innerJoin(connections, eq(intakeSessions.connectionId, connections.id))
          .innerJoin(doctors, eq(connections.doctorId, doctors.id))
          .innerJoin(doctorUsers, eq(doctors.userId, doctorUsers.id))
          .innerJoin(patients, eq(connections.patientId, patients.id))
          .innerJoin(patientUsers, eq(patients.userId, patientUsers.id))
          .where(eq(intakeSessions.id, input.sessionId))
          .limit(1);

        const row = sessionWithData[0];

        if (!row) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Intake session not found.',
          });
        }

        // Access control check using JOIN result (Requirements: 2.1, 2.2, 2.3, 2.4)
        const isPatientInConnection = row.patientUserId === ctx.user.id;
        const isDoctorInConnection = row.doctorUserId === ctx.user.id;
        const isSuperAdmin = ctx.user.primaryRole === 'super_admin';

        if (!isPatientInConnection && !isDoctorInConnection && !isSuperAdmin) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You are not authorized to view this intake session.',
          });
        }

        // Query 2: Get all messages for this session (Requirements: 1.2)
        const messages = await ctx.db.query.chatMessages.findMany({
          where: eq(chatMessages.sessionId, input.sessionId),
          orderBy: [chatMessages.createdAt],
        });

        // Transform messages to the expected format
        const formattedMessages: Message[] = messages.map((msg) => ({
          id: msg.id,
          role: msg.role as 'user' | 'model' | 'doctor',
          text: msg.content,
          images: msg.images ?? undefined,
          timestamp: msg.createdAt,
          groundingMetadata: msg.groundingMetadata,
          activeAgent: msg.activeAgent as Message['activeAgent'],
        }));

        // Log query timing in development mode (Requirements: 4.1, 4.3)
        if (process.env.NODE_ENV === 'development') {
          const endTime = performance.now();
          const duration = endTime - perfStartTime;
          console.log(`[intake.getSession] Query completed in ${duration.toFixed(2)}ms`);
          if (duration > 500) {
            console.warn(`[intake.getSession] Performance warning: Query took ${duration.toFixed(2)}ms (>500ms threshold)`);
          }
        }

        // Apply backward compatibility defaults for new fields (Requirements: 7.1, 7.2, 7.3)
        const rawMedicalData = row.medicalData as MedicalData | null;
        let medicalData = rawMedicalData;
        
        // Apply default values for new fields if they're missing
        if (medicalData) {
          medicalData = {
            ...INITIAL_MEDICAL_DATA,
            ...medicalData,
            // Ensure historyCheckCompleted has a default value
            historyCheckCompleted: medicalData.historyCheckCompleted ?? false,
            // Ensure vitalsData exists with proper defaults
            vitalsData: medicalData.vitalsData ?? {
              ...INITIAL_MEDICAL_DATA.vitalsData,
              vitalsStageCompleted: true, // Skip vitals for existing sessions without vitals data
            },
          };
        }
        
        // Redact sensitive fields for patients
        if (isPatientInConnection && medicalData) {
          medicalData = { ...medicalData, clinicalHandover: null, ucgRecommendations: null };
        }
        
        // Handle missing doctorThought gracefully
        const doctorThought = row.doctorThought as DoctorThought | null ?? null;

        const clinicalHandover = isPatientInConnection
          ? null
          : (row.clinicalHandover as SBAR | null);

        // Log query completion (Requirements: 3.1, 3.2)
        const duration = Date.now() - startTime;
        console.log('[intake.getSession] Completed', {
          timestamp: new Date().toISOString(),
          sessionId: input.sessionId,
          userId: ctx.user.id,
          duration,
          messageCount: formattedMessages.length,
          success: true,
        });

        // Transform JOIN result to match existing response structure (Requirements: 1.4, 3.1, 3.2, 3.3, 3.4)
        return {
          session: {
            id: row.id,
            connectionId: row.connectionId,
            name: row.name,
            status: row.status,
            medicalData,
            clinicalHandover,
            doctorThought,
            completeness: row.completeness,
            currentAgent: row.currentAgent,
            startedAt: row.startedAt,
            completedAt: row.completedAt,
            reviewedAt: row.reviewedAt,
            reviewedBy: row.reviewedBy,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          },
          messages: formattedMessages,
          connection: {
            id: row.connectionId,
            status: row.connectionStatus,
            patientId: row.patientId,
            doctorId: row.doctorId,
            doctor: {
              id: row.doctorId,
              specialty: row.doctorSpecialty,
              clinicName: row.doctorClinicName,
              user: {
                firstName: row.doctorFirstName,
                lastName: row.doctorLastName,
                imageUrl: row.doctorImageUrl,
              },
            },
            patient: {
              id: row.patientId,
              user: {
                firstName: row.patientFirstName,
                lastName: row.patientLastName,
                imageUrl: row.patientImageUrl,
              },
            },
          },
          userRole: isPatientInConnection ? ('patient' as const) : ('doctor' as const),
        };
      } catch (error) {
        // Log error with full context (Requirements: 3.1, 3.2, 4.1, 4.2)
        const duration = Date.now() - startTime;
        console.error('[intake.getSession] Error', {
          timestamp: new Date().toISOString(),
          sessionId: input.sessionId,
          userId: ctx.user.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          duration,
        });

        // Re-throw TRPCError instances as-is
        if (error instanceof TRPCError) {
          throw error;
        }

        // Wrap other errors with user-friendly message
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve intake session. Please try again.',
          cause: error,
        });
      }
    }),

  /**
   * Get all intake sessions for the current patient.
   * 
   * OPTIMIZED: Uses JOINs to fetch all related data in a single query.
   * - Single query fetches sessions with connection, doctor, and user data
   * - Eliminates N+1 query pattern from Promise.all
   * 
   * Requirements: 7.5, 6.4, 6.5
   * Performance Requirements: 1.3
   */
  getMyIntakeSessions: patientProcedure
    .input(
      z.object({
        connectionId: z.string().uuid().optional(),
        status: z.enum(['not_started', 'in_progress', 'ready', 'reviewed', 'all']).default('all'),
        limit: z.number().min(1).max(100).default(50),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      // Enforce pagination limit (Requirement 6.4)
      const effectiveLimit = enforcePaginationLimit(input?.limit ?? 50, MAX_PAGINATION_LIMIT);
      if (!ctx.patient) {
        // This can happen if the user hasn't been set up as a patient yet
        console.error(`[intake.getMyIntakeSessions] No patient profile for user ${ctx.user.id} (${ctx.user.email}). User primaryRole: ${ctx.user.primaryRole}`);
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Patient profile not found. Please try refreshing the page.',
        });
      }

      // Build conditions
      const baseCondition = eq(connections.patientId, ctx.patient.id);
      const connectionCondition = input?.connectionId
        ? eq(connections.id, input.connectionId)
        : undefined;
      const statusCondition = input?.status && input.status !== 'all'
        ? eq(intakeSessions.status, input.status)
        : undefined;

      // Combine all conditions
      const whereConditions = [baseCondition];
      if (connectionCondition) whereConditions.push(connectionCondition);
      if (statusCondition) whereConditions.push(statusCondition);

      // Single query with JOINs to fetch all related data
      const sessionsWithData = await ctx.db
        .select({
          // Session fields
          id: intakeSessions.id,
          connectionId: intakeSessions.connectionId,
          name: intakeSessions.name,
          status: intakeSessions.status,
          medicalData: intakeSessions.medicalData,
          clinicalHandover: intakeSessions.clinicalHandover,
          doctorThought: intakeSessions.doctorThought,
          completeness: intakeSessions.completeness,
          currentAgent: intakeSessions.currentAgent,
          startedAt: intakeSessions.startedAt,
          completedAt: intakeSessions.completedAt,
          reviewedAt: intakeSessions.reviewedAt,
          reviewedBy: intakeSessions.reviewedBy,
          createdAt: intakeSessions.createdAt,
          updatedAt: intakeSessions.updatedAt,
          // Connection fields
          connectionStatus: connections.status,
          // Doctor fields
          doctorId: doctors.id,
          specialty: doctors.specialty,
          clinicName: doctors.clinicName,
          // User fields
          doctorFirstName: users.firstName,
          doctorLastName: users.lastName,
          doctorImageUrl: users.imageUrl,
        })
        .from(intakeSessions)
        .innerJoin(connections, eq(intakeSessions.connectionId, connections.id))
        .innerJoin(doctors, eq(connections.doctorId, doctors.id))
        .innerJoin(users, eq(doctors.userId, users.id))
        .where(and(...whereConditions))
        .orderBy(desc(intakeSessions.updatedAt))
        .limit(effectiveLimit);

      // Verify access to specific connection if provided
      if (input?.connectionId && sessionsWithData.length === 0) {
        // Check if the connection exists but has no sessions
        const connectionExists = await ctx.db.query.connections.findFirst({
          where: and(
            eq(connections.id, input.connectionId),
            eq(connections.patientId, ctx.patient.id)
          ),
        });
        
        if (!connectionExists) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You do not have access to this connection.',
          });
        }
        
        return { sessions: [] };
      }

      // Transform to expected format
      const enrichedSessions = sessionsWithData.map((row) => ({
        id: row.id,
        connectionId: row.connectionId,
        name: row.name,
        status: row.status,
        medicalData: (row.medicalData
          ? { ...(row.medicalData as MedicalData), clinicalHandover: null, ucgRecommendations: null }
          : null) as MedicalData | null,
        clinicalHandover: null as SBAR | null,
        doctorThought: row.doctorThought as DoctorThought | null,
        completeness: row.completeness,
        currentAgent: row.currentAgent,
        startedAt: row.startedAt,
        completedAt: row.completedAt,
        reviewedAt: row.reviewedAt,
        reviewedBy: row.reviewedBy,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        connection: {
          id: row.connectionId,
          status: row.connectionStatus,
          doctor: {
            id: row.doctorId,
            specialty: row.specialty,
            clinicName: row.clinicName,
            user: {
              firstName: row.doctorFirstName,
              lastName: row.doctorLastName,
              imageUrl: row.doctorImageUrl,
            },
          },
        },
      }));

      const response = { sessions: enrichedSessions };
      
      // Check response size and log warning if needed (Requirement 6.5)
      checkResponseSize(response, 'intake.getMyIntakeSessions');

      return response;
    }),

  /**
   * Get all intake sessions with linked appointments for the current patient.
   * Groups sessions by connection with doctor info.
   * 
   * Requirements: 1.1, 1.2, 1.3, 1.4, 6.3
   */
  getAllSessionsWithAppointments: patientProcedure
    .input(z.object({
      status: z.enum(['all', 'active', 'completed']).default('all'),
      sortBy: z.enum(['newest', 'oldest', 'completeness']).default('newest'),
    }))
    .query(async ({ ctx, input }) => {
      if (!ctx.patient) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Patient profile not found.',
        });
      }

      // Build status filter condition based on input
      // 'active' = not_started or in_progress
      // 'completed' = ready or reviewed
      // 'all' = no filter
      const statusConditions = input.status === 'active'
        ? or(
            eq(intakeSessions.status, 'not_started'),
            eq(intakeSessions.status, 'in_progress')
          )
        : input.status === 'completed'
        ? or(
            eq(intakeSessions.status, 'ready'),
            eq(intakeSessions.status, 'reviewed')
          )
        : undefined;

      // Determine sort order
      const orderBy = input.sortBy === 'oldest'
        ? [asc(intakeSessions.createdAt)]
        : input.sortBy === 'completeness'
        ? [desc(intakeSessions.completeness), desc(intakeSessions.createdAt)]
        : [desc(intakeSessions.createdAt)]; // default: newest

      // Build where conditions
      const whereConditions = [eq(connections.patientId, ctx.patient.id)];
      if (statusConditions) {
        whereConditions.push(statusConditions);
      }

      // Query sessions with connection and doctor info
      const sessionsWithData = await ctx.db
        .select({
          // Session fields
          id: intakeSessions.id,
          connectionId: intakeSessions.connectionId,
          name: intakeSessions.name,
          status: intakeSessions.status,
          completeness: intakeSessions.completeness,
          currentAgent: intakeSessions.currentAgent,
          startedAt: intakeSessions.startedAt,
          completedAt: intakeSessions.completedAt,
          createdAt: intakeSessions.createdAt,
          updatedAt: intakeSessions.updatedAt,
          // Connection fields
          connectionStatus: connections.status,
          // Doctor fields
          doctorId: doctors.id,
          specialty: doctors.specialty,
          clinicName: doctors.clinicName,
          // User fields
          doctorFirstName: users.firstName,
          doctorLastName: users.lastName,
          doctorImageUrl: users.imageUrl,
        })
        .from(intakeSessions)
        .innerJoin(connections, eq(intakeSessions.connectionId, connections.id))
        .innerJoin(doctors, eq(connections.doctorId, doctors.id))
        .innerJoin(users, eq(doctors.userId, users.id))
        .where(and(...whereConditions))
        .orderBy(...orderBy);

      // Get linked appointments for these sessions
      const sessionIds = sessionsWithData.map(s => s.id);
      
      let linkedAppointments: Array<{
        id: string;
        intakeSessionId: string | null;
        scheduledAt: Date;
        duration: number;
        status: string;
      }> = [];
      
      if (sessionIds.length > 0) {
        linkedAppointments = await ctx.db
          .select({
            id: appointments.id,
            intakeSessionId: appointments.intakeSessionId,
            scheduledAt: appointments.scheduledAt,
            duration: appointments.duration,
            status: appointments.status,
          })
          .from(appointments)
          .where(
            and(
              // Filter to only appointments linked to our sessions
              // Using a subquery approach since we can't use inArray with potentially null values
              sessionIds.length > 0
                ? or(...sessionIds.map(id => eq(appointments.intakeSessionId, id)))
                : undefined
            )
          );
      }

      // Create a map of session ID to linked appointment
      const appointmentMap = new Map(
        linkedAppointments
          .filter(apt => apt.intakeSessionId !== null)
          .map(apt => [apt.intakeSessionId!, apt])
      );

      // Transform and group sessions by connection
      const sessionsGroupedByConnection = new Map<string, {
        connection: {
          id: string;
          status: string;
          doctor: {
            id: string;
            specialty: string | null;
            clinicName: string | null;
            user: {
              firstName: string | null;
              lastName: string | null;
              imageUrl: string | null;
            };
          };
        };
        sessions: Array<{
          id: string;
          name: string | null;
          status: string;
          completeness: number;
          currentAgent: string | null;
          startedAt: Date | null;
          completedAt: Date | null;
          createdAt: Date;
          updatedAt: Date;
          linkedAppointment: {
            id: string;
            scheduledAt: Date;
            duration: number;
            status: string;
          } | null;
        }>;
      }>();

      for (const row of sessionsWithData) {
        const linkedAppointment = appointmentMap.get(row.id) ?? null;
        
        const sessionData = {
          id: row.id,
          name: row.name,
          status: row.status,
          completeness: row.completeness,
          currentAgent: row.currentAgent,
          startedAt: row.startedAt,
          completedAt: row.completedAt,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          linkedAppointment: linkedAppointment ? {
            id: linkedAppointment.id,
            scheduledAt: linkedAppointment.scheduledAt,
            duration: linkedAppointment.duration,
            status: linkedAppointment.status,
          } : null,
        };

        if (sessionsGroupedByConnection.has(row.connectionId)) {
          sessionsGroupedByConnection.get(row.connectionId)!.sessions.push(sessionData);
        } else {
          sessionsGroupedByConnection.set(row.connectionId, {
            connection: {
              id: row.connectionId,
              status: row.connectionStatus,
              doctor: {
                id: row.doctorId,
                specialty: row.specialty,
                clinicName: row.clinicName,
                user: {
                  firstName: row.doctorFirstName,
                  lastName: row.doctorLastName,
                  imageUrl: row.doctorImageUrl,
                },
              },
            },
            sessions: [sessionData],
          });
        }
      }

      // Convert map to array
      const groupedSessions = Array.from(sessionsGroupedByConnection.values());

      return { groupedSessions };
    }),

  /**
   * Create a new intake session for a connection.
   * Allows creating multiple sessions per connection (no check for existing ones).
   * 
   * Requirements: 2.1, 2.2
   */
  createNewSession: patientProcedure
    .input(z.object({
      connectionId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.patient) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Patient profile not found.',
        });
      }

      // Verify the connection exists and belongs to this patient
      const connection = await ctx.db.query.connections.findFirst({
        where: and(
          eq(connections.id, input.connectionId),
          eq(connections.patientId, ctx.patient.id),
          eq(connections.status, 'active')
        ),
      });

      if (!connection) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Connection not found or not active.',
        });
      }

      // Create new intake session without checking for existing ones
      // INITIAL_MEDICAL_DATA already has currentAgent: 'VitalsTriageAgent' and vitalsStageCompleted: false
      const result = await ctx.db
        .insert(intakeSessions)
        .values({
          connectionId: input.connectionId,
          status: 'not_started',
          medicalData: INITIAL_MEDICAL_DATA,
          doctorThought: INITIAL_THOUGHT,
          completeness: 0,
          currentAgent: INITIAL_MEDICAL_DATA.currentAgent, // Use currentAgent from INITIAL_MEDICAL_DATA
        })
        .returning();

      const newSession = result[0];
      if (!newSession) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create intake session.',
        });
      }

      // Log the intake session creation
      await auditService.log({
        userId: ctx.user.id,
        action: 'intake_session_created',
        resourceType: 'intake_session',
        resourceId: newSession.id,
        metadata: {
          connectionId: input.connectionId,
          allowsMultipleSessions: true,
        },
      });

      return redactSessionForPatient(newSession);
    }),

  /**
   * Delete an intake session permanently.
   * Only allows deletion of sessions with status 'not_started' or 'in_progress'
   * and no linked appointment.
   * 
   * Requirements: 4.2, 4.3, 4.4, 4.5
   */
  deleteSession: patientProcedure
    .input(z.object({
      sessionId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.patient) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Patient profile not found.',
        });
      }

      // Get the session
      const session = await ctx.db.query.intakeSessions.findFirst({
        where: eq(intakeSessions.id, input.sessionId),
      });

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Session not found.',
        });
      }

      // Verify the session belongs to this patient via connection
      const connection = await ctx.db.query.connections.findFirst({
        where: and(
          eq(connections.id, session.connectionId),
          eq(connections.patientId, ctx.patient.id)
        ),
      });

      if (!connection) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: "You don't have access to this session.",
        });
      }

      // Check session status - only allow deletion of not_started or in_progress
      if (session.status !== 'not_started' && session.status !== 'in_progress') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Completed sessions cannot be deleted.',
        });
      }

      // Check for linked appointment
      const linkedAppointment = await ctx.db.query.appointments.findFirst({
        where: eq(appointments.intakeSessionId, input.sessionId),
      });

      if (linkedAppointment) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Sessions with linked appointments cannot be deleted.',
        });
      }

      // Delete chat messages first (cascade)
      await ctx.db
        .delete(chatMessages)
        .where(eq(chatMessages.sessionId, input.sessionId));

      // Delete the session
      await ctx.db
        .delete(intakeSessions)
        .where(eq(intakeSessions.id, input.sessionId));

      // Log the deletion
      await auditService.log({
        userId: ctx.user.id,
        action: 'intake_session_deleted',
        resourceType: 'intake_session',
        resourceId: input.sessionId,
        metadata: {
          connectionId: session.connectionId,
          previousStatus: session.status,
        },
      });

      return { success: true };
    }),

  /**
   * Get sessions available for appointment linking.
   * Returns sessions with status 'ready' OR (status 'in_progress' AND completeness >= 50).
   * 
   * Requirements: 5.2
   */
  getSessionsForAppointmentLinking: patientProcedure
    .input(z.object({
      connectionId: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      if (!ctx.patient) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Patient profile not found.',
        });
      }

      // Verify the connection belongs to this patient
      const connection = await ctx.db.query.connections.findFirst({
        where: and(
          eq(connections.id, input.connectionId),
          eq(connections.patientId, ctx.patient.id)
        ),
      });

      if (!connection) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: "You don't have access to this connection.",
        });
      }

      // Get sessions that are linkable:
      // - status 'ready' OR
      // - status 'in_progress' AND completeness >= 50
      const linkableSessions = await ctx.db
        .select({
          id: intakeSessions.id,
          status: intakeSessions.status,
          completeness: intakeSessions.completeness,
          createdAt: intakeSessions.createdAt,
          updatedAt: intakeSessions.updatedAt,
        })
        .from(intakeSessions)
        .where(
          and(
            eq(intakeSessions.connectionId, input.connectionId),
            or(
              eq(intakeSessions.status, 'ready'),
              and(
                eq(intakeSessions.status, 'in_progress'),
                gte(intakeSessions.completeness, 50)
              )
            )
          )
        )
        .orderBy(desc(intakeSessions.createdAt));

      return { sessions: linkableSessions };
    }),

  /**
   * Get intake sessions for a doctor (their connected patients).
   * 
   * OPTIMIZED: Uses JOINs to fetch all related data in a single query.
   * - Single query fetches sessions with connection, patient, and user data
   * - Eliminates N+1 query pattern from Promise.all
   * 
   * Requirements: 6.1, 6.4, 6.5
   * Performance Requirements: 1.3
   */
  getDoctorIntakeSessions: doctorProcedure
    .input(
      z.object({
        status: z.enum(['not_started', 'in_progress', 'ready', 'reviewed', 'all']).default('all'),
        limit: z.number().min(1).max(100).default(50),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      // Enforce pagination limit (Requirement 6.4)
      const effectiveLimit = enforcePaginationLimit(input?.limit ?? 50, MAX_PAGINATION_LIMIT);
      
      if (!ctx.doctor) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Doctor profile not found.',
        });
      }

      // Build the status condition
      const statusCondition = input?.status && input.status !== 'all'
        ? eq(intakeSessions.status, input.status)
        : undefined;

      // Single query with JOINs to fetch all related data
      const sessionsWithData = await ctx.db
        .select({
          // Session fields
          id: intakeSessions.id,
          connectionId: intakeSessions.connectionId,
          name: intakeSessions.name,
          status: intakeSessions.status,
          medicalData: intakeSessions.medicalData,
          clinicalHandover: intakeSessions.clinicalHandover,
          doctorThought: intakeSessions.doctorThought,
          completeness: intakeSessions.completeness,
          currentAgent: intakeSessions.currentAgent,
          startedAt: intakeSessions.startedAt,
          completedAt: intakeSessions.completedAt,
          reviewedAt: intakeSessions.reviewedAt,
          reviewedBy: intakeSessions.reviewedBy,
          createdAt: intakeSessions.createdAt,
          updatedAt: intakeSessions.updatedAt,
          // Connection fields
          connectionStatus: connections.status,
          // Patient fields
          patientId: patients.id,
          // User fields
          patientFirstName: users.firstName,
          patientLastName: users.lastName,
          patientImageUrl: users.imageUrl,
          patientEmail: users.email,
        })
        .from(intakeSessions)
        .innerJoin(connections, eq(intakeSessions.connectionId, connections.id))
        .innerJoin(patients, eq(connections.patientId, patients.id))
        .innerJoin(users, eq(patients.userId, users.id))
        .where(
          statusCondition
            ? and(
                eq(connections.doctorId, ctx.doctor.id),
                eq(connections.status, 'active'),
                statusCondition
              )
            : and(
                eq(connections.doctorId, ctx.doctor.id),
                eq(connections.status, 'active')
              )
        )
        .orderBy(desc(intakeSessions.updatedAt))
        .limit(effectiveLimit);

      // Check response size and log warning if needed (Requirement 6.5)
      const response = { sessions: sessionsWithData };
      checkResponseSize(response, 'intake.getDoctorIntakeSessions');

      // Transform to expected format
      const enrichedSessions = sessionsWithData.map((row) => ({
        id: row.id,
        connectionId: row.connectionId,
        name: row.name,
        status: row.status,
        medicalData: row.medicalData as MedicalData | null,
        clinicalHandover: row.clinicalHandover as SBAR | null,
        doctorThought: row.doctorThought as DoctorThought | null,
        completeness: row.completeness,
        currentAgent: row.currentAgent,
        startedAt: row.startedAt,
        completedAt: row.completedAt,
        reviewedAt: row.reviewedAt,
        reviewedBy: row.reviewedBy,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        connection: {
          id: row.connectionId,
          status: row.connectionStatus,
          patient: {
            id: row.patientId,
            user: {
              firstName: row.patientFirstName,
              lastName: row.patientLastName,
              imageUrl: row.patientImageUrl,
              email: row.patientEmail,
            },
          },
        },
      }));

      return {
        sessions: enrichedSessions,
      };
    }),

  /**
   * Mark an intake session as reviewed by the doctor.
   * Requirements: 6.6
   */
  markAsReviewed: doctorProcedure
    .input(getSessionSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.doctor) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Doctor profile not found.',
        });
      }

      // Get the session
      const session = await ctx.db.query.intakeSessions.findFirst({
        where: eq(intakeSessions.id, input.sessionId),
      });

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Intake session not found.',
        });
      }

      // Verify the doctor has access to this session
      const connection = await ctx.db.query.connections.findFirst({
        where: and(
          eq(connections.id, session.connectionId),
          eq(connections.doctorId, ctx.doctor.id)
        ),
      });

      if (!connection) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You are not authorized to review this intake session.',
        });
      }

      // Update the session status
      const result = await ctx.db
        .update(intakeSessions)
        .set({
          status: 'reviewed',
          reviewedAt: new Date(),
          reviewedBy: ctx.user.id,
          updatedAt: new Date(),
        })
        .where(eq(intakeSessions.id, input.sessionId))
        .returning();

      const updatedSession = result[0];
      if (!updatedSession) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update intake session.',
        });
      }

      // Log the intake review
      await auditService.log({
        userId: ctx.user.id,
        action: 'intake_reviewed',
        resourceType: 'intake_session',
        resourceId: input.sessionId,
        metadata: {
          connectionId: session.connectionId,
          reviewedBy: ctx.user.id,
        },
      });

      return updatedSession;
    }),

  /**
   * Get messages for an intake session by connectionId.
   * Filters messages to only those belonging to sessions for the specified connection.
   * Requirements: 2.1, 3.4
   */
  getMessages: protectedProcedure
    .input(z.object({ connectionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Verify user has access to this connection
      const connection = await ctx.db.query.connections.findFirst({
        where: eq(connections.id, input.connectionId),
      });

      if (!connection) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Connection not found.',
        });
      }

      // Check authorization - must be patient or doctor in connection
      const patient = await ctx.db.query.patients.findFirst({
        where: eq(patients.userId, ctx.user.id),
      });

      const doctor = await ctx.db.query.doctors.findFirst({
        where: eq(doctors.userId, ctx.user.id),
      });

      const isPatientInConnection = patient && connection.patientId === patient.id;
      const isDoctorInConnection = doctor && connection.doctorId === doctor.id;
      const isSuperAdmin = ctx.user.primaryRole === 'super_admin';

      if (!isPatientInConnection && !isDoctorInConnection && !isSuperAdmin) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You are not authorized to view messages for this connection.',
        });
      }

      // Get all intake sessions for this connection
      const sessions = await ctx.db.query.intakeSessions.findMany({
        where: eq(intakeSessions.connectionId, input.connectionId),
      });

      if (sessions.length === 0) {
        return { messages: [] };
      }

      const sessionIds = sessions.map(s => s.id);

      // Get all messages for these sessions
      const messages = await ctx.db.query.chatMessages.findMany({
        where: sessionIds.length > 0 
          ? or(...sessionIds.map(id => eq(chatMessages.sessionId, id)))
          : undefined,
        orderBy: [chatMessages.createdAt],
      });

      // Transform messages to the expected format
      const formattedMessages: Message[] = messages.map((msg) => ({
        id: msg.id,
        role: msg.role as 'user' | 'model' | 'doctor',
        text: msg.content,
        images: msg.images ?? undefined,
        timestamp: msg.createdAt,
        groundingMetadata: msg.groundingMetadata,
        activeAgent: msg.activeAgent as Message['activeAgent'],
        contextLayer: msg.contextLayer as ContextLayer,
      }));

      return { messages: formattedMessages };
    }),

  /**
   * Get the latest SBAR report for a connection.
   * Returns the most recent SBAR from any intake session for this connection.
   * Requirements: 3.5, 4.1
   */
  getSBAR: protectedProcedure
    .input(z.object({ connectionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Verify user has access to this connection
      const connection = await ctx.db.query.connections.findFirst({
        where: eq(connections.id, input.connectionId),
      });

      if (!connection) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Connection not found.',
        });
      }

      // Check authorization - must be doctor in connection (SBAR is doctor-only)
      const doctor = await ctx.db.query.doctors.findFirst({
        where: eq(doctors.userId, ctx.user.id),
      });

      const isDoctorInConnection = doctor && connection.doctorId === doctor.id;
      const isSuperAdmin = ctx.user.primaryRole === 'super_admin';

      if (!isDoctorInConnection && !isSuperAdmin) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You are not authorized to view SBAR reports for this connection.',
        });
      }

      // Get the most recent intake session with a clinical handover
      const session = await ctx.db.query.intakeSessions.findFirst({
        where: eq(intakeSessions.connectionId, input.connectionId),
        orderBy: [desc(intakeSessions.updatedAt)],
      });

      if (!session || !session.clinicalHandover) {
        return { sbar: null };
      }

      return { sbar: session.clinicalHandover as SBAR };
    }),

  /**
   * Get clinical reasoning (doctor thought) for a connection.
   * Returns the most recent clinical reasoning from any intake session for this connection.
   * Requirements: 4.1
   */
  getClinicalReasoning: protectedProcedure
    .input(z.object({ connectionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Verify user has access to this connection
      const connection = await ctx.db.query.connections.findFirst({
        where: eq(connections.id, input.connectionId),
      });

      if (!connection) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Connection not found.',
        });
      }

      // Check authorization - must be doctor in connection (clinical reasoning is doctor-only)
      const doctor = await ctx.db.query.doctors.findFirst({
        where: eq(doctors.userId, ctx.user.id),
      });

      const isDoctorInConnection = doctor && connection.doctorId === doctor.id;
      const isSuperAdmin = ctx.user.primaryRole === 'super_admin';

      if (!isDoctorInConnection && !isSuperAdmin) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You are not authorized to view clinical reasoning for this connection.',
        });
      }

      // Get the most recent intake session with doctor thought
      const session = await ctx.db.query.intakeSessions.findFirst({
        where: eq(intakeSessions.connectionId, input.connectionId),
        orderBy: [desc(intakeSessions.updatedAt)],
      });

      if (!session || !session.doctorThought) {
        return { clinicalReasoning: null };
      }

      return { clinicalReasoning: session.doctorThought as DoctorThought };
    }),

  /**
   * Send a message in an intake session and get AI response.
   * Requirements: 7.3, 7.4, 11.1, 11.2, 11.3, 11.4, 11.5
   * Requirement 6.4: Request deduplication based on content hash and timestamp
   */
  sendMessage: protectedProcedure
    .input(sendMessageSchema)
    .mutation(async ({ ctx, input }) => {
      // Track start time for duration logging (Requirement 3.1)
      const startTime = Date.now();
      
      // Log request start with context (Requirement 3.2)
      console.log('[intake.sendMessage] Request started', {
        timestamp: new Date().toISOString(),
        sessionId: input.sessionId,
        userId: ctx.user.id,
        contentLength: input.content.length,
        hasImages: !!input.images && input.images.length > 0,
        imageCount: input.images?.length ?? 0,
      });
      
      try {
        // --- DEDUPLICATION CHECK (Requirement 6.4) ---
        // Generate content hash for this message
        const contentHash = generateContentHash(input.content, input.sessionId);
        const deduplicationWindowStart = new Date(Date.now() - DEDUPLICATION_WINDOW_MS);
        
        // Check for duplicate messages within the deduplication window
        const recentDuplicates = await ctx.db.query.chatMessages.findMany({
          where: and(
            eq(chatMessages.sessionId, input.sessionId),
            eq(chatMessages.role, 'user'),
            gte(chatMessages.createdAt, deduplicationWindowStart)
          ),
          orderBy: [desc(chatMessages.createdAt)],
          limit: 10, // Only check recent messages
        });
        
        // Check if any recent message has the same content hash
        const isDuplicate = recentDuplicates.some(msg => {
          const existingHash = generateContentHash(msg.content, input.sessionId);
          return existingHash === contentHash;
        });
        
        if (isDuplicate) {
          console.log('[intake.sendMessage] Duplicate message detected, rejecting:', {
            sessionId: input.sessionId,
            contentHash,
            windowMs: DEDUPLICATION_WINDOW_MS,
          });
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Duplicate message detected. Please wait before sending the same message again.',
          });
        }
        // --- END DEDUPLICATION CHECK ---

        // Get the session
        const session = await ctx.db.query.intakeSessions.findFirst({
          where: eq(intakeSessions.id, input.sessionId),
        });

        if (!session) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Intake session not found.',
          });
      }

      // Get the connection to verify access
      const connection = await ctx.db.query.connections.findFirst({
        where: eq(connections.id, session.connectionId),
      });

      if (!connection) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Connection not found.',
        });
      }

      // Verify user has access (patient or doctor in the connection)
      const patient = await ctx.db.query.patients.findFirst({
        where: eq(patients.userId, ctx.user.id),
      });

      const doctor = await ctx.db.query.doctors.findFirst({
        where: eq(doctors.userId, ctx.user.id),
      });

      const isPatientInConnection = patient && connection.patientId === patient.id;
      const isDoctorInConnection = doctor && connection.doctorId === doctor.id;

      if (!isPatientInConnection && !isDoctorInConnection) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You are not authorized to send messages in this intake session.',
        });
      }

      // Determine the mode based on who is sending
      const mode = isDoctorInConnection ? 'doctor' : 'patient';
      const messageRole = isDoctorInConnection ? 'doctor' : 'user';

      // Get existing messages for context
      const existingMessages = await ctx.db.query.chatMessages.findMany({
        where: eq(chatMessages.sessionId, input.sessionId),
        orderBy: [chatMessages.createdAt],
      });

      // Transform to Message format for AI
      const messageHistory: Message[] = existingMessages.map((msg) => ({
        id: msg.id,
        role: msg.role as 'user' | 'model' | 'doctor',
        text: msg.content,
        images: msg.images ?? undefined,
        timestamp: msg.createdAt,
        groundingMetadata: msg.groundingMetadata,
        activeAgent: msg.activeAgent as AgentRole | undefined,
      }));

      // Add the new user message to history
      const userMessageId = crypto.randomUUID();
      const userMessage: Message = {
        id: userMessageId,
        role: messageRole as 'user' | 'doctor',
        text: input.content,
        images: input.images,
        timestamp: new Date(),
      };
      messageHistory.push(userMessage);

      // Save user message to database (Requirement 7.3 - persist in real-time)
      await ctx.db.insert(chatMessages).values({
        sessionId: input.sessionId,
        role: messageRole,
        content: input.content,
        images: input.images ?? null,
        activeAgent: null,
      });

      // Update session status to in_progress if it was not_started
      if (session.status === 'not_started') {
        await ctx.db
          .update(intakeSessions)
          .set({
            status: 'in_progress',
            startedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(intakeSessions.id, input.sessionId));
      }

      // Get current medical data
      let currentMedicalData = (session.medicalData as MedicalData) ?? INITIAL_MEDICAL_DATA;
      currentMedicalData = {
        ...INITIAL_MEDICAL_DATA,
        ...currentMedicalData,
        historyCheckCompleted: currentMedicalData.historyCheckCompleted ?? false,
        // Backward compatibility: Set vitalsStageCompleted to true for existing sessions without vitalsData
        vitalsData: currentMedicalData.vitalsData ?? {
          ...INITIAL_MEDICAL_DATA.vitalsData,
          vitalsStageCompleted: true, // Skip vitals for existing sessions
        },
      };

      // --- QUESTION OPTIMIZATION TRACKING (Requirements: 2.1, 2.4, 3.1, 3.4, 5.3) ---
      // Get current tracking state from session
      let currentFollowUpCounts = (session.followUpCounts as FollowUpCounts) ?? {};
      let currentAnsweredTopics = (session.answeredTopics as string[]) ?? [];
      let currentConsecutiveErrors = session.consecutiveErrors ?? 0;
      let currentAgent = (session.currentAgent as AgentRole) ?? 'Triage';
      
      // Extract answered topics from the patient's message (Requirement 3.4)
      const newTopics = extractAnsweredTopics(input.content);
      if (newTopics.length > 0) {
        currentAnsweredTopics = markTopicsAnswered(currentAnsweredTopics, newTopics);
      }
      
      // Check for completion phrases (Requirement 5.3)
      const hasCompletionPhrase = detectCompletionPhrase(input.content);
      
      // Check if message contains new information (Requirement 2.2)
      const hasNewInfo = containsNewInformation(input.content, currentAnsweredTopics);
      let shouldAdvanceStage = false;
      
      // --- RECORDS CHECK AUTO-COMPLETION (Requirements: 1.4, 3.2) ---
      // When RecordsClerk is active and patient gives a negative response,
      // automatically set recordsCheckCompleted to true and advance to next stage
      const isNegativeResponse = detectNegativeResponse(input.content);
      if (currentAgent === 'RecordsClerk' && isNegativeResponse && !currentMedicalData.recordsCheckCompleted) {
        console.log('[intake.sendMessage] Negative response to RecordsClerk, auto-completing records check');
        currentMedicalData = {
          ...currentMedicalData,
          recordsCheckCompleted: true,
        };
      }

      if (currentAgent === 'HistorySpecialist' && isNegativeResponse && !(currentMedicalData.historyCheckCompleted ?? false)) {
        console.log('[intake.sendMessage] Negative response to HistorySpecialist, auto-completing history check');
        currentMedicalData = {
          ...currentMedicalData,
          historyCheckCompleted: true,
        };
        currentAnsweredTopics = markTopicsAnswered(currentAnsweredTopics, [
          'medications',
          'allergies',
          'past medical history',
        ]);
        shouldAdvanceStage = true;
        currentAgent = getNextAgentOnLimitReached(currentAgent);
      }
      // --- END RECORDS CHECK AUTO-COMPLETION ---
      
      // Check follow-up limit and advance stage if needed (Requirements 2.1, 2.3)
      if (!hasNewInfo && isFollowUpLimitReachedForAgent(currentFollowUpCounts, currentAgent)) {
        if (currentAgent === 'HistorySpecialist' && !(currentMedicalData.historyCheckCompleted ?? false)) {
          currentMedicalData = {
            ...currentMedicalData,
            historyCheckCompleted: true,
          };
        }
        shouldAdvanceStage = true;
        currentAgent = getNextAgentOnLimitReached(currentAgent);
        console.log('[intake.sendMessage] Follow-up limit reached, advancing to:', currentAgent);
      }
      
      // Force stage advancement on completion phrase (Requirement 5.3)
      if (hasCompletionPhrase && currentAgent !== 'HandoverSpecialist') {
        if (currentAgent === 'HistorySpecialist' && !(currentMedicalData.historyCheckCompleted ?? false)) {
          currentMedicalData = {
            ...currentMedicalData,
            historyCheckCompleted: true,
          };
        }
        shouldAdvanceStage = true;
        currentAgent = getNextAgentOnLimitReached(currentAgent);
        console.log('[intake.sendMessage] Completion phrase detected, advancing to:', currentAgent);
      }
      // --- END QUESTION OPTIMIZATION TRACKING ---

      // --- TERMINATION DETECTION (Requirements: 1.2, 4.1, 4.2, 6.1, 6.2) ---
      // Get current AI message count and termination tracking state
      let currentAiMessageCount = session.aiMessageCount ?? 0;
      let hasOfferedConclusion = session.hasOfferedConclusion ?? false;
      let terminationReason: string | null = session.terminationReason ?? null;
      
      // Check for termination signals BEFORE calling AI
      const hasChiefComplaint = !!currentMedicalData.chiefComplaint;
      const hasHpi = !!currentMedicalData.hpi && currentMedicalData.hpi.length > 20;
      const currentCompleteness = calculateIntakeCompleteness(currentMedicalData);
      
      const terminationResult = detectTerminationSignal(
        input.content,
        currentAgent,
        currentAiMessageCount,
        currentCompleteness,
        hasChiefComplaint,
        hasHpi
      );
      
      // Handle immediate termination (skip/done commands)
      if (terminationResult.shouldTerminate && 
          (terminationResult.reason === 'skip_command' || terminationResult.reason === 'done_command')) {
        console.log('[intake.sendMessage] Immediate termination detected:', terminationResult.reason);
        
        // Update agent and termination reason
        if (terminationResult.targetAgent) {
          currentAgent = terminationResult.targetAgent;
          shouldAdvanceStage = true;
        }
        terminationReason = terminationResult.reason;
        
        // For done commands, mark as ready if we have minimum data
        const shouldMarkReady = terminationResult.reason === 'done_command' && 
          (hasChiefComplaint || currentCompleteness >= 30);
        
        // Save acknowledgment message and update session
        const ackMessage = terminationResult.acknowledgment ?? 
          (terminationResult.reason === 'done_command' 
            ? "Wrapping up your intake. Let me prepare your summary..."
            : "Moving to the next section...");
        
        // Save user message was already done above, now save the acknowledgment
        const ackMessageResult = await ctx.db
          .insert(chatMessages)
          .values({
            sessionId: input.sessionId,
            role: 'model',
            content: ackMessage,
            activeAgent: currentAgent,
            groundingMetadata: null,
          })
          .returning();
        
        const ackDbMessage = ackMessageResult[0];
        
        // Update session with termination state
        const terminationUpdateData: Record<string, unknown> = {
          currentAgent,
          terminationReason,
          aiMessageCount: currentAiMessageCount + 1,
          updatedAt: new Date(),
        };
        
        if (shouldMarkReady && session.status !== 'ready') {
          terminationUpdateData.status = 'ready';
          terminationUpdateData.completedAt = new Date();
          
          // Generate clinical handover if not present
          if (!currentMedicalData.clinicalHandover) {
            const clinicalHandover = await generateClinicalHandover(currentMedicalData);
            terminationUpdateData.clinicalHandover = clinicalHandover;
          }
        }
        
        await ctx.db
          .update(intakeSessions)
          .set(terminationUpdateData)
          .where(eq(intakeSessions.id, input.sessionId));
        
        return {
          userMessage: {
            id: crypto.randomUUID(),
            role: messageRole,
            text: input.content,
            images: input.images,
            timestamp: new Date(),
          },
          aiMessage: ackDbMessage ? {
            id: ackDbMessage.id,
            role: 'model' as const,
            text: ackMessage,
            timestamp: ackDbMessage.createdAt,
            activeAgent: currentAgent,
            groundingMetadata: null,
          } : null,
          thought: INITIAL_THOUGHT,
          updatedMedicalData: currentMedicalData,
          completeness: currentCompleteness,
          isReady: shouldMarkReady,
        };
      }
      
      // Handle message limit enforcement (force handover at 20 messages)
      if (terminationResult.shouldTerminate && terminationResult.reason === 'message_limit') {
        console.log('[intake.sendMessage] Message limit reached, forcing handover');
        currentAgent = 'HandoverSpecialist';
        shouldAdvanceStage = true;
        terminationReason = 'message_limit';
      }
      
      // Handle completeness threshold (offer conclusion at 80%)
      if (terminationResult.shouldTerminate && terminationResult.reason === 'completeness_threshold') {
        console.log('[intake.sendMessage] Completeness threshold reached, transitioning to handover');
        currentAgent = 'HandoverSpecialist';
        shouldAdvanceStage = true;
        if (!hasOfferedConclusion) {
          hasOfferedConclusion = true;
        }
      }
      
      // Handle explicit finish requests and completion phrases
      if (terminationResult.shouldTerminate && 
          (terminationResult.reason === 'explicit_request' || terminationResult.reason === 'completion_phrase')) {
        console.log('[intake.sendMessage] Termination signal detected:', terminationResult.reason);
        if (terminationResult.targetAgent) {
          currentAgent = terminationResult.targetAgent;
          shouldAdvanceStage = true;
        }
        terminationReason = terminationResult.reason;
      }
      
      // Check if we should offer conclusion (15 messages)
      const shouldOfferConclusionNow = shouldOfferConclusion(currentAiMessageCount) && !hasOfferedConclusion;
      if (shouldOfferConclusionNow) {
        console.log('[intake.sendMessage] Offering conclusion at', currentAiMessageCount, 'messages');
        hasOfferedConclusion = true;
      }
      // --- END TERMINATION DETECTION ---

      console.log('[intake.sendMessage] Calling AI service...');
      
      // --- BUILD TRACKING STATE FOR AI SERVICE (Requirements: 6.1, 6.2, 6.3, 6.4, 6.5) ---
      const trackingState: TrackingState = {
        followUpCounts: currentFollowUpCounts,
        answeredTopics: currentAnsweredTopics,
        aiMessageCount: currentAiMessageCount,
        completeness: currentCompleteness,
        currentAgent: currentAgent,
      };
      // --- END BUILD TRACKING STATE ---
      
      // Send to AI and get response with timeout and fallback handling (Requirements: 6.1, 6.2, 6.3)
      let aiResponse;
      let groundingMetadata;
      let aiServiceError: Error | null = null;
      
      try {
        // Wrap AI service call with 25-second timeout (Requirement 6.2)
        const aiPromise = sendAIMessage(
          messageHistory,
          currentMedicalData,
          mode,
          trackingState
        );
        
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('AI service timeout after 25 seconds')), 25000)
        );
        
        const result = await Promise.race([aiPromise, timeoutPromise]);
        aiResponse = result.response;
        groundingMetadata = result.groundingMetadata;
        
        console.log('[intake.sendMessage] AI response received:', {
          hasReply: !!aiResponse.reply,
          replyLength: aiResponse.reply?.length,
          activeAgent: aiResponse.activeAgent,
        });
      } catch (error) {
        // Log AI service errors with context (Requirement 6.3)
        aiServiceError = error instanceof Error ? error : new Error('Unknown AI service error');
        console.error('[intake.sendMessage] AI service error', {
          timestamp: new Date().toISOString(),
          sessionId: input.sessionId,
          userId: ctx.user.id,
          error: aiServiceError.message,
          stack: aiServiceError.stack,
          duration: Date.now() - startTime,
        });
        
        // Increment consecutive errors (Requirement 6.4)
        currentConsecutiveErrors = incrementConsecutiveErrors(currentConsecutiveErrors);
        
        // Use fallback message on AI failure (Requirement 6.1)
        aiResponse = {
          reply: getFallbackMessageForAgent(currentAgent, input.content, currentConsecutiveErrors),
          updatedData: {},
          thought: INITIAL_THOUGHT,
          activeAgent: currentAgent,
        };
        groundingMetadata = null;
        
        console.log('[intake.sendMessage] Using fallback message due to AI service error:', {
          consecutiveErrors: currentConsecutiveErrors,
          fallbackMessage: aiResponse.reply.substring(0, 100),
        });
      }

      // Validate AI response before saving to database (Requirement 4.3)
      let isValidResponse = aiResponse.reply && aiResponse.reply.trim().length > 0;
      let finalReply = aiResponse.reply;
      let usedFallback = !!aiServiceError; // Track if we used fallback due to AI service error
      
      if (!isValidResponse) {
        // Log empty/malformed responses with session context (Requirement 4.3)
        logInvalidResponse(
          input.sessionId,
          ctx.user.id,
          aiResponse,
          'Empty or null reply field in AI response'
        );
        
        // Only increment consecutive errors if we haven't already (from AI service error)
        if (!aiServiceError) {
          currentConsecutiveErrors = incrementConsecutiveErrors(currentConsecutiveErrors);
        }
        
        // Use contextual fallback message instead of throwing error (Requirements 4.1, 4.2)
        finalReply = getFallbackMessageForAgent(currentAgent, input.content, currentConsecutiveErrors);
        usedFallback = true;
        isValidResponse = true; // Allow the fallback to proceed
        
        console.log('[intake.sendMessage] Using fallback message:', {
          consecutiveErrors: currentConsecutiveErrors,
          fallbackMessage: finalReply.substring(0, 100),
        });
      } else if (!aiServiceError) {
        // Reset consecutive errors on successful response (Requirement 4.5, 6.5)
        // Only reset if we didn't have an AI service error
        currentConsecutiveErrors = resetConsecutiveErrors();
      }
      
      // Update follow-up count after successful response (Requirement 2.4)
      if (!usedFallback) {
        currentFollowUpCounts = incrementFollowUpCountForAgent(currentFollowUpCounts, currentAgent);
      }

      // Log AI response updatedData for debugging
      console.log('[intake.sendMessage] AI updatedData:', {
        chiefComplaint: aiResponse.updatedData?.chiefComplaint?.substring(0, 50),
        hpi: aiResponse.updatedData?.hpi?.substring(0, 100),
        hpiLength: aiResponse.updatedData?.hpi?.length,
        recordsCheckCompleted: aiResponse.updatedData?.recordsCheckCompleted,
        bookingStatus: aiResponse.updatedData?.bookingStatus,
        activeAgent: aiResponse.activeAgent,
      });

      // Merge updated medical data (Requirement 7.4 - update after each response)
      const mergedMedicalData = mergeMedicalData(currentMedicalData, aiResponse.updatedData);
      const finalAgentForState = shouldAdvanceStage
        ? currentAgent
        : (aiResponse.activeAgent ?? currentAgent);
      const updatedMedicalData = {
        ...mergedMedicalData,
        currentAgent: finalAgentForState,
      };

      const meetsReadyCriteria =
        determineAgent(updatedMedicalData) === 'HandoverSpecialist' &&
        !!updatedMedicalData.chiefComplaint &&
        (updatedMedicalData.hpi?.trim().length ?? 0) >= 50 &&
        updatedMedicalData.recordsCheckCompleted;

      if (updatedMedicalData.bookingStatus !== 'booked' && meetsReadyCriteria) {
        updatedMedicalData.bookingStatus = 'ready';
      }
      
      // Log merged medical data for debugging
      console.log('[intake.sendMessage] Merged medicalData:', {
        chiefComplaint: updatedMedicalData.chiefComplaint?.substring(0, 50),
        hpi: updatedMedicalData.hpi?.substring(0, 100),
        hpiLength: updatedMedicalData.hpi?.length,
        recordsCheckCompleted: updatedMedicalData.recordsCheckCompleted,
        bookingStatus: updatedMedicalData.bookingStatus,
        currentAgent: updatedMedicalData.currentAgent,
      });

      // Calculate completeness percentage (Requirement 11.5)
      const completeness = calculateIntakeCompleteness(updatedMedicalData);
      
      console.log('[intake.sendMessage] Completeness calculated:', completeness);

      // Determine if intake is ready
      const isReady = updatedMedicalData.bookingStatus === 'ready';

      // Save AI response to database (using finalReply which may be fallback)
      const aiMessageResult = await ctx.db
        .insert(chatMessages)
        .values({
          sessionId: input.sessionId,
          role: 'model',
          content: finalReply,
          activeAgent: aiResponse.activeAgent ?? currentAgent,
          groundingMetadata: groundingMetadata ?? null,
        })
        .returning();

      const aiMessage = aiMessageResult[0];

      // Update session with new medical data, completeness, and tracking state
      const sessionUpdateData: Record<string, unknown> = {
        medicalData: updatedMedicalData,
        doctorThought: aiResponse.thought,
        completeness,
        currentAgent: shouldAdvanceStage ? currentAgent : (aiResponse.activeAgent ?? currentAgent),
        // Question optimization tracking fields (Requirements: 2.4, 3.4, 4.5)
        followUpCounts: currentFollowUpCounts,
        answeredTopics: currentAnsweredTopics,
        consecutiveErrors: currentConsecutiveErrors,
        // Termination tracking fields (Requirements: 1.4, 4.1, 4.2)
        aiMessageCount: currentAiMessageCount + 1,
        hasOfferedConclusion,
        terminationReason,
        updatedAt: new Date(),
      };

      // Auto-populate session name from chief complaint if not already set
      // Requirements: 1.3, 2.1, 2.2, 2.3
      if (!session.name && updatedMedicalData.chiefComplaint) {
        // Truncate to 255 characters if necessary
        const autoName = updatedMedicalData.chiefComplaint.substring(0, 255);
        sessionUpdateData.name = autoName;
      }

      // If intake is ready, update status and generate clinical handover
      if (isReady && session.status !== 'ready') {
        sessionUpdateData.status = 'ready';
        sessionUpdateData.completedAt = new Date();

        // Generate clinical handover if not already present
        if (!updatedMedicalData.clinicalHandover) {
          const clinicalHandover = await generateClinicalHandover(updatedMedicalData);
          sessionUpdateData.clinicalHandover = clinicalHandover;
          updatedMedicalData.clinicalHandover = clinicalHandover;
        } else {
          sessionUpdateData.clinicalHandover = updatedMedicalData.clinicalHandover;
        }

        // Notify the connected doctor of completed intake (Requirement 12.3)
        const connDoctor = await ctx.db.query.doctors.findFirst({
          where: eq(doctors.id, connection.doctorId),
        });

        if (connDoctor) {
          const patientName = notificationService.getUserDisplayName(ctx.user);

          await notificationService.createIntakeCompleteNotification(
            connDoctor.userId,
            input.sessionId,
            connection.id,
            patientName,
            updatedMedicalData.chiefComplaint ?? undefined
          );
        }
      }

      await ctx.db
        .update(intakeSessions)
        .set(sessionUpdateData)
        .where(eq(intakeSessions.id, input.sessionId));

      const responseMedicalData = mode === 'patient'
        ? { ...updatedMedicalData, clinicalHandover: null, ucgRecommendations: null }
        : updatedMedicalData;

      const result = {
        userMessage: {
          id: userMessageId,
          role: messageRole,
          text: input.content,
          images: input.images,
          timestamp: new Date(),
        },
        aiMessage: aiMessage
          ? {
              id: aiMessage.id,
              role: 'model' as const,
              text: finalReply,
              timestamp: aiMessage.createdAt,
              activeAgent: aiResponse.activeAgent ?? currentAgent,
              groundingMetadata,
            }
          : null,
        thought: aiResponse.thought,
        updatedMedicalData: responseMedicalData,
        completeness,
        isReady,
      };
      
      // Log request completion with duration and success status (Requirement 3.2)
      const duration = Date.now() - startTime;
      console.log('[intake.sendMessage] Request completed successfully', {
        timestamp: new Date().toISOString(),
        sessionId: input.sessionId,
        userId: ctx.user.id,
        duration,
        success: true,
        completeness,
        isReady,
        usedFallback,
      });
      
      return result;
      } catch (error) {
        // Calculate duration for error logging (Requirement 3.3)
        const duration = Date.now() - startTime;
        
        // Log errors with full context (Requirement 3.3)
        console.error('[intake.sendMessage] Request failed', {
          timestamp: new Date().toISOString(),
          sessionId: input.sessionId,
          userId: ctx.user.id,
          duration,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          errorCode: error instanceof TRPCError ? error.code : 'UNKNOWN',
          stack: error instanceof Error ? error.stack : undefined,
        });
        
        // Re-throw TRPCErrors as-is
        if (error instanceof TRPCError) {
          throw error;
        }
        // Wrap other errors
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'An unexpected error occurred',
          cause: error,
        });
      }
    }),

  /**
   * Store file metadata for uploaded intake images.
   * Requirements: 11.2, 11.6, 11.8
   */
  storeFileMetadata: patientProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        files: z.array(
          z.object({
            url: z.string().url(),
            fileName: z.string(),
            fileType: z.string(),
            fileSize: z.number(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.patient) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Patient profile not found.',
        });
      }

      // Verify the session exists and belongs to this patient
      const session = await ctx.db.query.intakeSessions.findFirst({
        where: eq(intakeSessions.id, input.sessionId),
      });

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Intake session not found.',
        });
      }

      // Verify the connection belongs to this patient
      const connection = await ctx.db.query.connections.findFirst({
        where: and(
          eq(connections.id, session.connectionId),
          eq(connections.patientId, ctx.patient.id)
        ),
      });

      if (!connection) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You are not authorized to upload files to this session.',
        });
      }

      // Store file metadata in database with thumbnail generation for images
      const storedFiles = await Promise.all(
        input.files.map(async (file) => {
          // Generate thumbnail URL for image files (Requirement 11.8)
          let thumbnailUrl: string | null = null;
          if (file.fileType.startsWith('image/')) {
            // For UploadThing URLs, we can use image transformation parameters
            if (file.url.includes('uploadthing') || file.url.includes('utfs.io')) {
              const separator = file.url.includes('?') ? '&' : '?';
              thumbnailUrl = `${file.url}${separator}w=200&h=200&fit=cover`;
            } else {
              // For other URLs, use the original as thumbnail
              thumbnailUrl = file.url;
            }
          }

          const result = await ctx.db
            .insert(files)
            .values({
              uploaderId: ctx.user.id,
              sessionId: input.sessionId,
              fileName: file.fileName,
              fileType: file.fileType,
              fileSize: file.fileSize,
              url: file.url,
              thumbnailUrl,
            })
            .returning();

          return result[0];
        })
      );

      return {
        files: storedFiles.filter((f): f is NonNullable<typeof f> => f !== null),
      };
    }),

  /**
   * Get files associated with an intake session.
   * Requirements: 11.7, 11.8
   */
  getSessionFiles: protectedProcedure
    .input(getSessionSchema)
    .query(async ({ ctx, input }) => {
      // Get the session
      const session = await ctx.db.query.intakeSessions.findFirst({
        where: eq(intakeSessions.id, input.sessionId),
      });

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Intake session not found.',
        });
      }

      // Get the connection to verify access
      const connection = await ctx.db.query.connections.findFirst({
        where: eq(connections.id, session.connectionId),
      });

      if (!connection) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Connection not found.',
        });
      }

      // Verify user has access (patient or doctor in the connection)
      const patient = await ctx.db.query.patients.findFirst({
        where: eq(patients.userId, ctx.user.id),
      });

      const doctor = await ctx.db.query.doctors.findFirst({
        where: eq(doctors.userId, ctx.user.id),
      });

      const isPatientInConnection = patient && connection.patientId === patient.id;
      const isDoctorInConnection = doctor && connection.doctorId === doctor.id;
      const isSuperAdmin = ctx.user.primaryRole === 'super_admin';

      if (!isPatientInConnection && !isDoctorInConnection && !isSuperAdmin) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You are not authorized to view files for this session.',
        });
      }

      // Get all files for this session
      const sessionFiles = await ctx.db.query.files.findMany({
        where: eq(files.sessionId, input.sessionId),
        orderBy: [files.createdAt],
      });

      // Generate thumbnail URLs for files that don't have them (Requirement 11.8)
      const filesWithThumbnails = sessionFiles.map((file) => {
        if (file.thumbnailUrl) {
          return file;
        }
        
        // Generate thumbnail URL for image files
        let thumbnailUrl: string | null = null;
        if (file.fileType.startsWith('image/')) {
          if (file.url.includes('uploadthing') || file.url.includes('utfs.io')) {
            const separator = file.url.includes('?') ? '&' : '?';
            thumbnailUrl = `${file.url}${separator}w=200&h=200&fit=cover`;
          } else {
            thumbnailUrl = file.url;
          }
        }
        
        return { ...file, thumbnailUrl };
      });

      return {
        files: filesWithThumbnails,
      };
    }),

  /**
   * Reset an intake session by creating a new one.
   * Regenerate the last AI response when it was empty or failed.
   * This deletes the empty AI message and requests a new response.
   * Requirements: 7.3, 7.4
   */
  regenerateResponse: protectedProcedure
    .input(z.object({
      sessionId: z.string().uuid(),
      messageId: z.string().uuid().optional(), // Optional: specific message to regenerate from
    }))
    .mutation(async ({ ctx, input }) => {
      // Get the session
      const session = await ctx.db.query.intakeSessions.findFirst({
        where: eq(intakeSessions.id, input.sessionId),
      });

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Intake session not found.',
        });
      }

      // Get the connection to verify access
      const connection = await ctx.db.query.connections.findFirst({
        where: eq(connections.id, session.connectionId),
      });

      if (!connection) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Connection not found.',
        });
      }

      // Verify user has access
      const patient = await ctx.db.query.patients.findFirst({
        where: eq(patients.userId, ctx.user.id),
      });

      const doctor = await ctx.db.query.doctors.findFirst({
        where: eq(doctors.userId, ctx.user.id),
      });

      const isPatientInConnection = patient && connection.patientId === patient.id;
      const isDoctorInConnection = doctor && connection.doctorId === doctor.id;

      if (!isPatientInConnection && !isDoctorInConnection) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You are not authorized to regenerate responses in this intake session.',
        });
      }

      const mode = isDoctorInConnection ? 'doctor' : 'patient';

      // Get all messages for this session
      const existingMessages = await ctx.db.query.chatMessages.findMany({
        where: eq(chatMessages.sessionId, input.sessionId),
        orderBy: [chatMessages.createdAt],
      });

      if (existingMessages.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No messages to regenerate from.',
        });
      }

      // Find the last AI message (model role)
      const lastAiMessageIndex = existingMessages.findLastIndex(m => m.role === 'model');
      
      // If there's a last AI message that's empty, delete it
      if (lastAiMessageIndex !== -1) {
        const lastAiMessage = existingMessages[lastAiMessageIndex];
        if (lastAiMessage && (!lastAiMessage.content || lastAiMessage.content.trim() === '')) {
          await ctx.db.delete(chatMessages).where(eq(chatMessages.id, lastAiMessage.id));
          existingMessages.splice(lastAiMessageIndex, 1);
        }
      }

      // Build message history (excluding the deleted empty message)
      const messageHistory: Message[] = existingMessages.map((msg) => ({
        id: msg.id,
        role: msg.role as 'user' | 'model' | 'doctor',
        text: msg.content,
        images: msg.images ?? undefined,
        timestamp: msg.createdAt,
        groundingMetadata: msg.groundingMetadata,
        activeAgent: msg.activeAgent as AgentRole | undefined,
      }));

      // Get current medical data
      const currentMedicalData = (session.medicalData as MedicalData) ?? INITIAL_MEDICAL_DATA;

      console.log('[intake.regenerateResponse] Calling AI service...');

      // --- BUILD TRACKING STATE FOR AI SERVICE (Requirements: 6.1, 6.2, 6.3, 6.4, 6.5) ---
      const currentFollowUpCounts = (session.followUpCounts as FollowUpCounts) ?? {};
      const currentAnsweredTopics = (session.answeredTopics as string[]) ?? [];
      const currentAiMessageCount = session.aiMessageCount ?? 0;
      const currentAgent = (session.currentAgent as AgentRole) ?? 'Triage';
      const currentCompleteness = calculateIntakeCompleteness(currentMedicalData);
      
      const trackingState: TrackingState = {
        followUpCounts: currentFollowUpCounts,
        answeredTopics: currentAnsweredTopics,
        aiMessageCount: currentAiMessageCount,
        completeness: currentCompleteness,
        currentAgent: currentAgent,
      };
      // --- END BUILD TRACKING STATE ---

      // Send to AI and get new response
      const { response: aiResponse, groundingMetadata } = await sendAIMessage(
        messageHistory,
        currentMedicalData,
        mode,
        trackingState
      );

      console.log('[intake.regenerateResponse] AI response received:', {
        hasReply: !!aiResponse.reply,
        replyLength: aiResponse.reply?.length,
        activeAgent: aiResponse.activeAgent,
      });

      // Merge updated medical data
      const updatedMedicalData = mergeMedicalData(currentMedicalData, aiResponse.updatedData);

      const responseMedicalData = mode === 'patient'
        ? { ...updatedMedicalData, clinicalHandover: null, ucgRecommendations: null }
        : updatedMedicalData;

      const meetsReadyCriteria =
        determineAgent(updatedMedicalData) === 'HandoverSpecialist' &&
        !!updatedMedicalData.chiefComplaint &&
        (updatedMedicalData.hpi?.trim().length ?? 0) >= 50 &&
        updatedMedicalData.recordsCheckCompleted;

      if (updatedMedicalData.bookingStatus !== 'booked' && meetsReadyCriteria) {
        updatedMedicalData.bookingStatus = 'ready';
      }

      // Calculate completeness percentage
      const completeness = calculateIntakeCompleteness(updatedMedicalData);

      // Determine if intake is ready
      const isReady = updatedMedicalData.bookingStatus === 'ready';

      // Save new AI response to database
      const aiMessageResult = await ctx.db
        .insert(chatMessages)
        .values({
          sessionId: input.sessionId,
          role: 'model',
          content: aiResponse.reply,
          activeAgent: aiResponse.activeAgent,
          groundingMetadata: groundingMetadata ?? null,
        })
        .returning();

      const aiMessage = aiMessageResult[0];

      // Update session with new medical data and completeness
      const sessionUpdateData: Record<string, unknown> = {
        medicalData: updatedMedicalData,
        doctorThought: aiResponse.thought,
        completeness,
        currentAgent: aiResponse.activeAgent,
        updatedAt: new Date(),
      };

      if (isReady && session.status !== 'ready') {
        sessionUpdateData.status = 'ready';
        sessionUpdateData.completedAt = new Date();

        if (!updatedMedicalData.clinicalHandover) {
          const clinicalHandover = await generateClinicalHandover(updatedMedicalData);
          sessionUpdateData.clinicalHandover = clinicalHandover;
          updatedMedicalData.clinicalHandover = clinicalHandover;
        } else {
          sessionUpdateData.clinicalHandover = updatedMedicalData.clinicalHandover;
        }
      }

      await ctx.db
        .update(intakeSessions)
        .set(sessionUpdateData)
        .where(eq(intakeSessions.id, input.sessionId));

      // Log the regeneration
      await auditService.log({
        userId: ctx.user.id,
        action: 'intake_response_regenerated',
        resourceType: 'intake_session',
        resourceId: input.sessionId,
        metadata: {
          connectionId: session.connectionId,
        },
      });

      return {
        aiMessage: aiMessage
          ? {
              id: aiMessage.id,
              role: 'model' as const,
              text: aiResponse.reply,
              timestamp: aiMessage.createdAt,
              activeAgent: aiResponse.activeAgent,
              groundingMetadata,
            }
          : null,
        thought: aiResponse.thought,
        updatedMedicalData: responseMedicalData,
        completeness,
        isReady,
      };
    }),

  /**
   * Reset an intake session by creating a new one.
   * The old session is preserved for audit purposes.
   * Requirements: 4.3, 4.6
   */
  resetSession: patientProcedure
    .input(z.object({
      connectionId: z.string().uuid(),
      currentSessionId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.patient) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Patient profile not found.',
        });
      }

      // Verify the connection exists and belongs to this patient
      const connection = await ctx.db.query.connections.findFirst({
        where: and(
          eq(connections.id, input.connectionId),
          eq(connections.patientId, ctx.patient.id),
          eq(connections.status, 'active')
        ),
      });

      if (!connection) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Connection not found or not active.',
        });
      }

      // If there's a current session, mark it as abandoned (don't delete - preserve for audit)
      if (input.currentSessionId) {
        const existingSession = await ctx.db.query.intakeSessions.findFirst({
          where: and(
            eq(intakeSessions.id, input.currentSessionId),
            eq(intakeSessions.connectionId, input.connectionId)
          ),
        });

        if (existingSession && existingSession.status !== 'reviewed') {
          await ctx.db
            .update(intakeSessions)
            .set({
              status: 'reviewed', // Mark as reviewed/closed
              updatedAt: new Date(),
            })
            .where(eq(intakeSessions.id, input.currentSessionId));

          // Log the reset action
          await auditService.log({
            userId: ctx.user.id,
            action: 'intake_reset',
            resourceType: 'intake_session',
            resourceId: input.currentSessionId,
            metadata: {
              connectionId: input.connectionId,
              reason: 'user_reset',
            },
          });
        }
      }

      // Create new intake session
      // INITIAL_MEDICAL_DATA already has currentAgent: 'VitalsTriageAgent' and vitalsStageCompleted: false
      const result = await ctx.db
        .insert(intakeSessions)
        .values({
          connectionId: input.connectionId,
          status: 'not_started',
          medicalData: INITIAL_MEDICAL_DATA,
          doctorThought: INITIAL_THOUGHT,
          completeness: 0,
          currentAgent: INITIAL_MEDICAL_DATA.currentAgent, // Use currentAgent from INITIAL_MEDICAL_DATA
        })
        .returning();

      const newSession = result[0];
      if (!newSession) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create new intake session.',
        });
      }

      // Log the new session creation
      await auditService.log({
        userId: ctx.user.id,
        action: 'intake_started',
        resourceType: 'intake_session',
        resourceId: newSession.id,
        metadata: {
          connectionId: input.connectionId,
          isReset: true,
          previousSessionId: input.currentSessionId,
        },
      });

      return redactSessionForPatient(newSession);
    }),

  /**
   * Update the name of an intake session.
   * Requirements: 3.2, 3.3 - Manual session name editing
   */
  updateSessionName: patientProcedure
    .input(z.object({
      sessionId: z.string().uuid(),
      name: z.string().max(255).nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.patient) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Patient profile not found.',
        });
      }

      // Get the session
      const session = await ctx.db.query.intakeSessions.findFirst({
        where: eq(intakeSessions.id, input.sessionId),
      });

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Session not found.',
        });
      }

      // Verify the session belongs to this patient via connection
      const connection = await ctx.db.query.connections.findFirst({
        where: and(
          eq(connections.id, session.connectionId),
          eq(connections.patientId, ctx.patient.id)
        ),
      });

      if (!connection) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: "You don't have access to this session.",
        });
      }

      // Validate name is not empty string (null is allowed for clearing)
      if (input.name !== null && input.name.trim() === '') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Session name cannot be empty. Use null to clear the name.',
        });
      }

      // Update the session name
      const result = await ctx.db
        .update(intakeSessions)
        .set({
          name: input.name,
          updatedAt: new Date(),
        })
        .where(eq(intakeSessions.id, input.sessionId))
        .returning();

      const updatedSession = result[0];
      if (!updatedSession) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update session name.',
        });
      }

      // Log the name update
      await auditService.log({
        userId: ctx.user.id,
        action: 'intake_session_name_updated',
        resourceType: 'intake_session',
        resourceId: input.sessionId,
        metadata: {
          connectionId: session.connectionId,
          newName: input.name,
        },
      });

      return redactSessionForPatient(updatedSession);
    }),

  /**
   * Add a doctor message to an intake session.
   * Messages are stored with contextLayer: 'doctor-enhancement' to separate from patient intake.
   * Triggers SBAR regeneration using both patient-intake and doctor-enhancement messages.
   * Requirements: 2.3, 2.6, 5.5, 5.6
   */
  addMessage: doctorProcedure
    .input(z.object({
      connectionId: z.string().uuid(),
      content: z.string().min(1),
      messageType: z.enum(['text', 'test-result', 'exam-finding']).default('text'),
      metadata: z.record(z.any()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.doctor) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Only doctors can add enhancement messages.',
        });
      }

      // Verify the connection exists and belongs to this doctor
      const connection = await ctx.db.query.connections.findFirst({
        where: and(
          eq(connections.id, input.connectionId),
          eq(connections.doctorId, ctx.doctor.id)
        ),
      });

      if (!connection) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Connection not found or you do not have access.',
        });
      }

      // Get the most recent intake session for this connection
      const session = await ctx.db.query.intakeSessions.findFirst({
        where: eq(intakeSessions.connectionId, input.connectionId),
        orderBy: [desc(intakeSessions.updatedAt)],
      });

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No intake session found for this connection.',
        });
      }

      // Create the doctor message with contextLayer: 'doctor-enhancement'
      const messageResult = await ctx.db
        .insert(chatMessages)
        .values({
          sessionId: session.id,
          role: 'doctor',
          content: input.content,
          images: null,
          activeAgent: null,
          groundingMetadata: input.metadata ?? null,
          contextLayer: 'doctor-enhancement', // Critical: marks as doctor enhancement
        })
        .returning();

      const newMessage = messageResult[0];
      if (!newMessage) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create message.',
        });
      }

      // Get all messages for SBAR regeneration (both patient-intake and doctor-enhancement)
      const allMessages = await ctx.db.query.chatMessages.findMany({
        where: eq(chatMessages.sessionId, session.id),
        orderBy: [chatMessages.createdAt],
      });

      // Get current medical data
      let currentMedicalData = (session.medicalData as MedicalData) ?? INITIAL_MEDICAL_DATA;

      // Merge doctor enhancements into medical data context
      // Doctor messages with test results or exam findings should be included in the context
      const doctorEnhancements = allMessages
        .filter(msg => msg.contextLayer === 'doctor-enhancement')
        .map(msg => msg.content)
        .join('\n\n');

      if (doctorEnhancements) {
        // Add doctor enhancements to a special field in medical data for SBAR generation
        currentMedicalData = {
          ...currentMedicalData,
          doctorNotes: doctorEnhancements,
        };
      }

      // Regenerate SBAR using both context layers
      const clinicalHandover = await generateClinicalHandover(currentMedicalData);

      // Update session with new SBAR
      await ctx.db
        .update(intakeSessions)
        .set({
          clinicalHandover,
          updatedAt: new Date(),
        })
        .where(eq(intakeSessions.id, session.id));

      // Log the message addition
      await auditService.log({
        userId: ctx.user.id,
        action: 'message_sent',
        resourceType: 'message',
        resourceId: newMessage.id,
        metadata: {
          connectionId: input.connectionId,
          sessionId: session.id,
          messageType: input.messageType,
          contextLayer: 'doctor-enhancement',
        },
      });

      // Transform message to expected format
      const formattedMessage: Message = {
        id: newMessage.id,
        role: 'doctor',
        text: newMessage.content,
        images: undefined,
        timestamp: newMessage.createdAt,
        groundingMetadata: newMessage.groundingMetadata,
        activeAgent: undefined,
        contextLayer: 'doctor-enhancement',
      };

      return { 
        message: formattedMessage,
        sbar: clinicalHandover,
      };
    }),

  /**
   * Add a doctor image message (test result, scan, etc.) to an intake session.
   * Images are stored with contextLayer: 'doctor-enhancement' to separate from patient intake.
   * Triggers SBAR regeneration using both patient-intake and doctor-enhancement messages.
   * Requirements: 2.3, 2.4, 5.5, 5.6
   */
  addImageMessage: doctorProcedure
    .input(z.object({
      connectionId: z.string().uuid(),
      imageUrl: z.string().url(),
      messageType: z.enum(['image', 'test-result']).default('image'),
      caption: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.doctor) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Only doctors can add enhancement messages.',
        });
      }

      // Verify the connection exists and belongs to this doctor
      const connection = await ctx.db.query.connections.findFirst({
        where: and(
          eq(connections.id, input.connectionId),
          eq(connections.doctorId, ctx.doctor.id)
        ),
      });

      if (!connection) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Connection not found or you do not have access.',
        });
      }

      // Get the most recent intake session for this connection
      const session = await ctx.db.query.intakeSessions.findFirst({
        where: eq(intakeSessions.connectionId, input.connectionId),
        orderBy: [desc(intakeSessions.updatedAt)],
      });

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No intake session found for this connection.',
        });
      }

      // Create the doctor image message with contextLayer: 'doctor-enhancement'
      const messageResult = await ctx.db
        .insert(chatMessages)
        .values({
          sessionId: session.id,
          role: 'doctor',
          content: input.caption ?? `[${input.messageType}]`,
          images: [input.imageUrl],
          activeAgent: null,
          groundingMetadata: { messageType: input.messageType },
          contextLayer: 'doctor-enhancement', // Critical: marks as doctor enhancement
        })
        .returning();

      const newMessage = messageResult[0];
      if (!newMessage) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create image message.',
        });
      }

      // Get all messages for SBAR regeneration (both patient-intake and doctor-enhancement)
      const allMessages = await ctx.db.query.chatMessages.findMany({
        where: eq(chatMessages.sessionId, session.id),
        orderBy: [chatMessages.createdAt],
      });

      // Get current medical data
      let currentMedicalData = (session.medicalData as MedicalData) ?? INITIAL_MEDICAL_DATA;

      // Merge doctor enhancements into medical data context
      const doctorEnhancements = allMessages
        .filter(msg => msg.contextLayer === 'doctor-enhancement')
        .map(msg => {
          if (msg.images && msg.images.length > 0) {
            return `${msg.content} [Image: ${msg.images.join(', ')}]`;
          }
          return msg.content;
        })
        .join('\n\n');

      if (doctorEnhancements) {
        // Add doctor enhancements to medical data for SBAR generation
        currentMedicalData = {
          ...currentMedicalData,
          doctorNotes: doctorEnhancements,
        };
      }

      // Regenerate SBAR using both context layers
      const clinicalHandover = await generateClinicalHandover(currentMedicalData);

      // Update session with new SBAR
      await ctx.db
        .update(intakeSessions)
        .set({
          clinicalHandover,
          updatedAt: new Date(),
        })
        .where(eq(intakeSessions.id, session.id));

      // Log the image message addition
      await auditService.log({
        userId: ctx.user.id,
        action: 'message_sent',
        resourceType: 'message',
        resourceId: newMessage.id,
        metadata: {
          connectionId: input.connectionId,
          sessionId: session.id,
          messageType: input.messageType,
          contextLayer: 'doctor-enhancement',
          imageUrl: input.imageUrl,
        },
      });

      // Transform message to expected format
      const formattedMessage: Message = {
        id: newMessage.id,
        role: 'doctor',
        text: newMessage.content,
        images: [input.imageUrl],
        timestamp: newMessage.createdAt,
        groundingMetadata: newMessage.groundingMetadata,
        activeAgent: undefined,
        contextLayer: 'doctor-enhancement',
      };

      return { 
        message: formattedMessage,
        sbar: clinicalHandover,
      };
    }),

  /**
   * Mark an intake session as reviewed by the doctor.
   * Simplified version that takes connectionId instead of sessionId.
   * Requirements: 9.2, 9.3
   */
  markReviewed: doctorProcedure
    .input(z.object({ connectionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.doctor) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Doctor profile not found.',
        });
      }

      // Verify the doctor has access to this connection
      const connection = await ctx.db.query.connections.findFirst({
        where: and(
          eq(connections.id, input.connectionId),
          eq(connections.doctorId, ctx.doctor.id)
        ),
      });

      if (!connection) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You are not authorized to access this connection.',
        });
      }

      // Get the most recent intake session for this connection
      const session = await ctx.db.query.intakeSessions.findFirst({
        where: eq(intakeSessions.connectionId, input.connectionId),
        orderBy: [desc(intakeSessions.updatedAt)],
      });

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No intake session found for this connection.',
        });
      }

      // Update the session status to reviewed
      const result = await ctx.db
        .update(intakeSessions)
        .set({
          status: 'reviewed',
          reviewedAt: new Date(),
          reviewedBy: ctx.user.id,
          updatedAt: new Date(),
        })
        .where(eq(intakeSessions.id, session.id))
        .returning();

      const updatedSession = result[0];
      if (!updatedSession) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update intake session.',
        });
      }

      // Log the intake review
      await auditService.log({
        userId: ctx.user.id,
        action: 'intake_reviewed',
        resourceType: 'intake_session',
        resourceId: session.id,
        metadata: {
          connectionId: input.connectionId,
          reviewedBy: ctx.user.id,
        },
      });

      return {
        success: true,
        session: updatedSession,
      };
    }),

  /**
   * Get Uganda Clinical Guidelines (UCG) recommendations for a connection.
   * Returns recommendations from the most recent intake session's medical data.
   * Requirements: 3.8
   */
  getUCGRecommendations: doctorProcedure
    .input(z.object({ connectionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.doctor) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Doctor profile not found.',
        });
      }

      // Verify the doctor has access to this connection
      const connection = await ctx.db.query.connections.findFirst({
        where: and(
          eq(connections.id, input.connectionId),
          eq(connections.doctorId, ctx.doctor.id)
        ),
      });

      if (!connection) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You are not authorized to access this connection.',
        });
      }

      // Get the most recent intake session with UCG recommendations
      const session = await ctx.db.query.intakeSessions.findFirst({
        where: eq(intakeSessions.connectionId, input.connectionId),
        orderBy: [desc(intakeSessions.updatedAt)],
      });

      if (!session || !session.medicalData) {
        return { recommendations: null };
      }

      const medicalData = session.medicalData as MedicalData;
      const ucgRecommendations = medicalData.ucgRecommendations ?? null;

      return { 
        recommendations: ucgRecommendations,
        sessionId: session.id,
        updatedAt: session.updatedAt,
      };
    }),
});
