import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, publicProcedure, protectedProcedure, doctorProcedure } from '../trpc';
import { doctors, users, doctorAvailability, doctorBlockedDates } from '@/server/db/schema';
import { 
  generateDoctorQRCode, 
  generateDoctorShareUrl,
  generateQRCodeBuffer,
} from '@/server/services/qr';
import { auditService } from '@/server/services/audit';

// Input validation schemas
const createDoctorProfileSchema = z.object({
  specialty: z.string().min(1).max(200).optional(),
  clinicName: z.string().min(1).max(200).optional(),
  bio: z.string().max(2000).optional(),
  phone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
});

const updateDoctorProfileSchema = z.object({
  specialty: z.string().min(1).max(200).optional(),
  clinicName: z.string().min(1).max(200).optional(),
  bio: z.string().max(2000).optional(),
  phone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  appointmentDuration: z.number().min(15).max(120).optional(),
  bufferTime: z.number().min(0).max(60).optional(),
  maxDailyAppointments: z.number().min(1).max(100).optional(),
  consultationFee: z.number().min(0).optional(),
});

/**
 * Generate a URL-friendly slug from a name
 */
function generateSlug(firstName: string | null, lastName: string | null, uniqueId: string): string {
  const namePart = [firstName, lastName]
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .substring(0, 50);
  
  // Add a short unique suffix to ensure uniqueness
  const suffix = uniqueId.substring(0, 8);
  return namePart ? `${namePart}-${suffix}` : `doctor-${suffix}`;
}

