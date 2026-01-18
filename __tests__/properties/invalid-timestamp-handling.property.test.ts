/**
 * Feature: message-date-separators, Property 5: Graceful Handling of Invalid Timestamps
 * 
 * For any collection of messages including those with null, undefined, or invalid timestamp 
 * values, the grouping function should not throw errors and should either skip invalid 
 * messages or handle them gracefully.
 * 
 * Validates: Requirements 4.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { groupMessagesByDate, MessageWithTimestamp, getMessageTimestamp } from '@/app/lib/date-utils';

describe('Property 5: Graceful Handling of Invalid Timestamps', () => {
  it('does not throw errors with null timestamps', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string(),
            content: fc.string(),
            timestamp: fc.constant(null)
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (messages) => {
          expect(() => groupMessagesByDate(messages)).not.toThrow();
          
          const groups = groupMessagesByDate(messages);
          // Should return empty array since all timestamps are null
          expect(groups).toEqual([]);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('does not throw errors with undefined timestamps', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string(),
            content: fc.string()
            // No timestamp or createdAt field
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (messages) => {
          expect(() => groupMessagesByDate(messages)).not.toThrow();
          
          const groups = groupMessagesByDate(messages);
          // Should return empty array since all timestamps are undefined
          expect(groups).toEqual([]);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('does not throw errors with invalid Date objects', () => {
    const messages: MessageWithTimestamp[] = [
      { id: '1', content: 'msg1', timestamp: new Date('invalid') },
      { id: '2', content: 'msg2', timestamp: new Date('not a date') },
      { id: '3', content: 'msg3', timestamp: new Date(NaN) }
    ];
    
    expect(() => groupMessagesByDate(messages)).not.toThrow();
    
    const groups = groupMessagesByDate(messages);
    // Should return empty array since all timestamps are invalid
    expect(groups).toEqual([]);
  });

  it('filters out invalid messages and processes valid ones', () => {
    fc.assert(
      fc.property(
        fc.array(fc.date({ min: new Date('1900-01-01'), max: new Date('2100-12-31') }), { minLength: 1, maxLength: 20 }),
        fc.integer({ min: 1, max: 10 }),
        (validDates, numInvalid) => {
          // Create mix of valid and invalid messages
          const messages: MessageWithTimestamp[] = [
            ...validDates.map((date, i) => ({
              id: `valid-${i}`,
              content: `Valid message ${i}`,
              timestamp: date
            })),
            ...Array.from({ length: numInvalid }, (_, i) => ({
              id: `invalid-${i}`,
              content: `Invalid message ${i}`,
              timestamp: null as any
            }))
          ];
          
          // Shuffle messages
          messages.sort(() => Math.random() - 0.5);
          
          const groups = groupMessagesByDate(messages);
          
          // Count total messages in groups
          const totalGroupedMessages = groups.reduce((sum, group) => sum + group.messages.length, 0);
          
          // Should only include valid messages
          expect(totalGroupedMessages).toBe(validDates.length);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('getMessageTimestamp returns null for invalid timestamps', () => {
    const invalidMessages: MessageWithTimestamp[] = [
      { id: '1', timestamp: null as any },
      { id: '2', timestamp: undefined },
      { id: '3', timestamp: new Date('invalid') },
      { id: '4', createdAt: null as any },
      { id: '5', createdAt: undefined },
      { id: '6' }, // No timestamp field at all
    ];
    
    for (const msg of invalidMessages) {
      const result = getMessageTimestamp(msg);
      expect(result).toBeNull();
    }
  });

  it('getMessageTimestamp returns valid Date for valid timestamps', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('1900-01-01'), max: new Date('2100-12-31') }),
        (date) => {
          const msgWithTimestamp = { id: '1', timestamp: date };
          const msgWithCreatedAt = { id: '2', createdAt: date };
          
          const result1 = getMessageTimestamp(msgWithTimestamp);
          const result2 = getMessageTimestamp(msgWithCreatedAt);
          
          expect(result1).toBeInstanceOf(Date);
          expect(result2).toBeInstanceOf(Date);
          expect(result1?.getTime()).toBe(date.getTime());
          expect(result2?.getTime()).toBe(date.getTime());
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('prefers timestamp over createdAt when both exist', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('1900-01-01'), max: new Date('2100-12-31') }),
        fc.date({ min: new Date('1900-01-01'), max: new Date('2100-12-31') }),
        (timestamp, createdAt) => {
          const msg = {
            id: '1',
            timestamp,
            createdAt
          };
          
          const result = getMessageTimestamp(msg);
          
          expect(result?.getTime()).toBe(timestamp.getTime());
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('handles mixed valid and invalid messages without errors', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            fc.record({ id: fc.string(), content: fc.string(), timestamp: fc.date({ min: new Date('1900-01-01'), max: new Date('2100-12-31') }) }),
            fc.record({ id: fc.string(), content: fc.string(), timestamp: fc.constant(null) }),
            fc.record({ id: fc.string(), content: fc.string() }),
            fc.record({ id: fc.string(), content: fc.string(), timestamp: fc.constant(new Date('invalid')) })
          ),
          { minLength: 1, maxLength: 50 }
        ),
        (messages) => {
          expect(() => groupMessagesByDate(messages)).not.toThrow();
          
          const groups = groupMessagesByDate(messages);
          
          // All groups should be valid
          for (const group of groups) {
            expect(group.date).toBeInstanceOf(Date);
            expect(isNaN(group.date.getTime())).toBe(false);
            expect(group.messages.length).toBeGreaterThan(0);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
