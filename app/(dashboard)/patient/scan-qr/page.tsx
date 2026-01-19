'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { QrCode, Camera, ArrowLeft, AlertCircle } from 'lucide-react';
import { useLocalization } from '../../../hooks/useLocalization';
import { ActionCard } from '../../../components/ActionCard';

/**
 * QR Scan Page Component
 * 
 * Simple approach to QR code scanning:
 * - Display instructions for scanning QR codes
 * - Provide manual doctor code entry field
 * - Add "Open Camera" button that uses device camera
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */
export default function ScanQRPage() {
  const router = useRouter();
  const { t } = useLocalization();
  const [doctorCode, setDoctorCode] = useState('');
  const [error, setError] = useState('');
  const [isValidating, setIsValidating] = useState(false);

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
    // The connect page will handle validation and show appropriate error if doctor doesn't exist
    router.push(`/connect/${slug}`);
  };

  /**
   * Handle camera-based QR scanning
   * Requirements: 3.1, 3.2
   */
  const handleOpenCamera = async () => {
    setError('');
    
    try {
      // Check if browser supports camera access
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError(t('home.qrScanUnavailable'));
        return;
      }

      // Request camera permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      // Stop the stream immediately (we just wanted to check permission)
      stream.getTracks().forEach(track => track.stop());
      
      // For now, show a message that camera scanning will be implemented
      // In a full implementation, this would open a camera view with QR detection
      setError('Camera scanning will be available soon. Please use manual entry for now.');
      
    } catch (err) {
      // Camera permission denied or not available
      setError(t('home.qrScanUnavailable'));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
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
        {/* Attention-grabbing card with auto-pulse */}
        <div className="mb-6">
          <ActionCard
            title={t('home.scanQR')}
            subtitle={t('home.scanQRSubtitle')}
            icon={<QrCode className="w-10 h-10" />}
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
