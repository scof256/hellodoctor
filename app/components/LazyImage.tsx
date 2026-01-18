'use client';

import React from 'react';
import { useLazyImage, LazyImageOptions } from '../hooks/useLazyImage';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  lazyOptions?: LazyImageOptions;
  placeholderClassName?: string;
  onLoadComplete?: () => void;
}

/**
 * Lazy-loaded image component using Intersection Observer
 * Only loads images when they enter the viewport
 */
export function LazyImage({
  src,
  alt,
  className = '',
  lazyOptions,
  placeholderClassName = 'bg-gray-200 animate-pulse',
  onLoadComplete,
  ...imgProps
}: LazyImageProps) {
  const { imageSrc, isLoaded, ref } = useLazyImage(src, lazyOptions);

  React.useEffect(() => {
    if (isLoaded && onLoadComplete) {
      onLoadComplete();
    }
  }, [isLoaded, onLoadComplete]);

  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} className="relative">
      {!isLoaded && (
        <div
          className={`absolute inset-0 ${placeholderClassName}`}
          style={{
            width: imgProps.width,
            height: imgProps.height,
          }}
        />
      )}
      <img
        {...imgProps}
        src={imageSrc}
        alt={alt}
        className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
        loading="lazy"
      />
    </div>
  );
}

/**
 * Lazy-loaded background image component
 */
interface LazyBackgroundImageProps {
  src: string;
  className?: string;
  lazyOptions?: LazyImageOptions;
  children?: React.ReactNode;
}

export function LazyBackgroundImage({
  src,
  className = '',
  lazyOptions,
  children,
}: LazyBackgroundImageProps) {
  const { imageSrc, isLoaded, ref } = useLazyImage(src, lazyOptions);

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
      style={{
        backgroundImage: imageSrc ? `url(${imageSrc})` : undefined,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Lazy-loaded image with blur-up effect
 * Shows a low-quality placeholder that transitions to high-quality
 */
interface LazyBlurImageProps extends LazyImageProps {
  blurDataURL?: string; // Low-quality placeholder (base64)
}

export function LazyBlurImage({
  src,
  alt,
  blurDataURL,
  className = '',
  lazyOptions,
  ...imgProps
}: LazyBlurImageProps) {
  const { imageSrc, isLoaded, ref } = useLazyImage(src, {
    ...lazyOptions,
    placeholder: blurDataURL,
  });

  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} className="relative overflow-hidden">
      {blurDataURL && !isLoaded && (
        <img
          src={blurDataURL}
          alt={alt}
          className={`absolute inset-0 ${className} blur-lg scale-110`}
          style={{
            width: imgProps.width,
            height: imgProps.height,
          }}
        />
      )}
      <img
        {...imgProps}
        src={imageSrc}
        alt={alt}
        className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-500`}
        loading="lazy"
      />
    </div>
  );
}
