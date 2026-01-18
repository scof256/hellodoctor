'use client';

import { useEffect, useRef, useState } from 'react';

export interface LazyImageOptions {
  rootMargin?: string; // Margin around viewport (default: '50px')
  threshold?: number; // Visibility threshold (default: 0.01)
  placeholder?: string; // Placeholder image URL
}

/**
 * Hook for lazy loading images using Intersection Observer API
 * Only loads images when they enter the viewport
 */
export function useLazyImage(
  src: string,
  options: LazyImageOptions = {}
): {
  imageSrc: string;
  isLoaded: boolean;
  isInView: boolean;
  ref: React.RefObject<HTMLElement>;
} {
  const {
    rootMargin = '50px',
    threshold = 0.01,
    placeholder = '',
  } = options;

  const [imageSrc, setImageSrc] = useState<string>(placeholder);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    // Check if Intersection Observer is supported
    if (!('IntersectionObserver' in window)) {
      // Fallback: load image immediately
      setImageSrc(src);
      setIsLoaded(true);
      setIsInView(true);
      return;
    }

    const element = ref.current;
    if (!element) return;

    // Create observer
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            // Load the image
            setImageSrc(src);
            // Stop observing once loaded
            observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin,
        threshold,
      }
    );

    // Start observing
    observer.observe(element);

    // Cleanup
    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [src, rootMargin, threshold]);

  // Track when image actually loads
  useEffect(() => {
    if (imageSrc && imageSrc !== placeholder) {
      const img = new Image();
      img.onload = () => setIsLoaded(true);
      img.onerror = () => setIsLoaded(false);
      img.src = imageSrc;
    }
  }, [imageSrc, placeholder]);

  return { imageSrc, isLoaded, isInView, ref };
}

/**
 * Hook for lazy loading multiple images
 */
export function useLazyImages(
  sources: string[],
  options?: LazyImageOptions
): {
  loadedSources: string[];
  isLoaded: boolean[];
  refs: React.RefObject<HTMLElement>[];
} {
  const [loadedSources, setLoadedSources] = useState<string[]>(
    sources.map(() => options?.placeholder || '')
  );
  const [isLoaded, setIsLoaded] = useState<boolean[]>(
    sources.map(() => false)
  );
  const refs = useRef<React.RefObject<HTMLElement>[]>(
    sources.map(() => ({ current: null }))
  );

  useEffect(() => {
    // Check if Intersection Observer is supported
    if (!('IntersectionObserver' in window)) {
      // Fallback: load all images immediately
      setLoadedSources(sources);
      setIsLoaded(sources.map(() => true));
      return;
    }

    const observers: IntersectionObserver[] = [];

    sources.forEach((src, index) => {
      const element = refs.current[index]?.current;
      if (!element) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              // Load the image
              setLoadedSources((prev) => {
                const newSources = [...prev];
                newSources[index] = src;
                return newSources;
              });

              // Mark as loaded
              const img = new Image();
              img.onload = () => {
                setIsLoaded((prev) => {
                  const newLoaded = [...prev];
                  newLoaded[index] = true;
                  return newLoaded;
                });
              };
              img.src = src;

              // Stop observing
              observer.unobserve(entry.target);
            }
          });
        },
        {
          rootMargin: options?.rootMargin || '50px',
          threshold: options?.threshold || 0.01,
        }
      );

      observer.observe(element);
      observers.push(observer);
    });

    // Cleanup
    return () => {
      observers.forEach((observer) => observer.disconnect());
    };
  }, [sources, options?.rootMargin, options?.threshold, options?.placeholder]);

  return { loadedSources, isLoaded, refs: refs.current };
}
