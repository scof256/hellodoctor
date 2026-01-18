/**
 * Unit tests for date utility functions
 * Tests edge cases and specific examples
 */

import { describe, it, expect } from 'vitest';
import { 
  groupMessagesByDate, 
  formatDateLabel, 
  isSameDay,
  getMessageTimestamp,
  MessageWithTimestamp 
} from '@/app/lib/date-utils';

describe('date-utils edge cases', () => {
  describe('groupMessagesByDate', () => {
    it('returns empty array for empty message list (Property 7)', () => {
      const messages: MessageWithTimestamp[] = [];
      const groups = groupMessagesByDate(messages);
      
      expect(groups).toEqual([]);
    });

    it('returns one group for messages on same date (Property 6)', () => {
      const baseDate = new Date(2026, 0, 15);
      const messages: MessageWithTimestamp[] = [
        { id: '1', content: 'msg1', timestamp: new Date(2026, 0, 15, 9, 0, 0) },
        { id: '2', content: 'msg2', timestamp: new Date(2026, 0, 15, 12, 30, 0) },
        { id: '3', content: 'msg3', timestamp: new Date(2026, 0, 15, 18, 45, 0) }
      ];
      
      const groups = groupMessagesByDate(messages);
      
      expect(groups.length).toBe(1);
      expect(groups[0].messages.length).toBe(3);
      expect(groups[0].date.getTime()).toBe(new Date(2026, 0, 15).getTime());
    });

    it('handles single message', () => {
      const messages: MessageWithTimestamp[] = [
        { id: '1', content: 'msg1', timestamp: new Date(2026, 0, 15, 10, 0, 0) }
      ];
      
      const groups = groupMessagesByDate(messages);
      
      expect(groups.length).toBe(1);
      expect(groups[0].messages.length).toBe(1);
      expect(groups[0].messages[0].id).toBe('1');
    });

    it('handles mixed timestamp fields (timestamp vs createdAt)', () => {
      const messages: MessageWithTimestamp[] = [
        { id: '1', content: 'msg1', timestamp: new Date(2026, 0, 15, 10, 0, 0) },
        { id: '2', content: 'msg2', createdAt: new Date(2026, 0, 15, 12, 0, 0) },
        { id: '3', content: 'msg3', timestamp: new Date(2026, 0, 16, 9, 0, 0) },
        { id: '4', content: 'msg4', createdAt: new Date(2026, 0, 16, 14, 0, 0) }
      ];
      
      const groups = groupMessagesByDate(messages);
      
      expect(groups.length).toBe(2);
      expect(groups[0].messages.length).toBe(2);
      expect(groups[1].messages.length).toBe(2);
      
      // Check that messages are in correct groups
      expect(groups[0].messages[0].id).toBe('1');
      expect(groups[0].messages[1].id).toBe('2');
      expect(groups[1].messages[0].id).toBe('3');
      expect(groups[1].messages[1].id).toBe('4');
    });

    it('handles messages spanning multiple days', () => {
      const messages: MessageWithTimestamp[] = [
        { id: '1', content: 'msg1', timestamp: new Date(2026, 0, 15, 10, 0, 0) },
        { id: '2', content: 'msg2', timestamp: new Date(2026, 0, 16, 10, 0, 0) },
        { id: '3', content: 'msg3', timestamp: new Date(2026, 0, 17, 10, 0, 0) }
      ];
      
      const groups = groupMessagesByDate(messages);
      
      expect(groups.length).toBe(3);
      expect(groups[0].messages[0].id).toBe('1');
      expect(groups[1].messages[0].id).toBe('2');
      expect(groups[2].messages[0].id).toBe('3');
    });

    it('sorts messages before grouping', () => {
      const messages: MessageWithTimestamp[] = [
        { id: '3', content: 'msg3', timestamp: new Date(2026, 0, 17, 10, 0, 0) },
        { id: '1', content: 'msg1', timestamp: new Date(2026, 0, 15, 10, 0, 0) },
        { id: '2', content: 'msg2', timestamp: new Date(2026, 0, 16, 10, 0, 0) }
      ];
      
      const groups = groupMessagesByDate(messages);
      
      expect(groups.length).toBe(3);
      // Should be sorted chronologically
      expect(groups[0].messages[0].id).toBe('1');
      expect(groups[1].messages[0].id).toBe('2');
      expect(groups[2].messages[0].id).toBe('3');
    });
  });

  describe('formatDateLabel', () => {
    it('returns "Today" for current date', () => {
      const now = new Date(2026, 0, 15, 14, 30, 0);
      const today = new Date(2026, 0, 15, 10, 0, 0);
      
      const result = formatDateLabel(today, now);
      
      expect(result).toBe('Today');
    });

    it('returns "Yesterday" for previous day', () => {
      const now = new Date(2026, 0, 15, 14, 30, 0);
      const yesterday = new Date(2026, 0, 14, 10, 0, 0);
      
      const result = formatDateLabel(yesterday, now);
      
      expect(result).toBe('Yesterday');
    });

    it('returns "Month Day" for date in current year', () => {
      const now = new Date(2026, 0, 15, 14, 30, 0);
      const dateInYear = new Date(2026, 0, 10, 10, 0, 0);
      
      const result = formatDateLabel(dateInYear, now);
      
      expect(result).toBe('January 10');
    });

    it('returns "Month Day, Year" for date in previous year', () => {
      const now = new Date(2026, 0, 15, 14, 30, 0);
      const dateInPrevYear = new Date(2025, 11, 25, 10, 0, 0);
      
      const result = formatDateLabel(dateInPrevYear, now);
      
      expect(result).toBe('December 25, 2025');
    });

    it('handles date at midnight', () => {
      const now = new Date(2026, 0, 15, 0, 0, 0);
      const today = new Date(2026, 0, 15, 0, 0, 0);
      
      const result = formatDateLabel(today, now);
      
      expect(result).toBe('Today');
    });

    it('handles date at end of day', () => {
      const now = new Date(2026, 0, 15, 23, 59, 59);
      const today = new Date(2026, 0, 15, 23, 59, 59);
      
      const result = formatDateLabel(today, now);
      
      expect(result).toBe('Today');
    });
  });

  describe('isSameDay', () => {
    it('returns true for same date and time', () => {
      const date1 = new Date(2026, 0, 15, 10, 30, 0);
      const date2 = new Date(2026, 0, 15, 10, 30, 0);
      
      expect(isSameDay(date1, date2)).toBe(true);
    });

    it('returns true for same date but different times', () => {
      const date1 = new Date(2026, 0, 15, 9, 0, 0);
      const date2 = new Date(2026, 0, 15, 18, 30, 0);
      
      expect(isSameDay(date1, date2)).toBe(true);
    });

    it('returns false for different dates', () => {
      const date1 = new Date(2026, 0, 15, 10, 0, 0);
      const date2 = new Date(2026, 0, 16, 10, 0, 0);
      
      expect(isSameDay(date1, date2)).toBe(false);
    });

    it('returns false for dates in different months', () => {
      const date1 = new Date(2026, 0, 31, 10, 0, 0);
      const date2 = new Date(2026, 1, 1, 10, 0, 0);
      
      expect(isSameDay(date1, date2)).toBe(false);
    });

    it('returns false for dates in different years', () => {
      const date1 = new Date(2025, 11, 31, 23, 59, 59);
      const date2 = new Date(2026, 0, 1, 0, 0, 0);
      
      expect(isSameDay(date1, date2)).toBe(false);
    });
  });

  describe('getMessageTimestamp', () => {
    it('returns timestamp when present', () => {
      const date = new Date(2026, 0, 15, 10, 0, 0);
      const msg = { id: '1', timestamp: date };
      
      const result = getMessageTimestamp(msg);
      
      expect(result?.getTime()).toBe(date.getTime());
    });

    it('returns createdAt when timestamp is not present', () => {
      const date = new Date(2026, 0, 15, 10, 0, 0);
      const msg = { id: '1', createdAt: date };
      
      const result = getMessageTimestamp(msg);
      
      expect(result?.getTime()).toBe(date.getTime());
    });

    it('prefers timestamp over createdAt', () => {
      const timestamp = new Date(2026, 0, 15, 10, 0, 0);
      const createdAt = new Date(2026, 0, 16, 10, 0, 0);
      const msg = { id: '1', timestamp, createdAt };
      
      const result = getMessageTimestamp(msg);
      
      expect(result?.getTime()).toBe(timestamp.getTime());
    });

    it('returns null for null timestamp', () => {
      const msg = { id: '1', timestamp: null as any };
      
      const result = getMessageTimestamp(msg);
      
      expect(result).toBeNull();
    });

    it('returns null for undefined timestamp', () => {
      const msg = { id: '1' };
      
      const result = getMessageTimestamp(msg);
      
      expect(result).toBeNull();
    });

    it('returns null for invalid Date', () => {
      const msg = { id: '1', timestamp: new Date('invalid') };
      
      const result = getMessageTimestamp(msg);
      
      expect(result).toBeNull();
    });
  });
});
