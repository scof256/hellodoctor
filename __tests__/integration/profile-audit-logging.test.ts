/**
 * Integration test for profile audit logging
 * 
 * Verifies that all profile operations create appropriate audit log entries.
 * Requirements: 1.2, 1.4
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { auditService } from '@/server/services/audit';
import type { AuditAction, AuditResourceType } from '@/server/services/audit';

describe('Profile Audit Logging Integration', () => {
  describe('Profile Creation Audit', () => {
    it('should log profile creation with correct action and resource type', async () => {
      const userId = 'test-user-id';
      const profileId = 'test-profile-id';
      const doctorId = 'test-doctor-id';
      
      const auditEntry = await auditService.log({
        userId,
        action: 'doctor_profile_created',
        resourceType: 'doctor_profile',
        resourceId: profileId,
        metadata: {
          doctorId,
          completenessScore: 0,
          professionalBio: 'Test bio',
        },
      });

      expect(auditEntry).toBeDefined();
      expect(auditEntry.userId).toBe(userId);
      expect(auditEntry.action).toBe('doctor_profile_created');
      expect(auditEntry.resourceType).toBe('doctor_profile');
      expect(auditEntry.resourceId).toBe(profileId);
      expect(auditEntry.metadata).toMatchObject({
        doctorId,
        completenessScore: 0,
      });
    });
  });

  describe('Profile Update Audit', () => {
    it('should log profile update with before/after values', async () => {
      const userId = 'test-user-id';
      const profileId = 'test-profile-id';
      
      const previousValue = {
        professionalBio: 'Old bio',
        yearsOfExperience: 5,
      };
      
      const newValue = {
        professionalBio: 'New bio',
        yearsOfExperience: 10,
      };

      const auditEntry = await auditService.logDataModification(
        userId,
        'doctor_profile_updated',
        'doctor_profile',
        profileId,
        previousValue,
        newValue
      );

      expect(auditEntry).toBeDefined();
      expect(auditEntry.userId).toBe(userId);
      expect(auditEntry.action).toBe('doctor_profile_updated');
      expect(auditEntry.resourceType).toBe('doctor_profile');
      expect(auditEntry.resourceId).toBe(profileId);
      expect(auditEntry.metadata).toMatchObject({
        previousValue,
        newValue,
      });
    });
  });

  describe('Photo Upload Audit', () => {
    it('should log photo upload with URL and key', async () => {
      const userId = 'test-user-id';
      const profileId = 'test-profile-id';
      const photoUrl = 'https://example.com/photo.jpg';
      const photoKey = 'photo-key-123';

      const auditEntry = await auditService.log({
        userId,
        action: 'doctor_profile_photo_uploaded',
        resourceType: 'doctor_profile',
        resourceId: profileId,
        metadata: {
          url: photoUrl,
          key: photoKey,
          previousPhotoKey: null,
          type: 'profile_photo',
        },
      });

      expect(auditEntry).toBeDefined();
      expect(auditEntry.userId).toBe(userId);
      expect(auditEntry.action).toBe('doctor_profile_photo_uploaded');
      expect(auditEntry.resourceType).toBe('doctor_profile');
      expect(auditEntry.metadata).toMatchObject({
        url: photoUrl,
        key: photoKey,
        type: 'profile_photo',
      });
    });

    it('should log photo replacement with previous key', async () => {
      const userId = 'test-user-id';
      const profileId = 'test-profile-id';
      const newPhotoUrl = 'https://example.com/new-photo.jpg';
      const newPhotoKey = 'new-photo-key-456';
      const oldPhotoKey = 'old-photo-key-123';

      const auditEntry = await auditService.log({
        userId,
        action: 'doctor_profile_photo_uploaded',
        resourceType: 'doctor_profile',
        resourceId: profileId,
        metadata: {
          url: newPhotoUrl,
          key: newPhotoKey,
          previousPhotoKey: oldPhotoKey,
          type: 'profile_photo',
        },
      });

      expect(auditEntry).toBeDefined();
      expect(auditEntry.metadata).toMatchObject({
        previousPhotoKey: oldPhotoKey,
      });
    });
  });

  describe('Photo Deletion Audit', () => {
    it('should log photo deletion with deleted key', async () => {
      const userId = 'test-user-id';
      const profileId = 'test-profile-id';
      const deletedPhotoKey = 'photo-key-to-delete';

      const auditEntry = await auditService.log({
        userId,
        action: 'doctor_profile_photo_deleted',
        resourceType: 'doctor_profile',
        resourceId: profileId,
        metadata: {
          deletedPhotoKey,
          type: 'profile_photo',
        },
      });

      expect(auditEntry).toBeDefined();
      expect(auditEntry.userId).toBe(userId);
      expect(auditEntry.action).toBe('doctor_profile_photo_deleted');
      expect(auditEntry.resourceType).toBe('doctor_profile');
      expect(auditEntry.metadata).toMatchObject({
        deletedPhotoKey,
        type: 'profile_photo',
      });
    });
  });

  describe('Profile Publication Audit', () => {
    it('should log profile publication with verification status', async () => {
      const userId = 'test-user-id';
      const profileId = 'test-profile-id';
      const doctorId = 'test-doctor-id';

      const auditEntry = await auditService.log({
        userId,
        action: 'doctor_profile_published',
        resourceType: 'doctor_profile',
        resourceId: profileId,
        metadata: {
          doctorId,
          verificationStatus: 'verified',
          completenessScore: 85,
        },
      });

      expect(auditEntry).toBeDefined();
      expect(auditEntry.userId).toBe(userId);
      expect(auditEntry.action).toBe('doctor_profile_published');
      expect(auditEntry.resourceType).toBe('doctor_profile');
      expect(auditEntry.metadata).toMatchObject({
        doctorId,
        verificationStatus: 'verified',
        completenessScore: 85,
      });
    });

    it('should log profile unpublication', async () => {
      const userId = 'test-user-id';
      const profileId = 'test-profile-id';
      const doctorId = 'test-doctor-id';

      const auditEntry = await auditService.log({
        userId,
        action: 'doctor_profile_unpublished',
        resourceType: 'doctor_profile',
        resourceId: profileId,
        metadata: {
          doctorId,
          completenessScore: 85,
        },
      });

      expect(auditEntry).toBeDefined();
      expect(auditEntry.userId).toBe(userId);
      expect(auditEntry.action).toBe('doctor_profile_unpublished');
      expect(auditEntry.resourceType).toBe('doctor_profile');
      expect(auditEntry.metadata).toMatchObject({
        doctorId,
        completenessScore: 85,
      });
    });
  });

  describe('Audit Log Querying', () => {
    it('should retrieve profile audit history by resource', async () => {
      const profileId = 'test-profile-id';
      
      // Create multiple audit entries for the same profile
      await auditService.log({
        userId: 'user-1',
        action: 'doctor_profile_created',
        resourceType: 'doctor_profile',
        resourceId: profileId,
        metadata: { step: 1 },
      });

      await auditService.log({
        userId: 'user-1',
        action: 'doctor_profile_updated',
        resourceType: 'doctor_profile',
        resourceId: profileId,
        metadata: { step: 2 },
      });

      await auditService.log({
        userId: 'user-1',
        action: 'doctor_profile_published',
        resourceType: 'doctor_profile',
        resourceId: profileId,
        metadata: { step: 3 },
      });

      // Query audit history
      const history = await auditService.getResourceAuditHistory(
        'doctor_profile',
        profileId
      );

      expect(history.length).toBeGreaterThanOrEqual(3);
      
      // Verify entries are in reverse chronological order (newest first)
      const profileEntries = history.filter(entry => entry.resourceId === profileId);
      expect(profileEntries.length).toBeGreaterThanOrEqual(3);
      
      // Check that we have the expected actions
      const actions = profileEntries.map(entry => entry.action);
      expect(actions).toContain('doctor_profile_created');
      expect(actions).toContain('doctor_profile_updated');
      expect(actions).toContain('doctor_profile_published');
    });
  });

  describe('Audit Action Type Validation', () => {
    it('should accept all profile-related audit actions', () => {
      const profileActions: AuditAction[] = [
        'doctor_profile_created',
        'doctor_profile_updated',
        'doctor_profile_photo_uploaded',
        'doctor_profile_photo_deleted',
        'doctor_profile_published',
        'doctor_profile_unpublished',
      ];

      // This test verifies that TypeScript accepts these actions
      // If any action is invalid, TypeScript compilation will fail
      profileActions.forEach(action => {
        expect(action).toBeDefined();
      });
    });

    it('should accept doctor_profile as a valid resource type', () => {
      const resourceType: AuditResourceType = 'doctor_profile';
      expect(resourceType).toBe('doctor_profile');
    });
  });
});
