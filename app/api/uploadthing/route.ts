import { createRouteHandler } from "uploadthing/next";
import { ourFileRouter } from "@/lib/uploadthing";

/**
 * UploadThing API route handler
 * Handles file upload requests
 * Requirements: 11.1
 */
export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,
});
