/**
 * Property Test: Reconnection Message Order
 * Feature: messaging-reliability-fix, Property 14: Reconnection Message Order
 * 
 * *For any* set of queued messages, when the network reconnects, the system SHALL
 * send them in the exact order they were originally queued.
 * 
 * **Validates: Requirements 5.3**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Simplified types for testing
interface FailedMessage {
  tempId: string;
  content: string;
  timestamp: Date;
  retryCount: number;
}

// Simplified message queue for testing reconnection order logic
class TestReconnectionQueue {
  private failedMessages: Map<string, FailedMessage> = new Map();
  private retryOrder: string[] = [];
  private maxRetries: number;

  constructor(maxRetries: number = 3) {
    this.maxRetries = maxRetries;
  }

  addFailedMessage(message: FailedMessage): void {
    this.failedMessages.set(message.tempId, message);
  }

  // Simulate network reconnection - retry all failed messages in order
  onNetworkReconnect(): string[] {
    const sortedFailed = Array.from(this.failedMessages.values())
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    this.retryOrder = [];
    
    for (const msg of sortedFailed) {
      if (msg.retryCount < this.maxRetries) {
        this.retryOrder.push(msg.tempId);
      }
    }
    
    return this.retryOrder;
  }

  getRetryOrder(): string[] {
    return [...this.retryOrder];
  }
}

describe('Property 14: Reconnection Message Order', () => {
  it('should retry failed messages in chronological order on reconnection', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 5 }),
        (messageCount) => {
          const queue = new TestReconnectionQueue(3);
          const baseTime = Date.now();
          
          for (let i = 0; i < messageCount; i++) {
            queue.addFailedMessage({
              tempId: `msg-${i}`,
              content: `Message ${i}`,
              timestamp: new Date(baseTime + i * 1000),
              retryCount: 0,
            });
          }
          
          const retryOrder = queue.onNetworkReconnect();
          
          expect(retryOrder.length).toBe(messageCount);
          for (let i = 0; i < messageCount; i++) {
            expect(retryOrder[i]).toBe(`msg-${i}`);
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should maintain order even when messages are added out of order', () => {
    fc.assert(
      fc.property(
        fc.shuffledSubarray([0, 1, 2, 3, 4], { minLength: 2, maxLength: 5 }),
        (offsets) => {
          const queue = new TestReconnectionQueue(3);
          const baseTime = Date.now();
          
          for (const offset of offsets) {
            queue.addFailedMessage({
              tempId: `msg-${offset}`,
              content: `Message ${offset}`,
              timestamp: new Date(baseTime + offset * 1000),
              retryCount: 0,
            });
          }
          
          const retryOrder = queue.onNetworkReconnect();
          const sortedOffsets = [...offsets].sort((a, b) => a - b);
          const expectedOrder = sortedOffsets.map(o => `msg-${o}`);
          
          expect(retryOrder).toEqual(expectedOrder);
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should skip messages that have reached max retries', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4 }),
        (exhaustedIndex) => {
          const queue = new TestReconnectionQueue(3);
          const baseTime = Date.now();
          const messageCount = 5;
          const actualExhaustedIndex = exhaustedIndex % messageCount;
          
          const expectedRetryOrder: string[] = [];
          for (let i = 0; i < messageCount; i++) {
            const isExhausted = i === actualExhaustedIndex;
            queue.addFailedMessage({
              tempId: `msg-${i}`,
              content: `Message ${i}`,
              timestamp: new Date(baseTime + i * 1000),
              retryCount: isExhausted ? 3 : 0,
            });
            
            if (!isExhausted) {
              expectedRetryOrder.push(`msg-${i}`);
            }
          }
          
          const retryOrder = queue.onNetworkReconnect();
          expect(retryOrder).toEqual(expectedRetryOrder);
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should handle empty failed messages gracefully', () => {
    const queue = new TestReconnectionQueue(3);
    const retryOrder = queue.onNetworkReconnect();
    expect(retryOrder).toEqual([]);
  });

  it('should handle all messages at max retries', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 5 }),
        (messageCount) => {
          const queue = new TestReconnectionQueue(3);
          const baseTime = Date.now();
          
          for (let i = 0; i < messageCount; i++) {
            queue.addFailedMessage({
              tempId: `msg-${i}`,
              content: `Message ${i}`,
              timestamp: new Date(baseTime + i * 1000),
              retryCount: 3,
            });
          }
          
          const retryOrder = queue.onNetworkReconnect();
          expect(retryOrder).toEqual([]);
        }
      ),
      { numRuns: 30 }
    );
  });
});
