/**
 * Feature: doctor-appointment-saas, Property 3: Appointment Slot Availability
 * 
 * For any time slot that has been booked for an appointment with status 
 * 'pending' or 'confirmed', that slot SHALL NOT appear in the available 
 * slots response for the same doctor.
 * 
 * Validates: Requirements 9.5
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Types for testing
interface Doctor {
  id: string;
  appointmentDuration: number; // minutes
  bufferTime: number; // minutes
}

interface DoctorAvailability {
  doctorId: string;
  dayOfWeek: number; // 0-6
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  isActive: boolean;
}

interface Appointment {
  id: string;
  connectionId: string;
  doctorId: string;
  scheduledAt: Date;
  duration: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
}

interface TimeSlot {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  reason?: string;
}

/**
 * Parse time string (HH:MM) to minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours! * 60 + minutes!;
}

/**
 * Convert minutes since midnight to time string (HH:MM)
 */
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Generate time slots for a given day based on doctor's availability
 */
function generateTimeSlots(
  startTime: string,
  endTime: string,
  duration: number,
  bufferTime: number
): { startTime: string; endTime: string }[] {
  const slots: { startTime: string; endTime: string }[] = [];
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  const slotLength = duration + bufferTime;

  let currentStart = startMinutes;
  while (currentStart + duration <= endMinutes) {
    const slotStart = minutesToTime(currentStart);
    const slotEnd = minutesToTime(currentStart + duration);
    slots.push({ startTime: slotStart, endTime: slotEnd });
    currentStart += slotLength;
  }

  return slots;
}

/**
 * Simulated slot availability service
 */
class SlotAvailabilityService {
  private appointments: Appointment[] = [];
  private availability: DoctorAvailability[] = [];
  private blockedDates: Map<string, Set<string>> = new Map(); // doctorId -> Set of date strings

  setAvailability(availability: DoctorAvailability[]): void {
    this.availability = availability;
  }

  addAppointment(appointment: Appointment): void {
    this.appointments.push(appointment);
  }

  blockDate(doctorId: string, date: string): void {
    if (!this.blockedDates.has(doctorId)) {
      this.blockedDates.set(doctorId, new Set());
    }
    this.blockedDates.get(doctorId)!.add(date);
  }

  /**
   * Get available slots for a doctor on a specific date.
   * This implements the core logic being tested.
   */
  getAvailableSlots(
    doctor: Doctor,
    date: string // YYYY-MM-DD
  ): TimeSlot[] {
    const requestedDate = new Date(date);
    const dayOfWeek = requestedDate.getDay();

    // Check if date is blocked
    const blockedSet = this.blockedDates.get(doctor.id);
    if (blockedSet && blockedSet.has(date)) {
      return [];
    }

    // Get availability for this day
    const dayAvailability = this.availability.find(
      (a) => a.doctorId === doctor.id && a.dayOfWeek === dayOfWeek && a.isActive
    );

    if (!dayAvailability) {
      return [];
    }

    // Generate all possible slots
    const allSlots = generateTimeSlots(
      dayAvailability.startTime,
      dayAvailability.endTime,
      doctor.appointmentDuration,
      doctor.bufferTime
    );

    // Get existing appointments for this doctor on this date
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const doctorAppointments = this.appointments.filter((apt) => {
      const aptDate = new Date(apt.scheduledAt);
      return (
        apt.doctorId === doctor.id &&
        aptDate >= dayStart &&
        aptDate <= dayEnd &&
        (apt.status === 'pending' || apt.status === 'confirmed')
      );
    });

    // Mark slots as available or not
    return allSlots.map((slot) => {
      // Check if slot conflicts with existing appointment
      const hasConflict = doctorAppointments.some((apt) => {
        const aptTime = new Date(apt.scheduledAt);
        const aptHours = aptTime.getHours().toString().padStart(2, '0');
        const aptMinutes = aptTime.getMinutes().toString().padStart(2, '0');
        const aptTimeStr = `${aptHours}:${aptMinutes}`;
        return aptTimeStr === slot.startTime;
      });

      if (hasConflict) {
        return { ...slot, isAvailable: false, reason: 'Already booked' };
      }

      return { ...slot, isAvailable: true };
    });
  }

  reset(): void {
    this.appointments = [];
    this.availability = [];
    this.blockedDates.clear();
  }
}

// Arbitrary generators
const uuidArb = fc.uuid();

const doctorArb = fc.record({
  id: uuidArb,
  appointmentDuration: fc.constantFrom(15, 30, 45, 60),
  bufferTime: fc.constantFrom(0, 5, 10, 15),
});

