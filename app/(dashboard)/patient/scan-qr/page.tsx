'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { QrCode, ArrowLeft, AlertCircle, X, Camera } from 'lucide-react';
import { Scanner, IDetectedBarcode } from '@yudiel/react-qr-scanner';
import { useLocalization } from '../../../hooks/useLocalization';
import { ActionCard } from '../../../components/ActionCard';

/**
 * QR Scan Page Component
 * 
 * Camera-based QR code scanning:
 * - Opens camera to scan QR codes
 * - Provide manual doctor code entry field
 * - Handles navigation to doctor connection page
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */
export default function ScanQRPage() {
  const router = useRouter();
  const { t } = useLocalization();
  const [doctorCode, setDoctorCode] = useState('');
  const [error, setError] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');

  /**
   * Validate doctor slug format
   * Slugs should be lowercase alphanumeric with hyphens
   * Requirements: 3.3, 3.4
   */
  const validateDoctorSlug = (slug: string): boolean => {
    // Basic validation: alphanumeric and hyphens only, 3-50 characters
    const slugPattern = /^[a-z0-9-]{3,50}$/;
    return slugPattern.test(slug.toLowerCase());
  };

  /**
   * Extract doctor slug from scanned QR code URL
   * Handles various URL formats like:
   * - https://example.com/connect/dr-john-smith
   * - /connect/dr-john-smith
   * - dr-john-smith (just the slug)
   */
  const extractDoctorSlug = (scannedValue: string): string | null => {
    try {
      // Try to parse as URL first
      let pathname = scannedValue;

      try {
        const url = new URL(scannedValue);
        pathname = url.pathname;
      } catch {
        // Not a valid URL, use as-is
      }

      // Check for /connect/ pattern
      const connectMatch = pathname.match(/\/connect\/([a-z0-9-]+)/i);
      if (connectMatch) {
        return connectMatch[1].toLowerCase();
      }

      // Check for /d/ pattern (short URL)
      const shortMatch = pathname.match(/\/d\/([a-z0-9-]+)/i);
      if (shortMatch) {
        return shortMatch[1].toLowerCase();
      }

      // If it looks like just a slug, use it directly
      const trimmed = scannedValue.trim().toLowerCase();
      if (validateDoctorSlug(trimmed)) {
        return trimmed;
      }

      return null;
    } catch {
      return null;
    }
  };

  /**
   * Handle manual doctor code submission
   * Requirements: 3.3, 3.4
   */
  const handleSubmitCode = () => {
    setError('');

    if (!doctorCode.trim()) {
      setError('Please enter a doctor code');
      return;
    }

    const slug = doctorCode.trim().toLowerCase();

    if (!validateDoctorSlug(slug)) {
      setError('Invalid doctor code format. Please check and try again.');
      return;
    }

    setIsValidating(true);

    // Navigate to the doctor's connection page
    router.push(`/connect/${slug}`);
  };

  /**
   * Handle successful QR code scan
   * Requirements: 3.1, 3.2
   */
  const handleScanSuccess = useCallback((detectedCodes: IDetectedBarcode[]) => {
    if (detectedCodes.length === 0) return;

    const scannedValue = detectedCodes[0].rawValue;
    if (!scannedValue) return;

    const slug = extractDoctorSlug(scannedValue);

    if (slug) {
      setIsScannerOpen(false);
      router.push(`/connect/${slug}`);
    } else {
      setCameraError('Invalid QR code. Please scan a doctor\'s QR code.');
    }
  }, [router]);

  /**
   * Handle camera errors
   */
  const handleScanError = useCallback((error: unknown) => {
    console.error('QR Scanner error:', error);
    setCameraError(t('home.qrScanUnavailable') || 'Camera not available. Please ensure camera permissions are granted.');
  }, [t]);

  /**
   * Open the camera scanner
   * Requirements: 3.1, 3.2
   */
  const handleOpenCamera = async () => {
    setError('');
    setCameraError('');

    try {
      // Check if browser supports camera access
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError(t('home.qrScanUnavailable') || 'Camera not available on this device');
        return;
      }

      // Try to get camera permission first
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });

      // Stop the test stream
      stream.getTracks().forEach(track => track.stop());

      // Open scanner
      setIsScannerOpen(true);

    } catch (err) {
      console.error('Camera permission error:', err);
      setError(t('home.qrScanUnavailable') || 'Camera permission denied. Please allow camera access to scan QR codes.');
    }
  };

  /**
   * Close the scanner
   */
  const handleCloseScanner = () => {
    setIsScannerOpen(false);
    setCameraError('');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Full-screen QR Scanner Modal */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-50 bg-black">
          {/* Scanner Header */}
          <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/70 to-transparent p-4">
            <div className="flex items-center justify-between">
              <button
                onClick={handleCloseScanner}
                className="flex items-center gap-2 text-white hover:text-gray-300 transition-colors"
              >
                <X className="w-6 h-6" />
                <span className="font-medium">Close</span>
              </button>
              <h2 className="text-white font-semibold">Scan QR Code</h2>
              <div className="w-16" /> {/* Spacer for centering */}
            </div>
          </div>

          {/* Scanner */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Scanner
              onScan={handleScanSuccess}
              onError={handleScanError}
              constraints={{
                facingMode: 'environment'
              }}
              styles={{
                container: {
                  width: '100%',
                  height: '100%',
                },
                video: {
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }
              }}
              components={{
                audio: false,
                torch: true,
              }}
            />
          </div>

          {/* Scanner Frame Overlay */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-64 h-64 border-2 border-white/50 rounded-2xl relative">
              {/* Corner markers */}
              <div className="absolute -top-0.5 -left-0.5 w-8 h-8 border-t-4 border-l-4 border-[#25D366] rounded-tl-lg" />
              <div className="absolute -top-0.5 -right-0.5 w-8 h-8 border-t-4 border-r-4 border-[#25D366] rounded-tr-lg" />
              <div className="absolute -bottom-0.5 -left-0.5 w-8 h-8 border-b-4 border-l-4 border-[#25D366] rounded-bl-lg" />
              <div className="absolute -bottom-0.5 -right-0.5 w-8 h-8 border-b-4 border-r-4 border-[#25D366] rounded-br-lg" />
            </div>
          </div>

          {/* Scanner Instructions */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6">
            <p className="text-white text-center">
              Point your camera at the doctor's QR code
            </p>
            {cameraError && (
              <div className="mt-4 flex items-center justify-center gap-2 text-red-400">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm">{cameraError}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header with Back Button */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">{t('common.back')}</span>
        </button>
      </div>

      {/* Main Content - ActionCard with auto-pulse to draw attention */}
      <div className="max-w-md mx-auto">
        {/* Camera Open Button */}
        <div className="mb-6">
          <ActionCard
            title={t('home.scanQR') || 'Scan QR Code'}
            subtitle={t('home.scanQRSubtitle') || 'Connect with a new doctor'}
            icon={<Camera className="w-10 h-10" />}
            iconColor="#25D366"
            pulseMode="auto"
            onTap={handleOpenCamera}
          />
        </div>

        {/* Instructions */}
        <div className="bg-white rounded-xl p-6 mb-6 border border-gray-200">
          <h2 className="font-semibold text-gray-900 mb-3">How to connect:</h2>
          <ol className="space-y-2 text-gray-600">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-[#25D366] bg-opacity-10 rounded-full flex items-center justify-center text-[#25D366] text-sm font-bold">
                1
              </span>
              <span>Ask your doctor for their QR code or connection code</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-[#25D366] bg-opacity-10 rounded-full flex items-center justify-center text-[#25D366] text-sm font-bold">
                2
              </span>
              <span>Scan the QR code with your camera or enter the code manually</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-[#25D366] bg-opacity-10 rounded-full flex items-center justify-center text-[#25D366] text-sm font-bold">
                3
              </span>
              <span>You'll be connected and can start your medical form</span>
            </li>
          </ol>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px bg-gray-200"></div>
          <span className="text-sm text-gray-500">or enter code manually</span>
          <div className="flex-1 h-px bg-gray-200"></div>
        </div>

        {/* Manual Entry */}
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Enter Doctor Code
          </label>
          <input
            type="text"
            value={doctorCode}
            onChange={(e) => {
              setDoctorCode(e.target.value);
              setError('');
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSubmitCode();
              }
            }}
            placeholder="e.g., dr-john-smith"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#25D366] focus:border-transparent outline-none transition-all mb-3"
            disabled={isValidating}
          />

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <button
            onClick={handleSubmitCode}
            disabled={isValidating || !doctorCode.trim()}
            className="w-full bg-gray-900 text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {isValidating ? 'Connecting...' : 'Connect'}
          </button>
        </div>

        {/* Help Text */}
        <p className="text-center text-sm text-gray-500 mt-6">
          Don't have a doctor code?{' '}
          <button
            onClick={() => router.push('/patient/settings')}
            className="text-[#25D366] font-medium hover:underline"
          >
            Get help
          </button>
        </p>
      </div>
    </div>
  );
}
