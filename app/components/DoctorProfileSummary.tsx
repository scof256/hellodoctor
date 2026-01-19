'use client';

import React from 'react';
import { User, Briefcase, DollarSign, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface DoctorProfileSummaryProps {
  doctorId: string;
  name: string;
  profilePhotoUrl?: string | null;
  specializations?: string[];
  yearsOfExperience?: number | null;
  consultationFee?: number | null;
  currency?: string;
}

/**
 * DoctorProfileSummary Component
 * 
 * Displays a compact summary of a doctor's professional profile for use in the booking flow.
 * Shows essential information: photo, name, specializations, experience, and consultation fee.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */
export const DoctorProfileSummary: React.FC<DoctorProfileSummaryProps> = ({
  doctorId,
  name,
  profilePhotoUrl,
  specializations = [],
  yearsOfExperience,
  consultationFee,
  currency = 'UGX',
}) => {
  return (
    <div className="bg-white rounded-xl border-2 border-slate-200 p-4 mb-4">
      {/* Header with photo and name */}
      <div className="flex items-start gap-4 mb-4">
        {/* Profile Photo */}
        <div className="shrink-0">
          {profilePhotoUrl ? (
            <img
              src={profilePhotoUrl}
              alt={`Dr. ${name}`}
              className="w-16 h-16 rounded-full object-cover border-2 border-slate-200"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center">
              <User className="w-8 h-8 text-slate-400" />
            </div>
          )}
        </div>

        {/* Name and View Profile Link */}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-slate-800 mb-1">
            Dr. {name}
          </h3>
          <Link
            href={`/doctor/profile/view/${doctorId}`}
            className="inline-flex items-center gap-1 text-sm text-[#25D366] hover:text-[#20BA5A] font-medium transition-colors"
          >
            View Full Profile
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Specializations */}
      {specializations.length > 0 && (
        <div className="mb-3">
          <div className="flex flex-wrap gap-2">
            {specializations.slice(0, 3).map((spec, index) => (
              <span
                key={index}
                className="inline-flex items-center px-3 py-1 rounded-full bg-[#25D366]/10 text-[#25D366] text-xs font-medium"
              >
                {spec}
              </span>
            ))}
            {specializations.length > 3 && (
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                +{specializations.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Experience and Fee */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-200">
        {/* Years of Experience */}
        {yearsOfExperience !== null && yearsOfExperience !== undefined && (
          <div className="flex items-center gap-2 text-slate-600">
            <Briefcase className="w-4 h-4" />
            <span className="text-sm font-medium">
              {yearsOfExperience} {yearsOfExperience === 1 ? 'year' : 'years'} exp.
            </span>
          </div>
        )}

        {/* Consultation Fee */}
        {consultationFee !== null && consultationFee !== undefined && (
          <div className="flex items-center gap-2 text-slate-800">
            <DollarSign className="w-4 h-4" />
            <span className="text-sm font-bold">
              {currency} {consultationFee.toLocaleString()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
