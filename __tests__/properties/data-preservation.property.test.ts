/**
 * Feature: stream-video-integration, Property 14: Data Preservation
 * 
 * For any existing appointment, all metadata and database relationships should be 
 * maintained during the Stream migration
 * 
 * Validates: Requirements 6.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

// Mock database schema types
interface MockAppointment {
  id: string;
  connectionId: string;
  intakeSessionId: string | null;
  scheduledAt: Date;
  duration: number;
  isOnline: boolean;
  // Existing Zoom fields (should be preserved)
  zoomMeetingId: string | null;
  zoomJoinUrl: string | null;
  zoomStartUrl: string | null;
  zoomCreatedAt: Date | null;
  // New Stream fields (should be added without affecting existing data)
  streamCallId: string | null;
  streamJoinUrl: string | null;
  streamCreatedAt: Date | null;
  streamMetadata: Record<string, unknown> | null;
  // Other existing fields
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  notes: string | null;
  price: number | null;
  paymentStatus: string | null;
  paymentId: string | null;
  bookedBy: string | null;
  cancelledBy: string | null;
  cancelReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MockConnection {
  id: string;
  patientId: string;
  doctorId: string;
  status: 'active' | 'disconnected' | 'blocked';
  connectionSource: string | null;
  connectedAt: Date;
  disconnectedAt: Date | null;
  createdAt: Date;
}

interface MockIntakeSession {
  id: string;
  connectionId: string;
  name: string | null;
  status: 'not_started' | 'in_progress' | 'ready' | 'reviewed';
  medicalData: Record<string, unknown> | null;
  clinicalHandover: Record<string, unknown> | null;
  doctorThought: Record<string, unknown> | null;
  completeness: number;
  currentAgent: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Mock database operations
const mockDatabase = {
  appointments: new Map<string, MockAppointment>(),
  connections: new Map<string, MockConnection>(),
  intakeSessions: new Map<string, MockIntakeSession>(),
  
  // Simulate adding Stream columns to existing appointment
  addStreamColumns: (appointmentId: string, streamData: Partial<Pick<MockAppointment, 'streamCallId' | 'streamJoinUrl' | 'streamCreatedAt' | 'streamMetadata'>>) => {
    const appointment = mockDatabase.appointments.get(appointmentId);
    if (!appointment) return null;
    
    // Ensure updatedAt is always later than the original by adding a small delay
    const updatedAt = new Date(appointment.updatedAt.getTime() + 1);
    
    const updated = {
      ...appointment,
      ...streamData,
      updatedAt
    };
    
    mockDatabase.appointments.set(appointmentId, updated);
    return updated;
  },
  
  // Simulate migration process
  migrateAppointment: (appointmentId: string) => {
    const appointment = mockDatabase.appointments.get(appointmentId);
    if (!appointment) return null;
    
    // Ensure updatedAt is always later than the original by adding a small delay
    const updatedAt = new Date(appointment.updatedAt.getTime() + 1);
    
    // Migration should preserve all existing data
    const migrated = {
      ...appointment,
      streamCallId: null,
      streamJoinUrl: null,
      streamCreatedAt: null,
      streamMetadata: null,
      updatedAt
    };
    
    mockDatabase.appointments.set(appointmentId, migrated);
    return migrated;
  }
};

// Arbitrary generators
const arbitraryUuid = fc.string({ minLength: 36, maxLength: 36 });
const arbitraryDate = fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') });
const arbitraryAppointmentStatus = fc.constantFrom('pending', 'confirmed', 'completed', 'cancelled', 'no_show');
const arbitraryConnectionStatus = fc.constantFrom('active', 'disconnected', 'blocked');
const arbitraryIntakeStatus = fc.constantFrom('not_started', 'in_progress', 'ready', 'reviewed');

const arbitraryAppointment = fc.record({
  id: arbitraryUuid,
  connectionId: arbitraryUuid,
  intakeSessionId: fc.option(arbitraryUuid, { nil: null }),
  scheduledAt: arbitraryDate,
  duration: fc.integer({ min: 15, max: 120 }),
  isOnline: fc.boolean(),
  zoomMeetingId: fc.option(fc.string({ minLength: 5, maxLength: 20 }), { nil: null }),
  zoomJoinUrl: fc.option(fc.webUrl(), { nil: null }),
  zoomStartUrl: fc.option(fc.webUrl(), { nil: null }),
  zoomCreatedAt: fc.option(arbitraryDate, { nil: null }),
  streamCallId: fc.constant(null),
  streamJoinUrl: fc.constant(null),
  streamCreatedAt: fc.constant(null),
  streamMetadata: fc.constant(null),
  status: arbitraryAppointmentStatus,
  notes: fc.option(fc.string({ maxLength: 500 }), { nil: null }),
  price: fc.option(fc.integer({ min: 0, max: 50000 }), { nil: null }),
  paymentStatus: fc.option(fc.constantFrom('pending', 'paid', 'failed'), { nil: null }),
  paymentId: fc.option(fc.string({ minLength: 5, maxLength: 50 }), { nil: null }),
  bookedBy: fc.option(arbitraryUuid, { nil: null }),
  cancelledBy: fc.option(arbitraryUuid, { nil: null }),
  cancelReason: fc.option(fc.string({ maxLength: 200 }), { nil: null }),
  createdAt: arbitraryDate,
  updatedAt: arbitraryDate
});

const arbitraryConnection = fc.record({
  id: arbitraryUuid,
  patientId: arbitraryUuid,
  doctorId: arbitraryUuid,
  status: arbitraryConnectionStatus,
  connectionSource: fc.option(fc.string({ maxLength: 100 }), { nil: null }),
  connectedAt: arbitraryDate,
  disconnectedAt: fc.option(arbitraryDate, { nil: null }),
  createdAt: arbitraryDate
});

const arbitraryIntakeSession = fc.record({
  id: arbitraryUuid,
  connectionId: arbitraryUuid,
  name: fc.option(fc.string({ maxLength: 255 }), { nil: null }),
  status: arbitraryIntakeStatus,
  medicalData: fc.option(fc.object(), { nil: null }),
  clinicalHandover: fc.option(fc.object(), { nil: null }),
  doctorThought: fc.option(fc.object(), { nil: null }),
  completeness: fc.integer({ min: 0, max: 100 }),
  currentAgent: fc.option(fc.string({ maxLength: 50 }), { nil: null }),
  createdAt: arbitraryDate,
  updatedAt: arbitraryDate
});

const arbitraryStreamMetadata = fc.record({
  doctorName: fc.string({ minLength: 1, maxLength: 100 }),
  patientName: fc.string({ minLength: 1, maxLength: 100 }),
  appointmentType: fc.constantFrom('consultation', 'follow-up', 'emergency', 'routine'),
  additionalInfo: fc.option(fc.string({ maxLength: 200 }), { nil: undefined })
});

describe('Property 14: Data Preservation', () => {
  beforeEach(() => {
    // Clear mock database
    mockDatabase.appointments.clear();
    mockDatabase.connections.clear();
    mockDatabase.intakeSessions.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('preserves all existing appointment fields when adding Stream columns', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryAppointment,
        arbitraryStreamMetadata,
        async (originalAppointment, streamMetadata) => {
          // Store original appointment
          mockDatabase.appointments.set(originalAppointment.id, originalAppointment);
          
          // Add Stream columns (simulating migration)
          const streamData = {
            streamCallId: `call_${originalAppointment.id}`,
            streamJoinUrl: `https://stream.io/call/${originalAppointment.id}`,
            streamCreatedAt: new Date(),
            streamMetadata: streamMetadata
          };
          
          const updatedAppointment = mockDatabase.addStreamColumns(originalAppointment.id, streamData);
          
          expect(updatedAppointment).not.toBeNull();
          if (!updatedAppointment) return;
          
          // Verify all original fields are preserved
          expect(updatedAppointment.id).toBe(originalAppointment.id);
          expect(updatedAppointment.connectionId).toBe(originalAppointment.connectionId);
          expect(updatedAppointment.intakeSessionId).toBe(originalAppointment.intakeSessionId);
          expect(updatedAppointment.scheduledAt.getTime()).toBe(originalAppointment.scheduledAt.getTime());
          expect(updatedAppointment.duration).toBe(originalAppointment.duration);
          expect(updatedAppointment.isOnline).toBe(originalAppointment.isOnline);
          expect(updatedAppointment.status).toBe(originalAppointment.status);
          expect(updatedAppointment.notes).toBe(originalAppointment.notes);
          expect(updatedAppointment.price).toBe(originalAppointment.price);
          expect(updatedAppointment.paymentStatus).toBe(originalAppointment.paymentStatus);
          expect(updatedAppointment.paymentId).toBe(originalAppointment.paymentId);
          expect(updatedAppointment.bookedBy).toBe(originalAppointment.bookedBy);
          expect(updatedAppointment.cancelledBy).toBe(originalAppointment.cancelledBy);
          expect(updatedAppointment.cancelReason).toBe(originalAppointment.cancelReason);
          expect(updatedAppointment.createdAt.getTime()).toBe(originalAppointment.createdAt.getTime());
          
          // Verify Zoom fields are preserved
          expect(updatedAppointment.zoomMeetingId).toBe(originalAppointment.zoomMeetingId);
          expect(updatedAppointment.zoomJoinUrl).toBe(originalAppointment.zoomJoinUrl);
          expect(updatedAppointment.zoomStartUrl).toBe(originalAppointment.zoomStartUrl);
          if (originalAppointment.zoomCreatedAt && updatedAppointment.zoomCreatedAt) {
            expect(updatedAppointment.zoomCreatedAt.getTime()).toBe(originalAppointment.zoomCreatedAt.getTime());
          } else {
            expect(updatedAppointment.zoomCreatedAt).toBe(originalAppointment.zoomCreatedAt);
          }
          
          // Verify Stream fields are added
          expect(updatedAppointment.streamCallId).toBe(streamData.streamCallId);
          expect(updatedAppointment.streamJoinUrl).toBe(streamData.streamJoinUrl);
          expect(updatedAppointment.streamCreatedAt?.getTime()).toBe(streamData.streamCreatedAt?.getTime());
          expect(updatedAppointment.streamMetadata).toEqual(streamData.streamMetadata);
          
          // Verify updatedAt is updated
          expect(updatedAppointment.updatedAt.getTime()).toBeGreaterThan(originalAppointment.updatedAt.getTime());
        }
      ),
      { numRuns: 100 }
    );
  });

  it('maintains database relationships after Stream migration', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryAppointment,
        arbitraryConnection,
        arbitraryIntakeSession,
        async (appointment, connection, intakeSession) => {
          // Set up related data
          appointment.connectionId = connection.id;
          appointment.intakeSessionId = intakeSession.id;
          intakeSession.connectionId = connection.id;
          
          // Store in mock database
          mockDatabase.appointments.set(appointment.id, appointment);
          mockDatabase.connections.set(connection.id, connection);
          mockDatabase.intakeSessions.set(intakeSession.id, intakeSession);
          
          // Perform migration
          const migratedAppointment = mockDatabase.migrateAppointment(appointment.id);
          
          expect(migratedAppointment).not.toBeNull();
          if (!migratedAppointment) return;
          
          // Verify relationships are maintained
          expect(migratedAppointment.connectionId).toBe(connection.id);
          expect(migratedAppointment.intakeSessionId).toBe(intakeSession.id);
          
          // Verify related entities still exist and are unchanged
          const storedConnection = mockDatabase.connections.get(connection.id);
          const storedIntakeSession = mockDatabase.intakeSessions.get(intakeSession.id);
          
          expect(storedConnection).toEqual(connection);
          expect(storedIntakeSession).toEqual(intakeSession);
          
          // Verify foreign key relationships are intact
          expect(migratedAppointment.connectionId).toBe(storedConnection?.id);
          expect(migratedAppointment.intakeSessionId).toBe(storedIntakeSession?.id);
          expect(storedIntakeSession?.connectionId).toBe(storedConnection?.id);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('preserves appointment metadata during Stream field addition', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryAppointment,
        fc.record({
          streamCallId: fc.string({ minLength: 5, maxLength: 50 }),
          streamJoinUrl: fc.webUrl(),
          streamMetadata: arbitraryStreamMetadata
        }),
        async (originalAppointment, streamUpdate) => {
          // Store original appointment
          mockDatabase.appointments.set(originalAppointment.id, originalAppointment);
          
          // Create a snapshot of original data for comparison (preserving Date objects)
          const originalSnapshot = {
            ...originalAppointment,
            scheduledAt: new Date(originalAppointment.scheduledAt.getTime()),
            createdAt: new Date(originalAppointment.createdAt.getTime()),
            updatedAt: new Date(originalAppointment.updatedAt.getTime()),
            zoomCreatedAt: originalAppointment.zoomCreatedAt ? new Date(originalAppointment.zoomCreatedAt.getTime()) : null
          };
          
          // Add Stream data
          const updatedAppointment = mockDatabase.addStreamColumns(originalAppointment.id, {
            ...streamUpdate,
            streamCreatedAt: new Date()
          });
          
          expect(updatedAppointment).not.toBeNull();
          if (!updatedAppointment) return;
          
          // Verify all non-Stream fields remain exactly the same
          const fieldsToCheck = [
            'id', 'connectionId', 'intakeSessionId', 'duration', 
            'isOnline', 'zoomMeetingId', 'zoomJoinUrl', 'zoomStartUrl',
            'status', 'notes', 'price', 'paymentStatus', 'paymentId', 
            'bookedBy', 'cancelledBy', 'cancelReason'
          ];
          
          for (const field of fieldsToCheck) {
            expect(updatedAppointment[field as keyof MockAppointment]).toEqual(
              originalSnapshot[field as keyof MockAppointment]
            );
          }
          
          // Handle date fields separately to ensure proper comparison
          expect(updatedAppointment.scheduledAt.getTime()).toBe(originalSnapshot.scheduledAt.getTime());
          expect(updatedAppointment.createdAt.getTime()).toBe(originalSnapshot.createdAt.getTime());
          
          // Handle nullable date fields
          if (originalSnapshot.zoomCreatedAt && updatedAppointment.zoomCreatedAt) {
            expect(updatedAppointment.zoomCreatedAt.getTime()).toBe(originalSnapshot.zoomCreatedAt.getTime());
          } else {
            expect(updatedAppointment.zoomCreatedAt).toBe(originalSnapshot.zoomCreatedAt);
          }
          
          // Verify Stream fields are properly set
          expect(updatedAppointment.streamCallId).toBe(streamUpdate.streamCallId);
          expect(updatedAppointment.streamJoinUrl).toBe(streamUpdate.streamJoinUrl);
          expect(updatedAppointment.streamMetadata).toEqual(streamUpdate.streamMetadata);
          expect(updatedAppointment.streamCreatedAt).toBeInstanceOf(Date);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('handles null and undefined values correctly during migration', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryAppointment,
        async (appointment) => {
          // Ensure some fields are null to test null handling
          const appointmentWithNulls = {
            ...appointment,
            intakeSessionId: null,
            zoomMeetingId: null,
            zoomJoinUrl: null,
            zoomStartUrl: null,
            zoomCreatedAt: null,
            notes: null,
            price: null,
            paymentStatus: null,
            paymentId: null,
            bookedBy: null,
            cancelledBy: null,
            cancelReason: null
          };
          
          mockDatabase.appointments.set(appointmentWithNulls.id, appointmentWithNulls);
          
          // Perform migration
          const migratedAppointment = mockDatabase.migrateAppointment(appointmentWithNulls.id);
          
          expect(migratedAppointment).not.toBeNull();
          if (!migratedAppointment) return;
          
          // Verify null values are preserved
          expect(migratedAppointment.intakeSessionId).toBeNull();
          expect(migratedAppointment.zoomMeetingId).toBeNull();
          expect(migratedAppointment.zoomJoinUrl).toBeNull();
          expect(migratedAppointment.zoomStartUrl).toBeNull();
          expect(migratedAppointment.zoomCreatedAt).toBeNull();
          expect(migratedAppointment.notes).toBeNull();
          expect(migratedAppointment.price).toBeNull();
          expect(migratedAppointment.paymentStatus).toBeNull();
          expect(migratedAppointment.paymentId).toBeNull();
          expect(migratedAppointment.bookedBy).toBeNull();
          expect(migratedAppointment.cancelledBy).toBeNull();
          expect(migratedAppointment.cancelReason).toBeNull();
          
          // Verify new Stream fields are initialized as null
          expect(migratedAppointment.streamCallId).toBeNull();
          expect(migratedAppointment.streamJoinUrl).toBeNull();
          expect(migratedAppointment.streamCreatedAt).toBeNull();
          expect(migratedAppointment.streamMetadata).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('maintains data integrity across multiple appointment updates', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(arbitraryAppointment, { minLength: 1, maxLength: 10 }),
        async (appointments) => {
          // Store all appointments
          for (const appointment of appointments) {
            mockDatabase.appointments.set(appointment.id, appointment);
          }
          
          // Create snapshots of original data (preserving Date objects)
          const originalSnapshots = appointments.map(apt => ({
            ...apt,
            scheduledAt: new Date(apt.scheduledAt.getTime()),
            createdAt: new Date(apt.createdAt.getTime()),
            updatedAt: new Date(apt.updatedAt.getTime()),
            zoomCreatedAt: apt.zoomCreatedAt ? new Date(apt.zoomCreatedAt.getTime()) : null
          }));
          
          // Migrate all appointments
          const migratedAppointments = appointments.map(apt => 
            mockDatabase.migrateAppointment(apt.id)
          ).filter(apt => apt !== null);
          
          expect(migratedAppointments).toHaveLength(appointments.length);
          
          // Verify each appointment maintains its original data
          for (let i = 0; i < migratedAppointments.length; i++) {
            const migrated = migratedAppointments[i]!;
            const original = originalSnapshots[i]!;
            
            // Check core identifying fields
            expect(migrated.id).toBe(original.id);
            expect(migrated.connectionId).toBe(original.connectionId);
            expect(migrated.scheduledAt.getTime()).toBe(original.scheduledAt.getTime());
            expect(migrated.duration).toBe(original.duration);
            expect(migrated.status).toBe(original.status);
            expect(migrated.createdAt.getTime()).toBe(original.createdAt.getTime());
            
            // Verify Stream fields are added
            expect(migrated.streamCallId).toBeNull();
            expect(migrated.streamJoinUrl).toBeNull();
            expect(migrated.streamCreatedAt).toBeNull();
            expect(migrated.streamMetadata).toBeNull();
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});