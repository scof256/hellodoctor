'use client';

import React, { useState, useEffect, useRef } from 'react';

interface ProgressiveContentProps {
  children: React.ReactNode;
  priority?: 'high' | 'medium' | 'low';
  delay?: number; // Delay in ms before rendering (for low priority content)
  fallback?: React.ReactNode; // Skeleton/placeholder while loading
  className?: string;
}

/**
 * Progressive content component that renders content based on priority
 * High priority content renders immediately, low priority content renders after delay
 */
export function ProgressiveContent({
  children,
  priority = 'medium',
  delay = 0,
  fallback,
  className = '',
}: ProgressiveContentProps) {
  const [shouldRender, setShouldRender] = useState(priority === 'high');
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (priority === 'high') {
      setShouldRender(true);
      return;
    }

    // Calculate delay based on priority
    const actualDelay =
      delay ||
      (priority === 'medium' ? 100 : priority === 'low' ? 300 : 0);

    // Schedule rendering
    timeoutRef.current = setTimeout(() => {
      setShouldRender(true);
    }, actualDelay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [priority, delay]);

  if (!shouldRender) {
    return fallback ? <div className={className}>{fallback}</div> : null;
  }

  return <div className={className}>{children}</div>;
}

/**
 * Hook for progressive data loading
 * Loads data in chunks to display content incrementally
 */
export function useProgressiveData<T>(
  data: T[],
  chunkSize: number = 10,
  delay: number = 50
): {
  visibleData: T[];
  isComplete: boolean;
  loadMore: () => void;
} {
  const [visibleCount, setVisibleCount] = useState(chunkSize);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (visibleCount < data.length) {
      timeoutRef.current = setTimeout(() => {
        setVisibleCount((prev) => Math.min(prev + chunkSize, data.length));
      }, delay);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [visibleCount, data.length, chunkSize, delay]);

  const loadMore = () => {
    setVisibleCount((prev) => Math.min(prev + chunkSize, data.length));
  };

  return {
    visibleData: data.slice(0, visibleCount),
    isComplete: visibleCount >= data.length,
    loadMore,
  };
}

/**
 * Progressive list component that renders items incrementally
 */
interface ProgressiveListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  chunkSize?: number;
  delay?: number;
  loadingIndicator?: React.ReactNode;
  className?: string;
}

export function ProgressiveList<T>({
  items,
  renderItem,
  chunkSize = 10,
  delay = 50,
  loadingIndicator,
  className = '',
}: ProgressiveListProps<T>) {
  const { visibleData, isComplete } = useProgressiveData(
    items,
    chunkSize,
    delay
  );

  return (
    <div className={className}>
      {visibleData.map((item, index) => (
        <React.Fragment key={index}>{renderItem(item, index)}</React.Fragment>
      ))}
      {!isComplete && loadingIndicator}
    </div>
  );
}

/**
 * Above-the-fold content wrapper
 * Prioritizes rendering of content visible in initial viewport
 */
interface AboveFoldProps {
  children: React.ReactNode;
  className?: string;
}

export function AboveFold({ children, className = '' }: AboveFoldProps) {
  return (
    <ProgressiveContent priority="high" className={className}>
      {children}
    </ProgressiveContent>
  );
}

/**
 * Below-the-fold content wrapper
 * Defers rendering of content below initial viewport
 */
interface BelowFoldProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  className?: string;
}

export function BelowFold({
  children,
  fallback,
  className = '',
}: BelowFoldProps) {
  return (
    <ProgressiveContent priority="low" fallback={fallback} className={className}>
      {children}
    </ProgressiveContent>
  );
}

/**
 * Progressive image grid that loads images in batches
 */
interface ProgressiveImageGridProps {
  images: Array<{ src: string; alt: string }>;
  columns?: number;
  batchSize?: number;
  delay?: number;
  className?: string;
}

export function ProgressiveImageGrid({
  images,
  columns = 3,
  batchSize = 6,
  delay = 100,
  className = '',
}: ProgressiveImageGridProps) {
  const { visibleData, isComplete } = useProgressiveData(
    images,
    batchSize,
    delay
  );

  return (
    <div
      className={`grid gap-4 ${className}`}
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      }}
    >
      {visibleData.map((image, index) => (
        <div key={index} className="aspect-square overflow-hidden rounded-lg">
          <img
            src={image.src}
            alt={image.alt}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      ))}
      {!isComplete && (
        <div className="aspect-square bg-gray-200 animate-pulse rounded-lg" />
      )}
    </div>
  );
}
