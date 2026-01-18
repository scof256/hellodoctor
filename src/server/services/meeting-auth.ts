import { auth } from '@clerk/nextjs/server';
import { db } from '@/server/db';
import { appointments, connections, doctors, patients, users } from '@/server/db/schema';
import { eq } from 'drizzle-orm';

export interface MeetingAccessResult {
  hasAccess: boolean;
  userRole: 'doctor' | 'patient' | 'admin' | null;
  appointmentData?: {
    id: string;
    connectionId: string;
    scheduledAt: Date;
    duration: number;
    status: string;
    streamCallId: string | null;
    doctorId: string;
    patientId: string;
    doctorUserId: string;
    patientUserId: string;
  };
  errorMessage?: string;
}

export interface ValidateMeetingAccessParams {
  appointmentId: string;
  userId?: string; // Optional - if not provided, will get from Clerk auth
}

class MeetingAuthService {
  /**
   * Validates if a user has access to join a specific meeting
   * Requirements: 4.1, 4.2, 4.3, 4.4
   */
  async validateMeetingAccess(params: ValidateMeetingAccessParams): Promise<MeetingAccessResult> {
    try {
      // Get user ID from Clerk auth if not provided
      let userId = params.userId;
      if (!userId) {
        const { userId: clerkUserId } = await auth();
        if (!clerkUserId) {
          return {
            hasAccess: false,
            userRole: null,
            errorMessage: 'Authentication required. Please sign in to join the meeting.',
          };
        }
        userId = clerkUserId;
      }

      // Get user data and check if they exist in our system
      const userData = await db
        .select({
          id: users.id,
          clerkId: users.clerkId,
          primaryRole: users.primaryRole,
          isActive: users.isActive,
        })
        .from(users)
        .where(eq(users.clerkId, userId))
        .limit(1);

      if (!userData.length || !userData[0]?.isActive) {
        return {
          hasAccess: false,
          userRole: null,
          errorMessage: 'User account not found or inactive. Please contact support.',
        };
      }

      const user = userData[0];

      // Get appointment data with all related information
      const appointmentResult = await db
        .select({
          // Appointment fields
          id: appointments.id,
          connectionId: appointments.connectionId,
          scheduledAt: appointments.scheduledAt,
          duration: appointments.duration,
          status: appointments.status,
          streamCallId: appointments.streamCallId,
          // Connection fields
          connectionPatientId: connections.patientId,
          connectionDoctorId: connections.doctorId,
          connectionStatus: connections.status,
          // Doctor fields
          doctorId: doctors.id,
          doctorUserId: doctors.userId,
          // Patient fields
          patientId: patients.id,
          patientUserId: patients.userId,
        })
        .from(appointments)
        .innerJoin(connections, eq(appointments.connectionId, connections.id))
        .innerJoin(doctors, eq(connections.doctorId, doctors.id))
        .innerJoin(patients, eq(connections.patientId, patients.id))
        .where(eq(appointments.id, params.appointmentId))
        .limit(1);

      if (!appointmentResult.length) {
        return {
          hasAccess: false,
          userRole: null,
          errorMessage: 'Meeting not found. Please check the meeting link.',
        };
      }

      const appointment = appointmentResult[0]!;

      // Check if the appointment is an online appointment
      // Note: streamCallId may be null if the meeting room creation failed during booking
      // The meeting page will create the call on-demand if needed
      if (!appointment.streamCallId) {
        // For online appointments without a streamCallId, we'll allow access
        // and let the meeting page create the call on-demand
        console.log('[MeetingAuth] No streamCallId found, will create on-demand');
      }

      // Check if the connection is active
      if (appointment.connectionStatus !== 'active') {
        return {
          hasAccess: false,
          userRole: null,
          errorMessage: 'This connection is no longer active. Please contact support.',
        };
      }

      // Check if appointment is cancelled
      if (appointment.status === 'cancelled') {
        return {
          hasAccess: false,
          userRole: null,
          errorMessage: 'This meeting has been cancelled.',
        };
      }

      // Determine user role and access permissions
      const isPatient = user.id === appointment.patientUserId;
      const isDoctor = user.id === appointment.doctorUserId;
      const isAdmin = user.primaryRole === 'super_admin';

      if (!isPatient && !isDoctor && !isAdmin) {
        return {
          hasAccess: false,
          userRole: null,
          errorMessage: 'You are not authorized to join this meeting. Only the doctor and patient can participate.',
        };
      }

      // Check meeting timing (allow joining 15 minutes before scheduled time)
      const now = new Date();
      const scheduledTime = new Date(appointment.scheduledAt);
      const earlyJoinTime = new Date(scheduledTime.getTime() - 15 * 60 * 1000); // 15 minutes before
      const endTime = new Date(scheduledTime.getTime() + appointment.duration * 60 * 1000);

      if (now < earlyJoinTime) {
        const timeUntilAvailable = Math.ceil((earlyJoinTime.getTime() - now.getTime()) / (1000 * 60));
        return {
          hasAccess: false,
          userRole: isDoctor ? 'doctor' : isPatient ? 'patient' : 'admin',
          errorMessage: `Meeting will be available in ${timeUntilAvailable} minutes. You can join 15 minutes before the scheduled time.`,
        };
      }

      // Allow joining up to 24 hours after scheduled end time for flexibility
      // This allows doctors and patients to have follow-up discussions
      const lateJoinTime = new Date(endTime.getTime() + 24 * 60 * 60 * 1000); // 24 hours after end
      
      // If the meeting time has passed beyond the 24-hour window, automatically reactivate it
      // by updating the scheduled time to now (allowing immediate access)
      if (now > lateJoinTime) {
        // Auto-reactivate: Update the appointment's scheduled time to current time
        // This allows users to join meetings even if the original time has passed
        console.log('[MeetingAuth] Meeting time expired, auto-reactivating appointment to current time');
        
        const newScheduledAt = new Date();
        await db
          .update(appointments)
          .set({
            scheduledAt: newScheduledAt,
            status: 'confirmed', // Ensure status allows joining
            updatedAt: new Date(),
          })
          .where(eq(appointments.id, params.appointmentId));
        
        // Update the appointment object with new scheduled time for the response
        appointment.scheduledAt = newScheduledAt;
      }

      // User has access
      return {
        hasAccess: true,
        userRole: isDoctor ? 'doctor' : isPatient ? 'patient' : 'admin',
        appointmentData: {
          id: appointment.id,
          connectionId: appointment.connectionId,
          scheduledAt: appointment.scheduledAt,
          duration: appointment.duration,
          status: appointment.status,
          // Use existing streamCallId or generate one based on appointment ID
          streamCallId: appointment.streamCallId || `appointment_${appointment.id}`,
          doctorId: appointment.doctorId,
          patientId: appointment.patientId,
          doctorUserId: appointment.doctorUserId,
          patientUserId: appointment.patientUserId,
        },
      };
    } catch (error) {
      console.error('Meeting access validation failed:', error);
      return {
        hasAccess: false,
        userRole: null,
        errorMessage: 'Unable to validate meeting access. Please try again or contact support.',
      };
    }
  }

