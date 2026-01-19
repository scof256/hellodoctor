import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { users, patients, intakeSessions, connections, doctors } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

const f = createUploadthing();

/**
 * File router for UploadThing
 * Handles file uploads for medical documents and images during intake
 * Requirements: 11.1, 11.5
 */
export const ourFileRouter = {
  /**
   * Image uploader for intake chat
   * Allows patients to upload images during AI intake sessions
   * Requirements: 11.2, 11.5
   */
  intakeImageUploader: f({
    image: {
      maxFileSize: "8MB",
      maxFileCount: 4,
    },
  })
    .middleware(async ({ req }) => {
      // Authenticate user via Clerk
      const { userId } = await auth();
      if (!userId) {
        throw new UploadThingError("Unauthorized");
      }

      // Get user from database
      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, userId),
      });

      if (!user) {
        throw new UploadThingError("User not found");
      }

      // Verify user is a patient
      const patient = await db.query.patients.findFirst({
        where: eq(patients.userId, user.id),
      });

      if (!patient) {
        throw new UploadThingError("Only patients can upload intake images");
      }

      // Get sessionId from request headers (passed from client)
      const sessionId = req.headers.get("x-session-id");

      return { userId: user.id, patientId: patient.id, sessionId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Intake image upload complete for user:", metadata.userId);
      console.log("File URL:", file.ufsUrl);

      return {
        uploadedBy: metadata.userId,
        sessionId: metadata.sessionId,
        url: file.ufsUrl,
        name: file.name,
        size: file.size,
        type: file.type,
      };
    }),

  /**
   * Medical document uploader
   * Allows patients to upload PDF documents and images to their profile
   * Requirements: 11.3, 11.5
   */
  medicalDocumentUploader: f({
    image: {
      maxFileSize: "8MB",
      maxFileCount: 10,
    },
    pdf: {
      maxFileSize: "16MB",
      maxFileCount: 5,
    },
  })
    .middleware(async () => {
      // Authenticate user via Clerk
      const { userId } = await auth();
      if (!userId) {
        throw new UploadThingError("Unauthorized");
      }

      // Get user from database
      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, userId),
      });

      if (!user) {
        throw new UploadThingError("User not found");
      }

      // Verify user is a patient
      const patient = await db.query.patients.findFirst({
        where: eq(patients.userId, user.id),
      });

      if (!patient) {
        throw new UploadThingError("Only patients can upload medical documents");
      }

      return { userId: user.id, patientId: patient.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Medical document upload complete for user:", metadata.userId);
      console.log("File URL:", file.ufsUrl);

      return {
        uploadedBy: metadata.userId,
        url: file.ufsUrl,
        name: file.name,
        size: file.size,
        type: file.type,
      };
    }),

  /**
   * Profile image uploader
   * Allows users to upload profile pictures
   */
  profileImageUploader: f({
    image: {
      maxFileSize: "4MB",
      maxFileCount: 1,
    },
  })
    .middleware(async () => {
      // Authenticate user via Clerk
      const { userId } = await auth();
      if (!userId) {
        throw new UploadThingError("Unauthorized");
      }

      // Get user from database
      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, userId),
      });

      if (!user) {
        throw new UploadThingError("User not found");
      }

      return { userId: user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Profile image upload complete for user:", metadata.userId);
      console.log("File URL:", file.ufsUrl);

      return {
        uploadedBy: metadata.userId,
        url: file.ufsUrl,
        name: file.name,
        size: file.size,
        type: file.type,
      };
    }),

  /**
   * Doctor profile photo uploader
   * Allows doctors to upload professional profile photos
   * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
   */
  doctorProfilePhotoUploader: f({
    image: {
      maxFileSize: "5MB",
      maxFileCount: 1,
    },
  })
    .middleware(async () => {
      // Authenticate user via Clerk
      const { userId } = await auth();
      if (!userId) {
        throw new UploadThingError("Unauthorized");
      }

      // Get user from database
      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, userId),
      });

      if (!user) {
        throw new UploadThingError("User not found");
      }

      // Verify user is a doctor
      const doctor = await db.query.doctors.findFirst({
        where: eq(doctors.userId, user.id),
      });

      if (!doctor) {
        throw new UploadThingError("Only doctors can upload profile photos");
      }

      return { userId: user.id, doctorId: doctor.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Doctor profile photo upload complete for doctor:", metadata.doctorId);
      console.log("File URL:", file.ufsUrl);

      return {
        uploadedBy: metadata.userId,
        doctorId: metadata.doctorId,
        url: file.ufsUrl,
        key: file.key,
        name: file.name,
        size: file.size,
        type: file.type,
      };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
