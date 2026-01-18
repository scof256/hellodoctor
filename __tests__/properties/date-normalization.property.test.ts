/**
 * Feature: message-date-separators, Property 4: Date Normalization to Local Timezone
 * 
 * For any collection of messages, all dates in the resulting MessageGroup objects should 
 * be normalized to midnight (00:00:00) in the user's local timezone, and all messages 
 * within a group should share the same calendar date.
 * 
 * Validates: Requirements 4.1, 4.4
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

describe('Property 4: Date Normalization to Local Timezone', () => {
  it('all group dates are normalized to midnight', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryMessage, { minLength: 1, maxLength: 50 }),
        (messages) => {
          const groups = groupMessagesByDate(messages);
          
          for (const group of groups) {
            // Group date should be at midnight (00:00:00.000) in local timezone
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

  it('all messages in a group share the same calendar date as the group date', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryMessage, { minLength: 1, maxLength: 50 }),
        (messages) => {
          const groups = groupMessagesByDate(messages);
          
          for (const group of groups) {
            for (const msg of group.messages) {
              const timestamp = msg.timestamp || msg.createdAt;
              if (timestamp) {
                // Message timestamp should be on the same calendar day as group date
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

  it('messages with different times on same day are grouped together', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('1900-01-01'), max: new Date('2100-12-31') }),
        fc.integer({ min: 2, max: 20 }),
        (baseDate, numMessages) => {
          // Create messages all on the same calendar day but with different times
          const messages: MessageWithTimestamp[] = [];
          for (let i = 0; i < numMessages; i++) {
            messages.push({
              id: `msg-${i}`,
              content: `Message ${i}`,
              timestamp: new Date(
                baseDate.getFullYear(),
                baseDate.getMonth(),
                baseDate.getDate(),
                i % 24, // Different hours
                i % 60, // Different minutes
                i % 60  // Different seconds
              )
            });
          }
          
          const groups = groupMessagesByDate(messages);
          
          // Should have exactly one group since all messages are on the same day
          expect(groups.length).toBe(1);
          
          // All messages should be in that group
          expect(groups[0].messages.length).toBe(numMessages);
          
          // Group date should be normalized to midnight of that day
          const expectedDate = new Date(
            baseDate.getFullYear(),
            baseDate.getMonth(),
            baseDate.getDate()
          );
          expect(groups[0].date.getTime()).toBe(expectedDate.getTime());
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('messages at 23:59:59 and 00:00:01 on different days are in different groups', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('1900-01-01'), max: new Date('2100-12-31') }),
        (baseDate) => {
          const messages: MessageWithTimestamp[] = [
            {
              id: 'msg-1',
              content: 'Late night message',
              timestamp: new Date(
                baseDate.getFullYear(),
                baseDate.getMonth(),
                baseDate.getDate(),
                23,
                59,
                59
              )
            },
            {
              id: 'msg-2',
              content: 'Early morning message',
              timestamp: new Date(
                baseDate.getFullYear(),
                baseDate.getMonth(),
                baseDate.getDate() + 1,
                0,
                0,
                1
              )
            }
          ];
          
          const groups = groupMessagesByDate(messages);
          
          // Should have two groups since messages are on different calendar days
          expect(groups.length).toBe(2);
          
          // Each group should have one message
          expect(groups[0].messages.length).toBe(1);
          expect(groups[1].messages.length).toBe(1);
          
          // Group dates should be different
          expect(groups[0].date.getTime()).not.toBe(groups[1].date.getTime());
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('date normalization uses local timezone consistently', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryMessage, { minLength: 1, maxLength: 50 }),
        (messages) => {
          const groups = groupMessagesByDate(messages);
          
          for (const group of groups) {
            // Verify that the group date is in local timezone by checking
            // that it matches the expected midnight for that date
            const year = group.date.getFullYear();
            const month = group.date.getMonth();
            const day = group.date.getDate();
            
            const expectedMidnight = new Date(year, month, day);
            
            expect(group.date.getTime()).toBe(expectedMidnight.getTime());
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('messages with createdAt field are also normalized correctly', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string(),
            content: fc.string(),
            // Use a more reasonable date range to avoid historical timezone offset issues
            createdAt: fc.date({ min: new Date('2000-01-01'), max: new Date('2100-12-31') })
          }),
          { minLength: 1, maxLength: 50 }
        ),
        (messages) => {
          const groups = groupMessagesByDate(messages);
          
          for (const group of groups) {
            // Group date should be at midnight
            expect(group.date.getHours()).toBe(0);
            expect(group.date.getMinutes()).toBe(0);
            expect(group.date.getSeconds()).toBe(0);
            expect(group.date.getMilliseconds()).toBe(0);
            
            // All messages should share the same calendar date
            for (const msg of group.messages) {
              const timestamp = msg.createdAt;
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
});
