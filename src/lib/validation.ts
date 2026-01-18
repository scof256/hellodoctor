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
