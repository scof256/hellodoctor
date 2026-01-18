'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Message } from '../types';
import { MemoizedMessage } from './optimized/MemoizedMessage';

/**
 * Virtual Message List Component
 * Requirements: 7.1, 7.4, 7.5
 * 
 * Implements virtual scrolling for large message lists to reduce DOM nodes.
 * Only renders visible messages plus a buffer zone above and below the viewport.
 */

export interface VirtualMessageListProps {
  messages: Message[];
  itemHeight: number;
  bufferSize?: number; // Default: 10
  onLoadMore?: () => void;
  variant?: 'patient' | 'doctor';
  onImageClick?: (img: string) => void;
  containerHeight: number;
  /** If true, automatically scroll to bottom when new messages arrive */
  autoScrollToBottom?: boolean;
}

export interface VirtualScrollState {
  scrollTop: number;
  visibleStartIndex: number;
  visibleEndIndex: number;
  totalHeight: number;
}

export interface VirtualItem<T> {
  index: number;
  data: T;
  style: { position: 'absolute'; top: number; height: number };
}

/**
 * Calculate which items should be visible based on scroll position
 * Requirements: 7.1, 7.5
 */
export function calculateVisibleRange(
  scrollTop: number,
  containerHeight: number,
  itemHeight: number,
  totalItems: number,
  bufferSize: number
): { startIndex: number; endIndex: number } {
  // Calculate the first visible item index
  const firstVisibleIndex = Math.floor(scrollTop / itemHeight);
  
  // Calculate how many items fit in the viewport
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  
  // Apply buffer zones (Requirements: 7.5)
  const startIndex = Math.max(0, firstVisibleIndex - bufferSize);
  const endIndex = Math.min(totalItems - 1, firstVisibleIndex + visibleCount + bufferSize);
  
  return { startIndex, endIndex };
}

/**
 * Calculate the total height of the virtual list
 */
export function calculateTotalHeight(totalItems: number, itemHeight: number): number {
  return totalItems * itemHeight;
}

/**
 * Get the rendered item count for a given configuration
 * This is used for property testing to verify DOM bound
 */
export function getRenderedItemCount(
  containerHeight: number,
  itemHeight: number,
  bufferSize: number
): number {
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  return visibleCount + (2 * bufferSize);
}

/**
 * Calculate the new scroll position after prepending items
 * Requirements: 7.4 - Scroll position preservation
 * 
 * @param currentScrollTop - Current scroll position
 * @param newItemsCount - Number of items prepended
 * @param itemHeight - Height of each item
 * @returns New scroll position that maintains the same visible content
 */
export function calculatePreservedScrollPosition(
  currentScrollTop: number,
  newItemsCount: number,
  itemHeight: number
): number {
  return currentScrollTop + (newItemsCount * itemHeight);
}

/**
 * Check if scroll position is preserved after loading older messages
 * Used for property testing
 */
export function isScrollPositionPreserved(
  originalScrollTop: number,
  newScrollTop: number,
  newItemsCount: number,
  itemHeight: number,
  tolerance: number = 1
): boolean {
  const expectedScrollTop = calculatePreservedScrollPosition(
    originalScrollTop,
    newItemsCount,
    itemHeight
  );
  return Math.abs(newScrollTop - expectedScrollTop) <= tolerance;
}