  /**
   * Validates Stream token generation permissions for a specific meeting
   * Requirements: 4.2, 4.5
   */
  async validateTokenPermissions(params: ValidateMeetingAccessParams): Promise<MeetingAccessResult> {
    // Use the same validation logic as meeting access
    const accessResult = await this.validateMeetingAccess(params);
    
    if (!accessResult.hasAccess) {
      return accessResult;
    }

    // Additional token-specific validations can be added here
    // For now, if user has meeting access, they can get a token
    return accessResult;
  }

  /**
   * Gets redirect path based on user role for unauthorized access
   * Requirements: 4.4
   */
  getUnauthorizedRedirectPath(userRole: string | null): string {
    switch (userRole) {
      case 'doctor':
        return '/doctor/appointments';
      case 'patient':
        return '/patient/appointments';
      case 'admin':
        return '/admin';
      default:
        return '/sign-in';
    }
  }

  /**
   * Checks if a user is authorized to end a meeting (doctors and admins only)
   * Requirements: 5.1
   */
  async canEndMeeting(appointmentId: string, userId?: string): Promise<boolean> {
    const accessResult = await this.validateMeetingAccess({ appointmentId, userId });
    
    if (!accessResult.hasAccess) {
      return false;
    }

    // Only doctors and admins can end meetings
    return accessResult.userRole === 'doctor' || accessResult.userRole === 'admin';
  }
}

export const meetingAuthService = new MeetingAuthService();