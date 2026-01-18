import { z } from 'zod';
import { eq, and, desc, sql, or, ilike, count, isNull } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure, adminProcedure } from '../trpc';
import { supportTickets, ticketResponses, users, auditLogs, notifications } from '@/server/db/schema';

// Input validation schemas
const createTicketSchema = z.object({
  subject: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  category: z.enum(['technical', 'billing', 'account', 'feature_request', 'bug_report', 'other']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
});

const respondToTicketSchema = z.object({
  ticketId: z.string().uuid(),
  content: z.string().min(1).max(5000),
  isInternal: z.boolean().default(false),
});

const updateTicketStatusSchema = z.object({
  ticketId: z.string().uuid(),
  status: z.enum(['open', 'in_progress', 'waiting_on_user', 'resolved', 'closed']),
});

const assignTicketSchema = z.object({
  ticketId: z.string().uuid(),
  assignedTo: z.string().uuid().nullable(),
});

/**
 * Support Ticket Router
 * 
 * Handles support ticket creation, management, and responses.
 * 
 * Requirements: 27.1, 27.2, 27.3, 27.4, 27.5, 27.6, 27.7, 27.8
 */
export const supportRouter = createTRPCRouter({
  /**
   * Create a new support ticket.
   * 
   * Requirements: 27.1, 27.2
   */
  create: protectedProcedure
    .input(createTicketSchema)
    .mutation(async ({ ctx, input }) => {
      const { subject, description, category, priority } = input;

      // Create the ticket
      const [ticket] = await ctx.db
        .insert(supportTickets)
        .values({
          userId: ctx.user.id,
          subject,
          description,
          category,
          priority,
          status: 'open',
        })
        .returning();

      // Log the action
      await ctx.db.insert(auditLogs).values({
        userId: ctx.user.id,
        action: 'ticket_created',
        resourceType: 'support_ticket',
        resourceId: ticket?.id,
        metadata: {
          subject,
          category,
          priority,
        },
      });

      return ticket;
    }),

  /**
   * Get the current user's support tickets.
   * 
   * Requirements: 27.7, 27.8
   */
  getMyTickets: protectedProcedure
    .input(z.object({
      status: z.enum(['open', 'in_progress', 'waiting_on_user', 'resolved', 'closed']).optional(),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ ctx, input }) => {
      const { status, limit = 20, offset = 0 } = input ?? {};

      const conditions = [eq(supportTickets.userId, ctx.user.id)];
      
      if (status) {
        conditions.push(eq(supportTickets.status, status));
      }

      const tickets = await ctx.db.query.supportTickets.findMany({
        where: and(...conditions),
        orderBy: [desc(supportTickets.createdAt)],
        limit,
        offset,
      });

      const [totalResult] = await ctx.db
        .select({ count: count() })
        .from(supportTickets)
        .where(and(...conditions));

      return {
        tickets,
        total: totalResult?.count ?? 0,
        limit,
        offset,
      };
    }),

  /**
   * Get a specific ticket by ID with its responses.
   * Users can only view their own tickets, admins can view all.
   * 
   * Requirements: 27.7
   */
  getTicketById: protectedProcedure
    .input(z.object({ ticketId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const ticket = await ctx.db.query.supportTickets.findFirst({
        where: eq(supportTickets.id, input.ticketId),
      });

      if (!ticket) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Ticket not found',
        });
      }

      // Check access: user can only view their own tickets unless they're an admin
      const isAdmin = ctx.user.primaryRole === 'super_admin';
      if (!isAdmin && ticket.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have access to this ticket',
        });
      }

      // Get responses (filter internal notes for non-admins)
      const responseConditions = [eq(ticketResponses.ticketId, input.ticketId)];
      if (!isAdmin) {
        responseConditions.push(eq(ticketResponses.isInternal, false));
      }

      const responses = await ctx.db.query.ticketResponses.findMany({
        where: and(...responseConditions),
        orderBy: [desc(ticketResponses.createdAt)],
      });

      // Get user info for each response
      const responsesWithUsers = await Promise.all(
        responses.map(async (response) => {
          const user = await ctx.db.query.users.findFirst({
            where: eq(users.id, response.userId),
          });
          return {
            ...response,
            user: user ? {
              id: user.id,
              firstName: user.firstName,
              lastName: user.lastName,
              imageUrl: user.imageUrl,
              primaryRole: user.primaryRole,
            } : null,
          };
        })
      );

      // Get ticket creator info
      const ticketUser = await ctx.db.query.users.findFirst({
        where: eq(users.id, ticket.userId),
      });

      // Get assigned admin info if assigned
      let assignedUser = null;
      if (ticket.assignedTo) {
        assignedUser = await ctx.db.query.users.findFirst({
          where: eq(users.id, ticket.assignedTo),
        });
      }

      return {
        ...ticket,
        user: ticketUser ? {
          id: ticketUser.id,
          firstName: ticketUser.firstName,
          lastName: ticketUser.lastName,
          email: ticketUser.email,
          imageUrl: ticketUser.imageUrl,
        } : null,
        assignedUser: assignedUser ? {
          id: assignedUser.id,
          firstName: assignedUser.firstName,
          lastName: assignedUser.lastName,
          imageUrl: assignedUser.imageUrl,
        } : null,
        responses: responsesWithUsers,
      };
    }),

  /**
   * Add a response to a ticket.
   * Users can respond to their own tickets, admins can respond to any ticket.
   * 
   * Requirements: 27.5, 27.7
   */
  respond: protectedProcedure
    .input(respondToTicketSchema)
    .mutation(async ({ ctx, input }) => {
      const { ticketId, content, isInternal } = input;

      const ticket = await ctx.db.query.supportTickets.findFirst({
        where: eq(supportTickets.id, ticketId),
      });

      if (!ticket) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Ticket not found',
        });
      }

      // Check access
      const isAdmin = ctx.user.primaryRole === 'super_admin';
      if (!isAdmin && ticket.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have access to this ticket',
        });
      }

      // Only admins can create internal notes
      if (isInternal && !isAdmin) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only admins can create internal notes',
        });
      }

      // Create the response
      const [response] = await ctx.db
        .insert(ticketResponses)
        .values({
          ticketId,
          userId: ctx.user.id,
          content,
          isInternal,
        })
        .returning();

      // Update ticket status and timestamp
      const newStatus = isAdmin ? 'waiting_on_user' : 'open';
      await ctx.db
        .update(supportTickets)
        .set({
          status: ticket.status === 'resolved' || ticket.status === 'closed' 
            ? ticket.status 
            : newStatus,
          updatedAt: new Date(),
        })
        .where(eq(supportTickets.id, ticketId));

      // Notify the other party (if not internal)
      if (!isInternal) {
        const notifyUserId = isAdmin ? ticket.userId : ticket.assignedTo;
        if (notifyUserId) {
          await ctx.db.insert(notifications).values({
            userId: notifyUserId,
            type: 'ticket_response',
            title: 'New Response on Support Ticket',
            message: `A new response has been added to ticket: ${ticket.subject}`,
            data: { ticketId, responseId: response?.id },
          });
        }
      }

      // Log the action
      await ctx.db.insert(auditLogs).values({
        userId: ctx.user.id,
        action: 'ticket_response_added',
        resourceType: 'support_ticket',
        resourceId: ticketId,
        metadata: {
          responseId: response?.id,
          isInternal,
        },
      });

      return response;
    }),

  // ============================================================================
  // ADMIN PROCEDURES
  // ============================================================================

  /**
   * Get all support tickets (admin only).
   * 
   * Requirements: 27.3
   */
  getAllTickets: adminProcedure
    .input(z.object({
      status: z.enum(['open', 'in_progress', 'waiting_on_user', 'resolved', 'closed']).optional(),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
      category: z.enum(['technical', 'billing', 'account', 'feature_request', 'bug_report', 'other']).optional(),
      assignedTo: z.string().uuid().optional(),
      unassigned: z.boolean().optional(),
      search: z.string().optional(),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ ctx, input }) => {
      const { 
        status, 
        priority, 
        category, 
        assignedTo, 
        unassigned,
        search, 
        limit = 20, 
        offset = 0 
      } = input ?? {};

      const conditions = [];
      
      if (status) {
        conditions.push(eq(supportTickets.status, status));
      }
      
      if (priority) {
        conditions.push(eq(supportTickets.priority, priority));
      }
      
      if (category) {
        conditions.push(eq(supportTickets.category, category));
      }
      
      if (assignedTo) {
        conditions.push(eq(supportTickets.assignedTo, assignedTo));
      }
      
      if (unassigned) {
        conditions.push(isNull(supportTickets.assignedTo));
      }
      
      if (search) {
        conditions.push(
          or(
            ilike(supportTickets.subject, `%${search}%`),
            ilike(supportTickets.description, `%${search}%`)
          )
        );
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const tickets = await ctx.db.query.supportTickets.findMany({
        where: whereClause,
        orderBy: [
          // Priority order: urgent > high > medium > low
          sql`CASE ${supportTickets.priority} 
            WHEN 'urgent' THEN 1 
            WHEN 'high' THEN 2 
            WHEN 'medium' THEN 3 
            WHEN 'low' THEN 4 
          END`,
          desc(supportTickets.createdAt),
        ],
        limit,
        offset,
      });

      // Get user info for each ticket
      const ticketsWithUsers = await Promise.all(
        tickets.map(async (ticket) => {
          const user = await ctx.db.query.users.findFirst({
            where: eq(users.id, ticket.userId),
          });
          
          let assignedUser = null;
          if (ticket.assignedTo) {
            assignedUser = await ctx.db.query.users.findFirst({
              where: eq(users.id, ticket.assignedTo),
            });
          }

          // Get response count
          const [responseCount] = await ctx.db
            .select({ count: count() })
            .from(ticketResponses)
            .where(eq(ticketResponses.ticketId, ticket.id));

          return {
            ...ticket,
            user: user ? {
              id: user.id,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              imageUrl: user.imageUrl,
            } : null,
            assignedUser: assignedUser ? {
              id: assignedUser.id,
              firstName: assignedUser.firstName,
              lastName: assignedUser.lastName,
              imageUrl: assignedUser.imageUrl,
            } : null,
            responseCount: responseCount?.count ?? 0,
          };
        })
      );

      const [totalResult] = await ctx.db
        .select({ count: count() })
        .from(supportTickets)
        .where(whereClause);

      return {
        tickets: ticketsWithUsers,
        total: totalResult?.count ?? 0,
        limit,
        offset,
      };
    }),

  /**
   * Assign a ticket to an admin.
   * 
   * Requirements: 27.4
   */
  assignTicket: adminProcedure
    .input(assignTicketSchema)
    .mutation(async ({ ctx, input }) => {
      const { ticketId, assignedTo } = input;

      const ticket = await ctx.db.query.supportTickets.findFirst({
        where: eq(supportTickets.id, ticketId),
      });

      if (!ticket) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Ticket not found',
        });
      }

      // If assigning to someone, verify they're an admin
      if (assignedTo) {
        const assignee = await ctx.db.query.users.findFirst({
          where: eq(users.id, assignedTo),
        });

        if (!assignee || assignee.primaryRole !== 'super_admin') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Tickets can only be assigned to admins',
          });
        }
      }

      const previousAssignee = ticket.assignedTo;

      // Update the ticket
      const [updatedTicket] = await ctx.db
        .update(supportTickets)
        .set({
          assignedTo,
          status: assignedTo ? 'in_progress' : ticket.status,
          updatedAt: new Date(),
        })
        .where(eq(supportTickets.id, ticketId))
        .returning();

      // Notify the new assignee
      if (assignedTo && assignedTo !== ctx.user.id) {
        await ctx.db.insert(notifications).values({
          userId: assignedTo,
          type: 'ticket_assigned',
          title: 'Support Ticket Assigned',
          message: `You have been assigned to ticket: ${ticket.subject}`,
          data: { ticketId },
        });
      }

      // Log the action
      await ctx.db.insert(auditLogs).values({
        userId: ctx.user.id,
        action: 'ticket_assigned',
        resourceType: 'support_ticket',
        resourceId: ticketId,
        metadata: {
          previousAssignee,
          newAssignee: assignedTo,
        },
      });

      return updatedTicket;
    }),

  /**
   * Update ticket status.
   * 
   * Requirements: 27.5, 27.6
   */
  updateStatus: adminProcedure
    .input(updateTicketStatusSchema)
    .mutation(async ({ ctx, input }) => {
      const { ticketId, status } = input;

      const ticket = await ctx.db.query.supportTickets.findFirst({
        where: eq(supportTickets.id, ticketId),
      });

      if (!ticket) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Ticket not found',
        });
      }

      const previousStatus = ticket.status;

      // Update the ticket
      const [updatedTicket] = await ctx.db
        .update(supportTickets)
        .set({
          status,
          resolvedAt: status === 'resolved' || status === 'closed' ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(supportTickets.id, ticketId))
        .returning();

      // Notify the ticket creator of status change
      await ctx.db.insert(notifications).values({
        userId: ticket.userId,
        type: 'ticket_status_changed',
        title: 'Support Ticket Status Updated',
        message: `Your ticket "${ticket.subject}" status has been changed to: ${status.replace('_', ' ')}`,
        data: { ticketId, previousStatus, newStatus: status },
      });

      // Log the action
      await ctx.db.insert(auditLogs).values({
        userId: ctx.user.id,
        action: 'ticket_status_updated',
        resourceType: 'support_ticket',
        resourceId: ticketId,
        metadata: {
          previousStatus,
          newStatus: status,
        },
      });

      return updatedTicket;
    }),

  /**
   * Get ticket statistics for admin dashboard.
   * 
   * Requirements: 27.6
   */
  getStats: adminProcedure.query(async ({ ctx }) => {
    // Get counts by status
    const [openCount] = await ctx.db
      .select({ count: count() })
      .from(supportTickets)
      .where(eq(supportTickets.status, 'open'));

    const [inProgressCount] = await ctx.db
      .select({ count: count() })
      .from(supportTickets)
      .where(eq(supportTickets.status, 'in_progress'));

    const [waitingCount] = await ctx.db
      .select({ count: count() })
      .from(supportTickets)
      .where(eq(supportTickets.status, 'waiting_on_user'));

    const [resolvedCount] = await ctx.db
      .select({ count: count() })
      .from(supportTickets)
      .where(eq(supportTickets.status, 'resolved'));

    const [closedCount] = await ctx.db
      .select({ count: count() })
      .from(supportTickets)
      .where(eq(supportTickets.status, 'closed'));

    // Get unassigned count
    const [unassignedCount] = await ctx.db
      .select({ count: count() })
      .from(supportTickets)
      .where(and(
        isNull(supportTickets.assignedTo),
        or(
          eq(supportTickets.status, 'open'),
          eq(supportTickets.status, 'in_progress')
        )
      ));

    // Get urgent/high priority count
    const [urgentCount] = await ctx.db
      .select({ count: count() })
      .from(supportTickets)
      .where(and(
        or(
          eq(supportTickets.priority, 'urgent'),
          eq(supportTickets.priority, 'high')
        ),
        or(
          eq(supportTickets.status, 'open'),
          eq(supportTickets.status, 'in_progress')
        )
      ));

    // Calculate average resolution time (for resolved tickets in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const resolvedTickets = await ctx.db.query.supportTickets.findMany({
      where: and(
        eq(supportTickets.status, 'resolved'),
        sql`${supportTickets.resolvedAt} >= ${thirtyDaysAgo}`
      ),
    });

    let avgResolutionTimeHours = 0;
    if (resolvedTickets.length > 0) {
      const totalHours = resolvedTickets.reduce((sum, ticket) => {
        if (ticket.resolvedAt) {
          const hours = (ticket.resolvedAt.getTime() - ticket.createdAt.getTime()) / (1000 * 60 * 60);
          return sum + hours;
        }
        return sum;
      }, 0);
      avgResolutionTimeHours = Math.round(totalHours / resolvedTickets.length);
    }

    return {
      open: openCount?.count ?? 0,
      inProgress: inProgressCount?.count ?? 0,
      waitingOnUser: waitingCount?.count ?? 0,
      resolved: resolvedCount?.count ?? 0,
      closed: closedCount?.count ?? 0,
      unassigned: unassignedCount?.count ?? 0,
      urgentOrHigh: urgentCount?.count ?? 0,
      avgResolutionTimeHours,
    };
  }),
});
