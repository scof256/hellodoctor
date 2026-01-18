import { createTRPCRouter } from './trpc';
import { userRouter } from './routers/user';
import { doctorRouter } from './routers/doctor';
import { patientRouter } from './routers/patient';
import { connectionRouter } from './routers/connection';
import { intakeRouter } from './routers/intake';
import { appointmentRouter } from './routers/appointment';
import { messageRouter } from './routers/message';
import { notificationRouter } from './routers/notification';
import { fileRouter } from './routers/file';
import { adminRouter } from './routers/admin';
import { supportRouter } from './routers/support';
import { analyticsRouter } from './routers/analytics';
import { teamRouter } from './routers/team';
import { dashboardRouter } from './routers/dashboard';
import { meetingRouter } from './routers/meeting';

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  user: userRouter,
  doctor: doctorRouter,
  patient: patientRouter,
  connection: connectionRouter,
  intake: intakeRouter,
  appointment: appointmentRouter,
  message: messageRouter,
  notification: notificationRouter,
  file: fileRouter,
  admin: adminRouter,
  support: supportRouter,
  analytics: analyticsRouter,
  team: teamRouter,
  dashboard: dashboardRouter,
  meeting: meetingRouter,
});

// Export type definition of API
export type AppRouter = typeof appRouter;
