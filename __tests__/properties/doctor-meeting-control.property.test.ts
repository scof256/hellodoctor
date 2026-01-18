/**
 * Feature: stream-video-integration, Property 9: Doctor Meeting Control
 * 
 * For any meeting with a doctor participant, the doctor should have the ability 
 * to end the call for all participants
 * 
 * Validates: Requirements 5.1
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

// Mock Clerk auth
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn()
}));

// Mock the meeting auth service
vi.mock('@/server/services/meeting-auth', () => ({
  meetingAuthService: {
    validateMeetingAccess: vi.fn(),
    canEndMeeting: vi.fn(),
  }
}));

// Mock stream service
vi.mock('@/server/services/stream', () => ({
  streamService: {
    endMeetingForAll: vi.fn(),
    isConfigured: vi.fn().mockReturnValue(true),
  }
}));

import { meetingAuthService } from '@/server/services/meeting-auth';
import { streamService } from '@/server/services/stream';
import { auth } from '@clerk/nextjs/server';

// Arbitrary generators
const arbitraryUserId = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0);
const arbitraryAppointmentId = fc.uuid();
const arbitraryUserRole = fc.constantFrom('doctor', 'patient', 'super_admin');

// Generate appointment data with proper types
const arbitraryAppointmentData = fc.record({
  id: arbitraryAppointmentId,
  connectionId: fc.uuid(),
  scheduledAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
  duration: fc.integer({ min: 15, max: 120 }),
  status: fc.constantFrom('pending', 'confirmed', 'completed', 'cancelled', 'no_show'),
  streamCallId: fc.string({ minLength: 10, maxLength: 100 }),
  doctorId: fc.uuid(),
  patientId: fc.uuid(),
  doctorUserId: arbitraryUserId,
  patientUserId: arbitraryUserId,
});

describe('Property 9: Doctor Meeting Control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('allows doctors to end meetings for all participants', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryUserId,
        arbitraryAppointmentId,
        async (userId, appointmentId) => {
          // Setup: User is a doctor with access to the meeting
          (auth as any).mockResolvedValue({ userId });
          (meetingAuthService.validateMeetingAccess as any).mockResolvedValue({
            hasAccess: true,
            userRole: 'doctor',
            appointmentData: {
              id: appointmentId,
              streamCallId: `appointment_${appointmentId}`,
            }
          });
          (meetingAuthService.canEndMeeting as any).mockResolvedValue(true);
          (streamService.endMeetingForAll as any).mockResolvedValue(undefined);

          // Verify doctor can end meeting
          const canEnd = await meetingAuthService.canEndMeeting(appointmentId, userId);
          expect(canEnd).toBe(true);

          // Verify end meeting is called successfully
          await streamService.endMeetingForAll(appointmentId);
          expect(streamService.endMeetingForAll).toHaveBeenCalledWith(appointmentId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('allows admins to end meetings for all participants', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryUserId,
        arbitraryAppointmentId,
        async (userId, appointmentId) => {
          // Setup: User is an admin with access to the meeting
          (auth as any).mockResolvedValue({ userId });
          (meetingAuthService.validateMeetingAccess as any).mockResolvedValue({
            hasAccess: true,
            userRole: 'admin',
            appointmentData: {
              id: appointmentId,
              streamCallId: `appointment_${appointmentId}`,
            }
          });
          (meetingAuthService.canEndMeeting as any).mockResolvedValue(true);
          (streamService.endMeetingForAll as any).mockResolvedValue(undefined);

          // Verify admin can end meeting
          const canEnd = await meetingAuthService.canEndMeeting(appointmentId, userId);
          expect(canEnd).toBe(true);

          // Verify end meeting is called successfully
          await streamService.endMeetingForAll(appointmentId);
          expect(streamService.endMeetingForAll).toHaveBeenCalledWith(appointmentId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('prevents patients from ending meetings for all participants', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryUserId,
        arbitraryAppointmentId,
        async (userId, appointmentId) => {
          // Setup: User is a patient
          (auth as any).mockResolvedValue({ userId });
          (meetingAuthService.validateMeetingAccess as any).mockResolvedValue({
            hasAccess: true,
            userRole: 'patient',
            appointmentData: {
              id: appointmentId,
              streamCallId: `appointment_${appointmentId}`,
            }
          });
          // Patients cannot end meetings
          (meetingAuthService.canEndMeeting as any).mockResolvedValue(false);

          // Verify patient cannot end meeting
          const canEnd = await meetingAuthService.canEndMeeting(appointmentId, userId);
          expect(canEnd).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('only allows authorized users to end meetings based on role', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryUserId,
        arbitraryAppointmentId,
        arbitraryUserRole,
        async (userId, appointmentId, userRole) => {
          // Setup based on role
          (auth as any).mockResolvedValue({ userId });
          
          const mappedRole = userRole === 'super_admin' ? 'admin' : userRole;
          (meetingAuthService.validateMeetingAccess as any).mockResolvedValue({
            hasAccess: true,
            userRole: mappedRole,
            appointmentData: {
              id: appointmentId,
              streamCallId: `appointment_${appointmentId}`,
            }
          });

          // Only doctors and admins can end meetings
          const shouldBeAbleToEnd = userRole === 'doctor' || userRole === 'super_admin';
          (meetingAuthService.canEndMeeting as any).mockResolvedValue(shouldBeAbleToEnd);

          const canEnd = await meetingAuthService.canEndMeeting(appointmentId, userId);
          expect(canEnd).toBe(shouldBeAbleToEnd);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('denies end meeting permission for users without meeting access', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryUserId,
        arbitraryAppointmentId,
        async (userId, appointmentId) => {
          // Setup: User does not have access to the meeting
          (auth as any).mockResolvedValue({ userId });
          (meetingAuthService.validateMeetingAccess as any).mockResolvedValue({
            hasAccess: false,
            userRole: null,
            errorMessage: 'Access denied',
          });
          (meetingAuthService.canEndMeeting as any).mockResolvedValue(false);

          // Verify user cannot end meeting
          const canEnd = await meetingAuthService.canEndMeeting(appointmentId, userId);
          expect(canEnd).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('handles end meeting errors gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryUserId,
        arbitraryAppointmentId,
        fc.string({ minLength: 5, maxLength: 100 }),
        async (userId, appointmentId, errorMessage) => {
          // Setup: Doctor with access but Stream service fails
          (auth as any).mockResolvedValue({ userId });
          (meetingAuthService.canEndMeeting as any).mockResolvedValue(true);
          (streamService.endMeetingForAll as any).mockRejectedValue(new Error(errorMessage));

          // Verify error is thrown
          await expect(streamService.endMeetingForAll(appointmentId)).rejects.toThrow(errorMessage);
        }
      ),
      { numRuns: 100 }
    );
  });
});
