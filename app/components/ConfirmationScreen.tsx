"use client";

import React, { useEffect, useState } from "react";
import { handleButtonPress } from "@/app/lib/button-feedback";

interface ConfirmationDetail {
  label: string;
  value: string;
}

interface ConfirmationAction {
  label: string;
  onTap: () => void;
}

interface ConfirmationScreenProps {
  icon: React.ReactNode; // Large animated icon
  title: string;
  message: string;
  details?: ConfirmationDetail[];
  primaryAction?: ConfirmationAction;
  secondaryAction?: ConfirmationAction;
  autoClose?: number; // Milliseconds before auto-closing
  onClose?: () => void;
}

export function ConfirmationScreen({
  icon,
  title,
  message,
  details,
  primaryAction,
  secondaryAction,
  autoClose,
  onClose,
}: ConfirmationScreenProps) {
  const [countdown, setCountdown] = useState<number | null>(
    autoClose ? Math.ceil(autoClose / 1000) : null
  );

  useEffect(() => {
    if (autoClose && onClose) {
      const timer = setTimeout(() => {
        onClose();
      }, autoClose);

      // Update countdown every second
      const countdownInterval = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(countdownInterval);
            return null;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        clearTimeout(timer);
        clearInterval(countdownInterval);
      };
    }
  }, [autoClose, onClose]);

  const handlePrimaryPress = (e: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>) => {
    handleButtonPress(e, { ripple: true, haptic: false });
    primaryAction?.onTap();
  };

  const handleSecondaryPress = (e: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>) => {
    handleButtonPress(e, { ripple: true, haptic: false });
    secondaryAction?.onTap();
  };

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-6">
      {/* Animated Icon */}
      <div className="w-[120px] h-[120px] flex items-center justify-center mb-6 animate-bounce-once">
        <div className="text-[120px] leading-none">{icon}</div>
      </div>

      {/* Title */}
      <h1 className="text-2xl font-bold text-gray-900 text-center mb-3">
        {title}
      </h1>

      {/* Message */}
      <p className="text-base text-gray-600 text-center mb-6 max-w-md">
        {message}
      </p>

      {/* Details */}
      {details && details.length > 0 && (
        <div className="w-full max-w-md space-y-3 mb-6">
          {details.map((detail, index) => (
            <div
              key={index}
              className="bg-gray-50 rounded-xl p-4 flex justify-between items-center"
            >
              <span className="text-sm font-medium text-gray-700">
                {detail.label}
              </span>
              <span className="text-sm font-bold text-gray-900">
                {detail.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      <div className="w-full max-w-md space-y-3">
        {primaryAction && (
          <button
            onClick={handlePrimaryPress}
            onTouchStart={handlePrimaryPress}
            className="w-full h-14 bg-[#25D366] text-white text-lg font-semibold rounded-xl
                     hover:bg-[#20BD5A] btn-full-feedback
                     shadow-md"
          >
            {primaryAction.label}
          </button>
        )}

        {secondaryAction && (
          <button
            onClick={handleSecondaryPress}
            onTouchStart={handleSecondaryPress}
            className="w-full h-14 bg-white text-gray-700 text-lg font-semibold rounded-xl
                     border-2 border-gray-300 hover:border-gray-400 btn-full-feedback"
          >
            {secondaryAction.label}
          </button>
        )}
      </div>

      {/* Auto-close countdown */}
      {countdown !== null && countdown > 0 && (
        <p className="text-sm text-gray-500 mt-6">
          Closing in {countdown} second{countdown !== 1 ? "s" : ""}...
        </p>
      )}
    </div>
  );
}
