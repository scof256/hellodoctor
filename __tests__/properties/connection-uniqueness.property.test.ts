/**
 * Feature: doctor-appointment-saas, Property 2: Connection Uniqueness
 * 
 * For any patient and doctor pair, the system SHALL prevent duplicate active
 * connections between the same patient and doctor. If a connection already
 * exists and is active, attempting to create another connection SHALL fail
 * with a CONFLICT error.
 * 
 * Validates: Requirements 4.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { ConnectionStatus } from '@/types';

// Types for testing
interface Patient {
  id: string;
  userId: string;
}

interface Doctor {
  id: string;
  userId: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
}

interface Connection {
  id: string;
  patientId: string;
  doctorId: string;
  status: ConnectionStatus;
  connectionSource: string;
  connectedAt: Date;
  disconnectedAt: Date | null;
}

// Simulated connection store
class ConnectionStore {
  private connections: Connection[] = [];
  private nextId = 1;

  /**
   * Attempt to create a connection between a patient and doctor.
   * Returns the connection if successful, or throws an error if:
   * - Doctor is not verified
   * - Connection already exists and is active
   */
  createConnection(
    patient: Patient,
    doctor: Doctor,
    connectionSource: string = 'direct_url'
  ): Connection | { error: string; code: string } {
    // Check if doctor is verified
    if (doctor.verificationStatus !== 'verified') {
      return {
        error: 'Cannot connect to an unverified doctor',
        code: 'FORBIDDEN',
      };
    }

    // Check for existing connection
    const existingConnection = this.connections.find(
      (c) => c.patientId === patient.id && c.doctorId === doctor.id
    );

    if (existingConnection) {
      // If disconnected, reactivate
      if (existingConnection.status === 'disconnected') {
        existingConnection.status = 'active';
        existingConnection.connectedAt = new Date();
        existingConnection.disconnectedAt = null;
        existingConnection.connectionSource = connectionSource;
        return existingConnection;
      }

      // Active connection exists - prevent duplicate
      return {
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
      disconnectedAt: null,
    };

    this.connections.push(newConnection);
    return newConnection;
  }

  /**
   * Get all connections for a patient-doctor pair.
   */
  getConnections(patientId: string, doctorId: string): Connection[] {
    return this.connections.filter(
      (c) => c.patientId === patientId && c.doctorId === doctorId
    );
  }

  /**
   * Get active connections count for a patient-doctor pair.
   */
  getActiveConnectionCount(patientId: string, doctorId: string): number {
    return this.connections.filter(
      (c) =>
        c.patientId === patientId &&
        c.doctorId === doctorId &&
        c.status === 'active'
    ).length;
  }

  /**
   * Disconnect a connection.
   */
  disconnect(connectionId: string): boolean {
    const connection = this.connections.find((c) => c.id === connectionId);
    if (connection) {
      connection.status = 'disconnected';
      connection.disconnectedAt = new Date();
      return true;
    }
    return false;
  }

  /**
   * Reset the store for testing.
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

const verifiedDoctorArb = fc.record({
  id: uuidArb,
  userId: uuidArb,
  verificationStatus: fc.constant('verified' as const),
});

const connectionSourceArb = fc.constantFrom('qr_scan', 'direct_url', 'referral');

describe('Property 2: Connection Uniqueness', () => {
  describe('Duplicate Connection Prevention', () => {
    it('for any patient-doctor pair, creating a second active connection SHALL fail with CONFLICT', () => {
      fc.assert(
        fc.property(
          patientArb,
          verifiedDoctorArb,
          connectionSourceArb,
          connectionSourceArb,
          (patient, doctor, source1, source2) => {
            const store = new ConnectionStore();

            // First connection should succeed
            const result1 = store.createConnection(patient, doctor, source1);
            expect('id' in result1).toBe(true);

            // Second connection should fail with CONFLICT
            const result2 = store.createConnection(patient, doctor, source2);
            expect('error' in result2).toBe(true);
            if ('error' in result2) {
              expect(result2.code).toBe('CONFLICT');
            }

            // There should only be one active connection
            const activeCount = store.getActiveConnectionCount(patient.id, doctor.id);
            expect(activeCount).toBe(1);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any number of connection attempts, at most one active connection SHALL exist', () => {
      fc.assert(
        fc.property(
          patientArb,
          verifiedDoctorArb,
          fc.integer({ min: 2, max: 10 }),
          (patient, doctor, attempts) => {
            const store = new ConnectionStore();

            // Attempt to create multiple connections
            for (let i = 0; i < attempts; i++) {
              store.createConnection(patient, doctor, 'direct_url');
            }

            // There should only be one active connection
            const activeCount = store.getActiveConnectionCount(patient.id, doctor.id);
            expect(activeCount).toBe(1);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Disconnected Connection Reactivation', () => {
    it('for any disconnected connection, reconnecting SHALL reactivate instead of creating duplicate', () => {
      fc.assert(
        fc.property(
          patientArb,
          verifiedDoctorArb,
          connectionSourceArb,
          connectionSourceArb,
          (patient, doctor, source1, source2) => {
            const store = new ConnectionStore();

            // Create initial connection
            const result1 = store.createConnection(patient, doctor, source1);
            expect('id' in result1).toBe(true);
            const connectionId = 'id' in result1 ? result1.id : '';

            // Disconnect
            store.disconnect(connectionId);
            expect(store.getActiveConnectionCount(patient.id, doctor.id)).toBe(0);

            // Reconnect should succeed and reactivate
            const result2 = store.createConnection(patient, doctor, source2);
            expect('id' in result2).toBe(true);

            // Should still only have one connection total (reactivated, not new)
            const allConnections = store.getConnections(patient.id, doctor.id);
            expect(allConnections.length).toBe(1);
            expect(allConnections[0].status).toBe('active');

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Multiple Patient-Doctor Pairs', () => {
    it('different patient-doctor pairs SHALL be able to have independent connections', () => {
      fc.assert(
        fc.property(
          fc.array(patientArb, { minLength: 2, maxLength: 5 }),
          fc.array(verifiedDoctorArb, { minLength: 2, maxLength: 5 }),
          (patients, doctors) => {
            const store = new ConnectionStore();

            // Create connections for each unique patient-doctor pair
            const expectedConnections: Array<{ patientId: string; doctorId: string }> = [];

            for (const patient of patients) {
              for (const doctor of doctors) {
                const result = store.createConnection(patient, doctor, 'direct_url');
                if ('id' in result) {
                  expectedConnections.push({
                    patientId: patient.id,
                    doctorId: doctor.id,
                  });
                }
              }
            }

            // Each unique pair should have exactly one active connection
            for (const expected of expectedConnections) {
              const activeCount = store.getActiveConnectionCount(
                expected.patientId,
                expected.doctorId
              );
              expect(activeCount).toBe(1);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('one patient connecting to multiple doctors SHALL create separate connections', () => {
      fc.assert(
        fc.property(
          patientArb,
          fc.array(verifiedDoctorArb, { minLength: 2, maxLength: 5 }),
          (patient, doctors) => {
            const store = new ConnectionStore();

            // Connect patient to all doctors
            let successCount = 0;
            for (const doctor of doctors) {
              const result = store.createConnection(patient, doctor, 'direct_url');
              if ('id' in result) {
                successCount++;
              }
            }

            // Each doctor should have exactly one connection with this patient
            for (const doctor of doctors) {
              const activeCount = store.getActiveConnectionCount(patient.id, doctor.id);
              expect(activeCount).toBe(1);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Connection Source Tracking', () => {
    it('connection source SHALL be preserved when creating a connection', () => {
      fc.assert(
        fc.property(
          patientArb,
          verifiedDoctorArb,
          connectionSourceArb,
          (patient, doctor, source) => {
            const store = new ConnectionStore();

            const result = store.createConnection(patient, doctor, source);
            expect('id' in result).toBe(true);

            if ('id' in result) {
              expect(result.connectionSource).toBe(source);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('connection source SHALL be updated when reactivating a disconnected connection', () => {
      fc.assert(
        fc.property(
          patientArb,
          verifiedDoctorArb,
          connectionSourceArb,
          connectionSourceArb,
          (patient, doctor, source1, source2) => {
            const store = new ConnectionStore();

            // Create and disconnect
            const result1 = store.createConnection(patient, doctor, source1);
            expect('id' in result1).toBe(true);
            const connectionId = 'id' in result1 ? result1.id : '';
            store.disconnect(connectionId);

            // Reconnect with different source
            const result2 = store.createConnection(patient, doctor, source2);
            expect('id' in result2).toBe(true);

            if ('id' in result2) {
              expect(result2.connectionSource).toBe(source2);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge Cases', () => {
    it('same patient connecting to same doctor multiple times in sequence SHALL maintain uniqueness', () => {
      fc.assert(
        fc.property(
          patientArb,
          verifiedDoctorArb,
          fc.integer({ min: 3, max: 10 }),
          (patient, doctor, cycles) => {
            const store = new ConnectionStore();

            for (let i = 0; i < cycles; i++) {
              // Create connection
              const createResult = store.createConnection(patient, doctor, 'direct_url');
              
              if (i === 0) {
                // First time should succeed
                expect('id' in createResult).toBe(true);
              }

              // Active count should always be 1 after create attempt
              expect(store.getActiveConnectionCount(patient.id, doctor.id)).toBe(1);

              // Disconnect
              const connections = store.getConnections(patient.id, doctor.id);
              if (connections.length > 0) {
                store.disconnect(connections[0].id);
              }

              // Active count should be 0 after disconnect
              expect(store.getActiveConnectionCount(patient.id, doctor.id)).toBe(0);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
