import { z } from 'zod';
import { eq, and, gte, lte, ne, inArray, sql, desc } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, publicProcedure, protectedProcedure, patientProcedure, doctorProcedure } from '../trpc';
import { 
  appointments, 
  connections, 
  doctors, 
  patients, 
  users,
  doctorAvailability,
  doctorBlockedDates,
  intakeSessions,
  directMessages,
} from '@/server/db/schema';
import { INITIAL_MEDICAL_DATA } from '@/types';
import type { MedicalData } from '@/types';
import { mergeMedicalData } from '@/server/services/intake-utils';
import { notificationService } from '@/server/services/notification';
import { auditService } from '@/server/services/audit';
import { streamService } from '@/server/services/stream';
import { checkQueryCount, checkResponseSize, enforcePaginationLimit } from '@/server/lib/query-optimizer';
import type { AppointmentSummary } from '@/types/api-responses';
import { MAX_PAGINATION_LIMIT } from '@/types/api-responses';
import { env } from '@/env';

/**
 * Parse time string (HH:MM) to minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours! * 60 + minutes!;
}

/**
 * Generate time slots for a given day based on doctor's availability
 */
function generateTimeSlots(
  startTime: string,
  endTime: string,
  duration: number,
  bufferTime: number
): { startTime: string; endTime: string }[] {
  const slots: { startTime: string; endTime: string }[] = [];
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  const slotLength = duration + bufferTime;

  let currentStart = startMinutes;
  while (currentStart + duration <= endMinutes) {
    const slotStart = `${Math.floor(currentStart / 60).toString().padStart(2, '0')}:${(currentStart % 60).toString().padStart(2, '0')}`;
    const slotEnd = `${Math.floor((currentStart + duration) / 60).toString().padStart(2, '0')}:${((currentStart + duration) % 60).toString().padStart(2, '0')}`;
    slots.push({ startTime: slotStart, endTime: slotEnd });
    currentStart += slotLength;
  }

  return slots;
}

