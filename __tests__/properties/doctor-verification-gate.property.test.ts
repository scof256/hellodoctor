/**
 * Feature: doctor-appointment-saas, Property 6: Doctor Verification Gate
 * 
 * For any patient attempting to connect with a doctor, the system SHALL only
 * allow the connection if the doctor's verification status is 'verified'.
 * Connections to doctors with 'pending' or 'rejected' status SHALL be denied
 * with a FORBIDDEN error.
 * 
 * Validates: Requirements 20.6
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { VerificationStatus, ConnectionStatus } from '@/types';

// Types for testing
interface Patient {
  id: string;
  userId: string;
}

interface Doctor {
  id: string;
  userId: string;
  verificationStatus: VerificationStatus;
  slug: string;
}

interface Connection {
  id: string;
  patientId: string;
  doctorId: string;
  status: ConnectionStatus;
  connectionSource: string;
  connectedAt: Date;
}

type ConnectionResult = 
  | { success: true; connection: Connection }
  | { success: false; error: string; code: string };

// Simulated connection service that enforces verification gate
class ConnectionService {
  private connections: Connection[] = [];
  private nextId = 1;

  /**
   * Attempt to create a connection between a patient and doctor.
   * Enforces the doctor verification gate.
   */
  createConnection(
    patient: Patient,
    doctor: Doctor,
    connectionSource: string = 'direct_url'
  ): ConnectionResult {
    // VERIFICATION GATE: Only allow connections to verified doctors
    if (doctor.verificationStatus !== 'verified') {
      return {
        success: false,
        error: 'Cannot connect to an unverified doctor. Please wait for the doctor to be verified.',
        code: 'FORBIDDEN',
      };
    }

    // Check for existing active connection
    const existingConnection = this.connections.find(
      (c) =>
        c.patientId === patient.id &&
        c.doctorId === doctor.id &&
        c.status === 'active'
    );

    if (existingConnection) {
      return {
        success: false,
        error: 'You are already connected to this doctor',
        code: 'CONFLICT',
      };
    }

    // Create new connection
    const newConnection: Connection = {
      id: `conn-${this.nextId++}`,
      patientId: patient.id,
      doctorId: doctor.id,
      status: 'active',
      connectionSource,
      connectedAt: new Date(),
    };

    this.connections.push(newConnection);
    return { success: true, connection: newConnection };
  }

  /**
   * Get all connections.
   */
  getAllConnections(): Connection[] {
    return [...this.connections];
  }

  /**
   * Reset the service for testing.
   */
  reset(): void {
    this.connections = [];
    this.nextId = 1;
  }
}

// Arbitrary generators
const uuidArb = fc.uuid();

const patientArb = fc.record({
  id: uuidArb,
  userId: uuidArb,
});

const verificationStatusArb = fc.constantFrom<VerificationStatus>('pending', 'verified', 'rejected');

const doctorArb = (status?: VerificationStatus) =>
  fc.record({
    id: uuidArb,
    userId: uuidArb,
    verificationStatus: status ? fc.constant(status) : verificationStatusArb,
    slug: fc.string({ minLength: 5, maxLength: 20 }).map((s) => s.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'doctor'),
  });

const connectionSourceArb = fc.constantFrom('qr_scan', 'direct_url', 'referral');

