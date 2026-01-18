import { z } from 'zod';
import { eq, and, desc, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { notifications } from '@/server/db/schema';
import { enforcePaginationLimit, checkResponseSize } from '@/server/lib/query-optimizer';
import { MAX_PAGINATION_LIMIT } from '@/types/api-responses';

/**
 * Notification Router
 * 
 * Handles notification management for users.
 * 
 * Requirements: 12.7, 12.8, 6.4, 6.5
 */
export const notificationRouter = createTRPCRouter({
  /**
   * Get notifications for the current user.
   * Supports pagination and filtering by read status.
   * 
   * Requirements: 12.7, 6.4
   */
  getMyNotifications: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      cursor: z.string().uuid().optional(),
      unreadOnly: z.boolean().default(false),
    }).optional())
    .query(async ({ ctx, input }) => {
      // Enforce pagination limit (Requirement 6.4)
      const limit = enforcePaginationLimit(input?.limit ?? 20, MAX_PAGINATION_LIMIT);
      const unreadOnly = input?.unreadOnly ?? false;

      // Build where conditions
      const conditions = [eq(notifications.userId, ctx.user.id)];
      
      if (unreadOnly) {
        conditions.push(eq(notifications.isRead, false));
      }

      // Add cursor condition for pagination
      if (input?.cursor) {
        conditions.push(
          sql`${notifications.createdAt} < (SELECT created_at FROM notifications WHERE id = ${input.cursor})`
        );
      }

      const userNotifications = await ctx.db
        .select()
        .from(notifications)
        .where(and(...conditions))
        .orderBy(desc(notifications.createdAt))
        .limit(limit + 1);

      // Check if there are more results
      let nextCursor: string | undefined;
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
   * Mark a notification as read.
   * 
   * Requirements: 12.7
   */
  markAsRead: protectedProcedure
    .input(z.object({
      notificationId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify the notification belongs to the user
      const notification = await ctx.db.query.notifications.findFirst({
        where: and(
          eq(notifications.id, input.notificationId),
          eq(notifications.userId, ctx.user.id)
        ),
      });

      if (!notification) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Notification not found',
        });
      }

      if (notification.isRead) {
        return notification;
      }

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
   * 
   * Requirements: 12.7
   */
  markAllAsRead: protectedProcedure
    .mutation(async ({ ctx }) => {
      const result = await ctx.db
        .update(notifications)
        .set({
          isRead: true,
          readAt: new Date(),
        })
        .where(
          and(
            eq(notifications.userId, ctx.user.id),
            eq(notifications.isRead, false)
          )
        )
        .returning({ id: notifications.id });

      return {
        markedCount: result.length,
      };
    }),

  /**
   * Get unread notification count for the current user.
   * 
   * Requirements: 12.2, 12.8
   */
  getUnreadCount: protectedProcedure
    .query(async ({ ctx }) => {
      const [result] = await ctx.db
        .select({
          count: sql<number>`count(*)::int`,
        })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, ctx.user.id),
            eq(notifications.isRead, false)
          )
        );

      return {
        count: result?.count ?? 0,
      };
    }),

  /**
   * Delete a notification.
   */
  delete: protectedProcedure
    .input(z.object({
      notificationId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify the notification belongs to the user
      const notification = await ctx.db.query.notifications.findFirst({
        where: and(
          eq(notifications.id, input.notificationId),
          eq(notifications.userId, ctx.user.id)
        ),
      });

      if (!notification) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Notification not found',
        });
      }

      await ctx.db
        .delete(notifications)
        .where(eq(notifications.id, input.notificationId));

      return { success: true };
    }),

  /**
   * Delete all read notifications for the current user.
   */
  deleteAllRead: protectedProcedure
    .mutation(async ({ ctx }) => {
      const result = await ctx.db
        .delete(notifications)
        .where(
          and(
            eq(notifications.userId, ctx.user.id),
            eq(notifications.isRead, true)
          )
        )
        .returning({ id: notifications.id });

      return {
        deletedCount: result.length,
      };
    }),
});
