# Transcription Fix Summary

## Issues Identified

### 1. Audio Transcription Failing (413 Payload Too Large & FormData Parse Error)
**Errors:** 
- `/api/transcribe:1 Failed to load resource: the server responded with a status of 413 ()`
- `Failed to parse body as FormData`

**Root Cause:** 
- Next.js has a default 10MB body size limit for API routes in App Router
- Audio files being sent for transcription can be up to 25MB
- The scribe page sends audio chunks every 60 seconds, which can exceed the default limit
- **Previous incorrect fix**: Used `config.api.bodyParser` which only works in Pages Router, not App Router
- This caused FormData parsing to fail with "expected boundary after body" error

**Fix Applied:**
1. Updated `next.config.js` to use the correct App Router configuration:
   ```javascript
   // For API routes in App Router
   proxyClientMaxBodySize: '30mb',
   
   // For Server Actions
   experimental: {
     serverActions: {
       bodySizeLimit: '30mb',
     },
   }
   ```

2. Removed incorrect `config` export from `app/api/transcribe/route.ts`:
   - The `config.api.bodyParser` pattern is ONLY for Pages Router
   - App Router uses global `proxyClientMaxBodySize` in next.config.js
   - Route already has proper segment config: `maxDuration`, `dynamic`, `runtime`

### 2. React Hydration Error #418
**Error:** `Uncaught Error: Minified React error #418`

**Description:**
- React error #418 indicates hydration mismatch between server and client rendering
- The error was occurring in the `LandingPageRedirect` component on the landing page

**Root Cause:**
- The `LandingPageRedirect` component was rendering different content on server vs client
- Clerk's `isLoaded` state changes after hydration, causing conditional rendering mismatch
- Server renders one state, client renders different state after auth loads

**Fix Applied:**
1. Added `mounted` state to `LandingPageRedirect` component:
   ```typescript
   const [mounted, setMounted] = useState(false);
   
   useEffect(() => {
     setMounted(true);
   }, []);
   
   // Don't render anything until mounted to avoid hydration mismatch
   if (!mounted) {
     return null;
   }
   ```

2. This ensures the component doesn't render any conditional content until after hydration is complete
3. Prevents server/client mismatch by returning `null` on server-side render

## Testing Required

After deploying these changes:

1. **Test Audio Transcription:**
   - Record audio for 60+ seconds
   - Upload audio files of various sizes (up to 25MB)
   - Verify transcription completes successfully
   - Check that no 413 errors occur
   - Verify FormData parsing works correctly

2. **Test Hydration:**
   - Open the application in a fresh browser session
   - Navigate to the landing page (/)
   - Check browser console for hydration errors
   - Verify smooth redirect for signed-in users
   - Test across different pages and user roles

## Files Modified

1. `next.config.js` - Added `proxyClientMaxBodySize: '30mb'` for API routes
2. `app/api/transcribe/route.ts` - Removed incorrect Pages Router config export
3. `app/components/LandingPageClient.tsx` - Added mounted state to prevent hydration mismatch
4. `transcription-fix-summary.md` - Updated documentation with correct fixes

## Deployment Notes

- These changes require a server restart to take effect
- The increased body size limit applies to all API routes (consider if this needs to be more targeted)
- Monitor server memory usage with larger file uploads
- Consider adding client-side file size validation before upload to improve UX
