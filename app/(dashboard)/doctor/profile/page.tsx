'use client';

import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from '@/trpc/react';
import { updateProfessionalProfileSchema } from '@/lib/validation';
import { ProfilePhotoUploader } from '@/app/components/ProfilePhotoUploader';
import { ProfileCompletenessIndicator } from '@/app/components/ProfileCompletenessIndicator';
import { Loader2, Plus, Trash2, Save, Eye, EyeOff, AlertCircle, Globe, GlobeLock, CheckCircle, XCircle } from 'lucide-react';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

type ProfileFormData = z.infer<typeof updateProfessionalProfileSchema>;

// Common specializations list
const SPECIALIZATIONS = [
  'General Practice',
  'Internal Medicine',
  'Pediatrics',
  'Cardiology',
  'Dermatology',
  'Neurology',
  'Orthopedics',
  'Psychiatry',
  'Surgery',
  'Obstetrics & Gynecology',
  'Ophthalmology',
  'ENT (Ear, Nose, Throat)',
  'Radiology',
  'Anesthesiology',
  'Emergency Medicine',
  'Family Medicine',
  'Oncology',
  'Urology',
  'Gastroenterology',
  'Endocrinology',
];

// Common languages list
const LANGUAGES = [
  'English',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Portuguese',
  'Chinese',
  'Japanese',
  'Korean',
  'Arabic',
  'Hindi',
  'Russian',
  'Swahili',
  'Luganda',
];

/**
 * Profile Editor Page Component
 * Allows doctors to create and edit their professional profile
 * Requirements: 1.1, 1.2, 1.3, 1.5, 2.1-2.8, 5.1, 6.5
 */
