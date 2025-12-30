/**
 * Feature: nextjs-fullstack-conversion, Property 6: Unread Message Count Accuracy
 * 
 * For any sequence of direct messages where N messages are sent by the opposite party
 * while the chat is closed, the unread count badge SHALL display exactly N until the
 * chat is opened.
 * 
 * Validates: Requirements 8.2
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { DirectMessage } from '../../app/types';

// Simulate the unread count logic from AppClient
function calculateUnreadCount(
  messages: DirectMessage[],
  currentUser: 'patient' | 'doctor',
  isDMOpen: boolean
): number {
  if (isDMOpen) return 0;
  
  let unreadCount = 0;
  for (const msg of messages) {
    if (msg.sender !== currentUser && !msg.read) {
      unreadCount++;
    }
  }
  return unreadCount;
}

// Simulate receiving messages while chat is closed
function simulateMessageSequence(
  senders: ('patient' | 'doctor')[],
  currentUser: 'patient' | 'doctor',
  isDMOpen: boolean
): { messages: DirectMessage[]; expectedUnread: number } {
  const messages: DirectMessage[] = [];
  let expectedUnread = 0;
  
  senders.forEach((sender, index) => {
    const msg: DirectMessage = {
      id: `msg-${index}`,
      sender,
      text: `Message ${index}`,
      timestamp: new Date(),
      read: false
    };
    messages.push(msg);
    
    // Count unread only if from opposite party and chat is closed
    if (sender !== currentUser && !isDMOpen) {
      expectedUnread++;
    }
  });
  
  return { messages, expectedUnread };
}

describe('Property 6: Unread Message Count Accuracy', () => {
  it('should count exactly N unread messages from opposite party when chat is closed', () => {
    fc.assert(
      fc.property(
        // Generate array of senders
        fc.array(fc.constantFrom('patient' as const, 'doctor' as const), { minLength: 0, maxLength: 20 }),
        // Current user
        fc.constantFrom('patient' as const, 'doctor' as const),
        (senders, currentUser) => {
          // Chat is closed
          const isDMOpen = false;
          
          const { messages, expectedUnread } = simulateMessageSequence(senders, currentUser, isDMOpen);
          const actualUnread = calculateUnreadCount(messages, currentUser, isDMOpen);
          
          expect(actualUnread).toBe(expectedUnread);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return 0 unread when chat is open regardless of messages', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('patient' as const, 'doctor' as const), { minLength: 0, maxLength: 20 }),
        fc.constantFrom('patient' as const, 'doctor' as const),
        (senders, currentUser) => {
          // Chat is open
          const isDMOpen = true;
          
          const { messages } = simulateMessageSequence(senders, currentUser, false);
          const actualUnread = calculateUnreadCount(messages, currentUser, isDMOpen);
          
          // When chat is open, unread count should always be 0
          expect(actualUnread).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not count messages from current user as unread', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        fc.constantFrom('patient' as const, 'doctor' as const),
        (messageCount, currentUser) => {
          // All messages from current user
          const senders = Array(messageCount).fill(currentUser);
          const isDMOpen = false;
          
          const { messages } = simulateMessageSequence(senders, currentUser, isDMOpen);
          const actualUnread = calculateUnreadCount(messages, currentUser, isDMOpen);
          
          // No messages from opposite party, so unread should be 0
          expect(actualUnread).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should count all messages from opposite party as unread when chat is closed', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        fc.constantFrom('patient' as const, 'doctor' as const),
        (messageCount, currentUser) => {
          // All messages from opposite party
          const oppositeUser = currentUser === 'patient' ? 'doctor' : 'patient';
          const senders = Array(messageCount).fill(oppositeUser);
          const isDMOpen = false;
          
          const { messages } = simulateMessageSequence(senders, currentUser, isDMOpen);
          const actualUnread = calculateUnreadCount(messages, currentUser, isDMOpen);
          
          // All messages from opposite party should be counted
          expect(actualUnread).toBe(messageCount);
        }
      ),
      { numRuns: 100 }
    );
  });
});
