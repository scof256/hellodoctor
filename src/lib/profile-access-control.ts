/**
 * Access control utilities for doctor professional profiles.
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import type { DoctorProfile } from './validation';

/**
 * Type definitions for access control
 */
export interface Doctor {
  id: string;
  userId: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
}

export interface User {
  id: string;
  primaryRole: 'super_admin' | 'doctor' | 'clinic_admin' | 'receptionist' | 'patient';
}

export interface ProfileWithPublishStatus extends DoctorProfile {
  isPublished: boolean;
}

/**
 * Check if a viewer can view a doctor's profile.
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.5
 * 
 * Rules:
 * - Owner can always view their own profile
 * - Admins can view all profiles regardless of verification status
 * - Public (patients) can view only if profile is published AND doctor is verified
 * 
 * @param profile - The doctor professional profile
 * @param doctor - The doctor record
 * @param viewer - The user viewing the profile (null for anonymous)
 * @returns true if viewer can view the profile
 */
export function canViewProfile(
  profile: ProfileWithPublishStatus,
  doctor: Doctor,
  viewer: User | null
): boolean {
  // Owner can always view their own profile
  if (viewer && viewer.id === doctor.userId) {
    return true;
  }
  
  // Admins can view all profiles
  if (viewer && viewer.primaryRole === 'super_admin') {
    return true;
  }
  
  // Public can view only if published and doctor is verified
  return profile.isPublished && doctor.verificationStatus === 'verified';
}

/**
 * Check if a user can edit a doctor's profile.
 * 
 * Requirements: 3.4
 * 
 * Rules:
 * - Only the profile owner can edit their profile
 * 
 * @param doctor - The doctor record
 * @param user - The user attempting to edit
 * @returns true if user can edit the profile
 */
export function canEditProfile(doctor: Doctor, user: User): boolean {
  // Only the profile owner can edit
  return user.id === doctor.userId;
}

/**
 * Check if a doctor can publish their profile.
 * 
 * Requirements: 3.1, 3.2
 * 
 * Rules:
 * - Can only publish if doctor is verified
 * 
 * @param doctor - The doctor record
 * @returns true if doctor can publish their profile
 */
export function canPublishProfile(doctor: Doctor): boolean {
  // Can only publish if doctor is verified
  return doctor.verificationStatus === 'verified';
}
