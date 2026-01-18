import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc';
import { meetingAuthService } from '@/server/services/meeting-auth';
import { streamService } from '@/server/services/stream';
import { notificationService } from '@/server/services/notification';
import { db } from '@/server/db';
import { directMessages, appointments, connections, doctors, patients } from '@/server/db/schema';
import { eq } from 'drizzle-orm';

export const meetingRouter = createTRPCRouter({
  /**
   * Validates if the current user has access to join a specific meeting
   * Requirements: 4.1, 4.2, 4.3, 4.4
   */
  validateAccess: protectedProcedure
    .input(z.object({ appointmentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const accessResult = await meetingAuthService.validateMeetingAccess({
        appointmentId: input.appointmentId,
        userId: ctx.user.clerkId,
      });

      return {
        hasAccess: accessResult.hasAccess,
        userRole: accessResult.userRole,
        errorMessage: accessResult.errorMessage,
        appointmentData: accessResult.appointmentData,
      };
    }),

  /**
   * Checks if the current user can end a specific meeting (doctors and admins only)
   * Requirements: 5.1
   */
  canEndMeeting: protectedProcedure
    .input(z.object({ appointmentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const canEnd = await meetingAuthService.canEndMeeting(
        input.appointmentId,
        ctx.user.clerkId
      );

      return { canEnd };
    }),

  /**
   * Ends a meeting for all participants (doctors and admins only)
   * Requirements: 5.1, 5.2
   */
  endMeetingForAll: protectedProcedure
    .input(z.object({ appointmentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verify the user has permission to end the meeting
      const canEnd = await meetingAuthService.canEndMeeting(
        input.appointmentId,
        ctx.user.clerkId
      );

      if (!canEnd) {
        throw new Error('You do not have permission to end this meeting');
      }

      try {
        // End the meeting room on Stream's side and clean up
        await streamService.endMeetingForAll(input.appointmentId);
        
        return { success: true };
      } catch (error) {
        console.error('Failed to end meeting for all:', error);
        throw new Error('Failed to end meeting. Please try again.');
      }
    }),

  /**
   * Checks if a meeting is available to join based on scheduled time
   * Requirements: 5.3
   */
  isMeetingAvailable: protectedProcedure
    .input(z.object({ appointmentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const accessResult = await meetingAuthService.validateMeetingAccess({
        appointmentId: input.appointmentId,
        userId: ctx.user.clerkId,
      });

      // If access is denied due to timing, the error message will indicate this
      const isTimingIssue = accessResult.errorMessage?.includes('available in') || 
                           accessResult.errorMessage?.includes('has ended');
      
      return {
        isAvailable: accessResult.hasAccess,
        isTimingIssue,
        errorMessage: accessResult.errorMessage,
        appointmentData: accessResult.appointmentData,
      };
    }),

  /**
   * Notifies the other party that someone has joined the meeting
   * Sends a message with a join meeting link
   */
  notifyMeetingJoined: protectedProcedure
    .input(z.object({ appointmentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Get appointment with connection info
      const appointment = await db.query.appointments.findFirst({
        where: eq(appointments.id, input.appointmentId),
      });

      if (!appointment) {
        throw new Error('Appointment not found');
      }

      // Get connection info
      const connection = await db.query.connections.findFirst({
        where: eq(connections.id, appointment.connectionId),
      });

      if (!connection) {
        throw new Error('Connection not found');
      }

      // Get patient and doctor info
      const patient = await db.query.patients.findFirst({
        where: eq(patients.id, connection.patientId),
      });
      const doctor = await db.query.doctors.findFirst({
        where: eq(doctors.id, connection.doctorId),
      });

      if (!patient || !doctor) {
        throw new Error('Patient or doctor not found');
      }

      // Determine who is joining and who to notify
      const isDoctor = ctx.user.id === doctor.userId;
      const isPatient = ctx.user.id === patient.userId;

      if (!isDoctor && !isPatient) {
        throw new Error('You are not authorized for this meeting');
      }

      const recipientUserId = isDoctor ? patient.userId : doctor.userId;
      const senderName = notificationService.getUserDisplayName(ctx.user);
      const senderRole = isDoctor ? 'doctor' : 'patient';
      const senderLabel = isDoctor ? `Dr. ${senderName}` : senderName;

      // Create the meeting link
      const meetingLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/meeting/${input.appointmentId}`;

      // Create a message with the meeting invite
      // Use a special format that the UI can detect and render as a button
      const messageContent = `🎥 ${senderLabel} has started a video call and is waiting for you.\n\n[JOIN_MEETING:${meetingLink}]`;

      // Insert the message
      const [message] = await db
        .insert(directMessages)
        .values({
          connectionId: connection.id,
          senderId: ctx.user.id,
          content: messageContent,
        })
        .returning();

      if (!message) {
        throw new Error('Failed to send meeting invite message');
      }

      // Create notification for the recipient
      await notificationService.createMessageNotification(
        recipientUserId,
        connection.id,
        message.id,
        senderName,
        senderRole as 'patient' | 'doctor',
        `${senderLabel} has started a video call and is waiting for you. Click to join!`
      );

      return { 
        success: true, 
        messageId: message.id,
        recipientUserId,
      };
    }),
});