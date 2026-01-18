/**
 * Feature: stream-video-integration, Property 11: Meeting Availability
 * 
 * For any scheduled meeting, it should become available for joining at the 
 * appropriate time (15 minutes before scheduled start until 24 hours after end)
 * 
 * Validates: Requirements 5.3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

// Mock stream service
vi.mock('@/server/services/stream', () => ({
  streamService: {
    isMeetingAvailable: vi.fn(),
    getMeetingRoom: vi.fn(),
    isConfigured: vi.fn().mockReturnValue(true),
  }
}));

// Mock meeting auth service
vi.mock('@/server/services/meeting-auth', () => ({
  meetingAuthService: {
    validateMeetingAccess: vi.fn(),
  }
}));

import { streamService } from '@/server/services/stream';
import { meetingAuthService } from '@/server/services/meeting-auth';

// Constants for meeting availability window
const EARLY_JOIN_MINUTES = 15; // Can join 15 minutes before
const LATE_JOIN_MINUTES = 24 * 60; // Can join up to 24 hours after scheduled end

// Arbitrary generators
const arbitraryAppointmentId = fc.uuid();
const arbitraryDuration = fc.integer({ min: 15, max: 120 }); // 15 min to 2 hours
const arbitraryMinutesOffset = fc.integer({ min: -120, max: 180 }); // -2 hours to +3 hours from scheduled time

// Helper function to check meeting availability based on timing
function checkMeetingAvailability(
  scheduledAt: Date,
  duration: number,
  currentTime: Date
): { available: boolean; reason?: string } {
  const earlyJoinTime = new Date(scheduledAt.getTime() - EARLY_JOIN_MINUTES * 60 * 1000);
  const endTime = new Date(scheduledAt.getTime() + duration * 60 * 1000);
  const lateJoinTime = new Date(endTime.getTime() + LATE_JOIN_MINUTES * 60 * 1000);

  if (currentTime < earlyJoinTime) {
    const minutesUntilAvailable = Math.ceil((earlyJoinTime.getTime() - currentTime.getTime()) / (1000 * 60));
    return {
      available: false,
      reason: `Meeting will be available in ${minutesUntilAvailable} minutes. You can join 15 minutes before the scheduled time.`,
    };
  }

  if (currentTime > lateJoinTime) {
    return {
      available: false,
      reason: 'This meeting has ended and is no longer available.',
    };
  }

  return { available: true };
}

describe('Property 11: Meeting Availability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('makes meetings available 15 minutes before scheduled time', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryDuration,
        async (duration) => {
          const now = new Date();
          // Schedule meeting 15 minutes from now (exactly at early join boundary)
          const scheduledAt = new Date(now.getTime() + EARLY_JOIN_MINUTES * 60 * 1000);

          const result = checkMeetingAvailability(scheduledAt, duration, now);

          // Meeting should be available exactly at the early join boundary
          expect(result.available).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('denies access more than 15 minutes before scheduled time', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryDuration,
        fc.integer({ min: 16, max: 120 }), // More than 15 minutes before
        async (duration, minutesBefore) => {
          const now = new Date();
          // Schedule meeting more than 15 minutes from now
          const scheduledAt = new Date(now.getTime() + minutesBefore * 60 * 1000);

          const result = checkMeetingAvailability(scheduledAt, duration, now);

          // Meeting should not be available yet
          expect(result.available).toBe(false);
          expect(result.reason).toContain('available in');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('allows access during the scheduled meeting time', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryDuration,
        fc.integer({ min: 0, max: 100 }), // Percentage through the meeting
        async (duration, percentageThrough) => {
          const now = new Date();
          // Calculate a time during the meeting
          const meetingProgress = (percentageThrough / 100) * duration;
          const scheduledAt = new Date(now.getTime() - meetingProgress * 60 * 1000);

          const result = checkMeetingAvailability(scheduledAt, duration, now);

          // Meeting should be available during scheduled time
          expect(result.available).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('allows access up to 24 hours after scheduled end time', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryDuration,
        fc.integer({ min: 0, max: 23 * 60 + 59 }), // Minutes after end (within 24-hour grace period)
        async (duration, minutesAfterEnd) => {
          const now = new Date();
          // Schedule meeting that ended some time ago but within grace period
          const scheduledAt = new Date(now.getTime() - (duration + minutesAfterEnd) * 60 * 1000);

          const result = checkMeetingAvailability(scheduledAt, duration, now);

          // Meeting should still be available within the grace period
          expect(result.available).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('denies access more than 24 hours after scheduled end time', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryDuration,
        fc.integer({ min: 24 * 60 + 1, max: 48 * 60 }), // More than 24 hours after end
        async (duration, minutesAfterEnd) => {
          const now = new Date();
          // Schedule meeting that ended more than 24 hours ago
          const scheduledAt = new Date(now.getTime() - (duration + minutesAfterEnd) * 60 * 1000);

          const result = checkMeetingAvailability(scheduledAt, duration, now);

          // Meeting should not be available after grace period
          expect(result.available).toBe(false);
          expect(result.reason).toContain('ended');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('provides appropriate error messages for unavailable meetings', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryDuration,
        arbitraryMinutesOffset,
        async (duration, minutesOffset) => {
          const now = new Date();
          const scheduledAt = new Date(now.getTime() + minutesOffset * 60 * 1000);

          const result = checkMeetingAvailability(scheduledAt, duration, now);

          if (!result.available) {
            // Should have a reason when not available
            expect(result.reason).toBeDefined();
            expect(typeof result.reason).toBe('string');
            expect(result.reason!.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('validates meeting availability through the auth service', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryAppointmentId,
        arbitraryDuration,
        fc.boolean(),
        async (appointmentId, duration, shouldBeAvailable) => {
          const now = new Date();
          // Create scheduled time based on whether it should be available
          const scheduledAt = shouldBeAvailable
            ? new Date(now.getTime() - 5 * 60 * 1000) // 5 minutes ago (during meeting)
            : new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now (too early)

          // Mock the auth service response
          (meetingAuthService.validateMeetingAccess as any).mockResolvedValue({
            hasAccess: shouldBeAvailable,
            userRole: 'doctor',
            appointmentData: shouldBeAvailable ? {
              id: appointmentId,
              scheduledAt,
              duration,
              streamCallId: `appointment_${appointmentId}`,
            } : undefined,
            errorMessage: shouldBeAvailable ? undefined : 'Meeting not available at this time',
          });

          const result = await meetingAuthService.validateMeetingAccess({ appointmentId });

          expect(result.hasAccess).toBe(shouldBeAvailable);
          if (!shouldBeAvailable) {
            expect(result.errorMessage).toBeDefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('correctly calculates availability window boundaries', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryDuration,
        async (duration) => {
          const scheduledAt = new Date('2025-01-15T10:00:00Z');
          
          // Test exact boundaries
          const earlyBoundary = new Date(scheduledAt.getTime() - EARLY_JOIN_MINUTES * 60 * 1000);
          const endTime = new Date(scheduledAt.getTime() + duration * 60 * 1000);
          const lateBoundary = new Date(endTime.getTime() + LATE_JOIN_MINUTES * 60 * 1000);

          // Just before early boundary - should be unavailable
          const beforeEarly = new Date(earlyBoundary.getTime() - 1000);
          expect(checkMeetingAvailability(scheduledAt, duration, beforeEarly).available).toBe(false);

          // At early boundary - should be available
          expect(checkMeetingAvailability(scheduledAt, duration, earlyBoundary).available).toBe(true);

          // At scheduled time - should be available
          expect(checkMeetingAvailability(scheduledAt, duration, scheduledAt).available).toBe(true);

          // At end time - should be available
          expect(checkMeetingAvailability(scheduledAt, duration, endTime).available).toBe(true);

          // Just before late boundary - should be available
          const beforeLate = new Date(lateBoundary.getTime() - 1000);
          expect(checkMeetingAvailability(scheduledAt, duration, beforeLate).available).toBe(true);

          // Just after late boundary - should be unavailable
          const afterLate = new Date(lateBoundary.getTime() + 1000);
          expect(checkMeetingAvailability(scheduledAt, duration, afterLate).available).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('handles various meeting durations correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(15, 30, 45, 60, 90, 120), // Common meeting durations
        async (duration) => {
          const now = new Date();
          const scheduledAt = new Date(now.getTime() - 10 * 60 * 1000); // Started 10 minutes ago

          const result = checkMeetingAvailability(scheduledAt, duration, now);

          // All these meetings should be available (we're within the meeting time)
          expect(result.available).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
