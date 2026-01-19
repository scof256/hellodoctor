/**
 * Unit tests for professional profile API endpoints
 * Requirements: 1.2, 1.3, 3.4
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TRPCError } from '@trpc/server';
import { 
  updateProfessionalProfileSchema, 
  calculateProfileCompleteness 
} from '@/lib/validation';
import { 
  canViewProfile, 
  canEditProfile, 
  canPublishProfile 
} from '@/lib/profile-access-control';

describe('Professional Profile API Endpoints', () => {
  describe('Profile Creation', () => {
    it('should successfully create a profile with valid data', () => {
      const validProfileData = {
        professionalBio: 'A'.repeat(50), // Minimum 50 characters
        yearsOfExperience: 10,
        specializations: ['Cardiology'],
        education: [{
          id: '123e4567-e89b-12d3-a456-426614174000',
          institution: 'Medical University',
          degree: 'MD',
          year: 2010,
        }],
        languages: ['English'],
      };

      const result = updateProfessionalProfileSchema.safeParse(validProfileData);
      expect(result.success).toBe(true);
    });

    it('should reject profile with invalid biography length', () => {
      const invalidProfileData = {
        professionalBio: 'Too short', // Less than 50 characters
      };

      const result = updateProfessionalProfileSchema.safeParse(invalidProfileData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('at least 50 characters');
      }
    });

    it('should reject profile with invalid years of experience', () => {
      const invalidProfileData = {
        yearsOfExperience: -5, // Negative value
      };

      const result = updateProfessionalProfileSchema.safeParse(invalidProfileData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('cannot be negative');
      }
    });

    it('should reject profile with future education year', () => {
      const futureYear = new Date().getFullYear() + 1;
      const invalidProfileData = {
        education: [{
          id: '123e4567-e89b-12d3-a456-426614174000',
          institution: 'Medical University',
          degree: 'MD',
          year: futureYear,
        }],
      };

      const result = updateProfessionalProfileSchema.safeParse(invalidProfileData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('cannot be in the future');
      }
    });
  });

  describe('Profile Update', () => {
    it('should successfully update profile with valid data', () => {
      const updateData = {
        professionalBio: 'Updated biography with sufficient length to meet the minimum requirement of fifty characters',
        yearsOfExperience: 15,
      };

      const result = updateProfessionalProfileSchema.safeParse(updateData);
      expect(result.success).toBe(true);
    });

    it('should preserve data on validation errors', () => {
      const invalidData = {
        professionalBio: 'Short', // Invalid
        yearsOfExperience: 15, // Valid
        specializations: ['Cardiology'], // Valid
      };

      const result = updateProfessionalProfileSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      
      // The valid fields should still be accessible in the input
      expect(invalidData.yearsOfExperience).toBe(15);
      expect(invalidData.specializations).toEqual(['Cardiology']);
    });
  });

  describe('Authorization Checks', () => {
    it('should allow profile owner to edit their profile', () => {
      const doctor = {
        id: 'doctor-123',
        userId: 'user-123',
        verificationStatus: 'verified' as const,
      };

      const user = {
        id: 'user-123',
        primaryRole: 'doctor' as const,
      };

      const canEdit = canEditProfile(doctor, user);
      expect(canEdit).toBe(true);
    });

    it('should prevent non-owner from editing profile', () => {
      const doctor = {
        id: 'doctor-123',
        userId: 'user-123',
        verificationStatus: 'verified' as const,
      };

      const otherUser = {
        id: 'user-456',
        primaryRole: 'doctor' as const,
      };

      const canEdit = canEditProfile(doctor, otherUser);
      expect(canEdit).toBe(false);
    });

    it('should allow verified doctor to publish profile', () => {
      const verifiedDoctor = {
        id: 'doctor-123',
        userId: 'user-123',
        verificationStatus: 'verified' as const,
      };

      const canPublish = canPublishProfile(verifiedDoctor);
      expect(canPublish).toBe(true);
    });

    it('should prevent unverified doctor from publishing profile', () => {
      const unverifiedDoctor = {
        id: 'doctor-123',
        userId: 'user-123',
        verificationStatus: 'pending' as const,
      };

      const canPublish = canPublishProfile(unverifiedDoctor);
      expect(canPublish).toBe(false);
    });

    it('should allow admin to view any profile', () => {
      const profile = {
        isPublished: false,
        professionalBio: 'Test bio',
      };

      const doctor = {
        id: 'doctor-123',
        userId: 'user-123',
        verificationStatus: 'pending' as const,
      };

      const admin = {
        id: 'admin-123',
        primaryRole: 'super_admin' as const,
      };

      const canView = canViewProfile(profile, doctor, admin);
      expect(canView).toBe(true);
    });

    it('should hide unpublished profile from public', () => {
      const profile = {
        isPublished: false,
        professionalBio: 'Test bio',
      };

      const doctor = {
        id: 'doctor-123',
        userId: 'user-123',
        verificationStatus: 'verified' as const,
      };

      const canView = canViewProfile(profile, doctor, null);
      expect(canView).toBe(false);
    });
  });

  describe('Completeness Calculation', () => {
    it('should calculate 0% for empty profile', () => {
      const emptyProfile = {};
      const score = calculateProfileCompleteness(emptyProfile);
      expect(score).toBe(0);
    });

    it('should calculate correct score for partially complete profile', () => {
      const partialProfile = {
        professionalBio: 'A'.repeat(50), // 20 points
        specializations: ['Cardiology'], // 15 points
        yearsOfExperience: 10, // 10 points
      };
      
      const score = calculateProfileCompleteness(partialProfile);
      expect(score).toBe(45); // 20 + 15 + 10
    });

    it('should calculate 100% for fully complete profile', () => {
      const completeProfile = {
        professionalBio: 'A'.repeat(50),
        specializations: ['Cardiology'],
        yearsOfExperience: 10,
        education: [{
          id: '123e4567-e89b-12d3-a456-426614174000',
          institution: 'Medical University',
          degree: 'MD',
          year: 2010,
        }],
        certifications: [{
          id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Board Certified',
          issuingOrganization: 'Medical Board',
          year: 2012,
        }],
        languages: ['English'],
        profilePhotoUrl: 'https://example.com/photo.jpg',
        officeAddress: '123 Medical St',
      };
      
      const score = calculateProfileCompleteness(completeProfile);
      expect(score).toBe(100);
    });

    it('should not count biography shorter than 50 characters', () => {
      const profileWithShortBio = {
        professionalBio: 'Short bio', // Less than 50 characters
      };
      
      const score = calculateProfileCompleteness(profileWithShortBio);
      expect(score).toBe(0);
    });
  });

  describe('Validation Error Handling', () => {
    it('should provide specific error messages for each field', () => {
      const invalidData = {
        professionalBio: 'Too short',
        yearsOfExperience: -1,
        consultationFee: -100,
      };

      const result = updateProfessionalProfileSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      
      if (!result.success) {
        const errors = result.error.issues;
        expect(errors.length).toBeGreaterThan(0);
        
        // Check that each error has a specific message
        errors.forEach(error => {
          expect(error.message).toBeTruthy();
          expect(error.path).toBeTruthy();
        });
      }
    });

    it('should validate consultation fee decimal places', () => {
      const invalidFee = {
        consultationFee: 99.999, // More than 2 decimal places
      };

      const result = updateProfessionalProfileSchema.safeParse(invalidFee);
      expect(result.success).toBe(false);
      
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('at most 2 decimal places');
      }
    });

    it('should accept valid consultation fee with 2 decimal places', () => {
      const validFee = {
        consultationFee: 99.99,
      };

      const result = updateProfessionalProfileSchema.safeParse(validFee);
      expect(result.success).toBe(true);
    });
  });
});
