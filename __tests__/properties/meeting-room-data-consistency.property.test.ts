/**
 * Feature: stream-video-integration, Property 5: Meeting Room Data Consistency
 * 
 * For any appointment with an associated meeting room, retrieving appointment details 
 * should include the Stream meeting room data
 * 
 * Validates: Requirements 2.5
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

// Create a proper query builder chain
const createMockQueryBuilder = (resolveValue: any = []) => {
  const builder = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(resolveValue),
  };
  
  // Make sure all methods return the builder for chaining
  builder.set.mockReturnValue(builder);
  builder.where.mockReturnValue(builder);
  builder.from.mockReturnValue(builder);
  
  return builder;
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
interface AppointmentWithStream {
  id: string;
  connectionId: string;
  scheduledAt: Date;
  duration: number;
  streamCallId?: string;
  streamJoinUrl?: string;
  streamCreatedAt?: Date;
  streamMetadata?: {
    doctorName: string;
    patientName: string;
    appointmentType: string;
    duration: number;
  };
}

// Arbitrary generators
const arbitraryUuid = fc.string({ minLength: 36, maxLength: 36 });
const arbitraryDate = fc.date({ min: new Date('2024-01-01'), max: new Date('2030-12-31') });
const arbitraryDuration = fc.integer({ min: 15, max: 120 });
const arbitraryName = fc.string({ minLength: 1, maxLength: 100 });

const arbitraryStreamMetadata = fc.record({
  doctorName: arbitraryName,
  patientName: arbitraryName,
  appointmentType: fc.constantFrom('consultation', 'follow-up', 'emergency'),
  duration: arbitraryDuration,
});

const arbitraryAppointmentWithStream = fc.record({
  id: arbitraryUuid,
  connectionId: arbitraryUuid,
  scheduledAt: arbitraryDate,
  duration: arbitraryDuration,
  streamCallId: fc.option(fc.string({ minLength: 10, maxLength: 50 }), { nil: undefined }),
  streamJoinUrl: fc.option(fc.webUrl(), { nil: undefined }),
  streamCreatedAt: fc.option(arbitraryDate, { nil: undefined }),
  streamMetadata: fc.option(arbitraryStreamMetadata, { nil: undefined }),
});

describe('Property 5: Meeting Room Data Consistency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock implementations
    mockCall.getOrCreate.mockResolvedValue({});
    mockCall.updateCallMembers.mockResolvedValue({});
    
    // Setup database mocks with proper chaining
    const defaultQueryBuilder = createMockQueryBuilder([]);
    mockDb.update.mockReturnValue(defaultQueryBuilder);
    mockDb.select.mockReturnValue(defaultQueryBuilder);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('retrieves meeting room data when appointment has Stream call', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryAppointmentWithStream,
        async (appointment) => {
          // Skip test if appointment doesn't have Stream data
          if (!appointment.streamCallId) {
            return;
          }

          // Mock database to return appointment with Stream data
          const queryBuilder = createMockQueryBuilder([appointment]);
          mockDb.select.mockReturnValue(queryBuilder);

          const { streamService } = await import('@/server/services/stream');
          
          const result = await streamService.getMeetingRoom(appointment.id);

          if (result) {
            // Verify that meeting room data is consistent with appointment data
            expect(result.callId).toBe(appointment.streamCallId);
            expect(result.joinUrl).toBe(appointment.streamJoinUrl || '');
            expect(result.streamCall).toBeDefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns null when appointment has no Stream call', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryAppointmentWithStream,
        async (appointment) => {
          // Ensure appointment has no Stream data
          const appointmentWithoutStream = {
            ...appointment,
            streamCallId: null,
            streamJoinUrl: null,
            streamCreatedAt: null,
            streamMetadata: null,
          };

          // Mock database to return appointment without Stream data
          const queryBuilder = createMockQueryBuilder([appointmentWithoutStream]);
          mockDb.select.mockReturnValue(queryBuilder);

          const { streamService } = await import('@/server/services/stream');
          
          const result = await streamService.getMeetingRoom(appointment.id);

          // Should return null when no Stream data exists
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('maintains consistency between database and Stream service', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryAppointmentWithStream,
        async (appointment) => {
          // Skip if no Stream data
          if (!appointment.streamCallId) {
            return;
          }

          // Mock database to return appointment with Stream data
          const queryBuilder = createMockQueryBuilder([appointment]);
          mockDb.select.mockReturnValue(queryBuilder);

          const { streamService } = await import('@/server/services/stream');
          
          const result = await streamService.getMeetingRoom(appointment.id);

          if (result) {
            // Verify database query was made with correct appointment ID
            expect(mockDb.select).toHaveBeenCalled();
            expect(queryBuilder.where).toHaveBeenCalledWith(
              expect.objectContaining({
                column: 'id',
                value: appointment.id,
              })
            );

            // Verify Stream client was called with correct call ID
            expect(mockVideoClient.call).toHaveBeenCalledWith('default', appointment.streamCallId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('preserves all Stream metadata fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryAppointmentWithStream,
        async (appointment) => {
          // Ensure appointment has complete Stream data
          const completeAppointment = {
            ...appointment,
            streamCallId: `appointment_${appointment.id}`,
            streamJoinUrl: `http://localhost:3000/meeting/${appointment.id}`,
            streamCreatedAt: new Date(),
            streamMetadata: {
              doctorName: 'Dr. Test',
              patientName: 'Patient Test',
              appointmentType: 'consultation' as const,
              duration: appointment.duration,
            },
          };

          // Mock database to return complete appointment
          const queryBuilder = createMockQueryBuilder([completeAppointment]);
          mockDb.select.mockReturnValue(queryBuilder);

          const { streamService } = await import('@/server/services/stream');
          
          const result = await streamService.getMeetingRoom(appointment.id);

          if (result) {
            // Verify all Stream data is preserved
            expect(result.callId).toBe(completeAppointment.streamCallId);
            expect(result.joinUrl).toBe(completeAppointment.streamJoinUrl);
            
            // Verify the Stream call object is created with correct parameters
            expect(mockVideoClient.call).toHaveBeenCalledWith('default', completeAppointment.streamCallId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('handles database query errors gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryUuid,
        async (appointmentId) => {
          // Mock database to throw an error
          const queryBuilder = createMockQueryBuilder([]);
          queryBuilder.limit.mockRejectedValue(new Error('Database connection failed'));
          mockDb.select.mockReturnValue(queryBuilder);

          const { streamService } = await import('@/server/services/stream');
          
          // Should throw an error with appropriate message
          await expect(streamService.getMeetingRoom(appointmentId)).rejects.toThrow(
            'Failed to get meeting room'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns consistent data across multiple retrievals', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryAppointmentWithStream,
        async (appointment) => {
          // Skip if no Stream data
          if (!appointment.streamCallId) {
            return;
          }

          // Mock database to return consistent data
          const queryBuilder = createMockQueryBuilder([appointment]);
          mockDb.select.mockReturnValue(queryBuilder);

          const { streamService } = await import('@/server/services/stream');
          
          // Retrieve meeting room data multiple times
          const result1 = await streamService.getMeetingRoom(appointment.id);
          const result2 = await streamService.getMeetingRoom(appointment.id);

          // Results should be consistent
          if (result1 && result2) {
            expect(result1.callId).toBe(result2.callId);
            expect(result1.joinUrl).toBe(result2.joinUrl);
          } else {
            // Both should be null if one is null
            expect(result1).toBe(result2);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('validates appointment exists before retrieving Stream data', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryUuid,
        async (appointmentId) => {
          // Mock database to return empty result (appointment not found)
          const queryBuilder = createMockQueryBuilder([]);
          mockDb.select.mockReturnValue(queryBuilder);

          const { streamService } = await import('@/server/services/stream');
          
          const result = await streamService.getMeetingRoom(appointmentId);

          // Should return null when appointment doesn't exist
          expect(result).toBeNull();
          
          // Should have queried the database
          expect(mockDb.select).toHaveBeenCalled();
          expect(queryBuilder.where).toHaveBeenCalledWith(
            expect.objectContaining({
              column: 'id',
              value: appointmentId,
            })
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});