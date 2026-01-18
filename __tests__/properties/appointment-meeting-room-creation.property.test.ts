/**
 * Feature: stream-video-integration, Property 4: Appointment Meeting Room Creation
 * 
 * For any appointment creation, the system should create a corresponding Stream meeting room 
 * with the appointment ID as call identifier, matching start times, and including appointment metadata
 * 
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

// Mock Stream SDK
const mockCall = {
  getOrCreate: vi.fn(),
  updateCallMembers: vi.fn(),
  update: vi.fn(),
  end: vi.fn(),
};

const mockVideoClient = {
  call: vi.fn().mockReturnValue(mockCall),
};

const mockStreamClient = {
  video: mockVideoClient,
  generateUserToken: vi.fn(),
};

// Mock database
const mockDb = {
  update: vi.fn(),
  select: vi.fn(),
};

const mockQueryBuilder = {
  set: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
};

// Mock environment
vi.mock('@stream-io/node-sdk', () => ({
  StreamClient: vi.fn().mockImplementation(() => mockStreamClient),
}));

vi.mock('@/env', () => ({
  env: {
    STREAM_API_KEY: 'test-api-key',
    STREAM_SECRET_KEY: 'test-secret-key',
  },
}));

vi.mock('@/server/db', () => ({
  db: mockDb,
}));

vi.mock('@/server/db/schema', () => ({
  appointments: {
    id: 'id',
    streamCallId: 'streamCallId',
    streamJoinUrl: 'streamJoinUrl',
    streamCreatedAt: 'streamCreatedAt',
    streamMetadata: 'streamMetadata',
    updatedAt: 'updatedAt',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((column, value) => ({ column, value })),
}));

// Types for testing
interface CreateMeetingRoomParams {
  appointmentId: string;
  doctorId: string;
  patientId: string;
  scheduledAt: Date;
  duration: number;
  doctorName?: string;
  patientName?: string;
}

// Arbitrary generators
const arbitraryUuid = fc.string({ minLength: 36, maxLength: 36 });
const arbitraryDate = fc.date({ min: new Date('2024-01-01'), max: new Date('2030-12-31') });
const arbitraryDuration = fc.integer({ min: 15, max: 120 });
const arbitraryName = fc.string({ minLength: 1, maxLength: 100 });

const arbitraryMeetingRoomParams = fc.record({
  appointmentId: arbitraryUuid,
  doctorId: arbitraryUuid,
  patientId: arbitraryUuid,
  scheduledAt: arbitraryDate,
  duration: arbitraryDuration,
  doctorName: fc.option(arbitraryName, { nil: undefined }),
  patientName: fc.option(arbitraryName, { nil: undefined }),
});

describe('Property 4: Appointment Meeting Room Creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock implementations
    mockCall.getOrCreate.mockResolvedValue({});
    mockCall.updateCallMembers.mockResolvedValue({});
    mockDb.update.mockReturnValue(mockQueryBuilder);
    mockDb.select.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.where.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('creates meeting room with appointment ID as call identifier', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryMeetingRoomParams,
        async (params) => {
          // Import the service after mocks are set up
          const { streamService } = await import('@/server/services/stream');
          
          const result = await streamService.createMeetingRoom(params);

          // Verify call ID follows the expected pattern
          expect(result.callId).toBe(`appointment_${params.appointmentId}`);
          expect(result.callId).toContain(params.appointmentId);
          expect(result.callId).toMatch(/^appointment_/);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('creates meeting room with matching start times', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryMeetingRoomParams,
        async (params) => {
          const { streamService } = await import('@/server/services/stream');
          
          await streamService.createMeetingRoom(params);

          // Verify that Stream call was created with the correct start time
          expect(mockCall.getOrCreate).toHaveBeenCalledWith(
            expect.objectContaining({
              data: expect.objectContaining({
                starts_at: params.scheduledAt,
              }),
            })
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('includes appointment metadata in meeting room', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryMeetingRoomParams,
        async (params) => {
          const { streamService } = await import('@/server/services/stream');
          
          await streamService.createMeetingRoom(params);

          // Verify metadata is included in the Stream call
          expect(mockCall.getOrCreate).toHaveBeenCalledWith(
            expect.objectContaining({
              data: expect.objectContaining({
                custom: expect.objectContaining({
                  appointmentId: params.appointmentId,
                  doctorName: params.doctorName || 'Doctor',
                  patientName: params.patientName || 'Patient',
                  appointmentType: 'consultation',
                  duration: params.duration,
                }),
              }),
            })
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('updates appointment record with Stream data', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryMeetingRoomParams,
        async (params) => {
          const { streamService } = await import('@/server/services/stream');
          
          await streamService.createMeetingRoom(params);

          // Verify database update was called with correct Stream data
          expect(mockQueryBuilder.set).toHaveBeenCalledWith(
            expect.objectContaining({
              streamCallId: `appointment_${params.appointmentId}`,
              streamJoinUrl: expect.stringContaining(params.appointmentId),
              streamCreatedAt: expect.any(Date),
              streamMetadata: expect.objectContaining({
                doctorName: params.doctorName || 'Doctor',
                patientName: params.patientName || 'Patient',
                appointmentType: 'consultation',
                duration: params.duration,
              }),
              updatedAt: expect.any(Date),
            })
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('adds participants with correct roles', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryMeetingRoomParams,
        async (params) => {
          const { streamService } = await import('@/server/services/stream');
          
          await streamService.createMeetingRoom(params);

          // Verify participants are added with correct roles
          expect(mockCall.updateCallMembers).toHaveBeenCalledWith({
            update_members: expect.arrayContaining([
              expect.objectContaining({
                user_id: params.doctorId,
                role: 'admin', // Doctor should get admin role
              }),
            ]),
          });

          expect(mockCall.updateCallMembers).toHaveBeenCalledWith({
            update_members: expect.arrayContaining([
              expect.objectContaining({
                user_id: params.patientId,
                role: 'user', // Patient should get user role
              }),
            ]),
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('generates consistent join URLs', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryMeetingRoomParams,
        async (params) => {
          const { streamService } = await import('@/server/services/stream');
          
          const result = await streamService.createMeetingRoom(params);

          // Verify join URL follows expected pattern
          expect(result.joinUrl).toContain(params.appointmentId);
          expect(result.joinUrl).toMatch(/^https?:\/\/.+\/meeting\//);
          
          // Verify it's the expected URL format
          const expectedUrl = `http://localhost:3000/meeting/${params.appointmentId}`;
          expect(result.joinUrl).toBe(expectedUrl);
        }
      ),
      { numRuns: 100 }
    );
  });
});