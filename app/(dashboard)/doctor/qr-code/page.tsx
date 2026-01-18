'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/trpc/react';
import {
  QrCode,
  Download,
  RefreshCw,
  Copy,
  Check,
  Share2,
  Link as LinkIcon,
  ExternalLink,
} from 'lucide-react';
import { QRCodeSkeleton } from '@/components/SkeletonComponents';

export default function DoctorQRCodePage() {
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [canShare, setCanShare] = useState(false);

  // Check if Web Share API is available on mount
  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && 'share' in navigator);
  }, []);

  const utils = api.useUtils();

  // Fetch QR code
  const { data: qrData, isLoading: qrLoading } = api.doctor.getQRCode.useQuery();

  // Fetch share URL
  const { data: shareData } = api.doctor.getShareUrl.useQuery();

  // Regenerate QR code mutation
  const regenerateQR = api.doctor.regenerateQRCode.useMutation({
    onMutate: () => setRegenerating(true),
    onSuccess: () => {
      utils.doctor.getQRCode.invalidate();
      setRegenerating(false);
    },
    onError: () => setRegenerating(false),
  });

  // Get QR code download data
  const { refetch: fetchDownload } = api.doctor.getQRCodeDownload.useQuery(undefined, {
    enabled: false,
  });

  const handleCopyLink = async () => {
    if (shareData?.shareUrl) {
      // shareUrl is already an absolute URL from the API
      await navigator.clipboard.writeText(shareData.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = async () => {
    const result = await fetchDownload();
    if (result.data) {
      const link = document.createElement('a');
      link.href = `data:${result.data.mimeType};base64,${result.data.data}`;
      link.download = result.data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleShare = async () => {
    if (shareData?.shareUrl && canShare) {
      try {
        // shareUrl is already an absolute URL from the API
        await navigator.share({
          title: 'Connect with me on HelloDoctor',
          text: 'Scan this QR code or use the link to connect with me for your medical intake.',
          url: shareData.shareUrl,
        });
      } catch (err) {
        // User cancelled or share failed
      }
    }
  };

  // shareUrl is already an absolute URL from the API
  const fullShareUrl = shareData?.shareUrl ?? '';

  if (qrLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-48 mx-auto mb-2"></div>
          <div className="h-4 bg-slate-200 rounded w-64 mx-auto"></div>
        </div>
        <div className="max-w-lg mx-auto">
          <QRCodeSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-800">Your QR Code</h1>
        <p className="text-slate-500 mt-1">Share this with patients to let them connect with you</p>
      </div>

      {/* Main QR Code Card */}
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
          {/* QR Code Display */}
          <div className="p-8 flex flex-col items-center">
            <div className="relative">
              {qrData?.qrCodeUrl ? (
                <img
                  src={qrData.qrCodeUrl}
                  alt="Your QR Code"
                  className="w-64 h-64 rounded-xl border-4 border-medical-100"
                />
              ) : (
                <div className="w-64 h-64 rounded-xl border-4 border-slate-200 bg-slate-50 flex items-center justify-center">
                  <QrCode className="w-24 h-24 text-slate-300" />
                </div>
              )}
              {regenerating && (
                <div className="absolute inset-0 bg-white/80 rounded-xl flex items-center justify-center">
                  <RefreshCw className="w-8 h-8 text-medical-600 animate-spin" />
                </div>
              )}
            </div>

            <p className="text-sm text-slate-500 mt-4 text-center">
              Patients can scan this code to connect with you
            </p>
          </div>

          {/* Share URL */}
          <div className="px-6 pb-6">
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <LinkIcon className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-medium text-slate-600">Share Link</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={fullShareUrl}
                  className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 truncate"
                />
                <button
                  onClick={handleCopyLink}
                  className={`p-2 rounded-lg transition-colors ${
                    copied 
                      ? 'bg-green-100 text-green-600' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                  title={copied ? 'Copied!' : 'Copy link'}
                >
                  {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="px-6 pb-6 grid grid-cols-2 gap-3">
            <button
              onClick={handleDownload}
              className="flex items-center justify-center gap-2 py-3 bg-medical-600 text-white rounded-xl font-medium hover:bg-medical-700 transition-colors"
            >
              <Download className="w-5 h-5" />
              Download
            </button>
            <button
              onClick={() => regenerateQR.mutate()}
              disabled={regenerating}
              className="flex items-center justify-center gap-2 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${regenerating ? 'animate-spin' : ''}`} />
              Regenerate
            </button>
          </div>

          {/* Share Button (if Web Share API is available) */}
          {canShare && (
            <div className="px-6 pb-6">
              <button
                onClick={handleShare}
                className="w-full flex items-center justify-center gap-2 py-3 border-2 border-medical-200 text-medical-600 rounded-xl font-medium hover:bg-medical-50 transition-colors"
              >
                <Share2 className="w-5 h-5" />
                Share
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="max-w-lg mx-auto">
        <div className="bg-slate-50 rounded-xl p-6">
          <h3 className="font-semibold text-slate-800 mb-4">How to use your QR code</h3>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-medical-100 text-medical-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                1
              </span>
              <p className="text-sm text-slate-600">
                Print the QR code and display it in your clinic or office
              </p>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-medical-100 text-medical-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                2
              </span>
              <p className="text-sm text-slate-600">
                Patients scan the code with their phone camera
              </p>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-medical-100 text-medical-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                3
              </span>
              <p className="text-sm text-slate-600">
                They&apos;ll be directed to your profile where they can connect and start their intake
              </p>
            </li>
          </ul>
        </div>
      </div>

      {/* Preview Link */}
      <div className="max-w-lg mx-auto text-center">
        <a
          href={shareData?.shareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-medical-600 hover:text-medical-700 font-medium"
        >
          Preview your public profile
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}
