'use client';

import React, { useState, useEffect } from 'react';
import { OptimizedImage as OptimizedImageData, supportsWebP } from '../lib/image-optimizer';

interface OptimizedImageProps {
  src: string | OptimizedImageData;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  loading?: 'lazy' | 'eager';
  onClick?: () => void;
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * Optimized image component with WebP support and fallback
 * Automatically uses WebP when supported, falls back to JPEG
 */
export function OptimizedImage({
  src,
  alt,
  className = '',
  width,
  height,
  loading = 'lazy',
  onClick,
  onLoad,
  onError,
}: OptimizedImageProps) {
  const [imageSrc, setImageSrc] = useState<string>('');
  const [hasWebPSupport, setHasWebPSupport] = useState<boolean | null>(null);

  useEffect(() => {
    // Check WebP support
    supportsWebP().then(setHasWebPSupport);
  }, []);

  useEffect(() => {
    if (hasWebPSupport === null) return;

    // Determine which source to use
    if (typeof src === 'string') {
      setImageSrc(src);
    } else {
      // OptimizedImageData object
      setImageSrc(hasWebPSupport ? src.webp : src.fallback);
    }
  }, [src, hasWebPSupport]);

  if (!imageSrc) {
    // Show placeholder while loading
    return (
      <div
        className={`bg-gray-200 animate-pulse ${className}`}
        style={{ width, height }}
      />
    );
  }

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      width={width}
      height={height}
      loading={loading}
      onClick={onClick}
      onLoad={onLoad}
      onError={onError}
    />
  );
}

/**
 * Responsive image component with multiple sizes
 * Automatically selects appropriate size based on viewport
 */
interface ResponsiveImageProps extends OptimizedImageProps {
  srcSet?: {
    small?: string | OptimizedImageData;
    medium?: string | OptimizedImageData;
    large?: string | OptimizedImageData;
  };
  sizes?: string;
}

export function ResponsiveImage({
  src,
  srcSet,
  sizes = '100vw',
  ...props
}: ResponsiveImageProps) {
  const [hasWebPSupport, setHasWebPSupport] = useState<boolean | null>(null);

  useEffect(() => {
    supportsWebP().then(setHasWebPSupport);
  }, []);

  if (hasWebPSupport === null) {
    return (
      <div
        className={`bg-gray-200 animate-pulse ${props.className || ''}`}
        style={{ width: props.width, height: props.height }}
      />
    );
  }

  // Build srcSet string
  let srcSetString = '';
  if (srcSet) {
    const sources: string[] = [];
    if (srcSet.small) {
      const smallSrc =
        typeof srcSet.small === 'string'
          ? srcSet.small
          : hasWebPSupport
          ? srcSet.small.webp
          : srcSet.small.fallback;
      sources.push(`${smallSrc} 640w`);
    }
    if (srcSet.medium) {
      const mediumSrc =
        typeof srcSet.medium === 'string'
          ? srcSet.medium
          : hasWebPSupport
          ? srcSet.medium.webp
          : srcSet.medium.fallback;
      sources.push(`${mediumSrc} 1024w`);
    }
    if (srcSet.large) {
      const largeSrc =
        typeof srcSet.large === 'string'
          ? srcSet.large
          : hasWebPSupport
          ? srcSet.large.webp
          : srcSet.large.fallback;
      sources.push(`${largeSrc} 1920w`);
    }
    srcSetString = sources.join(', ');
  }

  const imageSrc =
    typeof src === 'string'
      ? src
      : hasWebPSupport
      ? src.webp
      : src.fallback;

  return (
    <img
      {...props}
      src={imageSrc}
      srcSet={srcSetString || undefined}
      sizes={srcSetString ? sizes : undefined}
    />
  );
}
