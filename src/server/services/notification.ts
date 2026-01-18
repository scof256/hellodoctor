/**
 * Notification Service
 * 
 * Provides functions for creating and managing notifications.
 * Implements notification types: connection, appointment, message, intake_complete
 * 
 * Requirements: 12.1, 12.2, 12.6
 */

import { db } from '@/server/db';
import { notifications, users, doctors, patients, connections } from '@/server/db/schema';
import { eq } from 'drizzle-orm';

// Notification types supported by the system
export type NotificationType = 'connection' | 'appointment' | 'message' | 'intake_complete';

// Base notification data interface
export interface NotificationData {
  [key: string]: unknown;
}

// Specific notification data interfaces
export interface ConnectionNotificationData extends NotificationData {
  connectionId: string;
  patientUserId?: string;
  doctorUserId?: string;
  patientName?: string;
  doctorName?: string;
  action: 'new' | 'reconnected' | 'disconnected';
}

export interface AppointmentNotificationData extends NotificationData {
  appointmentId: string;
  connectionId: string;
  scheduledAt: string;
  duration: number;
  patientName?: string;
  doctorName?: string;
  action: 'booked' | 'cancelled' | 'rescheduled' | 'confirmed' | 'reminder' | 'completed' | 'no_show';
  cancelReason?: string;
}

export interface MessageNotificationData extends NotificationData {
  connectionId: string;
  messageId: string;
  senderName: string;
  senderRole: 'patient' | 'doctor' | 'clinic_admin';
  preview: string;
}

export interface IntakeCompleteNotificationData extends NotificationData {
  sessionId: string;
  connectionId: string;
  patientName: string;
  chiefComplaint?: string;
}

// Union type for all notification data
export type TypedNotificationData = 
  | ConnectionNotificationData 
  | AppointmentNotificationData 
  | MessageNotificationData 
  | IntakeCompleteNotificationData;

// Create notification input
export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: TypedNotificationData;
}

/**
 * Create a notification for a user.
 * 
 * Requirements: 12.1, 12.6
 */
export async function createNotification(input: CreateNotificationInput): Promise<typeof notifications.$inferSelect> {
  const [notification] = await db
    .insert(notifications)
    .values({
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      data: input.data ?? null,
    })
    .returning();

  if (!notification) {
    throw new Error('Failed to create notification');
  }

  return notification;
}

/**
 * Create a connection notification.
 * Notifies the doctor when a patient connects/reconnects/disconnects.
 * 
 * Requirements: 12.3 (via connection events)
 */
export async function createConnectionNotification(
  doctorUserId: string,
  patientUser: { id: string; firstName: string | null; lastName: string | null },
  action: 'new' | 'reconnected' | 'disconnected',
  connectionId: string
): Promise<typeof notifications.$inferSelect> {
  const patientName = [patientUser.firstName, patientUser.lastName]
    .filter(Boolean)
    .join(' ') || 'A patient';

  const titles: Record<typeof action, string> = {
    new: 'New Patient Connection',
    reconnected: 'Patient Reconnected',
    disconnected: 'Patient Disconnected',
  };

  const messages: Record<typeof action, string> = {
    new: `${patientName} has connected with you.`,
    reconnected: `${patientName} has reconnected with you.`,
    disconnected: `${patientName} has disconnected from you.`,
  };

  return createNotification({
    userId: doctorUserId,
    type: 'connection',
    title: titles[action],
    message: messages[action],
    data: {
      connectionId,
      patientUserId: patientUser.id,
      patientName,
      action,
    },
  });
}

/**
 * Create an appointment notification.
 * Notifies relevant parties about appointment events.
 * 
 * Requirements: 12.4, 12.5
 */
