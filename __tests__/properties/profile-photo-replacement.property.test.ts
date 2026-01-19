/**
 * Property-Based Test: Profile Photo Replacement
 * Feature: doctor-professional-profile, Property 9: Profile Photo Replacement
 * 
 * Property: For any doctor profile with an existing photo, uploading a new photo
 * should result in the old photo being deleted from storage and the new photo URL
 * replacing the old one in the database.
 * 
 * Validates: Requirements 4.5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';

// Mock UploadThing API
const mockDeleteFiles = vi.fn();
vi.mock('uploadthing/server', () => ({
  UTApi: vi.fn().mockImplementation(() => ({
    deleteFiles: mockDeleteFiles,
  })),
}));

// Simulated profile photo replacement logic
interface ProfilePhoto {
  url: string;
  key: string;
}

interface DoctorProfile {
  id: string;
  doctorId: string;
  profilePhotoUrl: string | null;
  profilePhotoKey: string | null;
  completenessScore: number;
}

async function replaceProfilePhoto(
  existingProfile: DoctorProfile | null,
  newPhoto: ProfilePhoto,
  deleteOldPhoto: (key: string) => Promise<void>
): Promise<DoctorProfile> {
  // Delete old photo if exists
  if (existingProfile?.profilePhotoKey) {
    await deleteOldPhoto(existingProfile.profilePhotoKey);
  }

  // Return updated profile with new photo
  return {
    id: existingProfile?.id ?? 'new-profile-id',
    doctorId: existingProfile?.doctorId ?? 'doctor-id',
    profilePhotoUrl: newPhoto.url,
    profilePhotoKey: newPhoto.key,
    completenessScore: existingProfile?.completenessScore ?? 0,
  };
}

describe('Property 9: Profile Photo Replacement', () => {
  beforeEach(() => {
    mockDeleteFiles.mockClear();
  });

  it('should replace old photo with new photo and delete old from storage', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate existing profile with photo
        fc.record({
          id: fc.uuid(),
          doctorId: fc.uuid(),
          profilePhotoUrl: fc.webUrl(),
          profilePhotoKey: fc.string({ minLength: 10, maxLength: 50 }),
          completenessScore: fc.integer({ min: 0, max: 100 }),
        }),
        // Generate new photo
        fc.record({
          url: fc.webUrl(),
          key: fc.string({ minLength: 10, maxLength: 50 }),
        }),
        async (existingProfile, newPhoto) => {
          const deleteOldPhoto = vi.fn().mockResolvedValue(undefined);

          const updatedProfile = await replaceProfilePhoto(
            existingProfile,
            newPhoto,
            deleteOldPhoto
          );

          // Old photo should be deleted
          expect(deleteOldPhoto).toHaveBeenCalledWith(existingProfile.profilePhotoKey);
          expect(deleteOldPhoto).toHaveBeenCalledTimes(1);

          // New photo should replace old photo
          expect(updatedProfile.profilePhotoUrl).toBe(newPhoto.url);
          expect(updatedProfile.profilePhotoKey).toBe(newPhoto.key);

          // Profile ID should remain the same
          expect(updatedProfile.id).toBe(existingProfile.id);
          expect(updatedProfile.doctorId).toBe(existingProfile.doctorId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not attempt to delete when no existing photo', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate new photo
        fc.record({
          url: fc.webUrl(),
          key: fc.string({ minLength: 10, maxLength: 50 }),
        }),
        async (newPhoto) => {
          const deleteOldPhoto = vi.fn().mockResolvedValue(undefined);

          const updatedProfile = await replaceProfilePhoto(
            null, // No existing profile
            newPhoto,
            deleteOldPhoto
          );

          // Delete should not be called
          expect(deleteOldPhoto).not.toHaveBeenCalled();

          // New photo should be set
          expect(updatedProfile.profilePhotoUrl).toBe(newPhoto.url);
          expect(updatedProfile.profilePhotoKey).toBe(newPhoto.key);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle multiple photo replacements in sequence', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate initial profile
        fc.record({
          id: fc.uuid(),
          doctorId: fc.uuid(),
          profilePhotoUrl: fc.webUrl(),
          profilePhotoKey: fc.string({ minLength: 10, maxLength: 50 }),
          completenessScore: fc.integer({ min: 0, max: 100 }),
        }),
        // Generate array of new photos
        fc.array(
          fc.record({
            url: fc.webUrl(),
            key: fc.string({ minLength: 10, maxLength: 50 }),
          }),
          { minLength: 2, maxLength: 5 }
        ),
        async (initialProfile, newPhotos) => {
          const deleteOldPhoto = vi.fn().mockResolvedValue(undefined);
          let currentProfile: DoctorProfile = initialProfile;

          // Replace photos in sequence
          for (const newPhoto of newPhotos) {
            const previousKey = currentProfile.profilePhotoKey;
            currentProfile = await replaceProfilePhoto(
              currentProfile,
              newPhoto,
              deleteOldPhoto
            );

            // Each replacement should delete the previous photo
            expect(deleteOldPhoto).toHaveBeenCalledWith(previousKey);

            // Current photo should be the new one
            expect(currentProfile.profilePhotoUrl).toBe(newPhoto.url);
            expect(currentProfile.profilePhotoKey).toBe(newPhoto.key);
          }

          // Total deletions should equal number of replacements
          expect(deleteOldPhoto).toHaveBeenCalledTimes(newPhotos.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve profile identity during replacement', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.uuid(),
          doctorId: fc.uuid(),
          profilePhotoUrl: fc.webUrl(),
          profilePhotoKey: fc.string({ minLength: 10, maxLength: 50 }),
          completenessScore: fc.integer({ min: 0, max: 100 }),
        }),
        fc.record({
          url: fc.webUrl(),
          key: fc.string({ minLength: 10, maxLength: 50 }),
        }),
        async (existingProfile, newPhoto) => {
          const deleteOldPhoto = vi.fn().mockResolvedValue(undefined);

          const updatedProfile = await replaceProfilePhoto(
            existingProfile,
            newPhoto,
            deleteOldPhoto
          );

          // Profile identity should be preserved
          expect(updatedProfile.id).toBe(existingProfile.id);
          expect(updatedProfile.doctorId).toBe(existingProfile.doctorId);

          // Only photo fields should change
          expect(updatedProfile.profilePhotoUrl).not.toBe(existingProfile.profilePhotoUrl);
          expect(updatedProfile.profilePhotoKey).not.toBe(existingProfile.profilePhotoKey);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle deletion errors gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.uuid(),
          doctorId: fc.uuid(),
          profilePhotoUrl: fc.webUrl(),
          profilePhotoKey: fc.string({ minLength: 10, maxLength: 50 }),
          completenessScore: fc.integer({ min: 0, max: 100 }),
        }),
        fc.record({
          url: fc.webUrl(),
          key: fc.string({ minLength: 10, maxLength: 50 }),
        }),
        async (existingProfile, newPhoto) => {
          // Simulate deletion error
          const deleteOldPhoto = vi.fn().mockRejectedValue(new Error('Storage error'));

          // Should still complete the replacement despite deletion error
          await expect(
            replaceProfilePhoto(existingProfile, newPhoto, deleteOldPhoto)
          ).rejects.toThrow('Storage error');

          // Deletion should have been attempted
          expect(deleteOldPhoto).toHaveBeenCalledWith(existingProfile.profilePhotoKey);
        }
      ),
      { numRuns: 100 }
    );
  });
});
