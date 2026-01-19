"use client";

import React from "react";

interface ProfileCompletenessIndicatorProps {
  score: number; // 0-100
  missingFields: string[];
  onCompleteProfile?: () => void;
}

/**
 * Field name mapping for user-friendly display
 */
const FIELD_LABELS: Record<string, string> = {
  professionalBio: "Professional Biography",
  specializations: "Medical Specializations",
  yearsOfExperience: "Years of Experience",
  education: "Education History",
  certifications: "Certifications",
  languages: "Languages Spoken",
  profilePhoto: "Profile Photo",
  officeAddress: "Office Address",
};

/**
 * ProfileCompletenessIndicator Component
 * 
 * Displays a circular progress indicator showing profile completion percentage,
 * lists missing fields, and provides a call-to-action button.
 * 
 * Requirements: 5.1, 5.2, 5.3
 */
export function ProfileCompletenessIndicator({
  score,
  missingFields,
  onCompleteProfile,
}: ProfileCompletenessIndicatorProps) {
  // Calculate circle properties for SVG
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  // Determine color based on completeness
  const getColor = () => {
    if (score >= 80) return "#25D366"; // Green (WhatsApp green)
    if (score >= 50) return "#FFA500"; // Orange
    return "#FF6B6B"; // Red
  };

  const color = getColor();

  return (
    <div className="bg-white rounded-2xl shadow-md p-6">
      <h3 className="text-xl font-bold text-gray-900 mb-4">
        Profile Completeness
      </h3>

      <div className="flex flex-col md:flex-row items-center gap-6">
        {/* Circular Progress Bar */}
        <div className="relative flex-shrink-0">
          <svg width="140" height="140" className="transform -rotate-90">
            {/* Background circle */}
            <circle
              cx="70"
              cy="70"
              r={radius}
              stroke="#E5E7EB"
              strokeWidth="12"
              fill="none"
            />
            {/* Progress circle */}
            <circle
              cx="70"
              cy="70"
              r={radius}
              stroke={color}
              strokeWidth="12"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-500 ease-out"
            />
          </svg>
          {/* Percentage text */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-3xl font-bold" style={{ color }}>
                {score}%
              </div>
              <div className="text-xs text-gray-500">Complete</div>
            </div>
          </div>
        </div>

        {/* Missing Fields List */}
        <div className="flex-1 w-full">
          {missingFields.length === 0 ? (
            <div className="text-center md:text-left">
              <p className="text-lg font-semibold text-green-600 mb-2">
                🎉 Profile Complete!
              </p>
              <p className="text-sm text-gray-600">
                Your professional profile is fully complete. Patients can now
                see all your qualifications and expertise.
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold text-gray-700 mb-3">
                Complete these fields to improve your profile:
              </p>
              <ul className="space-y-2 mb-4">
                {missingFields.slice(0, 5).map((field) => (
                  <li
                    key={field}
                    className="flex items-center text-sm text-gray-600"
                  >
                    <span className="w-2 h-2 bg-gray-400 rounded-full mr-2 flex-shrink-0" />
                    {FIELD_LABELS[field] || field}
                  </li>
                ))}
                {missingFields.length > 5 && (
                  <li className="text-sm text-gray-500 italic">
                    +{missingFields.length - 5} more fields
                  </li>
                )}
              </ul>
              {onCompleteProfile && (
                <button
                  onClick={onCompleteProfile}
                  className="w-full md:w-auto px-6 py-2 bg-[#25D366] text-white font-semibold rounded-lg hover:bg-[#20BA5A] transition-colors duration-200"
                >
                  Complete Profile
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