export async function createAppointmentNotification(
  recipientUserId: string,
  appointmentId: string,
  connectionId: string,
  scheduledAt: Date,
  duration: number,
  action: 'booked' | 'cancelled' | 'rescheduled' | 'confirmed' | 'reminder',
  otherPartyName: string,
  cancelReason?: string
): Promise<typeof notifications.$inferSelect> {
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

  const titles: Record<typeof action, string> = {
    booked: 'Appointment Booked',
    cancelled: 'Appointment Cancelled',
    rescheduled: 'Appointment Rescheduled',
    confirmed: 'Appointment Confirmed',
    reminder: 'Appointment Reminder',
  };

  const messages: Record<typeof action, string> = {
    booked: `An appointment with ${otherPartyName} has been booked for ${formattedDate} at ${formattedTime}.`,
    cancelled: `Your appointment with ${otherPartyName} on ${formattedDate} has been cancelled.${cancelReason ? ` Reason: ${cancelReason}` : ''}`,
    rescheduled: `Your appointment with ${otherPartyName} has been rescheduled to ${formattedDate} at ${formattedTime}.`,
    confirmed: `Your appointment with ${otherPartyName} on ${formattedDate} at ${formattedTime} has been confirmed.`,
    reminder: `Reminder: You have an appointment with ${otherPartyName} on ${formattedDate} at ${formattedTime}.`,
  };

  return createNotification({
    userId: recipientUserId,
    type: 'appointment',
    title: titles[action],
    message: messages[action],
    data: {
      appointmentId,
      connectionId,
      scheduledAt: scheduledAt.toISOString(),
      duration,
      action,
      cancelReason,
    },
  });
}

/**
 * Create a message notification.
 * Notifies the recipient of a new direct message.
 * 
 * Requirements: 13.5
 */
export async function createMessageNotification(
  recipientUserId: string,
  connectionId: string,
  messageId: string,
  senderName: string,
  senderRole: 'patient' | 'doctor' | 'clinic_admin',
  messageContent: string
): Promise<typeof notifications.$inferSelect> {
  // Create a preview of the message (first 100 chars)
  const preview = messageContent.length > 100 
    ? messageContent.substring(0, 100) + '...' 
    : messageContent;

  const senderLabel = senderRole === 'doctor'
    ? `Dr. ${senderName}`
    : senderName;

  return createNotification({
    userId: recipientUserId,
    type: 'message',
    title: `New message from ${senderLabel}`,
    message: preview,
    data: {
      connectionId,
      messageId,
      senderName,
      senderRole,
      preview,
    },
  });
}

/**
 * Create an intake completion notification.
 * Notifies the doctor when a patient completes their intake.
 * 
 * Requirements: 12.3
 */
export async function createIntakeCompleteNotification(
  doctorUserId: string,
  sessionId: string,
  connectionId: string,
  patientName: string,
  chiefComplaint?: string
): Promise<typeof notifications.$inferSelect> {
  return createNotification({
    userId: doctorUserId,
    type: 'intake_complete',
    title: 'Intake Completed',
    message: `${patientName} has completed their intake and is ready for review.`,
    data: {
      sessionId,
      connectionId,
      patientName,
      chiefComplaint,
    },
  });
}

/**
 * Helper to get user name from user record
 */
export function getUserDisplayName(user: { firstName: string | null; lastName: string | null }): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Unknown User';
}

/**
 * Helper to get connection party info for notifications
 */
export async function getConnectionPartyInfo(connectionId: string): Promise<{
  patientUserId: string;
  patientName: string;
  doctorUserId: string;
  doctorName: string;
} | null> {
  const connection = await db.query.connections.findFirst({
    where: eq(connections.id, connectionId),
  });

  if (!connection) return null;

  const patient = await db.query.patients.findFirst({
    where: eq(patients.id, connection.patientId),
  });

  const doctor = await db.query.doctors.findFirst({
    where: eq(doctors.id, connection.doctorId),
  });

  if (!patient || !doctor) return null;

  const patientUser = await db.query.users.findFirst({
    where: eq(users.id, patient.userId),
  });

  const doctorUser = await db.query.users.findFirst({
    where: eq(users.id, doctor.userId),
  });

  if (!patientUser || !doctorUser) return null;

  return {
    patientUserId: patientUser.id,
    patientName: getUserDisplayName(patientUser),
    doctorUserId: doctorUser.id,
    doctorName: getUserDisplayName(doctorUser),
  };
}

// Export the notification service as a singleton-like object
export const notificationService = {
  createNotification,
  createConnectionNotification,
  createAppointmentNotification,
  createMessageNotification,
  createIntakeCompleteNotification,
  getUserDisplayName,
  getConnectionPartyInfo,
};
