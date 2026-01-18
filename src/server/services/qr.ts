import QRCode from 'qrcode';

/**
 * QR Code Generation Service
 * 
 * Generates QR codes for doctor profile URLs.
 * Requirements: 2.4, 3.1, 3.2
 */

export interface QRCodeOptions {
  width?: number;
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
}

const DEFAULT_OPTIONS: QRCodeOptions = {
  width: 300,
  margin: 2,
  color: {
    dark: '#000000',
    light: '#ffffff',
  },
};

/**
 * Generate the public profile URL for a doctor.
 * Format: /connect/{doctor_slug}
 * Requirements: 3.1
 * 
 * @param slug - Doctor's unique slug
 * @param baseUrl - Optional base URL (defaults to NEXT_PUBLIC_APP_URL)
 * @param isQrCode - If true, adds source=qr parameter to track QR code scans
 */
export function generateDoctorShareUrl(slug: string, baseUrl?: string, isQrCode: boolean = false): string {
  const base = baseUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const url = `${base}/connect/${slug}`;
  return isQrCode ? `${url}?source=qr` : url;
}

/**
 * Generate a QR code as a data URL (base64 encoded PNG).
 * The QR code encodes the doctor's public profile URL.
 * Requirements: 2.4, 3.2
 */
export async function generateQRCodeDataUrl(
  url: string,
  options: QRCodeOptions = {}
): Promise<string> {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  
  try {
    const dataUrl = await QRCode.toDataURL(url, {
      width: mergedOptions.width,
      margin: mergedOptions.margin,
      color: mergedOptions.color,
      errorCorrectionLevel: 'M',
    });
    
    return dataUrl;
  } catch (error) {
    console.error('Failed to generate QR code:', error);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Generate a QR code as a Buffer (PNG format).
 * Useful for file downloads.
 * Requirements: 2.5
 */
export async function generateQRCodeBuffer(
  url: string,
  options: QRCodeOptions = {}
): Promise<Buffer> {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  
  try {
    const buffer = await QRCode.toBuffer(url, {
      width: mergedOptions.width,
      margin: mergedOptions.margin,
      color: mergedOptions.color,
      errorCorrectionLevel: 'M',
      type: 'png',
    });
    
    return buffer;
  } catch (error) {
    console.error('Failed to generate QR code buffer:', error);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Generate a QR code as an SVG string.
 * Useful for inline rendering.
 */
export async function generateQRCodeSvg(
  url: string,
  options: QRCodeOptions = {}
): Promise<string> {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  
  try {
    const svg = await QRCode.toString(url, {
      type: 'svg',
      width: mergedOptions.width,
      margin: mergedOptions.margin,
      color: mergedOptions.color,
      errorCorrectionLevel: 'M',
    });
    
    return svg;
  } catch (error) {
    console.error('Failed to generate QR code SVG:', error);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Generate a complete QR code for a doctor profile.
 * Returns both the share URL and the QR code data URL.
 * The QR code URL includes source=qr to track scans.
 * Requirements: 2.4, 3.1, 3.2
 */
export async function generateDoctorQRCode(
  slug: string,
  baseUrl?: string,
  options: QRCodeOptions = {}
): Promise<{ shareUrl: string; qrCodeDataUrl: string }> {
  // Share URL without source param (for copying/sharing)
  const shareUrl = generateDoctorShareUrl(slug, baseUrl, false);
  // QR code encodes URL with source=qr param
  const qrUrl = generateDoctorShareUrl(slug, baseUrl, true);
  const qrCodeDataUrl = await generateQRCodeDataUrl(qrUrl, options);
  
  return {
    shareUrl,
    qrCodeDataUrl,
  };
}

/**
 * Decode a QR code data URL to extract the encoded URL.
 * This is useful for testing and validation.
 * Note: This doesn't actually decode the QR image, it just validates the format.
 */
export function isValidQRCodeDataUrl(dataUrl: string): boolean {
  return dataUrl.startsWith('data:image/png;base64,');
}

/**
 * Extract the URL that would be encoded in a QR code for a given slug.
 * This is the inverse of generateDoctorShareUrl for validation purposes.
 * Requirements: 3.3
 */
export function extractSlugFromShareUrl(shareUrl: string): string | null {
  const match = shareUrl.match(/\/connect\/([^/?#]+)/);
  return match ? match[1] ?? null : null;
}