export default function DoctorProfilePage() {
  const [showPreview, setShowPreview] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [autoSaveTimeout, setAutoSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showUnpublishDialog, setShowUnpublishDialog] = useState(false);

  // Fetch existing profile
  const { data: profileData, isLoading: isLoadingProfile, refetch: refetchProfile } = api.doctor.getProfessionalProfile.useQuery();

  // Update profile mutation
  const updateProfileMutation = api.doctor.updateProfessionalProfile.useMutation({
    onSuccess: () => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    },
    onError: (error) => {
      setSaveStatus('error');
      console.error('Failed to save profile:', error);
    },
  });

  // Upload photo mutation
  const uploadPhotoMutation = api.doctor.uploadProfilePhoto.useMutation();

  // Publish profile mutation
  const publishProfileMutation = api.doctor.publishProfile.useMutation({
    onSuccess: () => {
      refetchProfile();
      setShowPublishDialog(false);
    },
    onError: (error) => {
      console.error('Failed to publish profile:', error);
    },
  });

  // Unpublish profile mutation
  const unpublishProfileMutation = api.doctor.unpublishProfile.useMutation({
    onSuccess: () => {
      refetchProfile();
      setShowUnpublishDialog(false);
    },
    onError: (error) => {
      console.error('Failed to unpublish profile:', error);
    },
  });

  // Initialize form with React Hook Form
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
    reset,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(updateProfessionalProfileSchema),
    defaultValues: {
      professionalBio: '',
      yearsOfExperience: undefined,
      specializations: [],
      education: [],
      certifications: [],
      languages: [],
      officeAddress: '',
      officePhone: '',
      officeEmail: '',
      consultationFee: undefined,
    },
  });

  // Field arrays for dynamic lists
  const {
    fields: educationFields,
    append: appendEducation,
    remove: removeEducation,
  } = useFieldArray({
    control,
    name: 'education',
  });

  const {
    fields: certificationFields,
    append: appendCertification,
    remove: removeCertification,
  } = useFieldArray({
    control,
    name: 'certifications',
  });

  // Pre-populate form when profile data loads (Requirement 1.5)
  useEffect(() => {
    if (profileData) {
      reset({
        professionalBio: profileData.professionalBio || '',
        yearsOfExperience: profileData.yearsOfExperience || undefined,
        specializations: profileData.specializations || [],
        education: profileData.education || [],
        certifications: profileData.certifications || [],
        languages: profileData.languages || [],
        officeAddress: profileData.officeAddress || '',
        officePhone: profileData.officePhone || '',
        officeEmail: profileData.officeEmail || '',
        consultationFee: profileData.consultationFee || undefined,
      });
    }
  }, [profileData, reset]);

  // Watch form values for auto-save
  const formValues = watch();
  const bioLength = watch('professionalBio')?.length || 0;

  // Auto-save functionality (Requirement 1.4)
  useEffect(() => {
    if (!isDirty) return;

    // Clear existing timeout
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout);
    }

    // Set new timeout for auto-save (debounce 2 seconds)
    const timeout = setTimeout(() => {
      handleAutoSave();
    }, 2000);

    setAutoSaveTimeout(timeout);

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [formValues, isDirty]);

  // Auto-save handler
  const handleAutoSave = async () => {
    if (!isDirty) return;

    setSaveStatus('saving');
    try {
      await updateProfileMutation.mutateAsync(formValues);
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  };

  // Manual save handler
  const onSubmit = async (data: ProfileFormData) => {
    setSaveStatus('saving');
    try {
      await updateProfileMutation.mutateAsync(data);
    } catch (error) {
      console.error('Save failed:', error);
    }
  };

  // Photo upload handler
  const handlePhotoUploaded = async (url: string, key: string) => {
    try {
      await uploadPhotoMutation.mutateAsync({ url, key });
    } catch (error) {
      console.error('Failed to save photo:', error);
    }
  };

  // Calculate missing fields for completeness indicator
  const getMissingFields = (): string[] => {
    const missing: string[] = [];
    if (!formValues.professionalBio || formValues.professionalBio.length < 50) {
      missing.push('professionalBio');
    }
    if (!formValues.specializations || formValues.specializations.length === 0) {
      missing.push('specializations');
    }
    if (formValues.yearsOfExperience === undefined || formValues.yearsOfExperience === null) {
      missing.push('yearsOfExperience');
    }
    if (!formValues.education || formValues.education.length === 0) {
      missing.push('education');
    }
    if (!profileData?.profilePhotoUrl) {
      missing.push('profilePhoto');
    }
    return missing;
  };

  // Calculate completeness score
  const completenessScore = profileData?.completenessScore || 0;

  if (isLoadingProfile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Professional Profile</h1>
          <p className="text-gray-600 mt-2">
            Complete your profile to help patients learn about your qualifications and expertise.
          </p>
        </div>

        {/* Completeness Indicator */}
        <div className="mb-6">
          <ProfileCompletenessIndicator
            score={completenessScore}
            missingFields={getMissingFields()}
          />
        </div>

        {/* Save Status Indicator */}
        {saveStatus !== 'idle' && (
          <div className={`mb-4 px-4 py-3 rounded-lg flex items-center gap-2 ${
            saveStatus === 'saved' ? 'bg-green-50 text-green-700' :
            saveStatus === 'saving' ? 'bg-blue-50 text-blue-700' :
            'bg-red-50 text-red-700'
          }`}>
            {saveStatus === 'saving' && <Loader2 className="w-4 h-4 animate-spin" />}
            {saveStatus === 'saved' && <span>✓</span>}
            {saveStatus === 'error' && <AlertCircle className="w-4 h-4" />}
            <span className="text-sm font-medium">
              {saveStatus === 'saved' && 'Changes saved'}
              {saveStatus === 'saving' && 'Saving...'}
              {saveStatus === 'error' && 'Failed to save changes'}
            </span>
          </div>
        )}

        {/* Preview Toggle */}
        <div className="mb-6 flex justify-end">
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            {showPreview ? (
              <>
                <EyeOff className="w-4 h-4" />
                <span>Hide Preview</span>
              </>
            ) : (
              <>
                <Eye className="w-4 h-4" />
                <span>Show Preview</span>
              </>
            )}
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Profile Photo Section */}
          <section className="bg-white rounded-2xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Profile Photo</h2>
            <ProfilePhotoUploader
              currentPhotoUrl={profileData?.profilePhotoUrl}
              onPhotoUploaded={handlePhotoUploaded}
            />
          </section>

          {/* Professional Biography Section */}
          <section className="bg-white rounded-2xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Professional Biography</h2>
            <div>
              <label htmlFor="professionalBio" className="block text-sm font-medium text-gray-700 mb-2">
                Biography
                <span className="text-red-500 ml-1">*</span>
              </label>
              <textarea
                id="professionalBio"
                {...register('professionalBio')}
                rows={6}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.professionalBio ? 'border-red-500' : 'border-slate-300'
                }`}
                placeholder="Tell patients about your medical background, experience, and approach to care..."
              />
              <div className="flex justify-between items-center mt-2">
                <div>
                  {errors.professionalBio && (
                    <p className="text-sm text-red-600">{errors.professionalBio.message}</p>
                  )}
                </div>
                <p className={`text-sm ${
                  bioLength < 50 ? 'text-red-600' :
                  bioLength > 1000 ? 'text-red-600' :
                  'text-gray-500'
                }`}>
                  {bioLength} / 1000 characters (minimum 50)
                </p>
              </div>
            </div>
          </section>

          {/* Professional Information Section */}
          <section className="bg-white rounded-2xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Professional Information</h2>
            
            <div className="space-y-4">
              {/* Years of Experience */}
              <div>
                <label htmlFor="yearsOfExperience" className="block text-sm font-medium text-gray-700 mb-2">
                  Years of Experience
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                  id="yearsOfExperience"
                  type="number"
                  {...register('yearsOfExperience', { valueAsNumber: true })}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.yearsOfExperience ? 'border-red-500' : 'border-slate-300'
                  }`}
                  placeholder="e.g., 10"
                  min="0"
                  max="70"
                />
                {errors.yearsOfExperience && (
                  <p className="text-sm text-red-600 mt-1">{errors.yearsOfExperience.message}</p>
                )}
              </div>

              {/* Specializations */}
              <div>
                <label htmlFor="specializations" className="block text-sm font-medium text-gray-700 mb-2">
                  Medical Specializations
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <select
                  id="specializations"
                  multiple
                  {...register('specializations')}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.specializations ? 'border-red-500' : 'border-slate-300'
                  }`}
                  size={5}
                >
                  {SPECIALIZATIONS.map((spec) => (
                    <option key={spec} value={spec}>
                      {spec}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Hold Ctrl (Cmd on Mac) to select multiple specializations
                </p>
                {errors.specializations && (
                  <p className="text-sm text-red-600 mt-1">{errors.specializations.message}</p>
                )}
              </div>

              {/* Languages */}
              <div>
                <label htmlFor="languages" className="block text-sm font-medium text-gray-700 mb-2">
                  Languages Spoken
                </label>
                <select
                  id="languages"
                  multiple
                  {...register('languages')}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  size={5}
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Hold Ctrl (Cmd on Mac) to select multiple languages
                </p>
              </div>

              {/* Consultation Fee */}
              <div>
                <label htmlFor="consultationFee" className="block text-sm font-medium text-gray-700 mb-2">
                  Consultation Fee (USD)
                </label>
                <input
                  id="consultationFee"
                  type="number"
                  step="0.01"
                  {...register('consultationFee', { valueAsNumber: true })}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.consultationFee ? 'border-red-500' : 'border-slate-300'
                  }`}
                  placeholder="e.g., 100.00"
                  min="0"
                />
                {errors.consultationFee && (
                  <p className="text-sm text-red-600 mt-1">{errors.consultationFee.message}</p>
                )}
              </div>
            </div>
          </section>

          {/* Education Section */}
          <section className="bg-white rounded-2xl shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Education</h2>
              <button
                type="button"
                onClick={() => appendEducation({
                  id: uuidv4(),
                  institution: '',
                  degree: '',
                  fieldOfStudy: '',
                  year: new Date().getFullYear(),
                })}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Education
              </button>
            </div>

            {educationFields.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No education entries yet. Click "Add Education" to get started.
              </p>
            ) : (
              <div className="space-y-4">
                {educationFields.map((field, index) => (
                  <div key={field.id} className="border border-slate-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="font-semibold text-gray-900">Education Entry {index + 1}</h3>
                      <button
                        type="button"
                        onClick={() => removeEducation(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Institution
                          <span className="text-red-500 ml-1">*</span>
                        </label>
                        <input
                          {...register(`education.${index}.institution`)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="e.g., Harvard Medical School"
                        />
                        {errors.education?.[index]?.institution && (
                          <p className="text-xs text-red-600 mt-1">
                            {errors.education[index]?.institution?.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Degree
                          <span className="text-red-500 ml-1">*</span>
                        </label>
                        <input
                          {...register(`education.${index}.degree`)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="e.g., MD"
                        />
                        {errors.education?.[index]?.degree && (
                          <p className="text-xs text-red-600 mt-1">
                            {errors.education[index]?.degree?.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Field of Study
                        </label>
                        <input
                          {...register(`education.${index}.fieldOfStudy`)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="e.g., Internal Medicine"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Year
                          <span className="text-red-500 ml-1">*</span>
                        </label>
                        <input
                          type="number"
                          {...register(`education.${index}.year`, { valueAsNumber: true })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="e.g., 2015"
                          min="1950"
                          max={new Date().getFullYear()}
                        />
                        {errors.education?.[index]?.year && (
                          <p className="text-xs text-red-600 mt-1">
                            {errors.education[index]?.year?.message}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Certifications Section */}
          <section className="bg-white rounded-2xl shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Certifications</h2>
              <button
                type="button"
                onClick={() => appendCertification({
                  id: uuidv4(),
                  name: '',
                  issuingOrganization: '',
                  year: new Date().getFullYear(),
                })}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Certification
              </button>
            </div>

            {certificationFields.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No certifications yet. Click "Add Certification" to get started.
              </p>
            ) : (
              <div className="space-y-4">
                {certificationFields.map((field, index) => (
                  <div key={field.id} className="border border-slate-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="font-semibold text-gray-900">Certification {index + 1}</h3>
                      <button
                        type="button"
                        onClick={() => removeCertification(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Certification Name
                          <span className="text-red-500 ml-1">*</span>
                        </label>
                        <input
                          {...register(`certifications.${index}.name`)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="e.g., Board Certified in Internal Medicine"
                        />
                        {errors.certifications?.[index]?.name && (
                          <p className="text-xs text-red-600 mt-1">
                            {errors.certifications[index]?.name?.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Issuing Organization
                          <span className="text-red-500 ml-1">*</span>
                        </label>
                        <input
                          {...register(`certifications.${index}.issuingOrganization`)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="e.g., American Board of Internal Medicine"
                        />
                        {errors.certifications?.[index]?.issuingOrganization && (
                          <p className="text-xs text-red-600 mt-1">
                            {errors.certifications[index]?.issuingOrganization?.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Year Obtained
                          <span className="text-red-500 ml-1">*</span>
                        </label>
                        <input
                          type="number"
                          {...register(`certifications.${index}.year`, { valueAsNumber: true })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="e.g., 2018"
                          min="1950"
                          max={new Date().getFullYear()}
                        />
                        {errors.certifications?.[index]?.year && (
                          <p className="text-xs text-red-600 mt-1">
                            {errors.certifications[index]?.year?.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Credential ID (Optional)
                        </label>
                        <input
                          {...register(`certifications.${index}.credentialId`)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="e.g., ABC123456"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Office Contact Information Section */}
          <section className="bg-white rounded-2xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Office Contact Information</h2>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="officeAddress" className="block text-sm font-medium text-gray-700 mb-2">
                  Office Address
                </label>
                <textarea
                  id="officeAddress"
                  {...register('officeAddress')}
                  rows={3}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your office address"
                />
                {errors.officeAddress && (
                  <p className="text-sm text-red-600 mt-1">{errors.officeAddress.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="officePhone" className="block text-sm font-medium text-gray-700 mb-2">
                    Office Phone
                  </label>
                  <input
                    id="officePhone"
                    type="tel"
                    {...register('officePhone')}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="+1 (555) 123-4567"
                  />
                  {errors.officePhone && (
                    <p className="text-sm text-red-600 mt-1">{errors.officePhone.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="officeEmail" className="block text-sm font-medium text-gray-700 mb-2">
                    Office Email
                  </label>
                  <input
                    id="officeEmail"
                    type="email"
                    {...register('officeEmail')}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="office@example.com"
                  />
                  {errors.officeEmail && (
                    <p className="text-sm text-red-600 mt-1">{errors.officeEmail.message}</p>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Publication Controls Section */}
          <section className="bg-white rounded-2xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Profile Publication</h2>
            
            {/* Verification Status Message */}
            {profileData?.doctor && profileData.doctor.verificationStatus !== 'verified' && (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-900">
                    Verification Required
                  </p>
                  <p className="text-sm text-amber-700 mt-1">
                    Your profile cannot be published until your credentials have been verified by our team. 
                    Current status: <span className="font-semibold capitalize">{profileData.doctor.verificationStatus}</span>
                  </p>
                </div>
              </div>
            )}

            {/* Current Publication Status */}
            <div className="mb-4 p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                {profileData?.isPublished ? (
                  <>
                    <Globe className="w-5 h-5 text-green-600" />
                    <span className="font-semibold text-green-900">Profile is Published</span>
                  </>
                ) : (
                  <>
                    <GlobeLock className="w-5 h-5 text-slate-600" />
                    <span className="font-semibold text-slate-900">Profile is Not Published</span>
                  </>
                )}
              </div>
              <p className="text-sm text-slate-600">
                {profileData?.isPublished 
                  ? 'Your profile is visible to patients when they book appointments.'
                  : 'Your profile is currently hidden from patients. Publish it to make it visible.'}
              </p>
            </div>

            {/* Publish/Unpublish Buttons */}
            <div className="flex gap-3">
              {!profileData?.isPublished ? (
                <button
                  type="button"
                  onClick={() => setShowPublishDialog(true)}
                  disabled={profileData?.doctor?.verificationStatus !== 'verified' || publishProfileMutation.isPending}
                  className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {publishProfileMutation.isPending ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Publishing...</span>
                    </>
                  ) : (
                    <>
                      <Globe className="w-5 h-5" />
                      <span>Publish Profile</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowUnpublishDialog(true)}
                  disabled={unpublishProfileMutation.isPending}
                  className="flex items-center gap-2 px-6 py-3 bg-slate-600 text-white font-semibold rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {unpublishProfileMutation.isPending ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Unpublishing...</span>
                    </>
                  ) : (
                    <>
                      <GlobeLock className="w-5 h-5" />
                      <span>Unpublish Profile</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </section>

          {/* Save Button */}
          <div className="flex justify-end gap-4">
            <button
              type="submit"
              disabled={updateProfileMutation.isPending || !isDirty}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updateProfileMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Publish Confirmation Dialog */}
        {showPublishDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <Globe className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Publish Your Profile?</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Publishing your profile will make it visible to patients when they book appointments.
                  </p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-900">
                  <strong>What this means:</strong>
                </p>
                <ul className="text-sm text-blue-800 mt-2 space-y-1 list-disc list-inside">
                  <li>Patients will see your profile information</li>
                  <li>Your photo, bio, and credentials will be visible</li>
                  <li>You can unpublish at any time</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowPublishDialog(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => publishProfileMutation.mutate()}
                  disabled={publishProfileMutation.isPending}
                  className="flex-1 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {publishProfileMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Publishing...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Publish</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Unpublish Confirmation Dialog */}
        {showUnpublishDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <GlobeLock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Unpublish Your Profile?</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Unpublishing will hide your profile from patients.
                  </p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-amber-900">
                  <strong>What this means:</strong>
                </p>
                <ul className="text-sm text-amber-800 mt-2 space-y-1 list-disc list-inside">
                  <li>Patients will not see your profile</li>
                  <li>You can still edit your profile</li>
                  <li>You can republish at any time</li>
                  <li>Existing appointments are not affected</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowUnpublishDialog(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => unpublishProfileMutation.mutate()}
                  disabled={unpublishProfileMutation.isPending}
                  className="flex-1 px-4 py-2 bg-slate-600 text-white font-semibold rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {unpublishProfileMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Unpublishing...</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      <span>Unpublish</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
