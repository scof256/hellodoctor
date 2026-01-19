'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/trpc/react';
import { 
  Loader2, 
  MapPin, 
  Phone, 
  Mail, 
  GraduationCap, 
  Award, 
  Languages, 
  DollarSign,
  ArrowLeft,
  AlertCircle
} from 'lucide-react';
import Image from 'next/image';

/**
 * Public Profile View Page Component
 * Displays a doctor's professional profile to patients and other viewers
 * Requirements: 3.1, 7.2, 7.4
 */
export default function PublicProfileViewPage() {
  const params = useParams();
  const router = useRouter();
  const doctorId = params.doctorId as string;

  // Fetch public profile with access control
  const { 
    data: profileData, 
    isLoading, 
    error 
  } = api.doctor.getPublicProfile.useQuery(
    { doctorId },
    { 
      enabled: !!doctorId,
      retry: false 
    }
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Error state - handle access control errors
  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go Back</span>
          </button>

          <div className="bg-white rounded-2xl shadow-md p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Profile Not Available
            </h2>
            <p className="text-gray-600 mb-6">
              {error.message || 'This profile is not publicly visible or does not exist.'}
            </p>
            {error.data?.code === 'FORBIDDEN' && (
              <p className="text-sm text-gray-500">
                This profile may be unpublished or the doctor may not be verified yet.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!profileData) {
    return null;
  }

  const { user, doctor, ...profile } = profileData;
  const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Doctor';

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Go Back</span>
        </button>

        {/* Profile Header */}
        <section className="bg-white rounded-2xl shadow-md p-8 mb-6">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            {/* Profile Photo */}
            <div className="flex-shrink-0">
              {profile.profilePhotoUrl || user.imageUrl ? (
                <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-blue-100">
                  <Image
                    src={profile.profilePhotoUrl || user.imageUrl || ''}
                    alt={fullName}
                    fill
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="w-32 h-32 rounded-full bg-blue-100 flex items-center justify-center border-4 border-blue-200">
                  <span className="text-4xl font-bold text-blue-600">
                    {fullName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {/* Name and Basic Info */}
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Dr. {fullName}
              </h1>
              
              {/* Specializations */}
              {profile.specializations && profile.specializations.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {profile.specializations.map((spec, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium"
                    >
                      {spec}
                    </span>
                  ))}
                </div>
              )}

              {/* Years of Experience */}
              {profile.yearsOfExperience !== null && profile.yearsOfExperience !== undefined && (
                <p className="text-gray-600 mb-2">
                  <span className="font-semibold">{profile.yearsOfExperience}</span> years of experience
                </p>
              )}

              {/* Verification Badge */}
              {doctor.verificationStatus === 'verified' && (
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Verified Doctor
                </div>
              )}
            </div>

            {/* Consultation Fee */}
            {profile.consultationFee !== null && profile.consultationFee !== undefined && (
              <div className="bg-blue-50 rounded-xl p-4 text-center">
                <div className="flex items-center justify-center gap-2 text-blue-600 mb-1">
                  <DollarSign className="w-5 h-5" />
                  <span className="text-sm font-medium">Consultation Fee</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  ${profile.consultationFee.toFixed(2)}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Professional Biography */}
        {profile.professionalBio && (
          <section className="bg-white rounded-2xl shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">About</h2>
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
              {profile.professionalBio}
            </p>
          </section>
        )}

        {/* Education */}
        {profile.education && profile.education.length > 0 && (
          <section className="bg-white rounded-2xl shadow-md p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <GraduationCap className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-bold text-gray-900">Education</h2>
            </div>
            <div className="space-y-4">
              {profile.education.map((edu, index) => (
                <div key={index} className="border-l-4 border-blue-200 pl-4 py-2">
                  <h3 className="font-semibold text-gray-900">{edu.degree}</h3>
                  <p className="text-gray-700">{edu.institution}</p>
                  {edu.fieldOfStudy && (
                    <p className="text-gray-600 text-sm">{edu.fieldOfStudy}</p>
                  )}
                  <p className="text-gray-500 text-sm mt-1">{edu.year}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Certifications */}
        {profile.certifications && profile.certifications.length > 0 && (
          <section className="bg-white rounded-2xl shadow-md p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Award className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-bold text-gray-900">Certifications</h2>
            </div>
            <div className="space-y-3">
              {profile.certifications.map((cert, index) => (
                <div key={index} className="border border-slate-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900">{cert.name}</h3>
                  <p className="text-gray-700 text-sm">{cert.issuingOrganization}</p>
                  <p className="text-gray-500 text-sm mt-1">Issued: {cert.year}</p>
                  {cert.credentialId && (
                    <p className="text-gray-500 text-xs mt-1">
                      Credential ID: {cert.credentialId}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Languages Spoken */}
        {profile.languages && profile.languages.length > 0 && (
          <section className="bg-white rounded-2xl shadow-md p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Languages className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-bold text-gray-900">Languages Spoken</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {profile.languages.map((lang, index) => (
                <span
                  key={index}
                  className="px-4 py-2 bg-slate-100 text-gray-700 rounded-lg text-sm font-medium"
                >
                  {lang}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Contact Information */}
        {(profile.officeAddress || profile.officePhone || profile.officeEmail) && (
          <section className="bg-white rounded-2xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Contact Information</h2>
            <div className="space-y-3">
              {profile.officeAddress && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Office Address</p>
                    <p className="text-gray-600 whitespace-pre-wrap">{profile.officeAddress}</p>
                  </div>
                </div>
              )}
              
              {profile.officePhone && (
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Phone</p>
                    <a 
                      href={`tel:${profile.officePhone}`}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      {profile.officePhone}
                    </a>
                  </div>
                </div>
              )}
              
              {profile.officeEmail && (
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Email</p>
                    <a 
                      href={`mailto:${profile.officeEmail}`}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      {profile.officeEmail}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
