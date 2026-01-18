import { z } from 'zod';
import { eq, and, isNull, or, gte, lt } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, doctorProcedure, protectedProcedure, publicProcedure } from '../trpc';
import { userRoles, users, doctors, teamInvitations } from '@/server/db/schema';
import { auditService } from '@/server/services/audit';
import { notificationService } from '@/server/services/notification';
import { randomBytes } from 'crypto';

/**
 * Team management router for clinic admin and receptionist roles.
 * Requirements: 23.1-23.7, 24.1-24.8, 26.1-26.6
 */
export const teamRouter = createTRPCRouter({
  /**
   * Get team members for the current doctor.
   * Requirements: 26.1, 26.4
   */
  getTeamMembers: doctorProcedure.query(async ({ ctx }) => {
    if (!ctx.doctor) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Doctor profile not found',
      });
    }

    // Get all active role assignments for this doctor
    const roleAssignments = await ctx.db.query.userRoles.findMany({
      where: and(
        eq(userRoles.doctorId, ctx.doctor.id),
        or(
          isNull(userRoles.effectiveUntil),
          gte(userRoles.effectiveUntil, new Date())
        )
      ),
    });

    // Get user details for each team member
    const teamMembers = await Promise.all(
      roleAssignments.map(async (assignment) => {
        const user = await ctx.db.query.users.findFirst({
          where: eq(users.id, assignment.userId),
        });

        return {
          id: assignment.id,
          userId: assignment.userId,
          role: assignment.role,
          effectiveFrom: assignment.effectiveFrom,
          effectiveUntil: assignment.effectiveUntil,
          user: user ? {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            imageUrl: user.imageUrl,
            isActive: user.isActive,
          } : null,
        };
      })
    );

    return teamMembers.filter(m => m.user !== null);
  }),

  /**
   * Invite a new team member via email.
   * Requirements: 26.2, 26.3
   */
  inviteTeamMember: doctorProcedure
    .input(z.object({
      email: z.string().email(),
      role: z.enum(['clinic_admin', 'receptionist']),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.doctor) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Doctor profile not found',
        });
      }

      // Check if there's already a pending invitation for this email
      const existingInvitation = await ctx.db.query.teamInvitations.findFirst({
        where: and(
          eq(teamInvitations.doctorId, ctx.doctor.id),
          eq(teamInvitations.email, input.email),
          isNull(teamInvitations.acceptedAt),
          gte(teamInvitations.expiresAt, new Date())
        ),
      });

      if (existingInvitation) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'An invitation has already been sent to this email',
        });
      }

      // Check if user already exists and has this role
      const existingUser = await ctx.db.query.users.findFirst({
        where: eq(users.email, input.email),
      });

      if (existingUser) {
        // Check if user already has this role for this doctor
        const existingRole = await ctx.db.query.userRoles.findFirst({
          where: and(
            eq(userRoles.userId, existingUser.id),
            eq(userRoles.doctorId, ctx.doctor.id),
            eq(userRoles.role, input.role),
            or(
              isNull(userRoles.effectiveUntil),
              gte(userRoles.effectiveUntil, new Date())
            )
          ),
        });

        if (existingRole) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'User already has this role for your practice',
          });
        }
      }

      // Generate a secure invitation token
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

      // Create the invitation
      const result = await ctx.db
        .insert(teamInvitations)
        .values({
          doctorId: ctx.doctor.id,
          email: input.email,
          role: input.role,
          token,
          invitedBy: ctx.user.id,
          expiresAt,
        })
        .returning();

      const invitation = result[0];

      // If user exists, send them a notification
      if (existingUser) {
        await notificationService.createNotification({
          userId: existingUser.id,
          type: 'connection',
          title: 'Team Invitation',
          message: `You have been invited to join Dr. ${ctx.user.firstName || ''} ${ctx.user.lastName || ''}'s practice as a ${input.role.replace('_', ' ')}.`,
          data: {
            connectionId: '',
            action: 'new',
            invitationToken: token,
            doctorId: ctx.doctor.id,
            role: input.role,
          } as any,
        });
      }

      // Log the action
      await auditService.log({
        userId: ctx.user.id,
        action: 'team_member_invited',
        resourceType: 'team_member',
        resourceId: invitation?.id,
        metadata: {
          invitedEmail: input.email,
          role: input.role,
          doctorId: ctx.doctor.id,
          hasExistingAccount: !!existingUser,
        },
      });

      // In a real implementation, send an email with the invitation link
      // For now, return the invitation details
      return {
        id: invitation?.id,
        email: input.email,
        role: input.role,
        expiresAt,
        inviteUrl: `/accept-invite?token=${token}`,
      };
    }),

  /**
   * Get pending invitations for the current doctor.
   */
  getPendingInvitations: doctorProcedure.query(async ({ ctx }) => {
    if (!ctx.doctor) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Doctor profile not found',
      });
    }

    const invitations = await ctx.db.query.teamInvitations.findMany({
      where: and(
        eq(teamInvitations.doctorId, ctx.doctor.id),
        isNull(teamInvitations.acceptedAt),
        gte(teamInvitations.expiresAt, new Date())
      ),
    });

    return invitations;
  }),

  /**
   * Cancel a pending invitation.
   */
  cancelInvitation: doctorProcedure
    .input(z.object({
      invitationId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.doctor) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Doctor profile not found',
        });
      }

      const invitation = await ctx.db.query.teamInvitations.findFirst({
        where: and(
          eq(teamInvitations.id, input.invitationId),
          eq(teamInvitations.doctorId, ctx.doctor.id)
        ),
      });

      if (!invitation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invitation not found',
        });
      }

      // Delete the invitation
      await ctx.db
        .delete(teamInvitations)
        .where(eq(teamInvitations.id, input.invitationId));

      return { success: true };
    }),

  /**
   * Accept a team invitation.
   * Requirements: 26.3
   */
  acceptInvitation: protectedProcedure
    .input(z.object({
      token: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Find the invitation
      const invitation = await ctx.db.query.teamInvitations.findFirst({
        where: and(
          eq(teamInvitations.token, input.token),
          isNull(teamInvitations.acceptedAt),
          gte(teamInvitations.expiresAt, new Date())
        ),
      });

      if (!invitation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invalid or expired invitation',
        });
      }

      // Verify the email matches
      if (invitation.email.toLowerCase() !== ctx.user.email.toLowerCase()) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'This invitation was sent to a different email address',
        });
      }

      // Check if user already has this role
      const existingRole = await ctx.db.query.userRoles.findFirst({
        where: and(
          eq(userRoles.userId, ctx.user.id),
          eq(userRoles.doctorId, invitation.doctorId),
          eq(userRoles.role, invitation.role),
          or(
            isNull(userRoles.effectiveUntil),
            gte(userRoles.effectiveUntil, new Date())
          )
        ),
      });

      if (existingRole) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'You already have this role',
        });
      }

      // Create the role assignment
      const roleResult = await ctx.db
        .insert(userRoles)
        .values({
          userId: ctx.user.id,
          role: invitation.role,
          doctorId: invitation.doctorId,
          grantedBy: invitation.invitedBy,
          effectiveFrom: new Date(),
        })
        .returning();

      // Mark the invitation as accepted
      await ctx.db
        .update(teamInvitations)
        .set({
          acceptedAt: new Date(),
          acceptedBy: ctx.user.id,
        })
        .where(eq(teamInvitations.id, invitation.id));

      // Notify the doctor
      const doctor = await ctx.db.query.doctors.findFirst({
        where: eq(doctors.id, invitation.doctorId),
      });

      if (doctor) {
        await notificationService.createNotification({
          userId: doctor.userId,
          type: 'connection',
          title: 'Team Member Joined',
          message: `${ctx.user.firstName || ''} ${ctx.user.lastName || ''} has accepted your invitation and joined as a ${invitation.role.replace('_', ' ')}.`,
          data: {
            connectionId: '',
            action: 'new',
            newMemberUserId: ctx.user.id,
            role: invitation.role,
          } as any,
        });
      }

      // Log the action
      await auditService.log({
        userId: ctx.user.id,
        action: 'team_member_invited',
        resourceType: 'team_member',
        resourceId: roleResult[0]?.id,
        metadata: {
          invitationId: invitation.id,
          role: invitation.role,
          doctorId: invitation.doctorId,
          action: 'accepted',
        },
      });

      return roleResult[0];
    }),

  /**
   * Get invitation details by token (public, for showing invitation info before login).
   */
  getInvitationByToken: publicProcedure
    .input(z.object({
      token: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const invitation = await ctx.db.query.teamInvitations.findFirst({
        where: and(
          eq(teamInvitations.token, input.token),
          isNull(teamInvitations.acceptedAt),
          gte(teamInvitations.expiresAt, new Date())
        ),
      });

      if (!invitation) {
        return null;
      }

      // Get doctor info
      const doctor = await ctx.db.query.doctors.findFirst({
        where: eq(doctors.id, invitation.doctorId),
      });

      const doctorUser = doctor
        ? await ctx.db.query.users.findFirst({
            where: eq(users.id, doctor.userId),
          })
        : null;

      return {
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        doctor: doctor ? {
          clinicName: doctor.clinicName,
          specialty: doctor.specialty,
          user: doctorUser ? {
            firstName: doctorUser.firstName,
            lastName: doctorUser.lastName,
          } : null,
        } : null,
      };
    }),

  /**
   * Change a team member's role.
   * Requirements: 26.5
   */
  changeRole: doctorProcedure
    .input(z.object({
      roleAssignmentId: z.string().uuid(),
      newRole: z.enum(['clinic_admin', 'receptionist']),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.doctor) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Doctor profile not found',
        });
      }

      // Get the existing role assignment
      const existingRole = await ctx.db.query.userRoles.findFirst({
        where: and(
          eq(userRoles.id, input.roleAssignmentId),
          eq(userRoles.doctorId, ctx.doctor.id)
        ),
      });

      if (!existingRole) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Role assignment not found',
        });
      }

      // End the current role
      await ctx.db
        .update(userRoles)
        .set({ effectiveUntil: new Date() })
        .where(eq(userRoles.id, input.roleAssignmentId));

      // Create new role assignment
      const result = await ctx.db
        .insert(userRoles)
        .values({
          userId: existingRole.userId,
          role: input.newRole,
          doctorId: ctx.doctor.id,
          grantedBy: ctx.user.id,
          effectiveFrom: new Date(),
        })
        .returning();

      // Log the action
      await auditService.log({
        userId: ctx.user.id,
        action: 'team_member_role_changed',
        resourceType: 'team_member',
        resourceId: result[0]?.id,
        metadata: {
          previousRole: existingRole.role,
          newRole: input.newRole,
          affectedUserId: existingRole.userId,
        },
      });

      return result[0];
    }),

  /**
   * Remove a team member.
   * Requirements: 26.6
   */
  removeTeamMember: doctorProcedure
    .input(z.object({
      roleAssignmentId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.doctor) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Doctor profile not found',
        });
      }

      // Get the role assignment
      const roleAssignment = await ctx.db.query.userRoles.findFirst({
        where: and(
          eq(userRoles.id, input.roleAssignmentId),
          eq(userRoles.doctorId, ctx.doctor.id)
        ),
      });

      if (!roleAssignment) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Role assignment not found',
        });
      }

      // End the role assignment (soft delete)
      await ctx.db
        .update(userRoles)
        .set({ effectiveUntil: new Date() })
        .where(eq(userRoles.id, input.roleAssignmentId));

      // Log the action
      await auditService.log({
        userId: ctx.user.id,
        action: 'team_member_removed',
        resourceType: 'team_member',
        resourceId: input.roleAssignmentId,
        metadata: {
          removedUserId: roleAssignment.userId,
          role: roleAssignment.role,
        },
      });

      return { success: true };
    }),

  /**
   * Get the doctor this user is a team member of (for clinic_admin/receptionist).
   */
  getMyDoctorAssignment: protectedProcedure.query(async ({ ctx }) => {
    // Find active role assignments for this user
    const assignments = await ctx.db.query.userRoles.findMany({
      where: and(
        eq(userRoles.userId, ctx.user.id),
        or(
          eq(userRoles.role, 'clinic_admin'),
          eq(userRoles.role, 'receptionist')
        ),
        or(
          isNull(userRoles.effectiveUntil),
          gte(userRoles.effectiveUntil, new Date())
        )
      ),
    });

    if (assignments.length === 0) {
      return null;
    }

    // Get doctor details for each assignment
    const doctorAssignments = await Promise.all(
      assignments.map(async (assignment) => {
        if (!assignment.doctorId) return null;

        const doctor = await ctx.db.query.doctors.findFirst({
          where: eq(doctors.id, assignment.doctorId),
        });

        if (!doctor) return null;

        const doctorUser = await ctx.db.query.users.findFirst({
          where: eq(users.id, doctor.userId),
        });

        return {
          role: assignment.role,
          doctorId: doctor.id,
          doctor: {
            id: doctor.id,
            specialty: doctor.specialty,
            clinicName: doctor.clinicName,
            user: doctorUser ? {
              firstName: doctorUser.firstName,
              lastName: doctorUser.lastName,
              imageUrl: doctorUser.imageUrl,
            } : null,
          },
        };
      })
    );

    return doctorAssignments.filter(a => a !== null);
  }),
});
