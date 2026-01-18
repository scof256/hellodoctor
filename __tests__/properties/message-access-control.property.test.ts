/**
 * Feature: doctor-appointment-saas, Property 7: Message Access Control
 * 
 * For any direct message, only users who are part of the associated connection
 * (patient, doctor, or their authorized staff) SHALL be able to read or send
 * messages in that conversation.
 * 
 * Validates: Requirements 13.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Types for testing
interface User {
  id: string;
  primaryRole: 'patient' | 'doctor' | 'clinic_admin' | 'receptionist' | 'super_admin';
}

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
  status: 'active' | 'disconnected' | 'blocked';
}

interface ClinicAdminRole {
  userId: string;
  doctorId: string;
  effectiveUntil: Date | null;
}

interface Message {
  id: string;
  connectionId: string;
  senderId: string;
  content: string;
  createdAt: Date;
}

type AccessResult = 
  | { allowed: true; accessType: 'patient' | 'doctor' | 'clinic_admin' }
  | { allowed: false; error: string; code: string };

// Simulated message access control system
class MessageAccessControl {
  private users: Map<string, User> = new Map();
  private patients: Map<string, Patient> = new Map();
  private doctors: Map<string, Doctor> = new Map();
  private connections: Map<string, Connection> = new Map();
  private clinicAdminRoles: ClinicAdminRole[] = [];
  private messages: Message[] = [];
  private nextMessageId = 1;

  addUser(user: User): void {
    this.users.set(user.id, user);
  }

  addPatient(patient: Patient): void {
    this.patients.set(patient.id, patient);
  }

  addDoctor(doctor: Doctor): void {
    this.doctors.set(doctor.id, doctor);
  }

  addConnection(connection: Connection): void {
    this.connections.set(connection.id, connection);
  }

  addClinicAdminRole(role: ClinicAdminRole): void {
    this.clinicAdminRoles.push(role);
  }

  /**
   * Check if a user has access to a connection for messaging.
   * 
   * Access is granted if:
   * 1. User is the patient in the connection
   * 2. User is the doctor in the connection
   * 3. User is a clinic_admin for the doctor in the connection
   */
  verifyAccess(userId: string, connectionId: string): AccessResult {
    const connection = this.connections.get(connectionId);
    
    if (!connection) {
      return { allowed: false, error: 'Connection not found', code: 'NOT_FOUND' };
    }

    if (connection.status !== 'active') {
      return { allowed: false, error: 'Cannot message on an inactive connection', code: 'FORBIDDEN' };
    }

    // Get patient and doctor for this connection
    const patient = this.patients.get(connection.patientId);
    const doctor = this.doctors.get(connection.doctorId);

    if (!patient || !doctor) {
      return { allowed: false, error: 'Invalid connection data', code: 'INTERNAL_ERROR' };
    }

    // Check if user is the patient
    if (patient.userId === userId) {
      return { allowed: true, accessType: 'patient' };
    }

    // Check if user is the doctor
    if (doctor.userId === userId) {
      return { allowed: true, accessType: 'doctor' };
    }

    // Check if user is a clinic_admin for this doctor
    const now = new Date();
    const isClinicAdmin = this.clinicAdminRoles.some(
      (role) =>
        role.userId === userId &&
        role.doctorId === doctor.id &&
        (role.effectiveUntil === null || role.effectiveUntil > now)
    );

    if (isClinicAdmin) {
      return { allowed: true, accessType: 'clinic_admin' };
    }

    return { allowed: false, error: 'You do not have access to this conversation', code: 'FORBIDDEN' };
  }

  /**
   * Attempt to send a message.
   */
  sendMessage(userId: string, connectionId: string, content: string): Message | AccessResult {
    const accessResult = this.verifyAccess(userId, connectionId);
    
    if (!accessResult.allowed) {
      return accessResult;
    }

    const message: Message = {
      id: `msg-${this.nextMessageId++}`,
      connectionId,
      senderId: userId,
      content,
      createdAt: new Date(),
    };

    this.messages.push(message);
    return message;
  }

  /**
   * Attempt to read messages from a connection.
   */
  getMessages(userId: string, connectionId: string): Message[] | AccessResult {
    const accessResult = this.verifyAccess(userId, connectionId);
    
    if (!accessResult.allowed) {
      return accessResult;
    }

    return this.messages.filter((m) => m.connectionId === connectionId);
  }

  reset(): void {
    this.users.clear();
    this.patients.clear();
    this.doctors.clear();
    this.connections.clear();
    this.clinicAdminRoles = [];
    this.messages = [];
    this.nextMessageId = 1;
  }
}