export const doctorRouter = createTRPCRouter({
  /**
   * Get a doctor's public profile by slug.
   * This is a public endpoint for patients to view doctor profiles.
   * Requirements: 2.1, 3.4, 3.5
   */
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const doctor = await ctx.db.query.doctors.findFirst({
        where: eq(doctors.slug, input.slug),
      });

      if (!doctor) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Doctor not found',
        });
      }

      // Get the associated user for display info
      const user = await ctx.db.query.users.findFirst({
        where: eq(users.id, doctor.userId),
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Doctor user not found',
        });
      }

      // Return public profile information
      return {
        id: doctor.id,
        slug: doctor.slug,
        specialty: doctor.specialty,
        clinicName: doctor.clinicName,
        bio: doctor.bio,
        verificationStatus: doctor.verificationStatus,
        appointmentDuration: doctor.appointmentDuration,
        consultationFee: doctor.consultationFee,
        acceptsPayments: doctor.acceptsPayments,
        user: {
          firstName: user.firstName,
          lastName: user.lastName,
          imageUrl: user.imageUrl,
        },
        shareUrl: generateDoctorShareUrl(doctor.slug),
        qrCodeUrl: doctor.qrCodeUrl,
      };
    }),

  /**
   * Get the current authenticated doctor's profile.
   * Requirements: 2.2
   */
  getMyProfile: doctorProcedure.query(async ({ ctx }) => {
    if (!ctx.doctor) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Doctor profile not found. Please create a profile first.',
      });
    }

    return {
      ...ctx.doctor,
      shareUrl: generateDoctorShareUrl(ctx.doctor.slug),
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
   * Update the current doctor's profile.
   * Requirements: 2.2, 2.7
   */
  updateProfile: doctorProcedure
    .input(updateDoctorProfileSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.doctor) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Doctor profile not found. Please create a profile first.',
        });
      }

      const previousValue = {
        specialty: ctx.doctor.specialty,
        clinicName: ctx.doctor.clinicName,
        bio: ctx.doctor.bio,
        phone: ctx.doctor.phone,
        address: ctx.doctor.address,
        appointmentDuration: ctx.doctor.appointmentDuration,
        bufferTime: ctx.doctor.bufferTime,
        maxDailyAppointments: ctx.doctor.maxDailyAppointments,
        consultationFee: ctx.doctor.consultationFee,
      };

      const result = await ctx.db
        .update(doctors)
        .set({
          ...input,
          updatedAt: new Date(),
        })
        .where(eq(doctors.id, ctx.doctor.id))
        .returning();

      const updatedDoctor = result[0];
      if (!updatedDoctor) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update doctor profile',
        });
      }

      // Log the profile update
      await auditService.logDataModification(
        ctx.user.id,
        'doctor_updated',
        'doctor',
        ctx.doctor.id,
        previousValue,
        input
      );

      return {
        ...updatedDoctor,
        shareUrl: generateDoctorShareUrl(updatedDoctor.slug),
      };
    }),

  /**
   * Create initial doctor profile for the current user.
   * This is called during onboarding when a user selects the doctor role.
   * Requirements: 2.1, 2.2
   */
  createProfile: protectedProcedure
    .input(createDoctorProfileSchema)
    .mutation(async ({ ctx, input }) => {
      // Check if user already has a doctor profile
      const existingDoctor = await ctx.db.query.doctors.findFirst({
        where: eq(doctors.userId, ctx.user.id),
      });

      if (existingDoctor) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Doctor profile already exists for this user.',
        });
      }

      // Generate a unique slug
      const slug = generateSlug(ctx.user.firstName, ctx.user.lastName, ctx.user.id);

      // Create the doctor profile
      const result = await ctx.db
        .insert(doctors)
        .values({
          userId: ctx.user.id,
          slug,
          specialty: input.specialty ?? null,
          clinicName: input.clinicName ?? null,
          bio: input.bio ?? null,
          phone: input.phone ?? null,
          address: input.address ?? null,
          verificationStatus: 'pending',
          appointmentDuration: 30,
          bufferTime: 10,
          maxDailyAppointments: 20,
          acceptsPayments: false,
        })
        .returning();

      const newDoctor = result[0];
      if (!newDoctor) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create doctor profile',
        });
      }

      // Update user's primary role to doctor
      await ctx.db
        .update(users)
        .set({
          primaryRole: 'doctor',
          updatedAt: new Date(),
        })
        .where(eq(users.id, ctx.user.id));

      // Log the doctor profile creation
      await auditService.log({
        userId: ctx.user.id,
        action: 'doctor_created',
        resourceType: 'doctor',
        resourceId: newDoctor.id,
        metadata: {
          slug: newDoctor.slug,
          specialty: input.specialty,
          clinicName: input.clinicName,
        },
      });

      return {
        ...newDoctor,
        shareUrl: generateDoctorShareUrl(newDoctor.slug),
      };
    }),

  /**
   * Check if the current user has a doctor profile.
   * Useful for onboarding flow.
   */
  hasProfile: protectedProcedure.query(async ({ ctx }) => {
    const doctor = await ctx.db.query.doctors.findFirst({
      where: eq(doctors.userId, ctx.user.id),
    });

    return { hasProfile: !!doctor };
  }),

  /**
   * Get the share URL for the current doctor.
   * Requirements: 2.6, 3.1
   */
  getShareUrl: doctorProcedure.query(async ({ ctx }) => {
    if (!ctx.doctor) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Doctor profile not found.',
      });
    }

    const shareUrl = generateDoctorShareUrl(ctx.doctor.slug);
    
    return {
      shareUrl,
      slug: ctx.doctor.slug,
    };
  }),

  /**
   * Regenerate QR code for the current doctor.
   * This generates a new QR code and stores it in the database.
   * Requirements: 2.4, 3.7
   */
  regenerateQRCode: doctorProcedure.mutation(async ({ ctx }) => {
    if (!ctx.doctor) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Doctor profile not found.',
      });
    }

    // Generate new QR code
    const { shareUrl, qrCodeDataUrl } = await generateDoctorQRCode(ctx.doctor.slug);

    // Update the doctor profile with the new QR code URL
    const result = await ctx.db
      .update(doctors)
      .set({
        qrCodeUrl: qrCodeDataUrl,
        updatedAt: new Date(),
      })
      .where(eq(doctors.id, ctx.doctor.id))
      .returning();

    const updatedDoctor = result[0];
    if (!updatedDoctor) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update QR code',
      });
    }

    return {
      qrCodeUrl: qrCodeDataUrl,
      shareUrl,
    };
  }),

  /**
   * Get QR code as downloadable image data.
   * Returns base64 encoded PNG data for download.
   * Requirements: 2.5
   */
  getQRCodeDownload: doctorProcedure.query(async ({ ctx }) => {
    if (!ctx.doctor) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Doctor profile not found.',
      });
    }

    const shareUrl = generateDoctorShareUrl(ctx.doctor.slug);
    const buffer = await generateQRCodeBuffer(shareUrl, { width: 500 });
    const base64 = buffer.toString('base64');

    return {
      data: base64,
      mimeType: 'image/png',
      filename: `qr-code-${ctx.doctor.slug}.png`,
    };
  }),

  /**
   * Get QR code data URL for display.
   * If no QR code exists, generates one and stores it.
   * Requirements: 2.4, 3.2
   */
  getQRCode: doctorProcedure.query(async ({ ctx }) => {
    if (!ctx.doctor) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Doctor profile not found.',
      });
    }

    // If QR code already exists, return it
    if (ctx.doctor.qrCodeUrl) {
      return {
        qrCodeUrl: ctx.doctor.qrCodeUrl,
        shareUrl: generateDoctorShareUrl(ctx.doctor.slug),
      };
    }

    // Generate new QR code
    const { shareUrl, qrCodeDataUrl } = await generateDoctorQRCode(ctx.doctor.slug);

    // Store the QR code in the database
    await ctx.db
      .update(doctors)
      .set({
        qrCodeUrl: qrCodeDataUrl,
        updatedAt: new Date(),
      })
      .where(eq(doctors.id, ctx.doctor.id));

    return {
      qrCodeUrl: qrCodeDataUrl,
      shareUrl,
    };
  }),

  /**
   * Set weekly availability schedule.
   * Replaces all existing availability for the specified days.
   * Requirements: 10.1, 10.2
   */
  setAvailability: doctorProcedure
    .input(z.object({
      availability: z.array(z.object({
        dayOfWeek: z.number().min(0).max(6), // 0=Sunday, 6=Saturday
        startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/), // HH:MM format
        endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
        location: z.string().max(200).optional(),
        isActive: z.boolean().default(true),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.doctor) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Doctor profile not found.',
        });
      }

      // Validate that end time is after start time for each entry
      for (const slot of input.availability) {
        if (slot.startTime >= slot.endTime) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Invalid time range for day ${slot.dayOfWeek}: start time must be before end time`,
          });
        }
      }

      // Delete existing availability for this doctor
      await ctx.db
        .delete(doctorAvailability)
        .where(eq(doctorAvailability.doctorId, ctx.doctor.id));

      try {
        // Insert new availability
        if (input.availability.length > 0) {
          await ctx.db.insert(doctorAvailability).values(
            input.availability.map((slot) => ({
              doctorId: ctx.doctor!.id,
              dayOfWeek: slot.dayOfWeek,
              startTime: slot.startTime,
              endTime: slot.endTime,
              location: slot.location ?? null,
              isActive: slot.isActive,
            }))
          );
        }

        // Return updated availability
        const updatedAvailability = await ctx.db.query.doctorAvailability.findMany({
          where: eq(doctorAvailability.doctorId, ctx.doctor.id),
        });

        return { availability: updatedAvailability };
      } catch (err) {
        const e = err as { code?: string; message?: string };
        if (e?.code === '42703' && (e.message ?? '').includes('location')) {
          // DB missing the new column. Retry insert without location.
          if (input.availability.length > 0) {
            await ctx.db.insert(doctorAvailability).values(
              input.availability.map((slot) => ({
                doctorId: ctx.doctor!.id,
                dayOfWeek: slot.dayOfWeek,
                startTime: slot.startTime,
                endTime: slot.endTime,
                isActive: slot.isActive,
              }))
            );
          }

          const updatedAvailabilityNoLocation = await ctx.db.query.doctorAvailability.findMany({
            where: eq(doctorAvailability.doctorId, ctx.doctor.id),
            columns: {
              id: true,
              doctorId: true,
              dayOfWeek: true,
              startTime: true,
              endTime: true,
              isActive: true,
            },
          });

          return {
            availability: updatedAvailabilityNoLocation.map((a) => ({
              ...a,
              location: null,
            })),
          };
        }

        throw err;
      }
    }),

  /**
   * Get the current doctor's availability schedule.
   * Requirements: 10.1
   */
  getAvailability: doctorProcedure.query(async ({ ctx }) => {
    if (!ctx.doctor) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Doctor profile not found.',
      });
    }

    try {
      const availability = await ctx.db.query.doctorAvailability.findMany({
        where: eq(doctorAvailability.doctorId, ctx.doctor.id),
      });

      return { availability };
    } catch (err) {
      const e = err as { code?: string; message?: string };
      if (e?.code === '42P01' && (e.message ?? '').toLowerCase().includes('doctor_availability')) {
        return { availability: [] };
      }
      if (e?.code === '42703' && (e.message ?? '').includes('location')) {
        const availabilityNoLocation = await ctx.db.query.doctorAvailability.findMany({
          where: eq(doctorAvailability.doctorId, ctx.doctor.id),
          columns: {
            id: true,
            doctorId: true,
            dayOfWeek: true,
            startTime: true,
            endTime: true,
            isActive: true,
          },
        });
        return {
          availability: availabilityNoLocation.map((a) => ({
            ...a,
            location: null,
          })),
        };
      }
      throw err;
    }
  }),

  /**
   * Get availability for a specific doctor (public endpoint for patients).
   * Requirements: 10.1
   */
  getAvailabilityByDoctorId: publicProcedure
    .input(z.object({ doctorId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        const availability = await ctx.db.query.doctorAvailability.findMany({
          where: and(
            eq(doctorAvailability.doctorId, input.doctorId),
            eq(doctorAvailability.isActive, true)
          ),
        });

        return { availability };
      } catch (err) {
        const e = err as { code?: string; message?: string };
        if (e?.code === '42P01' && (e.message ?? '').toLowerCase().includes('doctor_availability')) {
          return { availability: [] };
        }
        if (e?.code === '42703' && (e.message ?? '').includes('location')) {
          const availabilityNoLocation = await ctx.db.query.doctorAvailability.findMany({
            where: and(
              eq(doctorAvailability.doctorId, input.doctorId),
              eq(doctorAvailability.isActive, true)
            ),
            columns: {
              id: true,
              doctorId: true,
              dayOfWeek: true,
              startTime: true,
              endTime: true,
              isActive: true,
            },
          });

          return {
            availability: availabilityNoLocation.map((a) => ({
              ...a,
              location: null,
            })),
          };
        }
        throw err;
      }
    }),

  /**
   * Block a specific date (holiday, time off).
   * Requirements: 10.2, 10.3
   */
  blockDate: doctorProcedure
    .input(z.object({
      date: z.string().datetime(), // ISO datetime string
      reason: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.doctor) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Doctor profile not found.',
        });
      }

      const blockDate = new Date(input.date);
      
      // Check if date is in the past
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (blockDate < today) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot block dates in the past',
        });
      }

      // Check if date is already blocked
      const existingBlock = await ctx.db.query.doctorBlockedDates.findFirst({
        where: and(
          eq(doctorBlockedDates.doctorId, ctx.doctor.id),
          eq(doctorBlockedDates.date, blockDate)
        ),
      });

      if (existingBlock) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'This date is already blocked',
        });
      }

      const result = await ctx.db
        .insert(doctorBlockedDates)
        .values({
          doctorId: ctx.doctor.id,
          date: blockDate,
          reason: input.reason ?? null,
        })
        .returning();

      return { blockedDate: result[0] };
    }),

  /**
   * Unblock a specific date.
   * Requirements: 10.2
   */
  unblockDate: doctorProcedure
    .input(z.object({
      blockedDateId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.doctor) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Doctor profile not found.',
        });
      }

      // Verify the blocked date belongs to this doctor
      const blockedDate = await ctx.db.query.doctorBlockedDates.findFirst({
        where: and(
          eq(doctorBlockedDates.id, input.blockedDateId),
          eq(doctorBlockedDates.doctorId, ctx.doctor.id)
        ),
      });

      if (!blockedDate) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Blocked date not found',
        });
      }

      await ctx.db
        .delete(doctorBlockedDates)
        .where(eq(doctorBlockedDates.id, input.blockedDateId));

      return { success: true };
    }),

  /**
   * Get all blocked dates for the current doctor.
   * Requirements: 10.2
   */
  getBlockedDates: doctorProcedure.query(async ({ ctx }) => {
    if (!ctx.doctor) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Doctor profile not found.',
      });
    }

    const blockedDates = await ctx.db.query.doctorBlockedDates.findMany({
      where: eq(doctorBlockedDates.doctorId, ctx.doctor.id),
    });

    return { blockedDates };
  }),

  /**
   * Get blocked dates for a specific doctor (public endpoint for patients).
   * Requirements: 10.2
   */
  getBlockedDatesByDoctorId: publicProcedure
    .input(z.object({ doctorId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const blockedDates = await ctx.db.query.doctorBlockedDates.findMany({
        where: eq(doctorBlockedDates.doctorId, input.doctorId),
      });

      return { blockedDates };
    }),
});
