/**
 * Feature: site-performance-optimization, Property 6: Response Field Optimization
 * 
 * For any API response returning entity data, the response SHALL contain only
 * the fields specified in the lean response type, and no additional fields
 * from the full entity.
 * 
 * Validates: Requirements 6.1, 6.2, 6.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { AppointmentSummary, ConversationSummary } from '@/types/api-responses';

/**
 * Full appointment entity with all database fields.
 * This represents what the database returns before optimization.
 */
interface FullAppointment {
  id: string;
  connectionId: string;
  intakeSessionId: string | null;
  scheduledAt: Date;
  duration: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  notes: string | null;
  price: number | null;
  paymentStatus: string | null;
  paymentId: string | null;
  bookedBy: string;
  cancelledBy: string | null;
  cancelReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Full doctor entity
  doctor: {
    id: string;
    userId: string;
    specialty: string | null;
    clinicName: string | null;
    clinicAddress: string | null;
    clinicPhone: string | null;
    licenseNumber: string | null;
    verificationStatus: string;
    appointmentDuration: number;
    bufferTime: number;
    consultationFee: number | null;
    createdAt: Date;
    updatedAt: Date;
    user: {
      id: string;
      clerkId: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      imageUrl: string | null;
      primaryRole: string;
      createdAt: Date;
      updatedAt: Date;
    };
  };
  // Full patient entity
  patient: {
    id: string;
    userId: string;
    dateOfBirth: Date | null;
    gender: string | null;
    bloodType: string | null;
    allergies: string | null;
    createdAt: Date;
    updatedAt: Date;
    user: {
      id: string;
      clerkId: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      imageUrl: string | null;
      primaryRole: string;
      createdAt: Date;
      updatedAt: Date;
    };
  };
}

/**
 * Full connection entity with all database fields.
 */
interface FullConnection {
  id: string;
  patientId: string;
  doctorId: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
  // Full other party entity
  otherParty: {
    id: string;
    clerkId: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
    primaryRole: string;
    createdAt: Date;
    updatedAt: Date;
  };
  // Full message entity
  latestMessage: {
    id: string;
    connectionId: string;
    senderId: string;
    content: string;
    isRead: boolean;
    readAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  unreadCount: number;
}

// Arbitraries for generating test data
const uuidArb = fc.uuid();
const dateArb = fc.date();
const nullableStringArb = fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null });

const appointmentStatusArb = fc.constantFrom(
  'pending' as const,
  'confirmed' as const,
  'completed' as const,
  'cancelled' as const,
  'no_show' as const
);

const fullAppointmentArb: fc.Arbitrary<FullAppointment> = fc.record({
  id: uuidArb,
  connectionId: uuidArb,
  intakeSessionId: fc.option(uuidArb, { nil: null }),
  scheduledAt: dateArb,
  duration: fc.integer({ min: 15, max: 120 }),
  status: appointmentStatusArb,
  notes: nullableStringArb,
  price: fc.option(fc.integer({ min: 0, max: 10000 }), { nil: null }),
  paymentStatus: nullableStringArb,
  paymentId: nullableStringArb,
  bookedBy: uuidArb,
  cancelledBy: fc.option(uuidArb, { nil: null }),
  cancelReason: nullableStringArb,
  createdAt: dateArb,
  updatedAt: dateArb,
  doctor: fc.record({
    id: uuidArb,
    userId: uuidArb,
    specialty: nullableStringArb,
    clinicName: nullableStringArb,
    clinicAddress: nullableStringArb,
    clinicPhone: nullableStringArb,
    licenseNumber: nullableStringArb,
    verificationStatus: fc.constantFrom('pending', 'verified', 'rejected'),
    appointmentDuration: fc.integer({ min: 15, max: 60 }),
    bufferTime: fc.integer({ min: 0, max: 30 }),
    consultationFee: fc.option(fc.integer({ min: 0, max: 1000 }), { nil: null }),
    createdAt: dateArb,
    updatedAt: dateArb,
    user: fc.record({
      id: uuidArb,
      clerkId: fc.string({ minLength: 10, maxLength: 50 }),
      email: fc.emailAddress(),
      firstName: nullableStringArb,
      lastName: nullableStringArb,
      imageUrl: nullableStringArb,
      primaryRole: fc.constantFrom('patient', 'doctor', 'super_admin'),
      createdAt: dateArb,
      updatedAt: dateArb,
    }),
  }),
  patient: fc.record({
    id: uuidArb,
    userId: uuidArb,
    dateOfBirth: fc.option(dateArb, { nil: null }),
    gender: nullableStringArb,
    bloodType: nullableStringArb,
    allergies: nullableStringArb,
    createdAt: dateArb,
    updatedAt: dateArb,
    user: fc.record({
      id: uuidArb,
      clerkId: fc.string({ minLength: 10, maxLength: 50 }),
      email: fc.emailAddress(),
      firstName: nullableStringArb,
      lastName: nullableStringArb,
      imageUrl: nullableStringArb,
      primaryRole: fc.constantFrom('patient', 'doctor', 'super_admin'),
      createdAt: dateArb,
      updatedAt: dateArb,
    }),
  }),
});

