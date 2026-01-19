# Transcription Fix Summary

## Issues Identified

### 1. Audio Transcription Failing (413 Payload Too Large)
**Error:** `/api/transcribe:1 Failed to load resource: the server responded with a status of 413 ()`

**Root Cause:** 
- Next.js has a default 4MB body size limit for API routes
- Audio files being sent for transcription can be up to 25MB
- The scribe page sends audio chunks every 60 seconds, which can exceed the default limit

**Fix Applied:**
1. Updated `next.config.js` to increase body size limit to 30MB:
   ```javascript
   experimental: {
     serverActions: {
       bodySizeLimit: '30mb',
     },
   }
   ```

2. Updated `app/api/transcribe/route.ts` to add route-specific configuration:
   ```typescript
   export const maxDuration = 60; // Allow up to 60 seconds for transcription
   export const dynamic = 'force-dynamic';
   
   export const config = {
     api: {
       bodyParser: {
         sizeLimit: '30mb',
       },
     },
   };
   ```

### 2. React Hydration Error #418
**Error:** `Uncaught Error: Minified React error #418`

**Description:**
- React error #418 indicates invalid HTML nesting (e.g., `<p>` inside `<p>`, `<div>` inside `<p>`, etc.)
- This is a hydration mismatch between server and client rendering

**Potential Causes:**
- Invalid HTML structure in components
- Conditional rendering that differs between server and client
- Browser extensions modifying the DOM

**Recommended Actions:**
1. Check browser console in development mode (non-minified) for specific error details
2. Look for `<p>` tags containing block-level elements like `<div>`
3. Check for conditional rendering based on `localStorage` or other client-only APIs
4. Verify all components use proper HTML nesting

**Note:** The layout code reviewed appears correct with proper `suppressHydrationWarning` attributes where needed.

## Testing Required

After deploying these changes:

1. **Test Audio Transcription:**
   - Record audio for 60+ seconds
   - Upload audio files of various sizes (up to 25MB)
   - Verify transcription completes successfully
   - Check that no 413 errors occur

2. **Test Hydration:**
   - Open the application in development mode
   - Check browser console for detailed React error messages
   - Verify no hydration warnings appear
   - Test across different pages and user roles

## Files Modified

1. `next.config.js` - Added body size limit configuration
2. `app/api/transcribe/route.ts` - Added route-specific limits and timeout

## Deployment Notes

- These changes require a server restart to take effect
- The increased body size limit applies to all API routes (consider if this needs to be more targeted)
- Monitor server memory usage with larger file uploads
- Consider adding client-side file size validation before upload to improve UX