// Arbitrary generators
const uuidArb = fc.uuid();

const userArb = (role: User['primaryRole']) =>
  fc.record({
    id: uuidArb,
    primaryRole: fc.constant(role),
  });

const patientArb = fc.record({
  id: uuidArb,
  userId: uuidArb,
});

const doctorArb = fc.record({
  id: uuidArb,
  userId: uuidArb,
  verificationStatus: fc.constant('verified' as const),
});

const activeConnectionArb = (patientId: string, doctorId: string) =>
  fc.record({
    id: uuidArb,
    patientId: fc.constant(patientId),
    doctorId: fc.constant(doctorId),
    status: fc.constant('active' as const),
  });

const messageContentArb = fc.string({ minLength: 1, maxLength: 500 });

describe('Property 7: Message Access Control', () => {
  describe('Patient Access', () => {
    it('for any connection, the patient SHALL be able to send messages', () => {
      fc.assert(
        fc.property(
          patientArb,
          doctorArb,
          messageContentArb,
          (patient, doctor, content) => {
            const system = new MessageAccessControl();

            // Setup
            system.addPatient(patient);
            system.addDoctor(doctor);
            
            const connection: Connection = {
              id: fc.sample(uuidArb, 1)[0],
              patientId: patient.id,
              doctorId: doctor.id,
              status: 'active',
            };
            system.addConnection(connection);

            // Patient should be able to send message
            const result = system.sendMessage(patient.userId, connection.id, content);
            
            expect('id' in result).toBe(true);
            if ('id' in result) {
              expect(result.senderId).toBe(patient.userId);
              expect(result.content).toBe(content);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any connection, the patient SHALL be able to read messages', () => {
      fc.assert(
        fc.property(patientArb, doctorArb, (patient, doctor) => {
          const system = new MessageAccessControl();

          // Setup
          system.addPatient(patient);
          system.addDoctor(doctor);
          
          const connection: Connection = {
            id: fc.sample(uuidArb, 1)[0],
            patientId: patient.id,
            doctorId: doctor.id,
            status: 'active',
          };
          system.addConnection(connection);

          // Patient should be able to read messages
          const result = system.getMessages(patient.userId, connection.id);
          
          expect(Array.isArray(result)).toBe(true);

          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Doctor Access', () => {
    it('for any connection, the doctor SHALL be able to send messages', () => {
      fc.assert(
        fc.property(
          patientArb,
          doctorArb,
          messageContentArb,
          (patient, doctor, content) => {
            const system = new MessageAccessControl();

            // Setup
            system.addPatient(patient);
            system.addDoctor(doctor);
            
            const connection: Connection = {
              id: fc.sample(uuidArb, 1)[0],
              patientId: patient.id,
              doctorId: doctor.id,
              status: 'active',
            };
            system.addConnection(connection);

            // Doctor should be able to send message
            const result = system.sendMessage(doctor.userId, connection.id, content);
            
            expect('id' in result).toBe(true);
            if ('id' in result) {
              expect(result.senderId).toBe(doctor.userId);
              expect(result.content).toBe(content);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any connection, the doctor SHALL be able to read messages', () => {
      fc.assert(
        fc.property(patientArb, doctorArb, (patient, doctor) => {
          const system = new MessageAccessControl();

          // Setup
          system.addPatient(patient);
          system.addDoctor(doctor);
          
          const connection: Connection = {
            id: fc.sample(uuidArb, 1)[0],
            patientId: patient.id,
            doctorId: doctor.id,
            status: 'active',
          };
          system.addConnection(connection);

          // Doctor should be able to read messages
          const result = system.getMessages(doctor.userId, connection.id);
          
          expect(Array.isArray(result)).toBe(true);

          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Clinic Admin Access (Requirement 23.4)', () => {
    it('for any connection, a clinic_admin for the doctor SHALL be able to send messages', () => {
      fc.assert(
        fc.property(
          patientArb,
          doctorArb,
          uuidArb, // clinic admin user id
          messageContentArb,
          (patient, doctor, clinicAdminUserId, content) => {
            const system = new MessageAccessControl();

            // Setup
            system.addPatient(patient);
            system.addDoctor(doctor);
            
            const connection: Connection = {
              id: fc.sample(uuidArb, 1)[0],
              patientId: patient.id,
              doctorId: doctor.id,
              status: 'active',
            };
            system.addConnection(connection);

            // Add clinic admin role
            system.addClinicAdminRole({
              userId: clinicAdminUserId,
              doctorId: doctor.id,
              effectiveUntil: null,
            });

            // Clinic admin should be able to send message
            const result = system.sendMessage(clinicAdminUserId, connection.id, content);
            
            expect('id' in result).toBe(true);
            if ('id' in result) {
              expect(result.senderId).toBe(clinicAdminUserId);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any connection, a clinic_admin with expired role SHALL NOT be able to send messages', () => {
      fc.assert(
        fc.property(
          patientArb,
          doctorArb,
          uuidArb,
          messageContentArb,
          (patient, doctor, clinicAdminUserId, content) => {
            const system = new MessageAccessControl();

            // Setup
            system.addPatient(patient);
            system.addDoctor(doctor);
            
            const connection: Connection = {
              id: fc.sample(uuidArb, 1)[0],
              patientId: patient.id,
              doctorId: doctor.id,
              status: 'active',
            };
            system.addConnection(connection);

            // Add expired clinic admin role
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 1);
            system.addClinicAdminRole({
              userId: clinicAdminUserId,
              doctorId: doctor.id,
              effectiveUntil: pastDate,
            });

            // Clinic admin with expired role should NOT be able to send message
            const result = system.sendMessage(clinicAdminUserId, connection.id, content);
            
            expect('allowed' in result && !result.allowed).toBe(true);
            if ('code' in result) {
              expect(result.code).toBe('FORBIDDEN');
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Unauthorized Access Prevention', () => {
    it('for any connection, an unrelated user SHALL NOT be able to send messages', () => {
      fc.assert(
        fc.property(
          patientArb,
          doctorArb,
          uuidArb, // unrelated user id
          messageContentArb,
          (patient, doctor, unrelatedUserId, content) => {
            // Ensure unrelated user is different from patient and doctor
            fc.pre(unrelatedUserId !== patient.userId && unrelatedUserId !== doctor.userId);

            const system = new MessageAccessControl();

            // Setup
            system.addPatient(patient);
            system.addDoctor(doctor);
            
            const connection: Connection = {
              id: fc.sample(uuidArb, 1)[0],
              patientId: patient.id,
              doctorId: doctor.id,
              status: 'active',
            };
            system.addConnection(connection);

            // Unrelated user should NOT be able to send message
            const result = system.sendMessage(unrelatedUserId, connection.id, content);
            
            expect('allowed' in result && !result.allowed).toBe(true);
            if ('code' in result) {
              expect(result.code).toBe('FORBIDDEN');
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any connection, an unrelated user SHALL NOT be able to read messages', () => {
      fc.assert(
        fc.property(
          patientArb,
          doctorArb,
          uuidArb,
          (patient, doctor, unrelatedUserId) => {
            fc.pre(unrelatedUserId !== patient.userId && unrelatedUserId !== doctor.userId);

            const system = new MessageAccessControl();

            // Setup
            system.addPatient(patient);
            system.addDoctor(doctor);
            
            const connection: Connection = {
              id: fc.sample(uuidArb, 1)[0],
              patientId: patient.id,
              doctorId: doctor.id,
              status: 'active',
            };
            system.addConnection(connection);

            // Unrelated user should NOT be able to read messages
            const result = system.getMessages(unrelatedUserId, connection.id);
            
            expect('allowed' in result && !result.allowed).toBe(true);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('clinic_admin for a different doctor SHALL NOT have access', () => {
      fc.assert(
        fc.property(
          patientArb,
          doctorArb,
          doctorArb, // different doctor
          uuidArb,
          messageContentArb,
          (patient, doctor, otherDoctor, clinicAdminUserId, content) => {
            // Ensure doctors are different
            fc.pre(doctor.id !== otherDoctor.id);

            const system = new MessageAccessControl();

            // Setup
            system.addPatient(patient);
            system.addDoctor(doctor);
            system.addDoctor(otherDoctor);
            
            const connection: Connection = {
              id: fc.sample(uuidArb, 1)[0],
              patientId: patient.id,
              doctorId: doctor.id,
              status: 'active',
            };
            system.addConnection(connection);

            // Add clinic admin role for OTHER doctor
            system.addClinicAdminRole({
              userId: clinicAdminUserId,
              doctorId: otherDoctor.id,
              effectiveUntil: null,
            });

            // Clinic admin for other doctor should NOT have access
            const result = system.sendMessage(clinicAdminUserId, connection.id, content);
            
            expect('allowed' in result && !result.allowed).toBe(true);
            if ('code' in result) {
              expect(result.code).toBe('FORBIDDEN');
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Inactive Connection Prevention', () => {
    it('for any disconnected connection, no user SHALL be able to send messages', () => {
      fc.assert(
        fc.property(
          patientArb,
          doctorArb,
          messageContentArb,
          (patient, doctor, content) => {
            const system = new MessageAccessControl();

            // Setup
            system.addPatient(patient);
            system.addDoctor(doctor);
            
            const connection: Connection = {
              id: fc.sample(uuidArb, 1)[0],
              patientId: patient.id,
              doctorId: doctor.id,
              status: 'disconnected',
            };
            system.addConnection(connection);

            // Patient should NOT be able to send message on disconnected connection
            const patientResult = system.sendMessage(patient.userId, connection.id, content);
            expect('allowed' in patientResult && !patientResult.allowed).toBe(true);

            // Doctor should NOT be able to send message on disconnected connection
            const doctorResult = system.sendMessage(doctor.userId, connection.id, content);
            expect('allowed' in doctorResult && !doctorResult.allowed).toBe(true);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any blocked connection, no user SHALL be able to send messages', () => {
      fc.assert(
        fc.property(
          patientArb,
          doctorArb,
          messageContentArb,
          (patient, doctor, content) => {
            const system = new MessageAccessControl();

            // Setup
            system.addPatient(patient);
            system.addDoctor(doctor);
            
            const connection: Connection = {
              id: fc.sample(uuidArb, 1)[0],
              patientId: patient.id,
              doctorId: doctor.id,
              status: 'blocked',
            };
            system.addConnection(connection);

            // Patient should NOT be able to send message on blocked connection
            const patientResult = system.sendMessage(patient.userId, connection.id, content);
            expect('allowed' in patientResult && !patientResult.allowed).toBe(true);

            // Doctor should NOT be able to send message on blocked connection
            const doctorResult = system.sendMessage(doctor.userId, connection.id, content);
            expect('allowed' in doctorResult && !doctorResult.allowed).toBe(true);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Non-existent Connection', () => {
    it('for any non-existent connection, access SHALL be denied with NOT_FOUND', () => {
      fc.assert(
        fc.property(uuidArb, uuidArb, messageContentArb, (userId, connectionId, content) => {
          const system = new MessageAccessControl();

          // No setup - connection doesn't exist

          const result = system.sendMessage(userId, connectionId, content);
          
          expect('allowed' in result && !result.allowed).toBe(true);
          if ('code' in result) {
            expect(result.code).toBe('NOT_FOUND');
          }

          return true;
        }),
        { numRuns: 100 }
      );
    });
  });
});
