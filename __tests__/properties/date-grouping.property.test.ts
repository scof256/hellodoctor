/**
 * Feature: message-date-separators, Property 1: Date Boundary Separators
 * 
 * For any collection of messages with different calendar dates, the grouping function 
 * should create a separate MessageGroup for each unique calendar date, ensuring date 
 * boundaries are properly identified.
 * 
 * Validates: Requirements 1.1
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { groupMessagesByDate, MessageWithTimestamp, isSameDay } from '@/app/lib/date-utils';

// Arbitrary generator for messages with timestamps
// Constrain dates to valid JavaScript Date range (1900-2100)
const arbitraryMessage = fc.record({
  id: fc.string(),
  content: fc.string(),
  timestamp: fc.date({ min: new Date('1900-01-01'), max: new Date('2100-12-31') })
}) as fc.Arbitrary<MessageWithTimestamp>;

describe('Property 1: Date Boundary Separators', () => {
  it('creates separate groups for each unique calendar date', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryMessage, { minLength: 1, maxLength: 50 }),
        (messages) => {
          const groups = groupMessagesByDate(messages);
          
          // Count unique calendar dates in input
          const uniqueDates = new Set<string>();
          for (const msg of messages) {
            const timestamp = msg.timestamp || msg.createdAt;
            if (timestamp && timestamp instanceof Date && !isNaN(timestamp.getTime())) {
              const dateKey = `${timestamp.getFullYear()}-${timestamp.getMonth()}-${timestamp.getDate()}`;
              uniqueDates.add(dateKey);
            }
          }
          
          // Number of groups should equal number of unique dates
          expect(groups.length).toBe(uniqueDates.size);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('all messages in a group share the same calendar date', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryMessage, { minLength: 1, maxLength: 50 }),
        (messages) => {
          const groups = groupMessagesByDate(messages);
          
          for (const group of groups) {
            // All messages in the group should have the same calendar date as the group date
            for (const msg of group.messages) {
              const timestamp = msg.timestamp || msg.createdAt;
              if (timestamp) {
                expect(isSameDay(timestamp, group.date)).toBe(true);
              }
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('group dates are normalized to midnight', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryMessage, { minLength: 1, maxLength: 50 }),
        (messages) => {
          const groups = groupMessagesByDate(messages);
          
          for (const group of groups) {
            // Group date should be at midnight (00:00:00.000)
            expect(group.date.getHours()).toBe(0);
            expect(group.date.getMinutes()).toBe(0);
            expect(group.date.getSeconds()).toBe(0);
            expect(group.date.getMilliseconds()).toBe(0);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('groups are ordered chronologically', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryMessage, { minLength: 2, maxLength: 50 }),
        (messages) => {
          const groups = groupMessagesByDate(messages);
          
          // Each group should come after the previous group chronologically
          for (let i = 1; i < groups.length; i++) {
            expect(groups[i].date.getTime()).toBeGreaterThan(groups[i - 1].date.getTime());
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('each group contains at least one message', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryMessage, { minLength: 1, maxLength: 50 }),
        (messages) => {
          const groups = groupMessagesByDate(messages);
          
          for (const group of groups) {
            expect(group.messages.length).toBeGreaterThan(0);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('total messages in groups equals valid input messages', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryMessage, { minLength: 1, maxLength: 50 }),
        (messages) => {
          const groups = groupMessagesByDate(messages);
          
          // Count valid messages in input
          const validMessages = messages.filter(msg => {
            const timestamp = msg.timestamp || msg.createdAt;
            return timestamp && timestamp instanceof Date && !isNaN(timestamp.getTime());
          });
          
          // Count messages in all groups
          const totalGroupedMessages = groups.reduce((sum, group) => sum + group.messages.length, 0);
          
          expect(totalGroupedMessages).toBe(validMessages.length);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