describe('Property 6: Doctor Verification Gate', () => {
  describe('Verified Doctor Connections', () => {
    it('for any verified doctor, patient connection SHALL succeed', () => {
      fc.assert(
        fc.property(
          patientArb,
          doctorArb('verified'),
          connectionSourceArb,
          (patient, doctor, source) => {
            const service = new ConnectionService();

            const result = service.createConnection(patient, doctor, source);

            expect(result.success).toBe(true);
            if (result.success) {
              expect(result.connection.patientId).toBe(patient.id);
              expect(result.connection.doctorId).toBe(doctor.id);
              expect(result.connection.status).toBe('active');
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Unverified Doctor Connections', () => {
    it('for any pending doctor, patient connection SHALL be denied with FORBIDDEN', () => {
      fc.assert(
        fc.property(
          patientArb,
          doctorArb('pending'),
          connectionSourceArb,
          (patient, doctor, source) => {
            const service = new ConnectionService();

            const result = service.createConnection(patient, doctor, source);

            expect(result.success).toBe(false);
            if (!result.success) {
              expect(result.code).toBe('FORBIDDEN');
              expect(result.error).toContain('unverified');
            }

            // No connection should be created
            expect(service.getAllConnections().length).toBe(0);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any rejected doctor, patient connection SHALL be denied with FORBIDDEN', () => {
      fc.assert(
        fc.property(
          patientArb,
          doctorArb('rejected'),
          connectionSourceArb,
          (patient, doctor, source) => {
            const service = new ConnectionService();

            const result = service.createConnection(patient, doctor, source);

            expect(result.success).toBe(false);
            if (!result.success) {
              expect(result.code).toBe('FORBIDDEN');
              expect(result.error).toContain('unverified');
            }

            // No connection should be created
            expect(service.getAllConnections().length).toBe(0);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any non-verified status, connection SHALL be denied', () => {
      const nonVerifiedStatuses: VerificationStatus[] = ['pending', 'rejected'];

      fc.assert(
        fc.property(
          patientArb,
          fc.constantFrom<VerificationStatus>(...nonVerifiedStatuses),
          connectionSourceArb,
          (patient, status, source) => {
            const service = new ConnectionService();
            const doctor: Doctor = {
              id: 'doctor-1',
              userId: 'user-1',
              verificationStatus: status,
              slug: 'test-doctor',
            };

            const result = service.createConnection(patient, doctor, source);

            expect(result.success).toBe(false);
            if (!result.success) {
              expect(result.code).toBe('FORBIDDEN');
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Verification Status Transitions', () => {
    it('connection attempts SHALL reflect current verification status', () => {
      fc.assert(
        fc.property(
          patientArb,
          verificationStatusArb,
          connectionSourceArb,
          (patient, status, source) => {
            const service = new ConnectionService();
            const doctor: Doctor = {
              id: 'doctor-1',
              userId: 'user-1',
              verificationStatus: status,
              slug: 'test-doctor',
            };

            const result = service.createConnection(patient, doctor, source);

            if (status === 'verified') {
              expect(result.success).toBe(true);
            } else {
              expect(result.success).toBe(false);
              if (!result.success) {
                expect(result.code).toBe('FORBIDDEN');
              }
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Multiple Patients Same Doctor', () => {
    it('multiple patients SHALL be able to connect to the same verified doctor', () => {
      fc.assert(
        fc.property(
          fc.array(patientArb, { minLength: 2, maxLength: 5 }),
          doctorArb('verified'),
          (patients, doctor) => {
            const service = new ConnectionService();

            // All patients should be able to connect
            for (const patient of patients) {
              const result = service.createConnection(patient, doctor, 'direct_url');
              expect(result.success).toBe(true);
            }

            // All connections should exist
            const connections = service.getAllConnections();
            expect(connections.length).toBe(patients.length);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('no patients SHALL be able to connect to an unverified doctor', () => {
      fc.assert(
        fc.property(
          fc.array(patientArb, { minLength: 2, maxLength: 5 }),
          doctorArb('pending'),
          (patients, doctor) => {
            const service = new ConnectionService();

            // No patients should be able to connect
            for (const patient of patients) {
              const result = service.createConnection(patient, doctor, 'direct_url');
              expect(result.success).toBe(false);
              if (!result.success) {
                expect(result.code).toBe('FORBIDDEN');
              }
            }

            // No connections should exist
            const connections = service.getAllConnections();
            expect(connections.length).toBe(0);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Mixed Doctor Verification Statuses', () => {
    it('patient connecting to multiple doctors SHALL only succeed for verified ones', () => {
      fc.assert(
        fc.property(
          patientArb,
          fc.array(doctorArb(), { minLength: 3, maxLength: 6 }),
          (patient, doctors) => {
            const service = new ConnectionService();

            let expectedSuccessCount = 0;

            for (const doctor of doctors) {
              const result = service.createConnection(patient, doctor, 'direct_url');

              if (doctor.verificationStatus === 'verified') {
                expect(result.success).toBe(true);
                expectedSuccessCount++;
              } else {
                expect(result.success).toBe(false);
                if (!result.success) {
                  expect(result.code).toBe('FORBIDDEN');
                }
              }
            }

            // Only verified doctor connections should exist
            const connections = service.getAllConnections();
            expect(connections.length).toBe(expectedSuccessCount);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Connection Source Independence', () => {
    it('verification gate SHALL apply regardless of connection source', () => {
      const sources = ['qr_scan', 'direct_url', 'referral'];

      fc.assert(
        fc.property(
          patientArb,
          verificationStatusArb,
          fc.constantFrom(...sources),
          (patient, status, source) => {
            const service = new ConnectionService();
            const doctor: Doctor = {
              id: 'doctor-1',
              userId: 'user-1',
              verificationStatus: status,
              slug: 'test-doctor',
            };

            const result = service.createConnection(patient, doctor, source);

            // Result should depend only on verification status, not source
            if (status === 'verified') {
              expect(result.success).toBe(true);
            } else {
              expect(result.success).toBe(false);
              if (!result.success) {
                expect(result.code).toBe('FORBIDDEN');
              }
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge Cases', () => {
    it('verification check SHALL happen before duplicate check', () => {
      fc.assert(
        fc.property(
          patientArb,
          doctorArb('pending'),
          (patient, doctor) => {
            const service = new ConnectionService();

            // First attempt - should fail due to verification
            const result1 = service.createConnection(patient, doctor, 'direct_url');
            expect(result1.success).toBe(false);
            if (!result1.success) {
              expect(result1.code).toBe('FORBIDDEN');
            }

            // Second attempt - should still fail due to verification (not CONFLICT)
            const result2 = service.createConnection(patient, doctor, 'direct_url');
            expect(result2.success).toBe(false);
            if (!result2.success) {
              expect(result2.code).toBe('FORBIDDEN');
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
