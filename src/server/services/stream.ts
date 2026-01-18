import { StreamClient } from '@stream-io/node-sdk';
import { env } from '@/env';
import { db } from '@/server/db';
import { appointments } from '@/server/db/schema';
import { eq } from 'drizzle-orm';
import { 
  StreamError, 
  STREAM_ERROR_CODES, 
  logStreamError, 
  retryWithBackoff,
  type StreamErrorCode 
} from './stream-error-handler';

const STREAM_DEBUG = process.env.NODE_ENV === 'development';

function mask(value: string | undefined | null): string {
  if (!value) return '(empty)';
  const v = String(value);
  if (v.length <= 6) return '*'.repeat(v.length);
  return `${v.slice(0, 3)}…${v.slice(-2)} (len=${v.length})`;
}

export interface GenerateStreamTokenParams {
  userId: string;
  callId?: string;
}

export interface StreamTokenResponse {
  token: string;
  expiresAt: number;
}

export interface CreateMeetingRoomParams {
  appointmentId: string;
  doctorId: string;
  patientId: string;
  scheduledAt: Date;
  duration: number;
  doctorName?: string;
  patientName?: string;
}

export interface MeetingRoomResponse {
  callId: string;
  joinUrl: string;
  streamCall: any; // Stream Call object
}

export interface StreamCallConfig {
  callId: string;
  callType: 'default';
  participants: StreamParticipant[];
  settings: {
    audio: { mic_default_on: boolean };
    video: { camera_default_on: boolean };
    screenshare: { enabled: boolean };
    recording: { mode: 'disabled' | 'available' };
  };
}

export interface StreamParticipant {
  user_id: string;
  name?: string;
  image?: string;
  /** Application-level role for display purposes */
  appRole: 'doctor' | 'patient';
  /** Stream SDK role for permissions (admin = host, user = participant) */
  streamRole: 'admin' | 'user';
}

class StreamService {
  private client: StreamClient | null = null;

  private getConfig() {
    const apiKey = env.STREAM_API_KEY?.trim();
    const secretKey = env.STREAM_SECRET_KEY?.trim();

    if (!apiKey || !secretKey) {
      return null;
    }

    return { apiKey, secretKey };
  }

  private getClient(): StreamClient {
    if (this.client) {
      return this.client;
    }

    const config = this.getConfig();
    if (!config) {
      throw new Error('Stream is not configured');
    }

    if (STREAM_DEBUG) {
      console.info('[stream] initializing client', {
        apiKey: mask(config.apiKey),
        secretKey: config.secretKey ? `(len=${config.secretKey.length})` : '(empty)',
      });
    }

    this.client = new StreamClient(config.apiKey, config.secretKey);
    return this.client;
  }

