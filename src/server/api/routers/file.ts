import { z } from 'zod';
import { eq, and, inArray, desc } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure, doctorProcedure } from '../trpc';
import { 
  files, 
  connections, 
  patients, 
  doctors, 
  users,
  intakeSessions,
} from '@/server/db/schema';

/**
 * Generate a thumbnail URL for image files.
 * For UploadThing URLs, we can use image transformation parameters.
 * Requirements: 11.8
 */
function generateThumbnailUrl(originalUrl: string, fileType: string): string | null {
  // Only generate thumbnails for image files
  if (!fileType.startsWith('image/')) {
    return null;
  }

  // For UploadThing URLs, we can append size parameters
  // UploadThing supports image transformations via URL parameters
  if (originalUrl.includes('uploadthing') || originalUrl.includes('utfs.io')) {
    // Add thumbnail size parameter (200x200)
    const separator = originalUrl.includes('?') ? '&' : '?';
    return `${originalUrl}${separator}w=200&h=200&fit=cover`;
  }

  // For other URLs, return the original (no transformation available)
  return originalUrl;
}

export const fileRouter = createTRPCRouter({
  /**
   * Get all files uploaded by connected patients for a doctor.
   * Requirements: 11.7
   */
  getPatientFiles: doctorProcedure
    .input(
      z.object({
        patientId: z.string().uuid().optional(),
        connectionId: z.string().uuid().optional(),
        sessionId: z.string().uuid().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.doctor) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Doctor profile not found.',
        });
      }

      // Get all active connections for this doctor
      const doctorConnections = await ctx.db.query.connections.findMany({
        where: and(
          eq(connections.doctorId, ctx.doctor.id),
          eq(connections.status, 'active')
        ),
      });

      if (doctorConnections.length === 0) {
        return { files: [], total: 0 };
      }

      // Filter by specific connection if provided
      let targetConnections = doctorConnections;
      if (input?.connectionId) {
        const conn = doctorConnections.find(c => c.id === input.connectionId);
        if (!conn) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You do not have access to this connection.',
          });
        }
        targetConnections = [conn];
      }

      // Filter by specific patient if provided
      if (input?.patientId) {
        targetConnections = targetConnections.filter(c => c.patientId === input.patientId);
        if (targetConnections.length === 0) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You do not have access to this patient.',
          });
        }
      }

      const connectionIds = targetConnections.map(c => c.id);

      // Get intake sessions for these connections
      const sessions = await ctx.db.query.intakeSessions.findMany({
        where: inArray(intakeSessions.connectionId, connectionIds),
      });

      // Filter by specific session if provided
      let targetSessionIds = sessions.map(s => s.id);
      if (input?.sessionId) {
        const session = sessions.find(s => s.id === input.sessionId);
        if (!session) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You do not have access to this session.',
          });
        }
        targetSessionIds = [input.sessionId];
      }

      if (targetSessionIds.length === 0) {
        return { files: [], total: 0 };
      }

      // Get files for these sessions
      const patientFiles = await ctx.db.query.files.findMany({
        where: inArray(files.sessionId, targetSessionIds),
        orderBy: [desc(files.createdAt)],
        limit: input?.limit ?? 50,
        offset: input?.offset ?? 0,
      });

      // Enrich files with patient info and generate thumbnails
      const enrichedFiles = await Promise.all(
        patientFiles.map(async (file) => {
          // Find the session and connection for this file
          const session = sessions.find(s => s.id === file.sessionId);
          const connection = session 
            ? targetConnections.find(c => c.id === session.connectionId)
            : null;

          // Get patient info
          let patientInfo = null;
          if (connection) {
            const patient = await ctx.db.query.patients.findFirst({
              where: eq(patients.id, connection.patientId),
            });
            if (patient) {
              const patientUser = await ctx.db.query.users.findFirst({
                where: eq(users.id, patient.userId),
              });
              patientInfo = patientUser ? {
                id: patient.id,
                firstName: patientUser.firstName,
                lastName: patientUser.lastName,
                imageUrl: patientUser.imageUrl,
              } : null;
            }
          }

          // Generate thumbnail URL for images
          const thumbnailUrl = file.thumbnailUrl ?? generateThumbnailUrl(file.url, file.fileType);

          return {
            ...file,
            thumbnailUrl,
            patient: patientInfo,
            sessionId: file.sessionId,
            connectionId: connection?.id ?? null,
          };
        })
      );

      // Get total count for pagination
      const allFiles = await ctx.db.query.files.findMany({
        where: inArray(files.sessionId, targetSessionIds),
      });

      return {
        files: enrichedFiles,
        total: allFiles.length,
      };
    }),

  /**
   * Get a single file by ID with access control.
   * Requirements: 11.7
   */
  getFile: protectedProcedure
    .input(z.object({ fileId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const file = await ctx.db.query.files.findFirst({
        where: eq(files.id, input.fileId),
      });

      if (!file) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'File not found.',
        });
      }

      // Check access: file owner, connected doctor, or super admin
      const isOwner = file.uploaderId === ctx.user.id;
      const isSuperAdmin = ctx.user.primaryRole === 'super_admin';

      if (isOwner || isSuperAdmin) {
        const thumbnailUrl = file.thumbnailUrl ?? generateThumbnailUrl(file.url, file.fileType);
        return { ...file, thumbnailUrl };
      }

      // Check if user is a doctor connected to the patient who uploaded this file
      const doctor = await ctx.db.query.doctors.findFirst({
        where: eq(doctors.userId, ctx.user.id),
      });

      if (doctor && file.sessionId) {
        // Get the session to find the connection
        const session = await ctx.db.query.intakeSessions.findFirst({
          where: eq(intakeSessions.id, file.sessionId),
        });

        if (session) {
          // Check if doctor is connected to this patient
          const connection = await ctx.db.query.connections.findFirst({
            where: and(
              eq(connections.id, session.connectionId),
              eq(connections.doctorId, doctor.id),
              eq(connections.status, 'active')
            ),
          });

          if (connection) {
            const thumbnailUrl = file.thumbnailUrl ?? generateThumbnailUrl(file.url, file.fileType);
            return { ...file, thumbnailUrl };
          }
        }
      }

      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You are not authorized to view this file.',
      });
    }),

  /**
   * Update file thumbnail URL.
   * This can be called after generating a thumbnail externally.
   * Requirements: 11.8
   */
  updateThumbnail: protectedProcedure
    .input(z.object({
      fileId: z.string().uuid(),
      thumbnailUrl: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      const file = await ctx.db.query.files.findFirst({
        where: eq(files.id, input.fileId),
      });

      if (!file) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'File not found.',
        });
      }

      // Only file owner or super admin can update thumbnail
      const isOwner = file.uploaderId === ctx.user.id;
      const isSuperAdmin = ctx.user.primaryRole === 'super_admin';

      if (!isOwner && !isSuperAdmin) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You are not authorized to update this file.',
        });
      }

      const result = await ctx.db
        .update(files)
        .set({ thumbnailUrl: input.thumbnailUrl })
        .where(eq(files.id, input.fileId))
        .returning();

      return result[0];
    }),

  /**
   * Get files grouped by patient for a doctor's dashboard.
   * Requirements: 11.7
   */
  getFilesGroupedByPatient: doctorProcedure.query(async ({ ctx }) => {
    if (!ctx.doctor) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Doctor profile not found.',
      });
    }

    // Get all active connections for this doctor
    const doctorConnections = await ctx.db.query.connections.findMany({
      where: and(
        eq(connections.doctorId, ctx.doctor.id),
        eq(connections.status, 'active')
      ),
    });

    if (doctorConnections.length === 0) {
      return { patientFiles: [] };
    }

    const connectionIds = doctorConnections.map(c => c.id);

    // Get intake sessions for these connections
    const sessions = await ctx.db.query.intakeSessions.findMany({
      where: inArray(intakeSessions.connectionId, connectionIds),
    });

    const sessionIds = sessions.map(s => s.id);

    if (sessionIds.length === 0) {
      return { patientFiles: [] };
    }

    // Get all files for these sessions
    const allFiles = await ctx.db.query.files.findMany({
      where: inArray(files.sessionId, sessionIds),
      orderBy: [desc(files.createdAt)],
    });

    // Group files by patient
    const patientFilesMap = new Map<string, {
      patient: {
        id: string;
        firstName: string | null;
        lastName: string | null;
        imageUrl: string | null;
      };
      files: typeof allFiles;
      totalCount: number;
    }>();

    for (const file of allFiles) {
      const session = sessions.find(s => s.id === file.sessionId);
      if (!session) continue;

      const connection = doctorConnections.find(c => c.id === session.connectionId);
      if (!connection) continue;

      const patientId = connection.patientId;

      if (!patientFilesMap.has(patientId)) {
        // Get patient info
        const patient = await ctx.db.query.patients.findFirst({
          where: eq(patients.id, patientId),
        });
        const patientUser = patient
          ? await ctx.db.query.users.findFirst({
              where: eq(users.id, patient.userId),
            })
          : null;

        patientFilesMap.set(patientId, {
          patient: {
            id: patientId,
            firstName: patientUser?.firstName ?? null,
            lastName: patientUser?.lastName ?? null,
            imageUrl: patientUser?.imageUrl ?? null,
          },
          files: [],
          totalCount: 0,
        });
      }

      const patientData = patientFilesMap.get(patientId)!;
      
      // Add thumbnail URL
      const fileWithThumbnail = {
        ...file,
        thumbnailUrl: file.thumbnailUrl ?? generateThumbnailUrl(file.url, file.fileType),
      };
      
      patientData.files.push(fileWithThumbnail);
      patientData.totalCount++;
    }

    return {
      patientFiles: Array.from(patientFilesMap.values()),
    };
  }),
});