const timeArb = fc.integer({ min: 0, max: 23 }).chain((hour) =>
  fc.integer({ min: 0, max: 59 }).map((minute) =>
    `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
  )
);

const workingHoursArb = fc.tuple(
  fc.integer({ min: 6, max: 12 }), // start hour
  fc.integer({ min: 14, max: 20 })  // end hour
).map(([startHour, endHour]) => ({
  startTime: `${startHour.toString().padStart(2, '0')}:00`,
  endTime: `${endHour.toString().padStart(2, '0')}:00`,
}));

const dayOfWeekArb = fc.integer({ min: 0, max: 6 });

// Generate a future date string (YYYY-MM-DD)
const futureDateArb = fc.integer({ min: 1, max: 30 }).map((daysAhead) => {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().split('T')[0];
});

const appointmentStatusArb = fc.constantFrom(
  'pending' as const,
  'confirmed' as const,
  'completed' as const,
  'cancelled' as const,
  'no_show' as const
);

describe('Property 3: Appointment Slot Availability', () => {
  describe('Booked Slot Exclusion', () => {
    it('for any booked slot with pending/confirmed status, that slot SHALL NOT be available', () => {
      fc.assert(
        fc.property(
          doctorArb,
          workingHoursArb,
          futureDateArb,
          (doctor, hours, dateStr) => {
            const service = new SlotAvailabilityService();

            // Get day of week for the date
            const date = new Date(dateStr);
            const dayOfWeek = date.getDay();

            // Set up availability
            service.setAvailability([
              {
                doctorId: doctor.id,
                dayOfWeek,
                startTime: hours.startTime,
                endTime: hours.endTime,
                isActive: true,
              },
            ]);

            // Get initial available slots
            const initialSlots = service.getAvailableSlots(doctor, dateStr);
            
            if (initialSlots.length === 0) {
              return true; // No slots to test
            }

            // Pick a random available slot to book
            const availableSlots = initialSlots.filter((s) => s.isAvailable);
            if (availableSlots.length === 0) {
              return true;
            }

            const slotToBook = availableSlots[0]!;
            const scheduledAt = new Date(`${dateStr}T${slotToBook.startTime}:00`);

            // Book the slot with pending status
            service.addAppointment({
              id: 'apt-1',
              connectionId: 'conn-1',
              doctorId: doctor.id,
              scheduledAt,
              duration: doctor.appointmentDuration,
              status: 'pending',
            });

            // Get slots again
            const updatedSlots = service.getAvailableSlots(doctor, dateStr);
            const bookedSlot = updatedSlots.find(
              (s) => s.startTime === slotToBook.startTime
            );

            // The booked slot should NOT be available
            expect(bookedSlot).toBeDefined();
            expect(bookedSlot!.isAvailable).toBe(false);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any confirmed appointment, the slot SHALL NOT be available', () => {
      fc.assert(
        fc.property(
          doctorArb,
          workingHoursArb,
          futureDateArb,
          (doctor, hours, dateStr) => {
            const service = new SlotAvailabilityService();

            const date = new Date(dateStr);
            const dayOfWeek = date.getDay();

            service.setAvailability([
              {
                doctorId: doctor.id,
                dayOfWeek,
                startTime: hours.startTime,
                endTime: hours.endTime,
                isActive: true,
              },
            ]);

            const initialSlots = service.getAvailableSlots(doctor, dateStr);
            const availableSlots = initialSlots.filter((s) => s.isAvailable);
            
            if (availableSlots.length === 0) {
              return true;
            }

            const slotToBook = availableSlots[0]!;
            const scheduledAt = new Date(`${dateStr}T${slotToBook.startTime}:00`);

            // Book with confirmed status
            service.addAppointment({
              id: 'apt-1',
              connectionId: 'conn-1',
              doctorId: doctor.id,
              scheduledAt,
              duration: doctor.appointmentDuration,
              status: 'confirmed',
            });

            const updatedSlots = service.getAvailableSlots(doctor, dateStr);
            const bookedSlot = updatedSlots.find(
              (s) => s.startTime === slotToBook.startTime
            );

            expect(bookedSlot).toBeDefined();
            expect(bookedSlot!.isAvailable).toBe(false);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Cancelled/Completed Slot Availability', () => {
    it('for any cancelled appointment, the slot SHALL be available', () => {
      fc.assert(
        fc.property(
          doctorArb,
          workingHoursArb,
          futureDateArb,
          (doctor, hours, dateStr) => {
            const service = new SlotAvailabilityService();

            const date = new Date(dateStr);
            const dayOfWeek = date.getDay();

            service.setAvailability([
              {
                doctorId: doctor.id,
                dayOfWeek,
                startTime: hours.startTime,
                endTime: hours.endTime,
                isActive: true,
              },
            ]);

            const initialSlots = service.getAvailableSlots(doctor, dateStr);
            const availableSlots = initialSlots.filter((s) => s.isAvailable);
            
            if (availableSlots.length === 0) {
              return true;
            }

            const slotToBook = availableSlots[0]!;
            const scheduledAt = new Date(`${dateStr}T${slotToBook.startTime}:00`);

            // Add cancelled appointment
            service.addAppointment({
              id: 'apt-1',
              connectionId: 'conn-1',
              doctorId: doctor.id,
              scheduledAt,
              duration: doctor.appointmentDuration,
              status: 'cancelled',
            });

            const updatedSlots = service.getAvailableSlots(doctor, dateStr);
            const slot = updatedSlots.find(
              (s) => s.startTime === slotToBook.startTime
            );

            // Cancelled appointment should NOT block the slot
            expect(slot).toBeDefined();
            expect(slot!.isAvailable).toBe(true);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any completed appointment, the slot SHALL be available for rebooking', () => {
      fc.assert(
        fc.property(
          doctorArb,
          workingHoursArb,
          futureDateArb,
          (doctor, hours, dateStr) => {
            const service = new SlotAvailabilityService();

            const date = new Date(dateStr);
            const dayOfWeek = date.getDay();

            service.setAvailability([
              {
                doctorId: doctor.id,
                dayOfWeek,
                startTime: hours.startTime,
                endTime: hours.endTime,
                isActive: true,
              },
            ]);

            const initialSlots = service.getAvailableSlots(doctor, dateStr);
            const availableSlots = initialSlots.filter((s) => s.isAvailable);
            
            if (availableSlots.length === 0) {
              return true;
            }

            const slotToBook = availableSlots[0]!;
            const scheduledAt = new Date(`${dateStr}T${slotToBook.startTime}:00`);

            // Add completed appointment
            service.addAppointment({
              id: 'apt-1',
              connectionId: 'conn-1',
              doctorId: doctor.id,
              scheduledAt,
              duration: doctor.appointmentDuration,
              status: 'completed',
            });

            const updatedSlots = service.getAvailableSlots(doctor, dateStr);
            const slot = updatedSlots.find(
              (s) => s.startTime === slotToBook.startTime
            );

            // Completed appointment should NOT block the slot
            expect(slot).toBeDefined();
            expect(slot!.isAvailable).toBe(true);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Multiple Appointments', () => {
    it('for multiple booked slots, all booked slots SHALL be unavailable', () => {
      fc.assert(
        fc.property(
          doctorArb,
          workingHoursArb,
          futureDateArb,
          fc.integer({ min: 1, max: 3 }),
          (doctor, hours, dateStr, numBookings) => {
            const service = new SlotAvailabilityService();

            const date = new Date(dateStr);
            const dayOfWeek = date.getDay();

            service.setAvailability([
              {
                doctorId: doctor.id,
                dayOfWeek,
                startTime: hours.startTime,
                endTime: hours.endTime,
                isActive: true,
              },
            ]);

            const initialSlots = service.getAvailableSlots(doctor, dateStr);
            const availableSlots = initialSlots.filter((s) => s.isAvailable);
            
            const slotsToBook = availableSlots.slice(0, Math.min(numBookings, availableSlots.length));
            
            if (slotsToBook.length === 0) {
              return true;
            }

            // Book multiple slots
            slotsToBook.forEach((slot, index) => {
              const scheduledAt = new Date(`${dateStr}T${slot.startTime}:00`);
              service.addAppointment({
                id: `apt-${index}`,
                connectionId: `conn-${index}`,
                doctorId: doctor.id,
                scheduledAt,
                duration: doctor.appointmentDuration,
                status: index % 2 === 0 ? 'pending' : 'confirmed',
              });
            });

            const updatedSlots = service.getAvailableSlots(doctor, dateStr);

            // All booked slots should be unavailable
            for (const bookedSlot of slotsToBook) {
              const slot = updatedSlots.find(
                (s) => s.startTime === bookedSlot.startTime
              );
              expect(slot).toBeDefined();
              expect(slot!.isAvailable).toBe(false);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('unbooked slots SHALL remain available when other slots are booked', () => {
      fc.assert(
        fc.property(
          doctorArb,
          workingHoursArb,
          futureDateArb,
          (doctor, hours, dateStr) => {
            const service = new SlotAvailabilityService();

            const date = new Date(dateStr);
            const dayOfWeek = date.getDay();

            service.setAvailability([
              {
                doctorId: doctor.id,
                dayOfWeek,
                startTime: hours.startTime,
                endTime: hours.endTime,
                isActive: true,
              },
            ]);

            const initialSlots = service.getAvailableSlots(doctor, dateStr);
            const availableSlots = initialSlots.filter((s) => s.isAvailable);
            
            if (availableSlots.length < 2) {
              return true; // Need at least 2 slots
            }

            // Book only the first slot
            const slotToBook = availableSlots[0]!;
            const scheduledAt = new Date(`${dateStr}T${slotToBook.startTime}:00`);
            
            service.addAppointment({
              id: 'apt-1',
              connectionId: 'conn-1',
              doctorId: doctor.id,
              scheduledAt,
              duration: doctor.appointmentDuration,
              status: 'pending',
            });

            const updatedSlots = service.getAvailableSlots(doctor, dateStr);

            // Other slots should still be available
            const otherSlots = updatedSlots.filter(
              (s) => s.startTime !== slotToBook.startTime
            );
            
            const stillAvailable = otherSlots.filter((s) => s.isAvailable);
            expect(stillAvailable.length).toBeGreaterThan(0);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Doctor Isolation', () => {
    it('appointments for one doctor SHALL NOT affect another doctor\'s availability', () => {
      fc.assert(
        fc.property(
          doctorArb,
          doctorArb,
          workingHoursArb,
          futureDateArb,
          (doctor1, doctor2, hours, dateStr) => {
            // Ensure different doctors
            if (doctor1.id === doctor2.id) {
              return true;
            }

            const service = new SlotAvailabilityService();

            const date = new Date(dateStr);
            const dayOfWeek = date.getDay();

            // Set up same availability for both doctors
            service.setAvailability([
              {
                doctorId: doctor1.id,
                dayOfWeek,
                startTime: hours.startTime,
                endTime: hours.endTime,
                isActive: true,
              },
              {
                doctorId: doctor2.id,
                dayOfWeek,
                startTime: hours.startTime,
                endTime: hours.endTime,
                isActive: true,
              },
            ]);

            const doctor1Slots = service.getAvailableSlots(doctor1, dateStr);
            const doctor2Slots = service.getAvailableSlots(doctor2, dateStr);

            if (doctor1Slots.length === 0 || doctor2Slots.length === 0) {
              return true;
            }

            // Book a slot for doctor1
            const slotToBook = doctor1Slots.filter((s) => s.isAvailable)[0];
            if (!slotToBook) {
              return true;
            }

            const scheduledAt = new Date(`${dateStr}T${slotToBook.startTime}:00`);
            service.addAppointment({
              id: 'apt-1',
              connectionId: 'conn-1',
              doctorId: doctor1.id,
              scheduledAt,
              duration: doctor1.appointmentDuration,
              status: 'pending',
            });

            // Doctor2's same slot should still be available
            const doctor2UpdatedSlots = service.getAvailableSlots(doctor2, dateStr);
            const doctor2Slot = doctor2UpdatedSlots.find(
              (s) => s.startTime === slotToBook.startTime
            );

            expect(doctor2Slot).toBeDefined();
            expect(doctor2Slot!.isAvailable).toBe(true);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Blocked Dates', () => {
    it('for any blocked date, no slots SHALL be available', () => {
      fc.assert(
        fc.property(
          doctorArb,
          workingHoursArb,
          futureDateArb,
          (doctor, hours, dateStr) => {
            const service = new SlotAvailabilityService();

            const date = new Date(dateStr);
            const dayOfWeek = date.getDay();

            service.setAvailability([
              {
                doctorId: doctor.id,
                dayOfWeek,
                startTime: hours.startTime,
                endTime: hours.endTime,
                isActive: true,
              },
            ]);

            // Block the date
            service.blockDate(doctor.id, dateStr);

            const slots = service.getAvailableSlots(doctor, dateStr);

            // No slots should be returned for blocked date
            expect(slots.length).toBe(0);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('No Availability', () => {
    it('for days without availability, no slots SHALL be returned', () => {
      fc.assert(
        fc.property(
          doctorArb,
          workingHoursArb,
          futureDateArb,
          dayOfWeekArb,
          (doctor, hours, dateStr, availableDayOfWeek) => {
            const service = new SlotAvailabilityService();

            const date = new Date(dateStr);
            const requestedDayOfWeek = date.getDay();

            // Set availability for a different day
            const differentDay = (availableDayOfWeek + 1) % 7;
            if (differentDay === requestedDayOfWeek) {
              return true; // Skip if they happen to match
            }

            service.setAvailability([
              {
                doctorId: doctor.id,
                dayOfWeek: differentDay,
                startTime: hours.startTime,
                endTime: hours.endTime,
                isActive: true,
              },
            ]);

            const slots = service.getAvailableSlots(doctor, dateStr);

            // No slots should be returned for day without availability
            expect(slots.length).toBe(0);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
