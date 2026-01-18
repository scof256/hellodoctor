import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure, patientProcedure } from '../trpc';
import { patients, users } from '@/server/db/schema';

// Input validation schemas
const createPatientProfileSchema = z.object({
  dateOfBirth: z.string().datetime().optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  phone: z.string().max(50).optional(),
  emergencyContact: z.string().max(200).optional(),
  emergencyPhone: z.string().max(50).optional(),
});

const updatePatientProfileSchema = z.object({
  dateOfBirth: z.string().datetime().optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  phone: z.string().max(50).optional(),
  emergencyContact: z.string().max(200).optional(),
  emergencyPhone: z.string().max(50).optional(),
});

export const patientRouter = createTRPCRouter({
  /**
   * Get the current authenticated patient's profile.
   * Requirements: 5.1
   */
  getMyProfile: patientProcedure.query(async ({ ctx }) => {
    if (!ctx.patient) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Patient profile not found. Please create a profile first.',
      });
    }

    return {
      ...ctx.patient,
      user: {
        id: ctx.user.id,
        email: ctx.user.email,
        firstName: ctx.user.firstName,
        lastName: ctx.user.lastName,
        imageUrl: ctx.user.imageUrl,
      },
    };
  }),

  /**
   * Update the current patient's profile.
   * Requirements: 5.1
   */
  updateProfile: patientProcedure
    .input(updatePatientProfileSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.patient) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Patient profile not found. Please create a profile first.',
        });
      }

      const result = await ctx.db
        .update(patients)
        .set({
          dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
          gender: input.gender,
          phone: input.phone,
          emergencyContact: input.emergencyContact,
          emergencyPhone: input.emergencyPhone,
          updatedAt: new Date(),
        })
        .where(eq(patients.id, ctx.patient.id))
        .returning();

      const updatedPatient = result[0];
      if (!updatedPatient) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update patient profile',
        });
      }

      return updatedPatient;
    }),

  /**
   * Create initial patient profile for the current user.
   * This is called during onboarding when a user selects the patient role.
   * Requirements: 5.1
   */
  createProfile: protectedProcedure
    .input(createPatientProfileSchema)
    .mutation(async ({ ctx, input }) => {
      // Check if user already has a patient profile
      const existingPatient = await ctx.db.query.patients.findFirst({
        where: eq(patients.userId, ctx.user.id),
      });

      if (existingPatient) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Patient profile already exists for this user.',
        });
      }

      // Create the patient profile
      const result = await ctx.db
        .insert(patients)
        .values({
          userId: ctx.user.id,
          dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
          gender: input.gender ?? null,
          phone: input.phone ?? null,
          emergencyContact: input.emergencyContact ?? null,
          emergencyPhone: input.emergencyPhone ?? null,
        })
        .returning();

      const newPatient = result[0];
      if (!newPatient) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create patient profile',
        });
      }

      // Update user's primary role to patient (if not already set)
      if (ctx.user.primaryRole !== 'patient') {
        await ctx.db
          .update(users)
          .set({
            primaryRole: 'patient',
            updatedAt: new Date(),
          })
          .where(eq(users.id, ctx.user.id));
      }

      return newPatient;
    }),

  /**
   * Check if the current user has a patient profile.
   * Useful for onboarding flow.
   */
  hasProfile: protectedProcedure.query(async ({ ctx }) => {
    const patient = await ctx.db.query.patients.findFirst({
      where: eq(patients.userId, ctx.user.id),
    });

    return { hasProfile: !!patient };
  }),
});