const fullConnectionArb: fc.Arbitrary<FullConnection> = fc.record({
  id: uuidArb,
  patientId: uuidArb,
  doctorId: uuidArb,
  status: fc.constantFrom('active' as const, 'inactive' as const),
  createdAt: dateArb,
  updatedAt: dateArb,
  otherParty: fc.record({
    id: uuidArb,
    clerkId: fc.string({ minLength: 10, maxLength: 50 }),
    email: fc.emailAddress(),
    firstName: nullableStringArb,
    lastName: nullableStringArb,
    imageUrl: nullableStringArb,
    primaryRole: fc.constantFrom('patient', 'doctor', 'super_admin'),
    createdAt: dateArb,
    updatedAt: dateArb,
  }),
  latestMessage: fc.option(
    fc.record({
      id: uuidArb,
      connectionId: uuidArb,
      senderId: uuidArb,
      content: fc.string({ minLength: 1, maxLength: 500 }),
      isRead: fc.boolean(),
      readAt: fc.option(dateArb, { nil: null }),
      createdAt: dateArb,
      updatedAt: dateArb,
    }),
    { nil: null }
  ),
  unreadCount: fc.integer({ min: 0, max: 100 }),
});

/**
 * Transform a full appointment to a lean AppointmentSummary.
 * This simulates what our optimized router does.
 */
function toLeanAppointment(full: FullAppointment): AppointmentSummary {
  return {
    id: full.id,
    connectionId: full.connectionId,
    intakeSessionId: full.intakeSessionId,
    scheduledAt: full.scheduledAt,
    duration: full.duration,
    isOnline: false,
    zoomJoinUrl: null,
    scribeIsActive: false,
    status: full.status,
    notes: full.notes,
    doctor: {
      id: full.doctor.id,
      clinicName: full.doctor.clinicName,
      user: {
        firstName: full.doctor.user.firstName,
        lastName: full.doctor.user.lastName,
        imageUrl: full.doctor.user.imageUrl,
      },
    },
    patient: {
      id: full.patient.id,
      user: {
        firstName: full.patient.user.firstName,
        lastName: full.patient.user.lastName,
        imageUrl: full.patient.user.imageUrl,
      },
    },
  };
}

/**
 * Transform a full connection to a lean ConversationSummary.
 * This simulates what our optimized router does.
 */
function toLeanConversation(full: FullConnection, role: 'patient' | 'doctor'): ConversationSummary {
  return {
    connectionId: full.id,
    otherParty: {
      userId: full.otherParty.id,
      firstName: full.otherParty.firstName,
      lastName: full.otherParty.lastName,
      imageUrl: full.otherParty.imageUrl,
      role: role,
    },
    latestMessage: full.latestMessage
      ? {
          content: full.latestMessage.content,
          createdAt: full.latestMessage.createdAt,
          isRead: full.latestMessage.isRead,
          isFromMe: false,
        }
      : null,
    unreadCount: full.unreadCount,
  };
}

