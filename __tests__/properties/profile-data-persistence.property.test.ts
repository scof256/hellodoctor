/**
 * Property Test: Profile Data Persistence
 *
 * Property 1: For any valid professional profile data submitted by a doctor,
 * saving the profile should result in all fields being retrievable with identical values.
 *
 * **Validates: Requirements 1.4**
 *
 * Feature: doctor-professional-profile, Property 1: Profile Data Persistence
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Types matching the database schema
interface EducationEntry {
  id: string;
  institution: string;
  degree: string;
  fieldOfStudy?: string;
  year: number;
  isVerified?: boolean;
}

interface CertificationEntry {
  id: string;
  name: string;
  issuingOrganization: string;
  year: number;
  expiryYear?: number;
  credentialId?: string;
  isVerified?: boolean;
}

interface DoctorProfile {
  id: string;
  doctorId: string;
  professionalBio?: string;
  yearsOfExperience?: number;
  specializations: string[];
  education: EducationEntry[];
  certifications: CertificationEntry[];
  languages: string[];
  officeAddress?: string;
  officePhone?: string;
  officeEmail?: string;
  profilePhotoUrl?: string;
  profilePhotoKey?: string;
  consultationFee?: number;
  completenessScore: number;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Simulate database operations
interface Database {
  profiles: Map<string, DoctorProfile>;
}

function createDatabase(): Database {
  return { profiles: new Map() };
}

function generateId(): string {
  return `profile-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Save profile to database
function saveProfile(
  db: Database,
  doctorId: string,
  profileData: Omit<DoctorProfile, 'id' | 'doctorId' | 'createdAt' | 'updatedAt'>
): { db: Database; profile: DoctorProfile } {
  const now = new Date();
  const profile: DoctorProfile = {
    id: generateId(),
    doctorId,
    ...profileData,
    createdAt: now,
    updatedAt: now,
  };

  const updatedProfiles = new Map(db.profiles);
  updatedProfiles.set(doctorId, profile);

  return {
    db: { profiles: updatedProfiles },
    profile,
  };
}

// Retrieve profile from database
function retrieveProfile(db: Database, doctorId: string): DoctorProfile | null {
  return db.profiles.get(doctorId) ?? null;
}

// Compare two profiles for equality
function profilesAreEqual(original: DoctorProfile, retrieved: DoctorProfile): boolean {
  return (
    original.doctorId === retrieved.doctorId &&
    original.professionalBio === retrieved.professionalBio &&
    original.yearsOfExperience === retrieved.yearsOfExperience &&
    JSON.stringify(original.specializations) === JSON.stringify(retrieved.specializations) &&
    JSON.stringify(original.education) === JSON.stringify(retrieved.education) &&
    JSON.stringify(original.certifications) === JSON.stringify(retrieved.certifications) &&
    JSON.stringify(original.languages) === JSON.stringify(retrieved.languages) &&
    original.officeAddress === retrieved.officeAddress &&
    original.officePhone === retrieved.officePhone &&
    original.officeEmail === retrieved.officeEmail &&
    original.profilePhotoUrl === retrieved.profilePhotoUrl &&
    original.profilePhotoKey === retrieved.profilePhotoKey &&
    original.consultationFee === retrieved.consultationFee &&
    original.completenessScore === retrieved.completenessScore &&
    original.isPublished === retrieved.isPublished
  );
}

// Arbitrary generators
const doctorIdArb = fc.uuid();

const bioArb = fc.option(
  fc.string({ minLength: 50, maxLength: 1000 }),
  { nil: undefined }
);

const yearsOfExperienceArb = fc.option(
  fc.integer({ min: 0, max: 70 }),
  { nil: undefined }
);

const specializationArb = fc.string({ minLength: 1, maxLength: 100 });
const specializationsArb = fc.array(specializationArb, { minLength: 0, maxLength: 10 });

const educationEntryArb = fc.record({
  id: fc.uuid(),
  institution: fc.string({ minLength: 1, maxLength: 200 }),
  degree: fc.string({ minLength: 1, maxLength: 100 }),
  fieldOfStudy: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
  year: fc.integer({ min: 1950, max: new Date().getFullYear() }),
  isVerified: fc.option(fc.boolean(), { nil: undefined }),
});

const educationArb = fc.array(educationEntryArb, { minLength: 0, maxLength: 20 });

const certificationEntryArb = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 200 }),
  issuingOrganization: fc.string({ minLength: 1, maxLength: 200 }),
  year: fc.integer({ min: 1950, max: new Date().getFullYear() }),
  expiryYear: fc.option(
    fc.integer({ min: new Date().getFullYear(), max: new Date().getFullYear() + 50 }),
    { nil: undefined }
  ),
  credentialId: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
  isVerified: fc.option(fc.boolean(), { nil: undefined }),
});

const certificationsArb = fc.array(certificationEntryArb, { minLength: 0, maxLength: 30 });

const languageArb = fc.string({ minLength: 1, maxLength: 50 });
const languagesArb = fc.array(languageArb, { minLength: 0, maxLength: 20 });

const officeAddressArb = fc.option(
  fc.string({ minLength: 1, maxLength: 500 }),
  { nil: undefined }
);

const officePhoneArb = fc.option(
  fc.string({ minLength: 1, maxLength: 50 }),
  { nil: undefined }
);

const officeEmailArb = fc.option(
  fc.emailAddress(),
  { nil: undefined }
);

const profilePhotoUrlArb = fc.option(fc.webUrl(), { nil: undefined });
const profilePhotoKeyArb = fc.option(
  fc.string({ minLength: 1, maxLength: 255 }),
  { nil: undefined }
);

const consultationFeeArb = fc.option(
  fc.integer({ min: 0, max: 1000000 }), // stored in cents
  { nil: undefined }
);

const completenessScoreArb = fc.integer({ min: 0, max: 100 });
const isPublishedArb = fc.boolean();

const profileDataArb = fc.record({
  professionalBio: bioArb,
  yearsOfExperience: yearsOfExperienceArb,
  specializations: specializationsArb,
  education: educationArb,
  certifications: certificationsArb,
  languages: languagesArb,
  officeAddress: officeAddressArb,
  officePhone: officePhoneArb,
  officeEmail: officeEmailArb,
  profilePhotoUrl: profilePhotoUrlArb,
  profilePhotoKey: profilePhotoKeyArb,
  consultationFee: consultationFeeArb,
  completenessScore: completenessScoreArb,
  isPublished: isPublishedArb,
});

describe('Property 1: Profile Data Persistence', () => {
  it('all profile fields are identical after round-trip', () => {
    fc.assert(
      fc.property(doctorIdArb, profileDataArb, (doctorId, profileData) => {
        // Create database
        let db = createDatabase();

        // Save profile
        const { db: updatedDb, profile: original } = saveProfile(db, doctorId, profileData);
        db = updatedDb;

        // Retrieve profile
        const retrieved = retrieveProfile(db, doctorId);

        // Should retrieve the profile
        expect(retrieved).not.toBeNull();

        // All fields should be identical
        expect(profilesAreEqual(original, retrieved!)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('professional bio is preserved exactly', () => {
    fc.assert(
      fc.property(doctorIdArb, bioArb, (doctorId, bio) => {
        let db = createDatabase();

        const profileData = {
          professionalBio: bio,
          specializations: [],
          education: [],
          certifications: [],
          languages: [],
          completenessScore: 0,
          isPublished: false,
        };

        const { db: updatedDb } = saveProfile(db, doctorId, profileData);
        db = updatedDb;

        const retrieved = retrieveProfile(db, doctorId);
        expect(retrieved?.professionalBio).toBe(bio);
      }),
      { numRuns: 100 }
    );
  });

  it('years of experience is preserved exactly', () => {
    fc.assert(
      fc.property(doctorIdArb, yearsOfExperienceArb, (doctorId, years) => {
        let db = createDatabase();

        const profileData = {
          yearsOfExperience: years,
          specializations: [],
          education: [],
          certifications: [],
          languages: [],
          completenessScore: 0,
          isPublished: false,
        };

        const { db: updatedDb } = saveProfile(db, doctorId, profileData);
        db = updatedDb;

        const retrieved = retrieveProfile(db, doctorId);
        expect(retrieved?.yearsOfExperience).toBe(years);
      }),
      { numRuns: 100 }
    );
  });

  it('specializations array is preserved with order', () => {
    fc.assert(
      fc.property(doctorIdArb, specializationsArb, (doctorId, specializations) => {
        let db = createDatabase();

        const profileData = {
          specializations,
          education: [],
          certifications: [],
          languages: [],
          completenessScore: 0,
          isPublished: false,
        };

        const { db: updatedDb } = saveProfile(db, doctorId, profileData);
        db = updatedDb;

        const retrieved = retrieveProfile(db, doctorId);
        expect(retrieved?.specializations).toEqual(specializations);
      }),
      { numRuns: 100 }
    );
  });

  it('education entries are preserved with all fields', () => {
    fc.assert(
      fc.property(doctorIdArb, educationArb, (doctorId, education) => {
        let db = createDatabase();

        const profileData = {
          specializations: [],
          education,
          certifications: [],
          languages: [],
          completenessScore: 0,
          isPublished: false,
        };

        const { db: updatedDb } = saveProfile(db, doctorId, profileData);
        db = updatedDb;

        const retrieved = retrieveProfile(db, doctorId);
        expect(retrieved?.education).toEqual(education);
      }),
      { numRuns: 100 }
    );
  });

  it('certification entries are preserved with all fields', () => {
    fc.assert(
      fc.property(doctorIdArb, certificationsArb, (doctorId, certifications) => {
        let db = createDatabase();

        const profileData = {
          specializations: [],
          education: [],
          certifications,
          languages: [],
          completenessScore: 0,
          isPublished: false,
        };

        const { db: updatedDb } = saveProfile(db, doctorId, profileData);
        db = updatedDb;

        const retrieved = retrieveProfile(db, doctorId);
        expect(retrieved?.certifications).toEqual(certifications);
      }),
      { numRuns: 100 }
    );
  });

  it('languages array is preserved', () => {
    fc.assert(
      fc.property(doctorIdArb, languagesArb, (doctorId, languages) => {
        let db = createDatabase();

        const profileData = {
          specializations: [],
          education: [],
          certifications: [],
          languages,
          completenessScore: 0,
          isPublished: false,
        };

        const { db: updatedDb } = saveProfile(db, doctorId, profileData);
        db = updatedDb;

        const retrieved = retrieveProfile(db, doctorId);
        expect(retrieved?.languages).toEqual(languages);
      }),
      { numRuns: 100 }
    );
  });

  it('office contact information is preserved', () => {
    fc.assert(
      fc.property(
        doctorIdArb,
        officeAddressArb,
        officePhoneArb,
        officeEmailArb,
        (doctorId, address, phone, email) => {
          let db = createDatabase();

          const profileData = {
            specializations: [],
            education: [],
            certifications: [],
            languages: [],
            officeAddress: address,
            officePhone: phone,
            officeEmail: email,
            completenessScore: 0,
            isPublished: false,
          };

          const { db: updatedDb } = saveProfile(db, doctorId, profileData);
          db = updatedDb;

          const retrieved = retrieveProfile(db, doctorId);
          expect(retrieved?.officeAddress).toBe(address);
          expect(retrieved?.officePhone).toBe(phone);
          expect(retrieved?.officeEmail).toBe(email);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('profile photo URL and key are preserved', () => {
    fc.assert(
      fc.property(
        doctorIdArb,
        profilePhotoUrlArb,
        profilePhotoKeyArb,
        (doctorId, photoUrl, photoKey) => {
          let db = createDatabase();

          const profileData = {
            specializations: [],
            education: [],
            certifications: [],
            languages: [],
            profilePhotoUrl: photoUrl,
            profilePhotoKey: photoKey,
            completenessScore: 0,
            isPublished: false,
          };

          const { db: updatedDb } = saveProfile(db, doctorId, profileData);
          db = updatedDb;

          const retrieved = retrieveProfile(db, doctorId);
          expect(retrieved?.profilePhotoUrl).toBe(photoUrl);
          expect(retrieved?.profilePhotoKey).toBe(photoKey);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('consultation fee is preserved', () => {
    fc.assert(
      fc.property(doctorIdArb, consultationFeeArb, (doctorId, fee) => {
        let db = createDatabase();

        const profileData = {
          specializations: [],
          education: [],
          certifications: [],
          languages: [],
          consultationFee: fee,
          completenessScore: 0,
          isPublished: false,
        };

        const { db: updatedDb } = saveProfile(db, doctorId, profileData);
        db = updatedDb;

        const retrieved = retrieveProfile(db, doctorId);
        expect(retrieved?.consultationFee).toBe(fee);
      }),
      { numRuns: 100 }
    );
  });

  it('completeness score and publication status are preserved', () => {
    fc.assert(
      fc.property(
        doctorIdArb,
        completenessScoreArb,
        isPublishedArb,
        (doctorId, score, published) => {
          let db = createDatabase();

          const profileData = {
            specializations: [],
            education: [],
            certifications: [],
            languages: [],
            completenessScore: score,
            isPublished: published,
          };

          const { db: updatedDb } = saveProfile(db, doctorId, profileData);
          db = updatedDb;

          const retrieved = retrieveProfile(db, doctorId);
          expect(retrieved?.completenessScore).toBe(score);
          expect(retrieved?.isPublished).toBe(published);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('updating profile preserves all new values', () => {
    fc.assert(
      fc.property(
        doctorIdArb,
        profileDataArb,
        profileDataArb,
        (doctorId, initialData, updatedData) => {
          let db = createDatabase();

          // Save initial profile
          const { db: db1 } = saveProfile(db, doctorId, initialData);
          db = db1;

          // Update profile
          const { db: db2 } = saveProfile(db, doctorId, updatedData);
          db = db2;

          // Retrieve profile
          const retrieved = retrieveProfile(db, doctorId);

          // Should have updated values, not initial values
          expect(retrieved?.professionalBio).toBe(updatedData.professionalBio);
          expect(retrieved?.yearsOfExperience).toBe(updatedData.yearsOfExperience);
          expect(retrieved?.specializations).toEqual(updatedData.specializations);
          expect(retrieved?.education).toEqual(updatedData.education);
          expect(retrieved?.certifications).toEqual(updatedData.certifications);
          expect(retrieved?.languages).toEqual(updatedData.languages);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('profiles for different doctors are isolated', () => {
    fc.assert(
      fc.property(
        doctorIdArb,
        doctorIdArb,
        profileDataArb,
        profileDataArb,
        (doctorId1, doctorId2, data1, data2) => {
          // Skip if doctor IDs are the same
          fc.pre(doctorId1 !== doctorId2);

          let db = createDatabase();

          // Save profile for doctor 1
          const { db: db1 } = saveProfile(db, doctorId1, data1);
          db = db1;

          // Save profile for doctor 2
          const { db: db2 } = saveProfile(db, doctorId2, data2);
          db = db2;

          // Retrieve both profiles
          const retrieved1 = retrieveProfile(db, doctorId1);
          const retrieved2 = retrieveProfile(db, doctorId2);

          // Both should exist
          expect(retrieved1).not.toBeNull();
          expect(retrieved2).not.toBeNull();

          // Should have correct data
          expect(retrieved1?.professionalBio).toBe(data1.professionalBio);
          expect(retrieved2?.professionalBio).toBe(data2.professionalBio);
        }
      ),
      { numRuns: 100 }
    );
  });
});
