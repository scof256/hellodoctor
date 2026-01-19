/**
 * Input validation and sanitization utilities.
 * Requirements: 16.2
 */

import { z } from 'zod';

// ============================================================================
// SANITIZATION FUNCTIONS
// ============================================================================

/**
 * Sanitize a string by removing potentially dangerous characters.
 * Removes HTML tags, script tags, and other XSS vectors.
 */
export function sanitizeString(input: string): string {
  return input
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove script content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove event handlers
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    // Remove javascript: URLs
    .replace(/javascript:/gi, '')
    // Remove data: URLs (potential XSS vector)
    .replace(/data:/gi, '')
    // Trim whitespace
    .trim();
}

/**
 * Sanitize HTML content while preserving safe tags.
 * For use in rich text fields where some formatting is allowed.
 */
export function sanitizeHtml(input: string): string {
  // Allow only safe tags
  const allowedTags = ['p', 'br', 'b', 'i', 'u', 'strong', 'em', 'ul', 'ol', 'li'];
  const tagPattern = new RegExp(`<(?!\/?(?:${allowedTags.join('|')})\\b)[^>]*>`, 'gi');
  
  return input
    .replace(tagPattern, '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '')
    .trim();
}

/**
 * Sanitize a slug to ensure it's URL-safe.
 */
export function sanitizeSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}

// ============================================================================
// COMMON ZOD SCHEMAS
// ============================================================================

/**
 * UUID schema with validation.
 */
export const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * Email schema with validation.
 */
export const emailSchema = z.string().email('Invalid email format').max(255);

/**
 * Phone number schema (basic validation).
 */
export const phoneSchema = z.string()
  .regex(/^[\d\s\-+()]+$/, 'Invalid phone number format')
  .min(7, 'Phone number too short')
  .max(20, 'Phone number too long')
  .optional()
  .nullable();

/**
 * Safe string schema that sanitizes input.
 */
export const safeStringSchema = (maxLength: number = 1000) =>
  z.string()
    .max(maxLength, `Text must be ${maxLength} characters or less`)
    .transform(sanitizeString);

/**
 * Safe text schema for longer content (bio, descriptions).
 */
export const safeTextSchema = (maxLength: number = 5000) =>
  z.string()
    .max(maxLength, `Text must be ${maxLength} characters or less`)
    .transform(sanitizeString);

/**
 * Slug schema with validation and sanitization.
 */
export const slugSchema = z.string()
  .min(3, 'Slug must be at least 3 characters')
  .max(100, 'Slug must be 100 characters or less')
  .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens')
  .transform(sanitizeSlug);

/**
 * URL schema with validation.
 */
export const urlSchema = z.string()
  .url('Invalid URL format')
  .max(2048, 'URL too long')
  .refine(
    (url) => url.startsWith('https://') || url.startsWith('http://'),
    'URL must start with http:// or https://'
  );

/**
 * Date string schema (ISO format).
 */
export const dateStringSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

/**
 * DateTime string schema (ISO format).
 */
export const dateTimeSchema = z.string().datetime('Invalid datetime format');

/**
 * Time string schema (HH:MM format).
 */
export const timeStringSchema = z.string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be in HH:MM format');

/**
 * Pagination schema.
 */
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

/**
 * Search query schema.
 */
export const searchQuerySchema = z.string()
  .max(200, 'Search query too long')
  .transform(sanitizeString)
  .optional();

// ============================================================================
// DOMAIN-SPECIFIC SCHEMAS
// ============================================================================

/**
 * User profile update schema.
 */
export const userProfileUpdateSchema = z.object({
  firstName: safeStringSchema(100).optional(),
  lastName: safeStringSchema(100).optional(),
});

/**
 * Doctor profile schema.
 */
