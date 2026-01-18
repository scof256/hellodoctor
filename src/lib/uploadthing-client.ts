import { generateReactHelpers } from '@uploadthing/react';
import type { OurFileRouter } from '@/lib/uploadthing';

/**
 * UploadThing React helpers for client-side file uploads
 * Requirements: 11.1, 11.2
 */
export const { useUploadThing, uploadFiles } = generateReactHelpers<OurFileRouter>();
