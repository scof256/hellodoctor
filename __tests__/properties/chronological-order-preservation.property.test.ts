/**
 * Feature: message-date-separators, Property 2: Chronological Order Preservation
 * 
 * For any collection of messages, when grouped by date, the messages within each group 
 * should maintain their original chronological order relative to each other.
 * 
 * Validates: Requirements 4.2
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { groupMessagesByDate, MessageWithTimestamp } from '@/app/lib/date-utils';

// Arbitrary generator for messages with timestamps
// Constrain dates to valid JavaScript Date range (1900-2100)
const arbitraryMessage = fc.record({
  id: fc.string(),
  content: fc.string(),
  timestamp: fc.date({ min: new Date('1900-01-01'), max: new Date('2100-12-31') })
}) as fc.Arbitrary<MessageWithTimestamp>;

describe('Property 2: Chronological Order Preservation', () => {
  it('messages within each group maintain chronological order', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryMessage, { minLength: 1, maxLength: 50 }),
        (messages) => {
          const groups = groupMessagesByDate(messages);
          
          for (const group of groups) {
            // Check that messages within the group are in chronological order
            for (let i = 1; i < group.messages.length; i++) {
              const prevTimestamp = group.messages[i - 1].timestamp || group.messages[i - 1].createdAt;
              const currTimestamp = group.messages[i].timestamp || group.messages[i].createdAt;
              
              if (prevTimestamp && currTimestamp) {
                expect(currTimestamp.getTime()).toBeGreaterThanOrEqual(prevTimestamp.getTime());
              }
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('relative order of messages is preserved after grouping', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryMessage, { minLength: 2, maxLength: 50 }),
        (messages) => {
          // Filter valid messages and sort them
          const validMessages = messages.filter(msg => {
            const timestamp = msg.timestamp || msg.createdAt;
            return timestamp && timestamp instanceof Date && !isNaN(timestamp.getTime());
          });
          
          if (validMessages.length < 2) return true;
          
          const sortedMessages = [...validMessages].sort((a, b) => {
            const aTime = (a.timestamp || a.createdAt)!.getTime();
            const bTime = (b.timestamp || b.createdAt)!.getTime();
            return aTime - bTime;
          });
          
          const groups = groupMessagesByDate(messages);
          
          // Flatten grouped messages
          const flattenedGroupedMessages = groups.flatMap(group => group.messages);
          
          // The flattened grouped messages should match the sorted order
          expect(flattenedGroupedMessages.length).toBe(sortedMessages.length);
          
          for (let i = 0; i < flattenedGroupedMessages.length; i++) {
            expect(flattenedGroupedMessages[i]).toBe(sortedMessages[i]);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('grouping does not reorder messages within the same day', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.date({ min: new Date('1900-01-01'), max: new Date('2100-12-31') }),
        (numMessages, baseDate) => {
          // Create messages all on the same day but with different times
          const messages: MessageWithTimestamp[] = [];
          for (let i = 0; i < numMessages; i++) {
            messages.push({
              id: `msg-${i}`,
              content: `Message ${i}`,
              timestamp: new Date(
                baseDate.getFullYear(),
                baseDate.getMonth(),
                baseDate.getDate(),
                Math.floor(i * 24 / numMessages), // Spread across the day
                i % 60,
                i % 60
              )
            });
          }
          
          const groups = groupMessagesByDate(messages);
          
          // Should have exactly one group
          expect(groups.length).toBe(1);
          
          // Messages should be in order
          const group = groups[0];
          for (let i = 0; i < group.messages.length; i++) {
            expect(group.messages[i].id).toBe(`msg-${i}`);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('messages from different days maintain relative order across groups', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryMessage, { minLength: 2, maxLength: 50 }),
        (messages) => {
          const validMessages = messages.filter(msg => {
            const timestamp = msg.timestamp || msg.createdAt;
            return timestamp && timestamp instanceof Date && !isNaN(timestamp.getTime());
          });
          
          if (validMessages.length < 2) return true;
          
          const groups = groupMessagesByDate(messages);
          
          // For any two messages in the flattened result, if message A comes before message B,
          // then A's timestamp should be <= B's timestamp
          const flattenedMessages = groups.flatMap(group => group.messages);
          
          for (let i = 0; i < flattenedMessages.length - 1; i++) {
            const msgA = flattenedMessages[i];
            const msgB = flattenedMessages[i + 1];
            
            const timestampA = (msgA.timestamp || msgA.createdAt)!;
            const timestampB = (msgB.timestamp || msgB.createdAt)!;
            
            expect(timestampA.getTime()).toBeLessThanOrEqual(timestampB.getTime());
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