export const doctorProfileSchema = z.object({
  specialty: safeStringSchema(200).optional().nullable(),
  clinicName: safeStringSchema(200).optional().nullable(),
  bio: safeTextSchema(2000).optional().nullable(),
  phone: phoneSchema,
  address: safeStringSchema(500).optional().nullable(),
  appointmentDuration: z.number().int().min(5).max(180).optional(),
  bufferTime: z.number().int().min(0).max(60).optional(),
  maxDailyAppointments: z.number().int().min(1).max(100).optional().nullable(),
  consultationFee: z.number().int().min(0).optional().nullable(),
});

// ============================================================================
// PROFESSIONAL PROFILE SCHEMAS
// ============================================================================

/**
 * Professional biography schema with length constraints.
 * Requirements: 2.1, 6.1
 */
export const professionalBioSchema = z.string()
  .min(50, 'Biography must be at least 50 characters')
  .max(1000, 'Biography must not exceed 1000 characters');

/**
 * Years of experience schema with bounds.
 * Requirements: 2.3, 6.2
 */
export const yearsOfExperienceSchema = z.number()
  .int('Years of experience must be a whole number')
  .min(0, 'Years of experience cannot be negative')
  .max(70, 'Years of experience cannot exceed 70');

/**
 * Education entry schema with year validation.
 * Requirements: 2.4, 6.3
 */
export const educationEntrySchema = z.object({
  id: z.string().uuid(),
  institution: z.string().min(1, 'Institution name is required').max(200, 'Institution name too long'),
  degree: z.string().min(1, 'Degree is required').max(100, 'Degree name too long'),
  fieldOfStudy: z.string().max(200, 'Field of study too long').optional(),
  year: z.number()
    .int('Year must be a whole number')
    .min(1950, 'Year must be 1950 or later')
    .max(new Date().getFullYear(), 'Year cannot be in the future'),
  isVerified: z.boolean().optional(),
});

/**
 * Certification entry schema with year validation.
 * Requirements: 2.5, 6.3
 */
export const certificationEntrySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Certification name is required').max(200, 'Certification name too long'),
  issuingOrganization: z.string().min(1, 'Issuing organization is required').max(200, 'Organization name too long'),
  year: z.number()
    .int('Year must be a whole number')
    .min(1950, 'Year must be 1950 or later')
    .max(new Date().getFullYear(), 'Year cannot be in the future'),
  expiryYear: z.number()
    .int('Expiry year must be a whole number')
    .min(new Date().getFullYear(), 'Expiry year must be current year or later')
    .optional(),
  credentialId: z.string().max(100, 'Credential ID too long').optional(),
  isVerified: z.boolean().optional(),
});

/**
 * Consultation fee schema with decimal validation.
 * Requirements: 2.7, 6.4
 */
export const consultationFeeSchema = z.number()
  .positive('Consultation fee must be positive')
  .refine(
    (val) => {
      // Check if the number has at most 2 decimal places
      const decimalPart = val.toString().split('.')[1];
      return !decimalPart || decimalPart.length <= 2;
    },
    'Consultation fee must have at most 2 decimal places'
  );

/**
 * Update professional profile schema combining all schemas.
 * Requirements: 2.1, 2.3, 2.4, 2.5, 2.7, 6.1, 6.2, 6.3, 6.4, 6.5
 */
export const updateProfessionalProfileSchema = z.object({
  professionalBio: professionalBioSchema.optional(),
  yearsOfExperience: yearsOfExperienceSchema.optional(),
  specializations: z.array(z.string().min(1).max(100)).max(10, 'Maximum 10 specializations allowed').optional(),
  education: z.array(educationEntrySchema).max(20, 'Maximum 20 education entries allowed').optional(),
  certifications: z.array(certificationEntrySchema).max(30, 'Maximum 30 certification entries allowed').optional(),
  languages: z.array(z.string().min(1).max(50)).max(20, 'Maximum 20 languages allowed').optional(),
  officeAddress: z.string().max(500, 'Office address too long').optional(),
  officePhone: phoneSchema,
  officeEmail: emailSchema.optional(),
  consultationFee: consultationFeeSchema.optional(),
});

