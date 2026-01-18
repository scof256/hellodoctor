/**
 * Image optimization utilities for WhatsApp-Simple UX
 * Compresses images to <100KB and provides WebP format with fallbacks
 */

export interface OptimizedImage {
  webp: string; // Base64 WebP format
  fallback: string; // Base64 JPEG format
  size: number; // Size in bytes
  width: number;
  height: number;
}

export interface ImageOptimizationOptions {
  maxSizeKB?: number; // Maximum size in KB (default: 100)
  quality?: number; // Initial quality (0-1, default: 0.8)
  maxWidth?: number; // Maximum width in pixels (default: 1920)
  maxHeight?: number; // Maximum height in pixels (default: 1920)
}

/**
 * Compress and optimize an image to meet size requirements
 */
export async function optimizeImage(
  file: File | string,
  options: ImageOptimizationOptions = {}
): Promise<OptimizedImage> {
  const {
    maxSizeKB = 100,
    quality = 0.8,
    maxWidth = 1920,
    maxHeight = 1920,
  } = options;

  // Load image
  const img = await loadImage(file);

  // Calculate new dimensions while maintaining aspect ratio
  const { width, height } = calculateDimensions(
    img.width,
    img.height,
    maxWidth,
    maxHeight
  );

  // Create canvas for resizing
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Draw resized image
  ctx.drawImage(img, 0, 0, width, height);

  // Try WebP format first (better compression)
  let webpQuality = quality;
  let webpData = canvas.toDataURL('image/webp', webpQuality);
  let webpSize = getBase64Size(webpData);

  // Reduce quality until size is acceptable
  while (webpSize > maxSizeKB * 1024 && webpQuality > 0.1) {
    webpQuality -= 0.1;
    webpData = canvas.toDataURL('image/webp', webpQuality);
    webpSize = getBase64Size(webpData);
  }

  // Create JPEG fallback
  let jpegQuality = quality;
  let jpegData = canvas.toDataURL('image/jpeg', jpegQuality);
  let jpegSize = getBase64Size(jpegData);

  // Reduce quality until size is acceptable
  while (jpegSize > maxSizeKB * 1024 && jpegQuality > 0.1) {
    jpegQuality -= 0.1;
    jpegData = canvas.toDataURL('image/jpeg', jpegQuality);
    jpegSize = getBase64Size(jpegData);
  }

  return {
    webp: webpData,
    fallback: jpegData,
    size: Math.min(webpSize, jpegSize),
    width,
    height,
  };
}

/**
 * Load an image from File or base64 string
 */
function loadImage(source: File | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;

    if (typeof source === 'string') {
      // Already a data URL
      img.src = source;
    } else {
      // File object - convert to data URL
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(source);
    }
  });
}

/**
 * Calculate new dimensions while maintaining aspect ratio
 */
function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  let width = originalWidth;
  let height = originalHeight;

  // Scale down if needed
  if (width > maxWidth) {
    height = (height * maxWidth) / width;
    width = maxWidth;
  }

  if (height > maxHeight) {
    width = (width * maxHeight) / height;
    height = maxHeight;
  }

  return { width: Math.round(width), height: Math.round(height) };
}

/**
 * Calculate size of base64 string in bytes
 */
function getBase64Size(base64String: string): number {
  // Remove data URL prefix if present
  const base64Data = base64String.split(',')[1] || base64String;
  
  // Calculate size: each base64 character represents 6 bits
  // Padding characters (=) don't count
  const padding = (base64Data.match(/=/g) || []).length;
  return (base64Data.length * 3) / 4 - padding;
}

/**
 * Check if browser supports WebP format
 */
export function supportsWebP(): Promise<boolean> {
  return new Promise((resolve) => {
    const webpData =
      'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=';
    const img = new Image();
    img.onload = () => resolve(img.width === 1);
    img.onerror = () => resolve(false);
    img.src = webpData;
  });
}

/**
 * Get the appropriate image source based on WebP support
 */
export async function getOptimalImageSrc(
  optimizedImage: OptimizedImage
): Promise<string> {
  const hasWebPSupport = await supportsWebP();
  return hasWebPSupport ? optimizedImage.webp : optimizedImage.fallback;
}

/**
 * Batch optimize multiple images
 */
export async function optimizeImages(
  files: File[],
  options?: ImageOptimizationOptions
): Promise<OptimizedImage[]> {
  return Promise.all(files.map((file) => optimizeImage(file, options)));
}
