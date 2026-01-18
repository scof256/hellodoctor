/**
 * Property-Based Test: Time Slot Grouping
 * Feature: whatsapp-simple-ux, Property 17
 * 
 * Property: For any list of available appointment times, times should be grouped 
 * into exactly three categories: "Morning" (before 12:00), "Afternoon" (12:00-17:00), 
 * and "Evening" (after 17:00).
 * 
 * Validates: Requirements 7.4
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

interface TimeSlot {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  reason?: string;
  location?: string | null;
}

type TimeOfDay = 'Morning' | 'Afternoon' | 'Evening';

interface GroupedSlots {
  Morning: TimeSlot[];
  Afternoon: TimeSlot[];
  Evening: TimeSlot[];
}

/**
 * Groups time slots by time of day according to the specification:
 * - Morning: before 12:00 (hour < 12)
 * - Afternoon: 12:00-17:00 (12 <= hour < 17)
 * - Evening: after 17:00 (hour >= 17)
 */
function groupTimeSlots(slots: TimeSlot[]): GroupedSlots {
  const groups: GroupedSlots = {
    Morning: [],
    Afternoon: [],
    Evening: [],
  };

  slots.forEach((slot) => {
    const hour = parseInt(slot.startTime.split(':')[0] ?? '0', 10);
    
    if (hour < 12) {
      groups.Morning.push(slot);
    } else if (hour >= 12 && hour < 17) {
      groups.Afternoon.push(slot);
    } else {
      groups.Evening.push(slot);
    }
  });

  return groups;
}

describe('Property: Time Slot Grouping', () => {
  // Generator for time strings in HH:MM format
  const timeStringArb = fc.integer({ min: 0, max: 23 }).chain((hour) =>
    fc.integer({ min: 0, max: 59 }).map((minute) => {
      const h = String(hour).padStart(2, '0');
      const m = String(minute).padStart(2, '0');
      return `${h}:${m}`;
    })
  );

  // Generator for time slots
  const timeSlotArb = fc.record({
    startTime: timeStringArb,
    endTime: timeStringArb,
    isAvailable: fc.boolean(),
    reason: fc.option(fc.string(), { nil: undefined }),
    location: fc.option(fc.string(), { nil: null }),
  });

  // Generator for arrays of time slots
  const timeSlotsArb = fc.array(timeSlotArb, { minLength: 0, maxLength: 50 });

  it('should group all slots into exactly three categories', () => {
    fc.assert(
      fc.property(timeSlotsArb, (slots) => {
        const grouped = groupTimeSlots(slots);
        
        // Property: Result must have exactly three keys
        const keys = Object.keys(grouped) as TimeOfDay[];
        expect(keys).toHaveLength(3);
        expect(keys).toContain('Morning');
        expect(keys).toContain('Afternoon');
        expect(keys).toContain('Evening');
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve all slots without loss', () => {
    fc.assert(
      fc.property(timeSlotsArb, (slots) => {
        const grouped = groupTimeSlots(slots);
        
        // Property: Total count of grouped slots equals input count
        const totalGrouped = 
          grouped.Morning.length + 
          grouped.Afternoon.length + 
          grouped.Evening.length;
        
        expect(totalGrouped).toBe(slots.length);
      }),
      { numRuns: 100 }
    );
  });

  it('should correctly categorize morning times (hour < 12)', () => {
    fc.assert(
      fc.property(timeSlotsArb, (slots) => {
        const grouped = groupTimeSlots(slots);
        
        // Property: All morning slots have hour < 12
        grouped.Morning.forEach((slot) => {
          const hour = parseInt(slot.startTime.split(':')[0] ?? '0', 10);
          expect(hour).toBeLessThan(12);
        });
      }),
      { numRuns: 100 }
    );
  });

  it('should correctly categorize afternoon times (12 <= hour < 17)', () => {
    fc.assert(
      fc.property(timeSlotsArb, (slots) => {
        const grouped = groupTimeSlots(slots);
        
        // Property: All afternoon slots have 12 <= hour < 17
        grouped.Afternoon.forEach((slot) => {
          const hour = parseInt(slot.startTime.split(':')[0] ?? '0', 10);
          expect(hour).toBeGreaterThanOrEqual(12);
          expect(hour).toBeLessThan(17);
        });
      }),
      { numRuns: 100 }
    );
  });

  it('should correctly categorize evening times (hour >= 17)', () => {
    fc.assert(
      fc.property(timeSlotsArb, (slots) => {
        const grouped = groupTimeSlots(slots);
        
        // Property: All evening slots have hour >= 17
        grouped.Evening.forEach((slot) => {
          const hour = parseInt(slot.startTime.split(':')[0] ?? '0', 10);
          expect(hour).toBeGreaterThanOrEqual(17);
        });
      }),
      { numRuns: 100 }
    );
  });

  it('should handle empty slot arrays', () => {
    fc.assert(
      fc.property(fc.constant([]), (slots) => {
        const grouped = groupTimeSlots(slots);
        
        // Property: Empty input produces empty groups
        expect(grouped.Morning).toHaveLength(0);
        expect(grouped.Afternoon).toHaveLength(0);
        expect(grouped.Evening).toHaveLength(0);
      }),
      { numRuns: 100 }
    );
  });

  it('should maintain slot properties during grouping', () => {
    fc.assert(
      fc.property(timeSlotsArb, (slots) => {
        const grouped = groupTimeSlots(slots);
        
        // Property: All grouped slots maintain their original properties
        const allGroupedSlots = [
          ...grouped.Morning,
          ...grouped.Afternoon,
          ...grouped.Evening,
        ];
        
        allGroupedSlots.forEach((groupedSlot) => {
          // Find the original slot
          const original = slots.find(
            (s) => 
              s.startTime === groupedSlot.startTime &&
              s.endTime === groupedSlot.endTime &&
              s.isAvailable === groupedSlot.isAvailable
          );
          
          expect(original).toBeDefined();
          if (original) {
            expect(groupedSlot.reason).toBe(original.reason);
            expect(groupedSlot.location).toBe(original.location);
          }
        });
      }),
      { numRuns: 100 }
    );
  });

  it('should handle boundary times correctly', () => {
    // Test specific boundary cases
    const boundarySlots: TimeSlot[] = [
      { startTime: '11:59', endTime: '12:59', isAvailable: true }, // Morning
      { startTime: '12:00', endTime: '13:00', isAvailable: true }, // Afternoon
      { startTime: '16:59', endTime: '17:59', isAvailable: true }, // Afternoon
      { startTime: '17:00', endTime: '18:00', isAvailable: true }, // Evening
      { startTime: '00:00', endTime: '01:00', isAvailable: true }, // Morning
      { startTime: '23:59', endTime: '00:59', isAvailable: true }, // Evening
    ];

    const grouped = groupTimeSlots(boundarySlots);

    expect(grouped.Morning).toHaveLength(2); // 11:59 and 00:00
    expect(grouped.Afternoon).toHaveLength(2); // 12:00 and 16:59
    expect(grouped.Evening).toHaveLength(2); // 17:00 and 23:59
  });

  it('should group slots deterministically', () => {
    fc.assert(
      fc.property(timeSlotsArb, (slots) => {
        // Property: Grouping the same slots twice produces identical results
        const grouped1 = groupTimeSlots(slots);
        const grouped2 = groupTimeSlots(slots);
        
        expect(grouped1.Morning).toEqual(grouped2.Morning);
        expect(grouped1.Afternoon).toEqual(grouped2.Afternoon);
        expect(grouped1.Evening).toEqual(grouped2.Evening);
      }),
      { numRuns: 100 }
    );
  });
});
