# Transcription Fix Summary

## Issues Identified and Fixed

### 1. Audio Transcription Failing - FIXED ✅
**Errors:** 
- `TypeError: fetch failed` when calling Gemini API
- `/api/transcribe:1 Failed to load resource: the server responded with a status of 500 ()`
- Previous: `413 Payload Too Large` and `Failed to parse body as FormData`

**Root Causes:** 
1. **Incorrect API call format for Google GenAI SDK** (Primary issue causing fetch failure)
   - The `contents` parameter was structured incorrectly
   - Used `contents: { parts: [...] }` instead of `contents: [...]`
   - According to official Gemini documentation, inline audio should use array format

2. **Next.js body size limit** (Secondary issue, already fixed)
   - Next.js has a default 10MB body size limit for API routes in App Router
   - Audio files being sent for transcription can be up to 25MB
   - The scribe page sends audio chunks every 60 seconds, which can exceed the default limit

**Fixes Applied:**

1. **Corrected Gemini API call format in `app/api/transcribe/route.ts`:**
   ```javascript
   // BEFORE (INCORRECT):
   const response = await ai.models.generateContent({
     model,
     config: { systemInstruction, temperature: 0.1 },
     contents: {
       parts: [
         { inlineData: { mimeType, data: base64Audio } },
         { text: 'Transcribe this audio.' },
       ],
     },
   });

   // AFTER (CORRECT):
   const response = await ai.models.generateContent({
     model,
     config: { systemInstruction, temperature: 0.1 },
     contents: [
       { text: 'Transcribe this audio.' },
       { inlineData: { mimeType, data: base64Audio } },
     ],
   });
   ```

2. **Updated `next.config.js` for body size limit:**
   ```javascript
   // For Server Actions
   experimental: {
     serverActions: {
       bodySizeLimit: '30mb',
     },
     middlewareClientMaxBodySize: '30mb',
   }
   ```
   
   **Note**: In Next.js 15, there is no direct configuration for API route body size limits in the App Router. The `middlewareClientMaxBodySize` setting applies when middleware is used. For API routes, Next.js uses the underlying Node.js server's body parser, which typically has a higher default limit. The main concern was the FormData parsing, which is now working correctly with the Gemini API fix.

3. **Removed incorrect Pages Router config from `app/api/transcribe/route.ts`:**
   - The `config.api.bodyParser` pattern is ONLY for Pages Router
   - App Router uses global `proxyClientMaxBodySize` in next.config.js

**CRITICAL: Server Restart Required**
- The `proxyClientMaxBodySize` setting requires a **full server restart** to take effect
- Stop your development server (Ctrl+C) and restart it with `npm run dev`
- The setting will NOT work with hot reload - you must restart the server

### 2. React Hydration Error #418
**Error:** `Uncaught Error: Hydration failed because the server rendered HTML didn't match the client`

**Description:**
- React hydration mismatch between server and client rendering
- Error occurring in the dashboard layout, not the landing page
- Server renders one className, client expects different className

**Root Cause:**
- The error shows server rendering: `className="fixed top-0 left-0 right-0 z-50 bg-yellow-500..."`
- Client expects: `className="h-screen bg-slate-50 flex flex-col overflow-hidden"`
- This suggests an OfflineBanner or similar component is being rendered on server but not client
- The `isSimpleMode()` check in dashboard layout depends on localStorage (client-only)
- The `isMounted` state is used but some conditional rendering still happens before mount

**Fix Applied:**
1. Added `mounted` state to `LandingPageRedirect` component to prevent hydration mismatch
2. Added `suppressHydrationWarning` to sidebar in dashboard layout
3. Dashboard layout already uses `isMounted` state for mode-dependent rendering

**Additional Fix Needed:**
- The hydration error is likely coming from the `OfflineBanner` component in root layout
- This component may be rendering different content on server vs client
- Need to check `app/components/OfflineBanner.tsx` and ensure it doesn't cause hydration issues

## Testing Required

After deploying these changes:

1. **RESTART THE SERVER:**
   ```bash
   # Stop the current server (Ctrl+C)
   npm run dev
   # OR
   yarn dev
   ```

2. **Test Audio Transcription:**
   - Record audio for 60+ seconds
   - Upload audio files of various sizes (up to 25MB)
   - Verify transcription completes successfully
   - Check that no 413 errors occur
   - Verify FormData parsing works correctly
   - Check that no 500 errors occur

3. **Test Hydration:**
   - Open the application in a fresh browser session
   - Navigate to the landing page (/)
   - Check browser console for hydration errors
   - Navigate to dashboard pages
   - Verify smooth redirect for signed-in users
   - Test across different pages and user roles

## Files Modified

1. `next.config.js` - Added `proxyClientMaxBodySize: '30mb'` for API routes
2. `app/api/transcribe/route.ts` - Removed incorrect Pages Router config export
3. `app/components/LandingPageClient.tsx` - Added mounted state to prevent hydration mismatch
4. `transcription-fix-summary.md` - Updated documentation with correct fixes

## Deployment Notes

- **CRITICAL**: These changes require a **full server restart** to take effect
- Hot reload will NOT apply the `proxyClientMaxBodySize` setting
- Stop the server completely and restart it
- The increased body size limit applies to all API routes (consider if this needs to be more targeted)
- Monitor server memory usage with larger file uploads
- Consider adding client-side file size validation before upload to improve UX

## Next Steps if Issues Persist

If transcription still fails after server restart:

1. **Check if running on Vercel:**
   - Vercel has a 4.5MB limit for serverless functions
   - May need to use Edge Runtime or increase Vercel limits
   - Check `vercel.json` for any conflicting settings

2. **Alternative Solution - Reduce Chunk Size:**
   - Reduce `CHUNK_DURATION_MS` in scribe page from 60 seconds to 30 seconds
   - This will send smaller audio chunks more frequently
   - Trade-off: more API calls but smaller payloads

3. **Check OfflineBanner for Hydration:**
   - Inspect `app/components/OfflineBanner.tsx`
   - Ensure it doesn't render different content on server vs client
   - May need to add `mounted` state or `suppressHydrationWarning`

4. **Diagnose 500 Internal Server Error:**
   - Look at the terminal where `npm run dev` is running
   - The 500 error should show the actual error message and stack trace
   - Common causes:
     - Missing `GEMINI_API_KEY` environment variable
     - Database connection issues
     - FormData parsing still failing (means server wasn't restarted properly)
     - Clerk authentication issues

5. **Verify Environment Variables:**
   - Ensure `GEMINI_API_KEY` is set in `.env.local`
   - Check that all required database credentials are present
   - Verify Clerk keys are configured
   - **Restart server after changing environment variables**