const VirtualMessageList: React.FC<VirtualMessageListProps> = ({
  messages,
  itemHeight,
  bufferSize = 10,
  onLoadMore,
  variant = 'patient',
  onImageClick,
  containerHeight,
  autoScrollToBottom = true,
}) => {
  const bottomSpacerPx = 96;
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [prevMessagesLength, setPrevMessagesLength] = useState(messages.length);
  const [preservedScrollOffset, setPreservedScrollOffset] = useState<number | null>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Calculate visible range
  const { startIndex, endIndex } = useMemo(() => {
    return calculateVisibleRange(
      scrollTop,
      containerHeight,
      itemHeight,
      messages.length,
      bufferSize
    );
  }, [scrollTop, containerHeight, itemHeight, messages.length, bufferSize]);
  
  // Calculate total height for the scrollable area
  const totalHeight = useMemo(() => {
    return calculateTotalHeight(messages.length, itemHeight) + bottomSpacerPx;
  }, [messages.length, itemHeight, bottomSpacerPx]);
  
  // Get visible items with their positions
  const visibleItems = useMemo((): VirtualItem<Message>[] => {
    const items: VirtualItem<Message>[] = [];
    
    for (let i = startIndex; i <= endIndex && i < messages.length; i++) {
      const message = messages[i];
      if (message) {
        items.push({
          index: i,
          data: message,
          style: {
            position: 'absolute',
            top: i * itemHeight,
            height: itemHeight,
          },
        });
      }
    }
    
    return items;
  }, [messages, startIndex, endIndex, itemHeight]);
  
  // Handle scroll events
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    setScrollTop(target.scrollTop);
    
    // Mark user as actively scrolling
    setIsUserScrolling(true);
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
    }, 150);
    
    // Trigger load more when scrolling near the top (Requirements: 7.3)
    if (target.scrollTop < itemHeight * 2 && onLoadMore) {
      onLoadMore();
    }
  }, [itemHeight, onLoadMore]);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);
  
  // Scroll position preservation when loading older messages (Requirements: 7.4)
  useEffect(() => {
    const newMessagesAdded = messages.length - prevMessagesLength;
    
    if (newMessagesAdded > 0 && prevMessagesLength > 0 && containerRef.current) {
      const { scrollTop: currentScroll, scrollHeight, clientHeight } = containerRef.current;
      const isAtBottom = scrollHeight - currentScroll - clientHeight < itemHeight * 2;
      const wasAtTop = currentScroll < itemHeight * 3;
      
      // If messages were added at the beginning (older messages loaded)
      // and user was near the top, preserve scroll position
      if (wasAtTop && !isAtBottom) {
        const scrollAdjustment = newMessagesAdded * itemHeight;
        setPreservedScrollOffset(currentScroll + scrollAdjustment);
      }
    }
    
    setPrevMessagesLength(messages.length);
  }, [messages.length, prevMessagesLength, itemHeight]);
  
  // Apply preserved scroll offset
  useEffect(() => {
    if (preservedScrollOffset !== null && containerRef.current) {
      containerRef.current.scrollTop = preservedScrollOffset;
      setPreservedScrollOffset(null);
    }
  }, [preservedScrollOffset]);
  
  // Scroll to bottom for new messages (when user is already at bottom)
  // Requirements: 7.4 - Handle scroll-to-bottom for new messages
  useEffect(() => {
    if (!autoScrollToBottom || isUserScrolling) return;
    
    if (containerRef.current && messages.length > prevMessagesLength) {
      const { scrollTop: currentScroll, scrollHeight, clientHeight } = containerRef.current;
      const isAtBottom = scrollHeight - currentScroll - clientHeight < itemHeight * 2;
      
      // Only auto-scroll if user was already at the bottom
      if (isAtBottom) {
        // Use requestAnimationFrame for smooth scrolling
        requestAnimationFrame(() => {
          if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
          }
        });
      }
    }
  }, [messages.length, prevMessagesLength, itemHeight, autoScrollToBottom, isUserScrolling]);
  
  /**
   * Scroll position preservation helper for external use
   * Returns the current scroll state for testing/debugging
   */
  const getScrollState = useCallback((): VirtualScrollState => {
    return {
      scrollTop,
      visibleStartIndex: startIndex,
      visibleEndIndex: endIndex,
      totalHeight,
    };
  }, [scrollTop, startIndex, endIndex, totalHeight]);
  
  return (
    <div
      ref={containerRef}
      className="overflow-y-auto relative"
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      {/* Spacer to maintain scroll height */}
      <div style={{ height: totalHeight, position: 'relative' }}>
        {/* Render only visible items */}
        {visibleItems.map((item) => (
          <div
            key={item.data.id}
            style={{
              position: item.style.position,
              top: item.style.top,
              left: 0,
              right: 0,
              minHeight: item.style.height,
            }}
            className="px-4 py-2"
          >
            <MemoizedMessage
              message={item.data}
              variant={variant}
              onImageClick={onImageClick}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default VirtualMessageList;
