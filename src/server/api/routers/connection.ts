import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure, patientProcedure } from '../trpc';
import { connections, doctors, patients, users } from '@/server/db/schema';
import { notificationService } from '@/server/services/notification';
import { auditService } from '@/server/services/audit';

// Input validation schemas
const createConnectionSchema = z.object({
  doctorId: z.string().uuid(),
  connectionSource: z.enum(['qr_scan', 'direct_url', 'referral']).optional(),
});

const disconnectSchema = z.object({
  connectionId: z.string().uuid(),
});

export const connectionRouter = createTRPCRouter({
  /**
   * Create a new patient-doctor connection.
   * Requirements: 4.1, 4.2, 4.3, 20.6, 3.8
   */
  create: patientProcedure
    .input(createConnectionSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.patient) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Patient profile not found. Please create a profile first.',
        });
      }

      // Check if user has a doctor profile (additional safety check - Requirements 4.1, 4.3)
      const doctorProfile = await ctx.db.query.doctors.findFirst({
        where: eq(doctors.userId, ctx.user.id),
      });

      if (doctorProfile) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Doctors cannot create patient connections. Please use professional networking features.',
        });
      }

      // Verify the doctor exists
      const doctor = await ctx.db.query.doctors.findFirst({
        where: eq(doctors.id, input.doctorId),
      });

      if (!doctor) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Doctor not found.',
        });
      }

      // Verify doctor is verified before allowing connection (Requirement 20.6)
      if (doctor.verificationStatus !== 'verified') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Cannot connect to an unverified doctor. Please wait for the doctor to be verified.',
        });
      }

      // Check for existing connection (prevent duplicates - Requirement 4.3)
      const existingConnection = await ctx.db.query.connections.findFirst({
        where: and(
          eq(connections.patientId, ctx.patient.id),
          eq(connections.doctorId, input.doctorId)
        ),
      });

      if (existingConnection) {
        // If connection exists but is disconnected, reactivate it
        if (existingConnection.status === 'disconnected') {
          const result = await ctx.db
            .update(connections)
            .set({
              status: 'active',
              connectedAt: new Date(),
              disconnectedAt: null,
              connectionSource: input.connectionSource ?? existingConnection.connectionSource,
            })
            .where(eq(connections.id, existingConnection.id))
            .returning();

          const reactivatedConnection = result[0];
          if (!reactivatedConnection) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to reactivate connection',
            });
          }

          // Notify doctor of reconnection
          await notificationService.createConnectionNotification(
            doctor.userId,
            ctx.user,
            'reconnected',
            reactivatedConnection.id
          );

          // Log the reconnection
          await auditService.log({
            userId: ctx.user.id,
            action: 'connection_created',
            resourceType: 'connection',
            resourceId: reactivatedConnection.id,
            metadata: {
              doctorId: input.doctorId,
              connectionSource: input.connectionSource,
              isReconnection: true,
            },
          });

          return reactivatedConnection;
        }

        // Connection already exists and is active
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'You are already connected to this doctor.',
        });
      }

      // Create new connection (Requirements 4.1, 4.2)
      const result = await ctx.db
        .insert(connections)
        .values({
          patientId: ctx.patient.id,
          doctorId: input.doctorId,
          status: 'active',
          connectionSource: input.connectionSource ?? 'direct_url',
          connectedAt: new Date(),
        })
        .returning();

      const newConnection = result[0];
      if (!newConnection) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create connection',
        });
      }

      // Notify doctor of new connection (Requirement 4.4)
      await notificationService.createConnectionNotification(
        doctor.userId,
        ctx.user,
        'new',
        newConnection.id
      );

      // Log the new connection
      await auditService.log({
        userId: ctx.user.id,
        action: 'connection_created',
        resourceType: 'connection',
        resourceId: newConnection.id,
        metadata: {
          doctorId: input.doctorId,
          connectionSource: input.connectionSource ?? 'direct_url',
          isReconnection: false,
        },
      });

      return newConnection;
    }),

  /**
   * Get all connections for the current user.
   * Returns different data based on user role.
   * Requirements: 4.5, 4.6
   */
  getMyConnections: protectedProcedure
    .input(
      z.object({
        status: z.enum(['active', 'disconnected', 'blocked', 'all']).default('active'),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const statusFilter = input?.status ?? 'active';

      // Check if user is a patient
      const patient = await ctx.db.query.patients.findFirst({
        where: eq(patients.userId, ctx.user.id),
      });

      // Check if user is a doctor
      const doctor = await ctx.db.query.doctors.findFirst({
        where: eq(doctors.userId, ctx.user.id),
      });

      if (!patient && !doctor) {
        return { connections: [], role: null };
      }

      // Build the where clause based on role and status
      let whereClause;
      if (patient) {
        whereClause = statusFilter === 'all'
          ? eq(connections.patientId, patient.id)
          : and(
              eq(connections.patientId, patient.id),
              eq(connections.status, statusFilter as 'active' | 'disconnected' | 'blocked')
            );
      } else if (doctor) {
        whereClause = statusFilter === 'all'
          ? eq(connections.doctorId, doctor.id)
          : and(
              eq(connections.doctorId, doctor.id),
              eq(connections.status, statusFilter as 'active' | 'disconnected' | 'blocked')
            );
      }

      const userConnections = await ctx.db.query.connections.findMany({
        where: whereClause,
        orderBy: (connections, { desc }) => [desc(connections.connectedAt)],
      });

      // Enrich connections with related data
      const enrichedConnections = await Promise.all(
        userConnections.map(async (conn) => {
          if (patient) {
            // Patient view: include doctor info
            const connDoctor = await ctx.db.query.doctors.findFirst({
              where: eq(doctors.id, conn.doctorId),
            });
            const doctorUser = connDoctor
              ? await ctx.db.query.users.findFirst({
                  where: eq(users.id, connDoctor.userId),
                })
              : null;

            return {
              ...conn,
              doctor: connDoctor
                ? {
                    id: connDoctor.id,
                    slug: connDoctor.slug,
                    specialty: connDoctor.specialty,
                    clinicName: connDoctor.clinicName,
                    verificationStatus: connDoctor.verificationStatus,
                    user: doctorUser
                      ? {
                          firstName: doctorUser.firstName,
                          lastName: doctorUser.lastName,
                          imageUrl: doctorUser.imageUrl,
                        }
                      : null,
                  }
                : null,
            };
          } else {
            // Doctor view: include patient info
            const connPatient = await ctx.db.query.patients.findFirst({
              where: eq(patients.id, conn.patientId),
            });
            const patientUser = connPatient
              ? await ctx.db.query.users.findFirst({
                  where: eq(users.id, connPatient.userId),
                })
              : null;

            return {
              ...conn,
              patient: connPatient
                ? {
                    id: connPatient.id,
                    user: patientUser
                      ? {
                          firstName: patientUser.firstName,
                          lastName: patientUser.lastName,
                          imageUrl: patientUser.imageUrl,
                          email: patientUser.email,
                        }
                      : null,
                  }
                : null,
            };
          }
        })
      );

      return {
        connections: enrichedConnections,
        role: patient ? 'patient' : 'doctor',
      };
    }),

  /**
   * Disconnect from a doctor/patient.
   * Archives the connection instead of deleting it.
   * Requirements: 4.7, 4.8
   */
  disconnect: protectedProcedure
    .input(disconnectSchema)
    .mutation(async ({ ctx, input }) => {
      // Find the connection
      const connection = await ctx.db.query.connections.findFirst({
        where: eq(connections.id, input.connectionId),
      });

      if (!connection) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Connection not found.',
        });
      }

      // Verify the user is part of this connection
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
          message: 'You are not authorized to disconnect this connection.',
        });
      }

      // Archive the connection (soft delete - Requirement 4.8)
      const result = await ctx.db
        .update(connections)
        .set({
          status: 'disconnected',
          disconnectedAt: new Date(),
        })
        .where(eq(connections.id, input.connectionId))
        .returning();

      const disconnectedConnection = result[0];
      if (!disconnectedConnection) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to disconnect',
        });
      }

      // Log the disconnection
      await auditService.log({
        userId: ctx.user.id,
        action: 'connection_disconnected',
        resourceType: 'connection',
        resourceId: input.connectionId,
        metadata: {
          patientId: connection.patientId,
          doctorId: connection.doctorId,
          disconnectedBy: isPatientInConnection ? 'patient' : 'doctor',
        },
      });

      return disconnectedConnection;
    }),

  /**
   * Get a specific connection by ID.
   * Verifies the user is part of the connection.
   */
  getById: protectedProcedure
    .input(z.object({ connectionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const connection = await ctx.db.query.connections.findFirst({
        where: eq(connections.id, input.connectionId),
      });

      if (!connection) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Connection not found.',
        });
      }

      // Verify the user is part of this connection
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
          message: 'You are not authorized to view this connection.',
        });
      }

      // Get related data
      const connDoctor = await ctx.db.query.doctors.findFirst({
        where: eq(doctors.id, connection.doctorId),
      });
      const doctorUser = connDoctor
        ? await ctx.db.query.users.findFirst({
            where: eq(users.id, connDoctor.userId),
          })
        : null;

      const connPatient = await ctx.db.query.patients.findFirst({
        where: eq(patients.id, connection.patientId),
      });
      const patientUser = connPatient
        ? await ctx.db.query.users.findFirst({
            where: eq(users.id, connPatient.userId),
          })
        : null;

      return {
        ...connection,
        doctor: connDoctor
          ? {
              id: connDoctor.id,
              slug: connDoctor.slug,
              specialty: connDoctor.specialty,
              clinicName: connDoctor.clinicName,
              verificationStatus: connDoctor.verificationStatus,
              user: doctorUser
                ? {
                    firstName: doctorUser.firstName,
                    lastName: doctorUser.lastName,
                    imageUrl: doctorUser.imageUrl,
                  }
                : null,
            }
          : null,
        patient: connPatient
          ? {
              id: connPatient.id,
              user: patientUser
                ? {
                    firstName: patientUser.firstName,
                    lastName: patientUser.lastName,
                    imageUrl: patientUser.imageUrl,
                    email: patientUser.email,
                  }
                : null,
            }
          : null,
      };
    }),
});