  async generateToken(params: GenerateStreamTokenParams): Promise<StreamTokenResponse> {
    const client = this.getClient();
    
    if (STREAM_DEBUG) {
      console.info('[stream] generating token', {
        userId: params.userId,
        callId: params.callId,
      });
    }

    try {
      // Set token expiration to 24 hours from now
      const now = Math.floor(Date.now() / 1000);
      // Subtract 60 seconds from iat to account for clock skew between client and server
      // This prevents "token used before issue at" errors
      const issuedAt = now - 60;
      const expiresAt = now + (24 * 60 * 60);
      
      // Generate JWT token for the user using the video API
      // Include iat (issued at) with clock skew buffer to prevent timing issues
      const token = client.generateUserToken({ 
        user_id: params.userId, 
        exp: expiresAt,
        iat: issuedAt,
      });

      if (STREAM_DEBUG) {
        console.info('[stream] token generated successfully', {
          userId: params.userId,
          expiresAt: new Date(expiresAt * 1000).toISOString(),
        });
      }

      return {
        token,
        expiresAt,
      };
    } catch (error) {
      logStreamError(error, {
        operation: 'generateToken',
        userId: params.userId,
        callId: params.callId,
      });
      
      throw new StreamError(
        STREAM_ERROR_CODES.TOKEN_GENERATION_FAILED,
        `Failed to generate Stream token: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async createMeetingRoom(params: CreateMeetingRoomParams): Promise<MeetingRoomResponse> {
    const client = this.getClient();
    
    if (STREAM_DEBUG) {
      console.info('[stream] creating meeting room', {
        appointmentId: params.appointmentId,
        doctorId: params.doctorId,
        patientId: params.patientId,
        scheduledAt: params.scheduledAt.toISOString(),
      });
    }

    try {
      // Use appointment ID as the call identifier
      const callId = `appointment_${params.appointmentId}`;
      const callType = 'default';

      // Create participants array with both app-level and Stream SDK roles
      // appRole: 'doctor' | 'patient' - for display and business logic
      // streamRole: 'admin' | 'user' - for Stream SDK permissions (admin = host, user = participant)
      const participants: StreamParticipant[] = [
        {
          user_id: params.doctorId,
          name: params.doctorName,
          appRole: 'doctor',
          streamRole: 'admin', // Doctors are hosts with admin permissions
        },
        {
          user_id: params.patientId,
          name: params.patientName,
          appRole: 'patient',
          streamRole: 'user', // Patients are regular participants
        },
      ];

      // Configure call settings for medical consultations
      const callConfig: StreamCallConfig = {
        callId,
        callType,
        participants,
        settings: {
          audio: { mic_default_on: true },
          video: { camera_default_on: true },
          screenshare: { enabled: true },
          recording: { mode: 'available' },
        },
      };

      // Create the call using Stream's video API with retry
      const call = client.video.call(callType, callId);
      
      // Create or get the call with metadata (with retry for transient failures)
      const callResponse = await retryWithBackoff(
        async () => call.getOrCreate({
          data: {
            created_by_id: params.doctorId,
            starts_at: params.scheduledAt,
            custom: {
              appointmentId: params.appointmentId,
              doctorName: params.doctorName || 'Doctor',
              patientName: params.patientName || 'Patient',
              appointmentType: 'consultation',
              duration: params.duration,
            },
          },
        }),
        { maxRetries: 2 },
        (attempt, error, delayMs) => {
          console.warn(`[stream] Meeting room creation retry ${attempt}, waiting ${delayMs}ms`, error.message);
        }
      );

      // Add members to the call with proper Stream SDK roles
      for (const participant of participants) {
        await call.updateCallMembers({
          update_members: [
            {
              user_id: participant.user_id,
              role: participant.streamRole, // Use Stream SDK role (admin/user)
            },
          ],
        });
      }

      // Generate join URL
      const joinUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/meeting/${params.appointmentId}`;

      // Update appointment record with Stream data
      await db
        .update(appointments)
        .set({
          streamCallId: callId,
          streamJoinUrl: joinUrl,
          streamCreatedAt: new Date(),
          streamMetadata: {
            doctorName: params.doctorName || 'Doctor',
            patientName: params.patientName || 'Patient',
            appointmentType: 'consultation',
            duration: params.duration,
          },
          updatedAt: new Date(),
        })
        .where(eq(appointments.id, params.appointmentId));

      if (STREAM_DEBUG) {
        console.info('[stream] meeting room created successfully', {
          callId,
          joinUrl,
          appointmentId: params.appointmentId,
        });
      }

      return {
        callId,
        joinUrl,
        streamCall: call,
      };
    } catch (error) {
      logStreamError(error, {
        operation: 'createMeetingRoom',
        appointmentId: params.appointmentId,
        doctorId: params.doctorId,
        patientId: params.patientId,
      });
      
      throw new StreamError(
        STREAM_ERROR_CODES.MEETING_CREATION_FAILED,
        `Failed to create meeting room: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async getMeetingRoom(appointmentId: string): Promise<MeetingRoomResponse | null> {
    const client = this.getClient();
    
    if (STREAM_DEBUG) {
      console.info('[stream] getting meeting room', { appointmentId });
    }

    try {
      // Get appointment data from database
      const appointment = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, appointmentId))
        .limit(1);

      if (!appointment.length || !appointment[0]?.streamCallId) {
        if (STREAM_DEBUG) {
          console.info('[stream] meeting room not found', { appointmentId });
        }
        return null;
      }

      const appointmentData = appointment[0];
      const callId = appointmentData.streamCallId;
      if (!callId) {
        if (STREAM_DEBUG) {
          console.info('[stream] meeting room has no call ID', { appointmentId });
        }
        return null;
      }

      // Get the call from Stream
      const call = client.video.call('default', callId);
      
      return {
        callId,
        joinUrl: appointmentData.streamJoinUrl || '',
        streamCall: call,
      };
    } catch (error) {
      logStreamError(error, {
        operation: 'getMeetingRoom',
        appointmentId,
      });
      
      throw new StreamError(
        STREAM_ERROR_CODES.MEETING_NOT_FOUND,
        `Failed to get meeting room: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async cancelMeetingRoom(appointmentId: string): Promise<void> {
    const client = this.getClient();
    
    if (STREAM_DEBUG) {
      console.info('[stream] cancelling meeting room', { appointmentId });
    }

    try {
      // Get appointment data from database
      const appointment = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, appointmentId))
        .limit(1);

      if (!appointment.length || !appointment[0]?.streamCallId) {
        if (STREAM_DEBUG) {
          console.info('[stream] meeting room not found for cancellation', { appointmentId });
        }
        return;
      }

      const callId = appointment[0].streamCallId;

      // End the call in Stream with retry
      const call = client.video.call('default', callId);
      await retryWithBackoff(
        async () => call.end(),
        { maxRetries: 2 },
        (attempt, error, delayMs) => {
          console.warn(`[stream] Meeting cancellation retry ${attempt}, waiting ${delayMs}ms`, error.message);
        }
      );

      // Clear Stream data from appointment record
      await db
        .update(appointments)
        .set({
          streamCallId: null,
          streamJoinUrl: null,
          streamCreatedAt: null,
          streamMetadata: null,
          updatedAt: new Date(),
        })
        .where(eq(appointments.id, appointmentId));

      if (STREAM_DEBUG) {
        console.info('[stream] meeting room cancelled successfully', {
          appointmentId,
          callId,
        });
      }
    } catch (error) {
      logStreamError(error, {
        operation: 'cancelMeetingRoom',
        appointmentId,
      });
      
      // Don't throw for cancellation failures - log and continue
      console.error('[stream] Meeting room cancellation failed, but continuing:', error);
    }
  }

  async updateMeetingRoom(appointmentId: string, scheduledAt: Date, duration?: number): Promise<void> {
    const client = this.getClient();
    
    if (STREAM_DEBUG) {
      console.info('[stream] updating meeting room', {
        appointmentId,
        scheduledAt: scheduledAt.toISOString(),
        duration,
      });
    }

    try {
      // Get appointment data from database
      const appointment = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, appointmentId))
        .limit(1);

      if (!appointment.length || !appointment[0]?.streamCallId) {
        if (STREAM_DEBUG) {
          console.info('[stream] meeting room not found for update', { appointmentId });
        }
        return;
      }

      const callId = appointment[0].streamCallId;

      // Update the call in Stream with retry
      const call = client.video.call('default', callId);
      
      const existingMetadata = appointment[0].streamMetadata as Record<string, any> || {};
      const appointmentDuration = appointment[0].duration;
      
      await retryWithBackoff(
        async () => call.update({
          starts_at: scheduledAt,
          custom: {
            ...existingMetadata,
            duration: duration || appointmentDuration,
          },
        }),
        { maxRetries: 2 },
        (attempt, error, delayMs) => {
          console.warn(`[stream] Meeting update retry ${attempt}, waiting ${delayMs}ms`, error.message);
        }
      );

      // Update Stream metadata in database
      const updatedMetadata = {
        ...existingMetadata,
        duration: duration || appointmentDuration,
      };

      await db
        .update(appointments)
        .set({
          streamMetadata: updatedMetadata,
          updatedAt: new Date(),
        })
        .where(eq(appointments.id, appointmentId));

      if (STREAM_DEBUG) {
        console.info('[stream] meeting room updated successfully', {
          appointmentId,
          callId,
          scheduledAt: scheduledAt.toISOString(),
        });
      }
    } catch (error) {
      logStreamError(error, {
        operation: 'updateMeetingRoom',
        appointmentId,
        scheduledAt: scheduledAt.toISOString(),
        duration,
      });
      
      throw new StreamError(
        STREAM_ERROR_CODES.MEETING_CREATION_FAILED,
        `Failed to update meeting room: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Ends a meeting for all participants
   * Requirements: 5.1, 5.2
   */
  async endMeetingForAll(appointmentId: string): Promise<void> {
    const client = this.getClient();
    
    if (STREAM_DEBUG) {
      console.info('[stream] ending meeting for all participants', { appointmentId });
    }

    try {
      // Get appointment data from database
      const appointment = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, appointmentId))
        .limit(1);

      if (!appointment.length || !appointment[0]?.streamCallId) {
        if (STREAM_DEBUG) {
          console.info('[stream] meeting room not found for ending', { appointmentId });
        }
        return;
      }

      const callId = appointment[0].streamCallId;

      // End the call in Stream - this will disconnect all participants (with retry)
      const call = client.video.call('default', callId);
      await retryWithBackoff(
        async () => call.end(),
        { maxRetries: 2 },
        (attempt, error, delayMs) => {
          console.warn(`[stream] End meeting retry ${attempt}, waiting ${delayMs}ms`, error.message);
        }
      );

      // Update the appointment status to completed if it was confirmed
      const currentStatus = appointment[0].status;
      if (currentStatus === 'confirmed' || currentStatus === 'pending') {
        await db
          .update(appointments)
          .set({
            status: 'completed',
            updatedAt: new Date(),
          })
          .where(eq(appointments.id, appointmentId));
      }

      if (STREAM_DEBUG) {
        console.info('[stream] meeting ended for all participants', {
          appointmentId,
          callId,
        });
      }
    } catch (error) {
      logStreamError(error, {
        operation: 'endMeetingForAll',
        appointmentId,
      });
      
      throw new StreamError(
        STREAM_ERROR_CODES.CONNECTION_FAILED,
        `Failed to end meeting: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Checks if a meeting is available based on scheduled time
   * Requirements: 5.3
   */
  isMeetingAvailable(scheduledAt: Date, duration: number): { available: boolean; reason?: string } {
    const now = new Date();
    const earlyJoinTime = new Date(scheduledAt.getTime() - 15 * 60 * 1000); // 15 minutes before
    const endTime = new Date(scheduledAt.getTime() + duration * 60 * 1000);
    const lateJoinTime = new Date(endTime.getTime() + 24 * 60 * 60 * 1000); // 24 hours after end

    if (now < earlyJoinTime) {
      const minutesUntilAvailable = Math.ceil((earlyJoinTime.getTime() - now.getTime()) / (1000 * 60));
      return {
        available: false,
        reason: `Meeting will be available in ${minutesUntilAvailable} minutes. You can join 15 minutes before the scheduled time.`,
      };
    }

    if (now > lateJoinTime) {
      return {
        available: false,
        reason: 'This meeting has ended and is no longer available.',
      };
    }

    return { available: true };
  }

  isConfigured(): boolean {
    return this.getConfig() !== null;
  }
}

export const streamService = new StreamService();