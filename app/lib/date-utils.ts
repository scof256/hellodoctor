/**
 * Date utility functions for message date separators
 */

export interface MessageWithTimestamp {
  timestamp?: Date;
  createdAt?: Date;
  [key: string]: any;
}

export interface MessageGroup<T extends MessageWithTimestamp = MessageWithTimestamp> {
  date: Date;           // Midnight of the date in local timezone
  messages: T[];        // Messages from that date, in chronological order
}

/**
 * Helper function to check if two dates are on the same calendar day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}

/**
 * Formats a date into a human-friendly label
 * - "Today" for current calendar day
 * - "Yesterday" for previous calendar day
 * - "Month Day" for dates in current year (e.g., "January 15")
 * - "Month Day, Year" for dates in previous years (e.g., "December 25, 2025")
 */
export function formatDateLabel(date: Date, now: Date = new Date()): string {
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const diffMs = nowStart.getTime() - dateStart.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  
  const options: Intl.DateTimeFormatOptions = 
    date.getFullYear() === now.getFullYear()
      ? { month: 'long', day: 'numeric' }
      : { month: 'long', day: 'numeric', year: 'numeric' };
  
  return date.toLocaleDateString('en-US', options);
}

/**
 * Safely extracts timestamp from a message object
 * Returns null if timestamp is missing or invalid
 */
export function getMessageTimestamp(message: MessageWithTimestamp): Date | null {
  const timestamp = message.timestamp || message.createdAt;
  if (!timestamp) return null;
  if (!(timestamp instanceof Date)) return null;
  if (isNaN(timestamp.getTime())) return null;
  return timestamp;
}

/**
 * Groups messages by calendar date in the user's local timezone
 * Returns an array of MessageGroup objects, each containing a date and messages from that date
 * Messages within each group maintain their original chronological order
 */
export function groupMessagesByDate<T extends MessageWithTimestamp>(
  messages: T[]
): MessageGroup<T>[] {
  // Filter out messages with invalid timestamps
  const validMessages = messages
    .map(msg => ({ msg, timestamp: getMessageTimestamp(msg) }))
    .filter((item): item is { msg: T; timestamp: Date } => item.timestamp !== null);

  // Sort by timestamp (ascending)
  validMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  // Group by calendar date
  const groups: MessageGroup<T>[] = [];
  
  for (const { msg, timestamp } of validMessages) {
    // Normalize to midnight in local timezone
    const dateKey = new Date(
      timestamp.getFullYear(),
      timestamp.getMonth(),
      timestamp.getDate()
    );
    
    // Check if we already have a group for this date
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && isSameDay(lastGroup.date, dateKey)) {
      // Add to existing group
      lastGroup.messages.push(msg);
    } else {
      // Create new group
      groups.push({
        date: dateKey,
        messages: [msg]
      });
    }
  }
  
  return groups;
}
