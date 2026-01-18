import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { users, notifications, patients, doctors } from '@/server/db/schema';
import { auditService } from '@/server/services/audit';

export const userRouter = createTRPCRouter({
  /**
   * Get the current authenticated user's profile with role-specific data.
   * Requirements: 1.3
   */
  me: protectedProcedure.query(async ({ ctx }) => {
    // Get patient profile if exists
    const patient = await ctx.db.query.patients.findFirst({
      where: eq(patients.userId, ctx.user.id),
    });

    // Get doctor profile if exists
    const doctor = await ctx.db.query.doctors.findFirst({
      where: eq(doctors.userId, ctx.user.id),
    });

    return {
      ...ctx.user,
      patient: patient ?? null,
      doctor: doctor ?? null,
    };
  }),

  /**
   * Get the current authenticated user's profile.
   * Requirements: 1.3
   */
  getMe: protectedProcedure.query(async ({ ctx }) => {
    return ctx.user;
  }),

  /**
   * Update the current user's profile.
   * Requirements: 1.3
   */
  updateProfile: protectedProcedure
    .input(
      z.object({
        firstName: z.string().min(1).max(100).optional(),
        lastName: z.string().min(1).max(100).optional(),
        imageUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const previousValue = {
        firstName: ctx.user.firstName,
        lastName: ctx.user.lastName,
        imageUrl: ctx.user.imageUrl,
      };

      const [updatedUser] = await ctx.db
        .update(users)
        .set({
          ...input,
          updatedAt: new Date(),
        })
        .where(eq(users.id, ctx.user.id))
        .returning();

      // Log the profile update
      await auditService.logDataModification(
        ctx.user.id,
        'user_updated',
        'user',
        ctx.user.id,
        previousValue,
        input
      );

      return updatedUser;
    }),

  /**
   * Get notifications for the current user.
   * Requirements: 12.1, 12.7
   */
  getNotifications: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().uuid().optional(),
        unreadOnly: z.boolean().default(false),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const { limit = 20, unreadOnly = false } = input ?? {};

      const userNotifications = await ctx.db.query.notifications.findMany({
        where: unreadOnly
          ? (notifications, { and, eq: eqOp }) =>
              and(
                eqOp(notifications.userId, ctx.user.id),
                eqOp(notifications.isRead, false)
              )
          : eq(notifications.userId, ctx.user.id),
        orderBy: (notifications, { desc }) => [desc(notifications.createdAt)],
        limit: limit + 1,
      });

      let nextCursor: string | undefined = undefined;
      if (userNotifications.length > limit) {
        const nextItem = userNotifications.pop();
        nextCursor = nextItem?.id;
      }

      return {
        notifications: userNotifications,
        nextCursor,
      };
    }),

  /**
   * Get unread notification count for the current user.
   * Requirements: 12.2
   */
  getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    const unreadNotifications = await ctx.db.query.notifications.findMany({
      where: (notifications, { and, eq: eqOp }) =>
        and(
          eqOp(notifications.userId, ctx.user.id),
          eqOp(notifications.isRead, false)
        ),
    });

    return { count: unreadNotifications.length };
  }),

  /**
   * Mark a notification as read.
   * Requirements: 12.7
   */
  markNotificationAsRead: protectedProcedure
    .input(z.object({ notificationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(notifications)
        .set({
          isRead: true,
          readAt: new Date(),
        })
        .where(eq(notifications.id, input.notificationId))
        .returning();

      return updated;
    }),

  /**
   * Mark all notifications as read for the current user.
   * Requirements: 12.7
   */
  markAllNotificationsAsRead: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(eq(notifications.userId, ctx.user.id));

    return { success: true };
  }),
});
