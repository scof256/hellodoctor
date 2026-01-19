"use client";

import React from "react";
import { handleButtonPress } from "@/app/lib/button-feedback";

interface ActionCardProps {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  iconColor: string;
  badge?: string | number;
  progress?: number; // 0-100 for progress indicators
  onTap: () => void;
  isPrimary?: boolean; // DEPRECATED - kept for backward compatibility
  pulseMode?: 'none' | 'auto' | 'hover'; // Controls animation behavior
  disabled?: boolean;
}

export function ActionCard({
  title,
  subtitle,
  icon,
  iconColor,
  badge,
  progress,
  onTap,
  isPrimary = false,
  pulseMode,
  disabled = false,
}: ActionCardProps) {
  const handlePress = (e: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>) => {
    if (!disabled) {
      handleButtonPress(e, { ripple: true, haptic: false });
      onTap();
    }
  };

  // Determine animation class based on pulseMode
  // Maintain backward compatibility: if isPrimary is true and pulseMode is not set, default to 'hover'
  const getAnimationClass = () => {
    if (pulseMode === 'auto') return 'animate-pulse-glow';
    if (pulseMode === 'hover') return 'animate-pulse-glow-hover';
    if (pulseMode === 'none') return '';
    
    // Backward compatibility: isPrimary defaults to hover mode
    if (isPrimary && !pulseMode) return 'animate-pulse-glow-hover';
    
    return '';
  };

  return (
    <button
      onClick={handlePress}
      onTouchStart={handlePress}
      disabled={disabled}
      className={`
        relative w-full min-h-[120px] rounded-2xl p-6
        bg-white shadow-md hover:shadow-lg
        transition-all duration-200
        flex items-center gap-4
        btn-full-feedback
        ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        ${getAnimationClass()}
      `}
      style={{
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
      }}
    >
      {/* Icon */}
      <div
        className="flex-shrink-0 w-16 h-16 flex items-center justify-center rounded-xl"
        style={{ backgroundColor: iconColor + "20" }}
      >
        <div className="w-16 h-16 flex items-center justify-center text-4xl">
          {icon}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 text-left">
        <h3 className="text-xl font-bold text-gray-900 leading-tight">
          {title}
        </h3>
        {subtitle && (
          <p className="text-sm text-gray-600 mt-1 leading-snug">
            {subtitle}
          </p>
        )}
        {progress !== undefined && (
          <div className="mt-2">
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#25D366] transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">{progress}% complete</p>
          </div>
        )}
      </div>

      {/* Badge */}
      {badge !== undefined && (
        <div className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[24px] text-center">
          {badge}
        </div>
      )}
    </button>
  );
}