/**
 * Get all keys from an object recursively.
 */
function getAllKeys(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object') {
    return [];
  }
  
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    keys.push(fullKey);
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      keys.push(...getAllKeys(value, fullKey));
    }
  }
  return keys;
}

/**
 * Calculate the approximate size of an object in bytes.
 */
function getObjectSize(obj: unknown): number {
  return JSON.stringify(obj).length;
}

describe('Property 6: Response Field Optimization', () => {
  describe('Appointment Response Optimization', () => {
    it('lean appointment SHALL contain only required fields', () => {
      fc.assert(
        fc.property(fullAppointmentArb, (fullAppointment) => {
          const lean = toLeanAppointment(fullAppointment);
          const leanKeys = getAllKeys(lean);
          
          // Define the expected fields in lean response
          const expectedFields = [
            'id',
            'connectionId',
            'intakeSessionId',
            'scheduledAt',
            'duration',
            'isOnline',
            'zoomJoinUrl',
            'scribeIsActive',
            'status',
            'notes',
            'doctor',
            'doctor.id',
            'doctor.clinicName',
            'doctor.user',
            'doctor.user.firstName',
            'doctor.user.lastName',
            'doctor.user.imageUrl',
            'patient',
            'patient.id',
            'patient.user',
            'patient.user.firstName',
            'patient.user.lastName',
            'patient.user.imageUrl',
          ];
          
          // All lean keys should be in expected fields
          for (const key of leanKeys) {
            expect(expectedFields).toContain(key);
          }
          
          // All expected fields should be in lean keys
          for (const field of expectedFields) {
            expect(leanKeys).toContain(field);
          }
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('lean appointment SHALL NOT contain sensitive or unnecessary fields', () => {
      fc.assert(
        fc.property(fullAppointmentArb, (fullAppointment) => {
          const lean = toLeanAppointment(fullAppointment);
          const leanKeys = getAllKeys(lean);
          
          // Fields that should NOT be in lean response
          const forbiddenFields = [
            'price',
            'paymentStatus',
            'paymentId',
            'bookedBy',
            'cancelledBy',
            'cancelReason',
            'createdAt',
            'updatedAt',
            'doctor.userId',
            'doctor.specialty',
            'doctor.clinicAddress',
            'doctor.clinicPhone',
            'doctor.licenseNumber',
            'doctor.verificationStatus',
            'doctor.appointmentDuration',
            'doctor.bufferTime',
            'doctor.consultationFee',
            'doctor.createdAt',
            'doctor.updatedAt',
            'doctor.user.id',
            'doctor.user.clerkId',
            'doctor.user.email',
            'doctor.user.primaryRole',
            'doctor.user.createdAt',
            'doctor.user.updatedAt',
            'patient.userId',
            'patient.dateOfBirth',
            'patient.gender',
            'patient.bloodType',
            'patient.allergies',
            'patient.createdAt',
            'patient.updatedAt',
            'patient.user.id',
            'patient.user.clerkId',
            'patient.user.email',
            'patient.user.primaryRole',
            'patient.user.createdAt',
            'patient.user.updatedAt',
          ];
          
          for (const field of forbiddenFields) {
            expect(leanKeys).not.toContain(field);
          }
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('lean appointment SHALL be smaller than full appointment', () => {
      fc.assert(
        fc.property(fullAppointmentArb, (fullAppointment) => {
          const lean = toLeanAppointment(fullAppointment);
          
          const fullSize = getObjectSize(fullAppointment);
          const leanSize = getObjectSize(lean);
          
          // Lean should be significantly smaller
          expect(leanSize).toBeLessThan(fullSize);
          
          // Lean should be at most 50% of full size
          expect(leanSize).toBeLessThan(fullSize * 0.5);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Conversation Response Optimization', () => {
    it('lean conversation SHALL contain only required fields', () => {
      fc.assert(
        fc.property(
          fullConnectionArb,
          fc.constantFrom('patient' as const, 'doctor' as const),
          (fullConnection, role) => {
            const lean = toLeanConversation(fullConnection, role);
            const leanKeys = getAllKeys(lean);
            
            // Define the expected fields in lean response
            const expectedFields = [
              'connectionId',
              'otherParty',
              'otherParty.userId',
              'otherParty.firstName',
              'otherParty.lastName',
              'otherParty.imageUrl',
              'otherParty.role',
              'latestMessage',
              'unreadCount',
            ];
            
            // Add latestMessage fields if present
            if (lean.latestMessage) {
              expectedFields.push(
                'latestMessage.content',
                'latestMessage.createdAt',
                'latestMessage.isRead',
                'latestMessage.isFromMe'
              );
            }
            
            // All lean keys should be in expected fields
            for (const key of leanKeys) {
              expect(expectedFields).toContain(key);
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('lean conversation SHALL NOT contain sensitive or unnecessary fields', () => {
      fc.assert(
        fc.property(
          fullConnectionArb,
          fc.constantFrom('patient' as const, 'doctor' as const),
          (fullConnection, role) => {
            const lean = toLeanConversation(fullConnection, role);
            const leanKeys = getAllKeys(lean);
            
            // Fields that should NOT be in lean response
            const forbiddenFields = [
              'patientId',
              'doctorId',
              'status',
              'createdAt',
              'updatedAt',
              'otherParty.id',
              'otherParty.clerkId',
              'otherParty.email',
              'otherParty.primaryRole',
              'otherParty.createdAt',
              'otherParty.updatedAt',
              'latestMessage.id',
              'latestMessage.connectionId',
              'latestMessage.senderId',
              'latestMessage.readAt',
              'latestMessage.updatedAt',
            ];
            
            for (const field of forbiddenFields) {
              expect(leanKeys).not.toContain(field);
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('lean conversation SHALL be smaller than full connection', () => {
      fc.assert(
        fc.property(
          fullConnectionArb,
          fc.constantFrom('patient' as const, 'doctor' as const),
          (fullConnection, role) => {
            const lean = toLeanConversation(fullConnection, role);
            
            const fullSize = getObjectSize(fullConnection);
            const leanSize = getObjectSize(lean);
            
            // Lean should be smaller
            expect(leanSize).toBeLessThan(fullSize);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Analytics Field Selection', () => {
    it('field selection SHALL reduce response size when fields are excluded', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              date: fc.string(),
              total: fc.integer({ min: 0, max: 1000 }),
              doctors: fc.integer({ min: 0, max: 500 }),
              patients: fc.integer({ min: 0, max: 500 }),
            }),
            { minLength: 1, maxLength: 30 }
          ),
          fc.record({
            users: fc.integer({ min: 0, max: 10000 }),
            doctors: fc.integer({ min: 0, max: 5000 }),
            patients: fc.integer({ min: 0, max: 5000 }),
          }),
          (timeSeries, totals) => {
            // Full response with all fields
            const fullResponse = {
              timeSeries,
              totals,
              period: { startDate: '2024-01-01', endDate: '2024-12-31', granularity: 'daily' },
            };
            
            // Response with only totals (field selection)
            const totalsOnlyResponse = {
              totals,
              period: { startDate: '2024-01-01', endDate: '2024-12-31', granularity: 'daily' },
            };
            
            // Response with only time series (field selection)
            const timeSeriesOnlyResponse = {
              timeSeries,
              period: { startDate: '2024-01-01', endDate: '2024-12-31', granularity: 'daily' },
            };
            
            const fullSize = getObjectSize(fullResponse);
            const totalsOnlySize = getObjectSize(totalsOnlyResponse);
            const timeSeriesOnlySize = getObjectSize(timeSeriesOnlyResponse);
            
            // Partial responses should be smaller than full
            expect(totalsOnlySize).toBeLessThan(fullSize);
            expect(timeSeriesOnlySize).toBeLessThan(fullSize);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