// ============================================================================
// PROFILE COMPLETENESS CALCULATION
// ============================================================================

/**
 * Type definition for doctor professional profile.
 * Matches the database schema for doctor_profiles table.
 */
export interface DoctorProfile {
  professionalBio?: string | null;
  yearsOfExperience?: number | null;
  specializations?: string[] | null;
  education?: Array<{
    id: string;
    institution: string;
    degree: string;
    fieldOfStudy?: string;
    year: number;
    isVerified?: boolean;
  }> | null;
  certifications?: Array<{
    id: string;
    name: string;
    issuingOrganization: string;
    year: number;
    expiryYear?: number;
    credentialId?: string;
    isVerified?: boolean;
  }> | null;
  languages?: string[] | null;
  profilePhotoUrl?: string | null;
  officeAddress?: string | null;
}

/**
 * Calculate profile completeness score based on weighted fields.
 * Returns a score between 0 and 100.
 * 
 * Requirements: 5.1, 5.2, 5.4
 * 
 * @param profile - The doctor professional profile
 * @returns Completeness score (0-100)
 */
export function calculateProfileCompleteness(profile: DoctorProfile): number {
  // Define weights for each field (total = 100)
  const weights = {
    professionalBio: 20,
    specializations: 15,
    yearsOfExperience: 10,
    education: 15,
    certifications: 10,
    languages: 10,
    profilePhoto: 15,
    officeAddress: 5,
  };
  
  let score = 0;
  
  // Professional bio (must be at least 50 characters)
  if (profile.professionalBio && profile.professionalBio.length >= 50) {
    score += weights.professionalBio;
  }
  
  // Specializations (must have at least one)
  if (profile.specializations && profile.specializations.length > 0) {
    score += weights.specializations;
  }
  
  // Years of experience (must be non-null and >= 0)
  if (profile.yearsOfExperience !== null && profile.yearsOfExperience !== undefined && profile.yearsOfExperience >= 0) {
    score += weights.yearsOfExperience;
  }
  
  // Education (must have at least one entry)
  if (profile.education && profile.education.length > 0) {
    score += weights.education;
  }
  
  // Certifications (must have at least one entry)
  if (profile.certifications && profile.certifications.length > 0) {
    score += weights.certifications;
  }
  
  // Languages (must have at least one)
  if (profile.languages && profile.languages.length > 0) {
    score += weights.languages;
  }
  
  // Profile photo (must have URL)
  if (profile.profilePhotoUrl) {
    score += weights.profilePhoto;
  }
  
  // Office address (optional but contributes to completeness)
  if (profile.officeAddress) {
    score += weights.officeAddress;
  }
  
  return score;
}

/**
 * Patient profile schema.
 */
export const patientProfileSchema = z.object({
  dateOfBirth: z.string().datetime().optional().nullable(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional().nullable(),
  phone: phoneSchema,
  emergencyContact: safeStringSchema(200).optional().nullable(),
  emergencyPhone: phoneSchema,
});

/**
 * Appointment creation schema.
 */
export const appointmentCreateSchema = z.object({
  connectionId: uuidSchema,
  scheduledAt: dateTimeSchema,
  intakeSessionId: uuidSchema.optional(),
  notes: safeTextSchema(1000).optional(),
});

/**
 * Message schema.
 */
export const messageSchema = z.object({
  content: safeTextSchema(5000),
});

/**
 * Support ticket schema.
 */
export const supportTicketSchema = z.object({
  subject: safeStringSchema(200),
  description: safeTextSchema(5000),
  category: z.enum(['technical', 'billing', 'account', 'feature_request', 'other']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
});

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate and sanitize an object against a schema.
 * Returns the validated data or throws a ZodError.
 */
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Safely validate input without throwing.
 * Returns a result object with success status and data/error.
 */
export function safeValidateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