export const appointmentRouter = createTRPCRouter({
  /**
   * Get available time slots for a specific doctor on a specific date.
   * Requirements: 9.2, 9.5, 10.6
   */
  getAvailableSlots: publicProcedure
    .input(z.object({
      doctorId: z.string().uuid(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD format
    }))
    .query(async ({ ctx, input }) => {
      // Get doctor profile
      const doctor = await ctx.db.query.doctors.findFirst({
        where: eq(doctors.id, input.doctorId),
      });

      if (!doctor) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Doctor not found',
        });
      }

      const requestedDate = new Date(input.date);
      const dayOfWeek = requestedDate.getDay(); // 0=Sunday, 6=Saturday

      // Check if date is in the past
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (requestedDate < today) {
        return { slots: [], message: 'Cannot view slots for past dates' };
      }

      // Check if date is blocked
      const startOfDay = new Date(input.date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(input.date);
      endOfDay.setHours(23, 59, 59, 999);

      const blockedDate = await ctx.db.query.doctorBlockedDates.findFirst({
        where: and(
          eq(doctorBlockedDates.doctorId, input.doctorId),
          gte(doctorBlockedDates.date, startOfDay),
          lte(doctorBlockedDates.date, endOfDay)
        ),
      });

      if (blockedDate) {
        return { 
          slots: [], 
          message: blockedDate.reason || 'Doctor is not available on this date',
          isBlocked: true,
        };
      }

      // Get doctor's availability for this day of week
      let availability: Array<{ startTime: string; endTime: string; location?: string | null }> = [];
      try {
        availability = await ctx.db.query.doctorAvailability.findMany({
          where: and(
            eq(doctorAvailability.doctorId, input.doctorId),
            eq(doctorAvailability.dayOfWeek, dayOfWeek),
            eq(doctorAvailability.isActive, true)
          ),
          orderBy: (table, { asc }) => [asc(table.startTime)],
        });
      } catch (err) {
        const e = err as { code?: string; message?: string };
        if (e?.code === '42P01' && (e.message ?? '').toLowerCase().includes('doctor_availability')) {
          return {
            slots: [],
            message: 'Doctor availability is not configured yet',
          };
        }
        if (e?.code === '42703' && (e.message ?? '').includes('location')) {
          availability = (await ctx.db.query.doctorAvailability.findMany({
            where: and(
              eq(doctorAvailability.doctorId, input.doctorId),
              eq(doctorAvailability.dayOfWeek, dayOfWeek),
              eq(doctorAvailability.isActive, true)
            ),
            orderBy: (table, { asc }) => [asc(table.startTime)],
            columns: {
              startTime: true,
              endTime: true,
            },
          })) as Array<{ startTime: string; endTime: string }>;
        } else {
          throw err;
        }
      }

      if (availability.length === 0) {
        return { 
          slots: [], 
          message: 'Doctor is not available on this day',
        };
      }

      // Generate all possible slots across all windows
      const allSlots = availability.flatMap((window) =>
        generateTimeSlots(
          window.startTime,
          window.endTime,
          doctor.appointmentDuration,
          doctor.bufferTime
        ).map((slot) => ({
          ...slot,
          location: window.location ?? null,
        }))
      );

      // Filter to only appointments for this doctor (via connection)
      const doctorConnectionIds = await ctx.db.query.connections.findMany({
        where: eq(connections.doctorId, input.doctorId),
        columns: { id: true },
      });
      const connectionIds = doctorConnectionIds.map(c => c.id);

      // Get existing appointments for this date (only for this doctor)
      const doctorAppointments = connectionIds.length === 0
        ? []
        : await ctx.db.query.appointments.findMany({
            where: and(
              inArray(appointments.connectionId, connectionIds),
              gte(appointments.scheduledAt, startOfDay),
              lte(appointments.scheduledAt, endOfDay),
              inArray(appointments.status, ['pending', 'confirmed'])
            ),
          });

      // Mark slots as available or not
      const isToday = requestedDate.toDateString() === new Date().toDateString();
      const currentTime = new Date();

      const slots = allSlots.map(slot => {
        // Create full datetime for this slot
        const slotDateTime = new Date(`${input.date}T${slot.startTime}:00`);
        
        // Check if slot is in the past (for today)
        if (isToday && slotDateTime <= currentTime) {
          return { ...slot, isAvailable: false, reason: 'Past time' };
        }

        // Check if slot conflicts with existing appointment
        const hasConflict = doctorAppointments.some(apt => {
          const aptTime = new Date(apt.scheduledAt);
          const aptHours = aptTime.getHours().toString().padStart(2, '0');
          const aptMinutes = aptTime.getMinutes().toString().padStart(2, '0');
          const aptTimeStr = `${aptHours}:${aptMinutes}`;
          return aptTimeStr === slot.startTime;
        });

        if (hasConflict) {
          return { ...slot, isAvailable: false, reason: 'Already booked' };
        }

        return { ...slot, isAvailable: true };
      });

      return { 
        slots,
        doctorName: doctor.clinicName || 'Doctor',
        appointmentDuration: doctor.appointmentDuration,
      };
    }),

  /**
   * Create a new appointment.
   * Requirements: 9.1, 9.4, 9.5, 9.7
   */
  create: patientProcedure
    .input(z.object({
      connectionId: z.string().uuid(),
      scheduledAt: z.string().datetime(), // ISO datetime string
      intakeSessionId: z.string().uuid().optional(),
      notes: z.string().max(1000).optional(),
      isOnline: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.patient) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Patient profile not found. Please complete onboarding.',
        });
      }

      // Verify connection exists and belongs to this patient
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
          message: 'Connection not found or not active',
        });
      }

      // Get doctor info
      const doctor = await ctx.db.query.doctors.findFirst({
        where: eq(doctors.id, connection.doctorId),
      });

      if (!doctor) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Doctor not found',
        });
      }

      // Verify doctor is verified
      if (doctor.verificationStatus !== 'verified') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Cannot book appointments with unverified doctors',
        });
      }

      const scheduledAt = new Date(input.scheduledAt);

      // Check if date is in the past
      if (scheduledAt <= new Date()) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot book appointments in the past',
        });
      }

      // Check if slot is available (no double booking)
      const slotStart = new Date(scheduledAt);
      const slotEnd = new Date(scheduledAt.getTime() + doctor.appointmentDuration * 60000);

      // Get all appointments for this doctor on this day
      const dayStart = new Date(scheduledAt);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(scheduledAt);
      dayEnd.setHours(23, 59, 59, 999);

      const doctorConnections = await ctx.db.query.connections.findMany({
        where: eq(connections.doctorId, doctor.id),
        columns: { id: true },
      });
      const connectionIds = doctorConnections.map(c => c.id);

      if (connectionIds.length > 0) {
        const existingAppointments = await ctx.db.query.appointments.findMany({
          where: and(
            inArray(appointments.connectionId, connectionIds),
            gte(appointments.scheduledAt, dayStart),
            lte(appointments.scheduledAt, dayEnd),
            inArray(appointments.status, ['pending', 'confirmed'])
          ),
        });

        // Check for time conflicts
        const hasConflict = existingAppointments.some(apt => {
          const aptStart = new Date(apt.scheduledAt);
          const aptEnd = new Date(aptStart.getTime() + apt.duration * 60000);
          
          // Check if slots overlap
          return (slotStart < aptEnd && slotEnd > aptStart);
        });

        if (hasConflict) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'This time slot is no longer available',
          });
        }
      }

      // Verify intake session if provided - cross-connection validation (Requirement 5.5)
      let intakeSessionForBooking: typeof intakeSessions.$inferSelect | null = null;
      if (input.intakeSessionId) {
        // First check if the session exists at all
        intakeSessionForBooking =
          (await ctx.db.query.intakeSessions.findFirst({
            where: eq(intakeSessions.id, input.intakeSessionId),
          })) ?? null;

        if (!intakeSessionForBooking) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Intake session not found',
          });
        }

        // Then verify it belongs to the same connection
        if (intakeSessionForBooking.connectionId !== input.connectionId) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: "This session doesn't belong to the selected doctor",
          });
        }
      }

      // Create the appointment
      const result = await ctx.db
        .insert(appointments)
        .values({
          connectionId: input.connectionId,
          intakeSessionId: input.intakeSessionId ?? null,
          scheduledAt,
          duration: doctor.appointmentDuration,
          isOnline: input.isOnline ?? false,
          status: 'pending',
          notes: input.notes ?? null,
          bookedBy: ctx.user.id,
          price: doctor.consultationFee,
        })
        .returning();

      const newAppointment = result[0];
      if (!newAppointment) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create appointment',
        });
      }

      // Create Stream meeting room for online appointments (Requirements: 6.1, 6.2)
      if (input.isOnline && streamService.isConfigured()) {
        try {
          // Get doctor user info for meeting metadata
          const doctorUserForStream = await ctx.db.query.users.findFirst({
            where: eq(users.id, doctor.userId),
          });
          const doctorNameForStream = doctorUserForStream 
            ? `Dr. ${doctorUserForStream.firstName || ''} ${doctorUserForStream.lastName || ''}`.trim()
            : 'Doctor';
          const patientNameForStream = `${ctx.user.firstName || ''} ${ctx.user.lastName || ''}`.trim() || 'Patient';

          await streamService.createMeetingRoom({
            appointmentId: newAppointment.id,
            doctorId: doctor.userId,
            patientId: ctx.user.id,
            scheduledAt,
            duration: doctor.appointmentDuration,
            doctorName: doctorNameForStream,
            patientName: patientNameForStream,
          });
        } catch (error) {
          // Log error but don't fail the appointment creation
          console.error('Failed to create Stream meeting room:', error);
        }
      }

      if (input.intakeSessionId && intakeSessionForBooking) {
        const currentMedicalData = (intakeSessionForBooking.medicalData as MedicalData) ?? INITIAL_MEDICAL_DATA;
        const updatedMedicalData = mergeMedicalData(currentMedicalData, {
          bookingStatus: 'booked',
          appointmentDate: scheduledAt.toISOString(),
        });

        await ctx.db
          .update(intakeSessions)
          .set({
            medicalData: updatedMedicalData,
            updatedAt: new Date(),
          })
          .where(eq(intakeSessions.id, input.intakeSessionId));
      }

      // Send notification to doctor about new appointment (Requirement 12.4)
      const doctorUser = await ctx.db.query.users.findFirst({
        where: eq(users.id, doctor.userId),
      });

      if (doctorUser) {
        const patientName = notificationService.getUserDisplayName(ctx.user);
        await notificationService.createAppointmentNotification(
          doctorUser.id,
          newAppointment.id,
          input.connectionId,
          scheduledAt,
          doctor.appointmentDuration,
          'booked',
          patientName
        );
      }

      // Log the appointment creation
      await auditService.log({
        userId: ctx.user.id,
        action: 'appointment_created',
        resourceType: 'appointment',
        resourceId: newAppointment.id,
        metadata: {
          connectionId: input.connectionId,
          scheduledAt: scheduledAt.toISOString(),
          duration: doctor.appointmentDuration,
          doctorId: doctor.id,
        },
      });

      return newAppointment;
    }),

  createByDoctor: doctorProcedure
    .input(z.object({
      connectionId: z.string().uuid(),
      scheduledAt: z.string().datetime(), // ISO datetime string
      intakeSessionId: z.string().uuid().optional(),
      notes: z.string().max(1000).optional(),
      isOnline: z.boolean().optional(),
      sendMessage: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.doctor) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Doctor profile not found. Please complete onboarding.',
        });
      }

      if (ctx.doctor.verificationStatus !== 'verified') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Cannot schedule appointments as an unverified doctor',
        });
      }

      const connection = await ctx.db.query.connections.findFirst({
        where: and(
          eq(connections.id, input.connectionId),
          eq(connections.doctorId, ctx.doctor.id),
          eq(connections.status, 'active')
        ),
      });

      if (!connection) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Connection not found or not active',
        });
      }

      const scheduledAt = new Date(input.scheduledAt);
      if (scheduledAt <= new Date()) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot schedule appointments in the past',
        });
      }

      const slotStart = new Date(scheduledAt);
      const slotEnd = new Date(scheduledAt.getTime() + ctx.doctor.appointmentDuration * 60000);

      const dayStart = new Date(scheduledAt);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(scheduledAt);
      dayEnd.setHours(23, 59, 59, 999);

      const doctorConnections = await ctx.db.query.connections.findMany({
        where: eq(connections.doctorId, ctx.doctor.id),
        columns: { id: true },
      });
      const connectionIds = doctorConnections.map(c => c.id);

      if (connectionIds.length > 0) {
        const existingAppointments = await ctx.db.query.appointments.findMany({
          where: and(
            inArray(appointments.connectionId, connectionIds),
            gte(appointments.scheduledAt, dayStart),
            lte(appointments.scheduledAt, dayEnd),
            inArray(appointments.status, ['pending', 'confirmed'])
          ),
        });

        const hasConflict = existingAppointments.some(apt => {
          const aptStart = new Date(apt.scheduledAt);
          const aptEnd = new Date(aptStart.getTime() + apt.duration * 60000);
          return slotStart < aptEnd && slotEnd > aptStart;
        });

        if (hasConflict) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'This time slot is no longer available',
          });
        }
      }

      let intakeSessionForBooking: typeof intakeSessions.$inferSelect | null = null;
      if (input.intakeSessionId) {
        intakeSessionForBooking =
          (await ctx.db.query.intakeSessions.findFirst({
            where: eq(intakeSessions.id, input.intakeSessionId),
          })) ?? null;

        if (!intakeSessionForBooking) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Intake session not found',
          });
        }

        if (intakeSessionForBooking.connectionId !== input.connectionId) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: "This session doesn't belong to the selected patient",
          });
        }
      }

      const result = await ctx.db
        .insert(appointments)
        .values({
          connectionId: input.connectionId,
          intakeSessionId: input.intakeSessionId ?? null,
          scheduledAt,
          duration: ctx.doctor.appointmentDuration,
          isOnline: input.isOnline ?? false,
          status: 'confirmed',
          notes: input.notes ?? null,
          bookedBy: ctx.user.id,
          price: ctx.doctor.consultationFee,
        })
        .returning();

      const newAppointment = result[0];
      if (!newAppointment) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create appointment',
        });
      }

      // Create Stream meeting room for online appointments (Requirements: 6.1, 6.2)
      if (input.isOnline && streamService.isConfigured()) {
        try {
          // Get patient info for meeting metadata
          const patientProfile = await ctx.db.query.patients.findFirst({
            where: eq(patients.id, connection.patientId),
          });
          const patientUser = patientProfile 
            ? await ctx.db.query.users.findFirst({ where: eq(users.id, patientProfile.userId) })
            : null;
          const doctorNameForStream = `Dr. ${ctx.user.firstName || ''} ${ctx.user.lastName || ''}`.trim() || 'Doctor';
          const patientNameForStream = patientUser 
            ? `${patientUser.firstName || ''} ${patientUser.lastName || ''}`.trim() || 'Patient'
            : 'Patient';

          await streamService.createMeetingRoom({
            appointmentId: newAppointment.id,
            doctorId: ctx.user.id,
            patientId: patientProfile?.userId || '',
            scheduledAt,
            duration: ctx.doctor.appointmentDuration,
            doctorName: doctorNameForStream,
            patientName: patientNameForStream,
          });
        } catch (error) {
          // Log error but don't fail the appointment creation
          console.error('Failed to create Stream meeting room:', error);
        }
      }

      if (input.intakeSessionId && intakeSessionForBooking) {
        const currentMedicalData = (intakeSessionForBooking.medicalData as MedicalData) ?? INITIAL_MEDICAL_DATA;
        const updatedMedicalData = mergeMedicalData(currentMedicalData, {
          bookingStatus: 'booked',
          appointmentDate: scheduledAt.toISOString(),
        });

        await ctx.db
          .update(intakeSessions)
          .set({
            medicalData: updatedMedicalData,
            updatedAt: new Date(),
          })
          .where(eq(intakeSessions.id, input.intakeSessionId));
      }

      const patient = await ctx.db.query.patients.findFirst({
        where: eq(patients.id, connection.patientId),
      });

      if (patient) {
        const rawDoctorName = notificationService.getUserDisplayName(ctx.user);
        const doctorName = rawDoctorName === 'Unknown User' ? 'Your doctor' : `Dr. ${rawDoctorName}`;
        await notificationService.createAppointmentNotification(
          patient.userId,
          newAppointment.id,
          connection.id,
          scheduledAt,
          ctx.doctor.appointmentDuration,
          'booked',
          doctorName
        );

        if (input.sendMessage ?? true) {
          const formattedDate = scheduledAt.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
          const formattedTime = scheduledAt.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          });

          const content = `${doctorName} scheduled an appointment for ${formattedDate} at ${formattedTime}.${input.isOnline ? ' This is an online video appointment.' : ''}`;

          const [message] = await ctx.db
            .insert(directMessages)
            .values({
              connectionId: connection.id,
              senderId: ctx.user.id,
              content,
            })
            .returning();

          if (message) {
            await notificationService.createMessageNotification(
              patient.userId,
              connection.id,
              message.id,
              doctorName,
              'doctor',
              content
            );
          }
        }
      }

      await auditService.log({
        userId: ctx.user.id,
        action: 'appointment_created',
        resourceType: 'appointment',
        resourceId: newAppointment.id,
        metadata: {
          connectionId: input.connectionId,
          scheduledAt: scheduledAt.toISOString(),
          duration: ctx.doctor.appointmentDuration,
          createdBy: 'doctor',
        },
      });

      return newAppointment;
    }),


  /**
   * Cancel an appointment.
   * Requirements: 9.8
   */
  cancel: protectedProcedure
    .input(z.object({
      appointmentId: z.string().uuid(),
      reason: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get the appointment
      const appointment = await ctx.db.query.appointments.findFirst({
        where: eq(appointments.id, input.appointmentId),
      });

      if (!appointment) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Appointment not found',
        });
      }

      // Get the connection to verify access
      const connection = await ctx.db.query.connections.findFirst({
        where: eq(connections.id, appointment.connectionId),
      });

      if (!connection) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Connection not found',
        });
      }

      // Check if user has permission to cancel
      // Patient can cancel their own appointments
      const patient = await ctx.db.query.patients.findFirst({
        where: eq(patients.userId, ctx.user.id),
      });

      // Doctor can cancel appointments with their patients
      const doctor = await ctx.db.query.doctors.findFirst({
        where: eq(doctors.userId, ctx.user.id),
      });

      const isPatient = patient && connection.patientId === patient.id;
      const isDoctor = doctor && connection.doctorId === doctor.id;
      const isAdmin = ctx.user.primaryRole === 'super_admin';

      if (!isPatient && !isDoctor && !isAdmin) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to cancel this appointment',
        });
      }

      // Check if appointment can be cancelled
      if (appointment.status === 'cancelled') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Appointment is already cancelled',
        });
      }

      if (appointment.status === 'completed') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot cancel a completed appointment',
        });
      }

      // Update the appointment
      const result = await ctx.db
        .update(appointments)
        .set({
          status: 'cancelled',
          cancelledBy: ctx.user.id,
          cancelReason: input.reason ?? null,
          updatedAt: new Date(),
        })
        .where(eq(appointments.id, input.appointmentId))
        .returning();

      const cancelledAppointment = result[0];

      // Cancel Stream meeting room if it exists (Requirements: 6.2)
      if (appointment.streamCallId && streamService.isConfigured()) {
        try {
          await streamService.cancelMeetingRoom(input.appointmentId);
        } catch (error) {
          // Log error but don't fail the cancellation
          console.error('Failed to cancel Stream meeting room:', error);
        }
      }

      // Send notification to the other party about cancellation (Requirement 12.5)
      if (cancelledAppointment) {
        // Determine who to notify (the other party)
        let recipientUserId: string | null = null;
        let otherPartyName: string = '';

        if (isPatient) {
          // Patient cancelled, notify doctor
          const doctorProfile = await ctx.db.query.doctors.findFirst({
            where: eq(doctors.id, connection.doctorId),
          });
          if (doctorProfile) {
            recipientUserId = doctorProfile.userId;
            otherPartyName = notificationService.getUserDisplayName(ctx.user);
          }
        } else if (isDoctor) {
          // Doctor cancelled, notify patient
          const patientProfile = await ctx.db.query.patients.findFirst({
            where: eq(patients.id, connection.patientId),
          });
          if (patientProfile) {
            recipientUserId = patientProfile.userId;
            const doctorUser = await ctx.db.query.users.findFirst({
              where: eq(users.id, ctx.user.id),
            });
            otherPartyName = doctorUser ? notificationService.getUserDisplayName(doctorUser) : 'Your doctor';
          }
        }

        if (recipientUserId) {
          await notificationService.createAppointmentNotification(
            recipientUserId,
            cancelledAppointment.id,
            connection.id,
            new Date(appointment.scheduledAt),
            appointment.duration,
            'cancelled',
            otherPartyName,
            input.reason
          );
        }
      }

      // Log the appointment cancellation
      await auditService.log({
        userId: ctx.user.id,
        action: 'appointment_cancelled',
        resourceType: 'appointment',
        resourceId: input.appointmentId,
        metadata: {
          connectionId: connection.id,
          scheduledAt: appointment.scheduledAt,
          cancelReason: input.reason,
          cancelledBy: isPatient ? 'patient' : isDoctor ? 'doctor' : 'admin',
        },
      });

      return cancelledAppointment;
    }),

  /**
   * Reschedule an appointment.
   * Requirements: 9.6
   */
  reschedule: protectedProcedure
    .input(z.object({
      appointmentId: z.string().uuid(),
      newScheduledAt: z.string().datetime(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get the appointment
      const appointment = await ctx.db.query.appointments.findFirst({
        where: eq(appointments.id, input.appointmentId),
      });

      if (!appointment) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Appointment not found',
        });
      }

      // Get the connection to verify access
      const connection = await ctx.db.query.connections.findFirst({
        where: eq(connections.id, appointment.connectionId),
      });

      if (!connection) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Connection not found',
        });
      }

      // Check if user has permission to reschedule
      const patient = await ctx.db.query.patients.findFirst({
        where: eq(patients.userId, ctx.user.id),
      });

      const doctor = await ctx.db.query.doctors.findFirst({
        where: eq(doctors.userId, ctx.user.id),
      });

      const isPatient = patient && connection.patientId === patient.id;
      const isDoctor = doctor && connection.doctorId === doctor.id;
      const isAdmin = ctx.user.primaryRole === 'super_admin';

      if (!isPatient && !isDoctor && !isAdmin) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to reschedule this appointment',
        });
      }

      // Check if appointment can be rescheduled
      if (appointment.status === 'cancelled') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot reschedule a cancelled appointment',
        });
      }

      if (appointment.status === 'completed') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot reschedule a completed appointment',
        });
      }

      const newScheduledAt = new Date(input.newScheduledAt);

      // Check if new date is in the past
      if (newScheduledAt <= new Date()) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot reschedule to a past date',
        });
      }

      // Get doctor info for slot validation
      const doctorProfile = await ctx.db.query.doctors.findFirst({
        where: eq(doctors.id, connection.doctorId),
      });

      if (!doctorProfile) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Doctor not found',
        });
      }

      // Check for conflicts with other appointments (excluding current one)
      const dayStart = new Date(newScheduledAt);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(newScheduledAt);
      dayEnd.setHours(23, 59, 59, 999);

      const doctorConnections = await ctx.db.query.connections.findMany({
        where: eq(connections.doctorId, connection.doctorId),
        columns: { id: true },
      });
      const connectionIds = doctorConnections.map(c => c.id);

      if (connectionIds.length > 0) {
        const existingAppointments = await ctx.db.query.appointments.findMany({
          where: and(
            inArray(appointments.connectionId, connectionIds),
            gte(appointments.scheduledAt, dayStart),
            lte(appointments.scheduledAt, dayEnd),
            inArray(appointments.status, ['pending', 'confirmed']),
            ne(appointments.id, input.appointmentId) // Exclude current appointment
          ),
        });

        const slotStart = newScheduledAt;
        const slotEnd = new Date(newScheduledAt.getTime() + appointment.duration * 60000);

        const hasConflict = existingAppointments.some(apt => {
          const aptStart = new Date(apt.scheduledAt);
          const aptEnd = new Date(aptStart.getTime() + apt.duration * 60000);
          return (slotStart < aptEnd && slotEnd > aptStart);
        });

        if (hasConflict) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'This time slot is not available',
          });
        }
      }

      // Update the appointment
      const result = await ctx.db
        .update(appointments)
        .set({
          scheduledAt: newScheduledAt,
          status: 'pending', // Reset to pending after reschedule
          updatedAt: new Date(),
        })
        .where(eq(appointments.id, input.appointmentId))
        .returning();

      // Update Stream meeting room schedule if it exists (Requirements: 6.3)
      if (appointment.streamCallId && streamService.isConfigured()) {
        try {
          await streamService.updateMeetingRoom(input.appointmentId, newScheduledAt, appointment.duration);
        } catch (error) {
          // Log error but don't fail the reschedule
          console.error('Failed to update Stream meeting room schedule:', error);
        }
      }

      return result[0];
    }),

  /**
   * Get appointment by ID.
   * Optimized with eager loading - fetches all related data in a single query.
   * Requirements: 1.1, 1.3
   */
  getById: protectedProcedure
    .input(z.object({ appointmentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Single query with JOINs to fetch appointment with all related data
      // This reduces N+1 queries to a maximum of 2 queries (1 for data, 1 for access check)
      const result = await ctx.db
        .select({
          // Appointment fields
          id: appointments.id,
          connectionId: appointments.connectionId,
          intakeSessionId: appointments.intakeSessionId,
          scheduledAt: appointments.scheduledAt,
          duration: appointments.duration,
          isOnline: appointments.isOnline,
          zoomJoinUrl: appointments.zoomJoinUrl,
          streamCallId: appointments.streamCallId,
          streamJoinUrl: appointments.streamJoinUrl,
          streamCreatedAt: appointments.streamCreatedAt,
          streamMetadata: appointments.streamMetadata,
          scribeIsActive: appointments.scribeIsActive,
          scribeActivatedAt: appointments.scribeActivatedAt,
          scribeDeactivatedAt: appointments.scribeDeactivatedAt,
          scribeTranscript: appointments.scribeTranscript,
          scribeSummary: appointments.scribeSummary,
          scribeSoap: appointments.scribeSoap,
          scribeActionItems: appointments.scribeActionItems,
          scribeRiskAssessment: appointments.scribeRiskAssessment,
          scribeUpdatedAt: appointments.scribeUpdatedAt,
          status: appointments.status,
          notes: appointments.notes,
          price: appointments.price,
          paymentStatus: appointments.paymentStatus,
          paymentId: appointments.paymentId,
          bookedBy: appointments.bookedBy,
          cancelledBy: appointments.cancelledBy,
          cancelReason: appointments.cancelReason,
          createdAt: appointments.createdAt,
          updatedAt: appointments.updatedAt,
          // Connection fields
          connectionPatientId: connections.patientId,
          connectionDoctorId: connections.doctorId,
          connectionStatus: connections.status,
          // Doctor fields
          doctorId: doctors.id,
          doctorSpecialty: doctors.specialty,
          doctorClinicName: doctors.clinicName,
          doctorUserId: doctors.userId,
          // Doctor user fields
          doctorFirstName: sql<string | null>`doctor_user.first_name`.as('doctor_first_name'),
          doctorLastName: sql<string | null>`doctor_user.last_name`.as('doctor_last_name'),
          doctorImageUrl: sql<string | null>`doctor_user.image_url`.as('doctor_image_url'),
          // Patient fields
          patientId: patients.id,
          patientUserId: patients.userId,
          // Patient user fields
          patientFirstName: sql<string | null>`patient_user.first_name`.as('patient_first_name'),
          patientLastName: sql<string | null>`patient_user.last_name`.as('patient_last_name'),
          patientImageUrl: sql<string | null>`patient_user.image_url`.as('patient_image_url'),
        })
        .from(appointments)
        .innerJoin(connections, eq(appointments.connectionId, connections.id))
        .innerJoin(doctors, eq(connections.doctorId, doctors.id))
        .innerJoin(patients, eq(connections.patientId, patients.id))
        .innerJoin(
          sql`${users} AS doctor_user`,
          sql`${doctors.userId} = doctor_user.id`
        )
        .innerJoin(
          sql`${users} AS patient_user`,
          sql`${patients.userId} = patient_user.id`
        )
        .where(eq(appointments.id, input.appointmentId))
        .limit(1);

      const appointmentData = result[0];

      if (!appointmentData) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Appointment not found',
        });
      }

      // Check access - single query to check user's patient/doctor profiles
      const userProfiles = await ctx.db
        .select({
          patientId: patients.id,
          doctorId: doctors.id,
        })
        .from(users)
        .leftJoin(patients, eq(patients.userId, users.id))
        .leftJoin(doctors, eq(doctors.userId, users.id))
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      const userProfile = userProfiles[0];
      const isPatient = userProfile?.patientId === appointmentData.connectionPatientId;
      const isDoctor = userProfile?.doctorId === appointmentData.connectionDoctorId;
      const isAdmin = ctx.user.primaryRole === 'super_admin';

      if (!isPatient && !isDoctor && !isAdmin) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to view this appointment',
        });
      }

      // Log query count for monitoring (2 queries total)
      checkQueryCount(2, 'appointment.getById');

      return {
        id: appointmentData.id,
        connectionId: appointmentData.connectionId,
        intakeSessionId: appointmentData.intakeSessionId,
        scheduledAt: appointmentData.scheduledAt,
        duration: appointmentData.duration,
        isOnline: appointmentData.isOnline,
        zoomJoinUrl: appointmentData.zoomJoinUrl,
        streamCallId: appointmentData.streamCallId,
        streamJoinUrl: appointmentData.streamJoinUrl,
        streamCreatedAt: appointmentData.streamCreatedAt,
        streamMetadata: appointmentData.streamMetadata,
        scribeIsActive: appointmentData.scribeIsActive,
        scribeActivatedAt: appointmentData.scribeActivatedAt,
        scribeDeactivatedAt: appointmentData.scribeDeactivatedAt,
        scribeTranscript: appointmentData.scribeTranscript,
        scribeSummary: appointmentData.scribeSummary,
        scribeSoap: appointmentData.scribeSoap,
        scribeActionItems: appointmentData.scribeActionItems,
        scribeRiskAssessment: appointmentData.scribeRiskAssessment,
        scribeUpdatedAt: appointmentData.scribeUpdatedAt,
        status: appointmentData.status,
        notes: appointmentData.notes,
        price: appointmentData.price,
        paymentStatus: appointmentData.paymentStatus,
        paymentId: appointmentData.paymentId,
        bookedBy: appointmentData.bookedBy,
        cancelledBy: appointmentData.cancelledBy,
        cancelReason: appointmentData.cancelReason,
        createdAt: appointmentData.createdAt,
        updatedAt: appointmentData.updatedAt,
        doctor: {
          id: appointmentData.doctorId,
          specialty: appointmentData.doctorSpecialty,
          clinicName: appointmentData.doctorClinicName,
          user: {
            firstName: appointmentData.doctorFirstName,
            lastName: appointmentData.doctorLastName,
            imageUrl: appointmentData.doctorImageUrl,
          },
        },
        patient: {
          id: appointmentData.patientId,
          user: {
            firstName: appointmentData.patientFirstName,
            lastName: appointmentData.patientLastName,
            imageUrl: appointmentData.patientImageUrl,
          },
        },
      };
    }),

  /**
   * Get appointments for the current user (patient or doctor).
   * Optimized with eager loading - fetches all related data in a single query.
   * Returns lean response with only required fields.
   * Requirements: 1.1, 1.3, 6.1, 6.4
   */
  getMyAppointments: protectedProcedure
    .input(z.object({
      status: z.enum(['pending', 'confirmed', 'completed', 'cancelled', 'no_show']).optional(),
      upcoming: z.boolean().optional(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ ctx, input }) => {
      // Debug logging
      console.log('[getMyAppointments] Starting query for user:', ctx.user.id, 'input:', input);
      
      // Enforce pagination limit (Requirement 6.4)
      const effectiveLimit = enforcePaginationLimit(input.limit, MAX_PAGINATION_LIMIT);
      
      // Query 1: Get user's patient and doctor profiles in a single query
      const userProfiles = await ctx.db
        .select({
          patientId: patients.id,
          doctorId: doctors.id,
        })
        .from(users)
        .leftJoin(patients, eq(patients.userId, users.id))
        .leftJoin(doctors, eq(doctors.userId, users.id))
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      const userProfile = userProfiles[0];
      console.log('[getMyAppointments] User profile:', userProfile);
      
      if (!userProfile?.patientId && !userProfile?.doctorId) {
        console.log('[getMyAppointments] No patient or doctor profile found, returning empty');
        return { appointments: [] };
      }

      // Build conditions for connection IDs based on user role
      const connectionConditions = [];
      if (userProfile.patientId) {
        connectionConditions.push(eq(connections.patientId, userProfile.patientId));
      }
      if (userProfile.doctorId) {
        connectionConditions.push(eq(connections.doctorId, userProfile.doctorId));
      }

      // Query 2: Single query with JOINs to fetch appointments with all related data
      const query = ctx.db
        .select({
          // Appointment fields
          id: appointments.id,
          connectionId: appointments.connectionId,
          intakeSessionId: appointments.intakeSessionId,
          scheduledAt: appointments.scheduledAt,
          duration: appointments.duration,
          isOnline: appointments.isOnline,
          zoomJoinUrl: appointments.zoomJoinUrl,
          streamCallId: appointments.streamCallId,
          streamJoinUrl: appointments.streamJoinUrl,
          scribeIsActive: appointments.scribeIsActive,
          status: appointments.status,
          notes: appointments.notes,
          price: appointments.price,
          paymentStatus: appointments.paymentStatus,
          paymentId: appointments.paymentId,
          bookedBy: appointments.bookedBy,
          cancelledBy: appointments.cancelledBy,
          cancelReason: appointments.cancelReason,
          createdAt: appointments.createdAt,
          updatedAt: appointments.updatedAt,
          // Doctor fields
          doctorId: doctors.id,
          doctorSpecialty: doctors.specialty,
          doctorClinicName: doctors.clinicName,
          // Doctor user fields
          doctorFirstName: sql<string | null>`doctor_user.first_name`.as('doctor_first_name'),
          doctorLastName: sql<string | null>`doctor_user.last_name`.as('doctor_last_name'),
          doctorImageUrl: sql<string | null>`doctor_user.image_url`.as('doctor_image_url'),
          // Patient fields
          patientId: patients.id,
          // Patient user fields
          patientFirstName: sql<string | null>`patient_user.first_name`.as('patient_first_name'),
          patientLastName: sql<string | null>`patient_user.last_name`.as('patient_last_name'),
          patientImageUrl: sql<string | null>`patient_user.image_url`.as('patient_image_url'),
        })
        .from(appointments)
        .innerJoin(connections, eq(appointments.connectionId, connections.id))
        .innerJoin(doctors, eq(connections.doctorId, doctors.id))
        .innerJoin(patients, eq(connections.patientId, patients.id))
        .innerJoin(
          sql`${users} AS doctor_user`,
          sql`${doctors.userId} = doctor_user.id`
        )
        .innerJoin(
          sql`${users} AS patient_user`,
          sql`${patients.userId} = patient_user.id`
        )
        .where(
          connectionConditions.length === 1
            ? connectionConditions[0]!
            : sql`(${connections.patientId} = ${userProfile.patientId} OR ${connections.doctorId} = ${userProfile.doctorId})`
        )
        .orderBy(desc(appointments.scheduledAt))
        .limit(effectiveLimit);

      // Apply additional filters
      const conditions = [];
      if (input.status) {
        conditions.push(eq(appointments.status, input.status));
      }
      if (input.upcoming) {
        conditions.push(gte(appointments.scheduledAt, new Date()));
      }

      // Execute query with filters
      let appointmentResults;
      if (conditions.length > 0) {
        const baseCondition = connectionConditions.length === 1
          ? connectionConditions[0]!
          : sql`(${connections.patientId} = ${userProfile.patientId} OR ${connections.doctorId} = ${userProfile.doctorId})`;
        
        appointmentResults = await ctx.db
          .select({
            id: appointments.id,
            connectionId: appointments.connectionId,
            intakeSessionId: appointments.intakeSessionId,
            scheduledAt: appointments.scheduledAt,
            duration: appointments.duration,
            isOnline: appointments.isOnline,
            zoomJoinUrl: appointments.zoomJoinUrl,
            streamCallId: appointments.streamCallId,
            streamJoinUrl: appointments.streamJoinUrl,
            scribeIsActive: appointments.scribeIsActive,
            status: appointments.status,
            notes: appointments.notes,
            price: appointments.price,
            paymentStatus: appointments.paymentStatus,
            paymentId: appointments.paymentId,
            bookedBy: appointments.bookedBy,
            cancelledBy: appointments.cancelledBy,
            cancelReason: appointments.cancelReason,
            createdAt: appointments.createdAt,
            updatedAt: appointments.updatedAt,
            doctorId: doctors.id,
            doctorSpecialty: doctors.specialty,
            doctorClinicName: doctors.clinicName,
            doctorFirstName: sql<string | null>`doctor_user.first_name`.as('doctor_first_name'),
            doctorLastName: sql<string | null>`doctor_user.last_name`.as('doctor_last_name'),
            doctorImageUrl: sql<string | null>`doctor_user.image_url`.as('doctor_image_url'),
            patientId: patients.id,
            patientFirstName: sql<string | null>`patient_user.first_name`.as('patient_first_name'),
            patientLastName: sql<string | null>`patient_user.last_name`.as('patient_last_name'),
            patientImageUrl: sql<string | null>`patient_user.image_url`.as('patient_image_url'),
          })
          .from(appointments)
          .innerJoin(connections, eq(appointments.connectionId, connections.id))
          .innerJoin(doctors, eq(connections.doctorId, doctors.id))
          .innerJoin(patients, eq(connections.patientId, patients.id))
          .innerJoin(
            sql`${users} AS doctor_user`,
            sql`${doctors.userId} = doctor_user.id`
          )
          .innerJoin(
            sql`${users} AS patient_user`,
            sql`${patients.userId} = patient_user.id`
          )
          .where(and(baseCondition, ...conditions))
          .orderBy(desc(appointments.scheduledAt))
          .limit(effectiveLimit);
      } else {
        appointmentResults = await query;
      }

      // Log query count for monitoring (2 queries total)
      checkQueryCount(2, 'appointment.getMyAppointments');

      // Transform results to lean response format (Requirement 6.1)
      // Only include fields required by the client
      const leanAppointments: AppointmentSummary[] = appointmentResults.map((apt) => ({
        id: apt.id,
        connectionId: apt.connectionId,
        intakeSessionId: apt.intakeSessionId,
        scheduledAt: apt.scheduledAt,
        duration: apt.duration,
        isOnline: apt.isOnline,
        zoomJoinUrl: apt.zoomJoinUrl,
        streamCallId: apt.streamCallId,
        streamJoinUrl: apt.streamJoinUrl,
        scribeIsActive: apt.scribeIsActive,
        status: apt.status,
        notes: apt.notes,
        doctor: {
          id: apt.doctorId,
          clinicName: apt.doctorClinicName,
          user: {
            firstName: apt.doctorFirstName,
            lastName: apt.doctorLastName,
            imageUrl: apt.doctorImageUrl,
          },
        },
        patient: {
          id: apt.patientId,
          user: {
            firstName: apt.patientFirstName,
            lastName: apt.patientLastName,
            imageUrl: apt.patientImageUrl,
          },
        },
      }));

      const response = { appointments: leanAppointments };
      
      // Debug logging
      console.log('[getMyAppointments] Returning', leanAppointments.length, 'appointments');
      
      // Check response size and log warning if needed (Requirement 6.5)
      checkResponseSize(response, 'appointment.getMyAppointments');

      return response;
    }),

  getScribeData: doctorProcedure
    .input(z.object({ appointmentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.doctor) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Doctor profile not found. Please complete onboarding.',
        });
      }

      const rows = await ctx.db
        .select({
          id: appointments.id,
          scheduledAt: appointments.scheduledAt,
          status: appointments.status,
          scribeIsActive: appointments.scribeIsActive,
          scribeActivatedAt: appointments.scribeActivatedAt,
          scribeDeactivatedAt: appointments.scribeDeactivatedAt,
          scribeTranscript: appointments.scribeTranscript,
          scribeSummary: appointments.scribeSummary,
          scribeSoap: appointments.scribeSoap,
          scribeActionItems: appointments.scribeActionItems,
          scribeRiskAssessment: appointments.scribeRiskAssessment,
          scribeUpdatedAt: appointments.scribeUpdatedAt,
          isOnline: appointments.isOnline,
          zoomJoinUrl: appointments.zoomJoinUrl,
        })
        .from(appointments)
        .innerJoin(connections, eq(appointments.connectionId, connections.id))
        .where(and(eq(appointments.id, input.appointmentId), eq(connections.doctorId, ctx.doctor.id)))
        .limit(1);

      const row = rows[0];
      if (!row) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Appointment not found',
        });
      }

      return row;
    }),

  activateScribe: doctorProcedure
    .input(z.object({ appointmentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.doctor) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Doctor profile not found. Please complete onboarding.',
        });
      }

      const rows = await ctx.db
        .select({
          id: appointments.id,
          status: appointments.status,
        })
        .from(appointments)
        .innerJoin(connections, eq(appointments.connectionId, connections.id))
        .where(and(eq(appointments.id, input.appointmentId), eq(connections.doctorId, ctx.doctor.id)))
        .limit(1);

      const appointment = rows[0];
      if (!appointment) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Appointment not found',
        });
      }

      if (appointment.status === 'cancelled') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot activate scribe for a cancelled appointment',
        });
      }

      const updated = await ctx.db
        .update(appointments)
        .set({
          scribeIsActive: true,
          scribeActivatedAt: new Date(),
          scribeDeactivatedAt: null,
          scribeUpdatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(appointments.id, input.appointmentId))
        .returning({
          id: appointments.id,
          scribeIsActive: appointments.scribeIsActive,
        });

      const updatedAppointment = updated[0];
      if (!updatedAppointment) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to activate scribe',
        });
      }

      return updatedAppointment;
    }),

  deactivateScribe: doctorProcedure
    .input(z.object({ appointmentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.doctor) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Doctor profile not found. Please complete onboarding.',
        });
      }

      const rows = await ctx.db
        .select({
          id: appointments.id,
        })
        .from(appointments)
        .innerJoin(connections, eq(appointments.connectionId, connections.id))
        .where(and(eq(appointments.id, input.appointmentId), eq(connections.doctorId, ctx.doctor.id)))
        .limit(1);

      const appointment = rows[0];
      if (!appointment) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Appointment not found',
        });
      }

      const updated = await ctx.db
        .update(appointments)
        .set({
          scribeIsActive: false,
          scribeDeactivatedAt: new Date(),
          scribeUpdatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(appointments.id, input.appointmentId))
        .returning({
          id: appointments.id,
          scribeIsActive: appointments.scribeIsActive,
        });

      const updatedAppointment = updated[0];
      if (!updatedAppointment) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to deactivate scribe',
        });
      }

      return updatedAppointment;
    }),

  /**
   * Confirm a pending appointment.
   * Changes status from 'pending' to 'confirmed'.
   * Requirements: 6.1, 6.4, 6.5
   */
  confirm: protectedProcedure
    .input(z.object({
      appointmentId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get the appointment
      const appointment = await ctx.db.query.appointments.findFirst({
        where: eq(appointments.id, input.appointmentId),
      });

      if (!appointment) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Appointment not found',
        });
      }

      // Get the connection to verify access
      const connection = await ctx.db.query.connections.findFirst({
        where: eq(connections.id, appointment.connectionId),
      });

      if (!connection) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Connection not found',
        });
      }

      // Verify user is the doctor for this appointment
      const doctor = await ctx.db.query.doctors.findFirst({
        where: eq(doctors.id, connection.doctorId),
      });

      if (!doctor || doctor.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only the doctor can confirm appointments',
        });
      }

      // Verify appointment is in pending status
      if (appointment.status !== 'pending') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot confirm appointment with status '${appointment.status}'. Only pending appointments can be confirmed.`,
        });
      }

      // Update the appointment status to confirmed
      const result = await ctx.db
        .update(appointments)
        .set({
          status: 'confirmed',
          updatedAt: new Date(),
        })
        .where(eq(appointments.id, input.appointmentId))
        .returning();

      const updatedAppointment = result[0];

      // Send notification to patient (Requirement 6.5)
      if (updatedAppointment) {
        const patient = await ctx.db.query.patients.findFirst({
          where: eq(patients.id, connection.patientId),
        });

        if (patient) {
          const doctorUser = await ctx.db.query.users.findFirst({
            where: eq(users.id, doctor.userId),
          });
          const doctorName = doctorUser ? notificationService.getUserDisplayName(doctorUser) : 'Your doctor';

          await notificationService.createAppointmentNotification(
            patient.userId,
            updatedAppointment.id,
            connection.id,
            new Date(appointment.scheduledAt),
            appointment.duration,
            'confirmed',
            doctorName
          );
        }
      }

      // Create audit log entry (Requirement 6.4)
      await auditService.log({
        userId: ctx.user.id,
        action: 'appointment_updated',
        resourceType: 'appointment',
        resourceId: input.appointmentId,
        metadata: {
          previousStatus: appointment.status,
          newStatus: 'confirmed',
          action: 'confirmed',
          connectionId: connection.id,
          doctorId: doctor.id,
        },
      });

      return updatedAppointment;
    }),

  /**
   * Mark a patient as arrived for their appointment.
   * Requirements: 24.7
   */
  markArrived: protectedProcedure
    .input(z.object({
      appointmentId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get the appointment
      const appointment = await ctx.db.query.appointments.findFirst({
        where: eq(appointments.id, input.appointmentId),
      });

      if (!appointment) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Appointment not found',
        });
      }

      // Get the connection to verify access
      const connection = await ctx.db.query.connections.findFirst({
        where: eq(connections.id, appointment.connectionId),
      });

      if (!connection) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Connection not found',
        });
      }

      // Check if user has permission (doctor, clinic_admin, or receptionist for this doctor)
      const doctor = await ctx.db.query.doctors.findFirst({
        where: eq(doctors.id, connection.doctorId),
      });

      const isDoctor = doctor && doctor.userId === ctx.user.id;
      const isAdmin = ctx.user.primaryRole === 'super_admin';

      // TODO: Check if user is clinic_admin or receptionist for this doctor
      // For now, allow doctors and admins

      if (!isDoctor && !isAdmin) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to update this appointment',
        });
      }

      // Update the appointment status to confirmed (arrived)
      const result = await ctx.db
        .update(appointments)
        .set({
          status: 'confirmed',
          updatedAt: new Date(),
        })
        .where(eq(appointments.id, input.appointmentId))
        .returning();

      // Log the action
      await auditService.log({
        userId: ctx.user.id,
        action: 'appointment_updated',
        resourceType: 'appointment',
        resourceId: input.appointmentId,
        metadata: {
          previousStatus: appointment.status,
          newStatus: 'confirmed',
          action: 'marked_arrived',
        },
      });

      return result[0];
    }),

  /**
   * Mark a patient as no-show for their appointment.
   * Changes status from 'confirmed' to 'no_show'.
   * Requirements: 6.3, 6.4, 6.5
   */
  markNoShow: protectedProcedure
    .input(z.object({
      appointmentId: z.string().uuid(),
      notes: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get the appointment
      const appointment = await ctx.db.query.appointments.findFirst({
        where: eq(appointments.id, input.appointmentId),
      });

      if (!appointment) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Appointment not found',
        });
      }

      // Get the connection to verify access
      const connection = await ctx.db.query.connections.findFirst({
        where: eq(connections.id, appointment.connectionId),
      });

      if (!connection) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Connection not found',
        });
      }

      // Verify user is the doctor for this appointment
      const doctor = await ctx.db.query.doctors.findFirst({
        where: eq(doctors.id, connection.doctorId),
      });

      if (!doctor || doctor.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only the doctor can mark appointments as no-show',
        });
      }

      // Verify appointment is in confirmed status
      if (appointment.status !== 'confirmed') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot mark appointment with status '${appointment.status}' as no-show. Only confirmed appointments can be marked as no-show.`,
        });
      }

      // Verify appointment is in the past
      const appointmentTime = new Date(appointment.scheduledAt);
      if (appointmentTime > new Date()) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot mark a future appointment as no-show',
        });
      }

      // Update the appointment status to no_show
      const result = await ctx.db
        .update(appointments)
        .set({
          status: 'no_show',
          notes: input.notes ?? appointment.notes,
          updatedAt: new Date(),
        })
        .where(eq(appointments.id, input.appointmentId))
        .returning();

      const updatedAppointment = result[0];

      // Send notification to patient (Requirement 6.5)
      if (updatedAppointment) {
        const patient = await ctx.db.query.patients.findFirst({
          where: eq(patients.id, connection.patientId),
        });

        if (patient) {
          const doctorUser = await ctx.db.query.users.findFirst({
            where: eq(users.id, doctor.userId),
          });
          const doctorName = doctorUser ? notificationService.getUserDisplayName(doctorUser) : 'Your doctor';

          await notificationService.createNotification({
            userId: patient.userId,
            type: 'appointment',
            title: 'Appointment Marked as No-Show',
            message: `Your appointment with ${doctorName} has been marked as no-show.`,
            data: {
              appointmentId: updatedAppointment.id,
              connectionId: connection.id,
              scheduledAt: appointment.scheduledAt.toISOString(),
              duration: appointment.duration,
              action: 'no_show' as const,
            },
          });
        }
      }

      // Create audit log entry (Requirement 6.4)
      await auditService.log({
        userId: ctx.user.id,
        action: 'appointment_no_show',
        resourceType: 'appointment',
        resourceId: input.appointmentId,
        metadata: {
          previousStatus: appointment.status,
          newStatus: 'no_show',
          connectionId: connection.id,
          doctorId: doctor.id,
          notes: input.notes,
        },
      });

      return updatedAppointment;
    }),

  /**
   * Mark an appointment as completed.
   * Changes status from 'confirmed' to 'completed'.
   * Requirements: 6.2, 6.4, 6.5
   */
  complete: protectedProcedure
    .input(z.object({
      appointmentId: z.string().uuid(),
      notes: z.string().max(2000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get the appointment
      const appointment = await ctx.db.query.appointments.findFirst({
        where: eq(appointments.id, input.appointmentId),
      });

      if (!appointment) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Appointment not found',
        });
      }

      // Get the connection to verify access
      const connection = await ctx.db.query.connections.findFirst({
        where: eq(connections.id, appointment.connectionId),
      });

      if (!connection) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Connection not found',
        });
      }

      // Verify user is the doctor for this appointment
      const doctor = await ctx.db.query.doctors.findFirst({
        where: eq(doctors.id, connection.doctorId),
      });

      if (!doctor || doctor.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only the doctor can mark appointments as completed',
        });
      }

      // Verify appointment is in confirmed status
      if (appointment.status !== 'confirmed') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot complete appointment with status '${appointment.status}'. Only confirmed appointments can be completed.`,
        });
      }

      // Verify appointment is in the past
      const appointmentTime = new Date(appointment.scheduledAt);
      if (appointmentTime > new Date()) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot mark a future appointment as completed',
        });
      }

      // Update the appointment status to completed
      const result = await ctx.db
        .update(appointments)
        .set({
          status: 'completed',
          notes: input.notes ?? appointment.notes,
          updatedAt: new Date(),
        })
        .where(eq(appointments.id, input.appointmentId))
        .returning();

      const updatedAppointment = result[0];

      // Send notification to patient (Requirement 6.5)
      if (updatedAppointment) {
        const patient = await ctx.db.query.patients.findFirst({
          where: eq(patients.id, connection.patientId),
        });

        if (patient) {
          const doctorUser = await ctx.db.query.users.findFirst({
            where: eq(users.id, doctor.userId),
          });
          const doctorName = doctorUser ? notificationService.getUserDisplayName(doctorUser) : 'Your doctor';

          await notificationService.createNotification({
            userId: patient.userId,
            type: 'appointment',
            title: 'Appointment Completed',
            message: `Your appointment with ${doctorName} has been marked as completed.`,
            data: {
              appointmentId: updatedAppointment.id,
              connectionId: connection.id,
              scheduledAt: appointment.scheduledAt.toISOString(),
              duration: appointment.duration,
              action: 'completed' as const,
            },
          });
        }
      }

      // Create audit log entry (Requirement 6.4)
      await auditService.log({
        userId: ctx.user.id,
        action: 'appointment_completed',
        resourceType: 'appointment',
        resourceId: input.appointmentId,
        metadata: {
          previousStatus: appointment.status,
          newStatus: 'completed',
          connectionId: connection.id,
          doctorId: doctor.id,
          notes: input.notes,
        },
      });

      return updatedAppointment;
    }),
});
