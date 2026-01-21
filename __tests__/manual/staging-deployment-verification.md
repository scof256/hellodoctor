# Staging Deployment Verification Guide

## Task 13: Deploy and Verify in Staging

This guide provides step-by-step instructions for deploying the messaging system production fixes to a Vercel staging environment and verifying all functionality works correctly.

## Prerequisites

- [ ] All code changes from tasks 1-12 are committed
- [ ] All tests are passing locally
- [ ] Vercel account with access to the project
- [ ] Vercel CLI installed (optional but recommended)

## Part 1: Deploy to Staging

### Option A: Deploy via Vercel CLI (Recommended)

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy to Preview/Staging**:
   ```bash
   vercel
   ```
   
   This creates a preview deployment (staging environment) without affecting production.

4. **Note the Deployment URL**:
   - The CLI will output a URL like: `https://your-project-abc123.vercel.app`
   - Save this URL for testing

### Option B: Deploy via Git Push

1. **Create a staging branch**:
   ```bash
   git checkout -b staging/messaging-fix
   ```

2. **Push to remote**:
   ```bash
   git push origin staging/messaging-fix
   ```

3. **Find the preview deployment**:
   - Go to Vercel Dashboard → Your Project → Deployments
   - Find the deployment for your branch
   - Click to get the preview URL

### Verify Deployment Success

- [ ] Build completed without errors
- [ ] No TypeScript compilation errors
- [ ] No missing environment variables warnings
- [ ] Deployment status shows "Ready"

## Part 2: Health Check Verification

### Test 1: Basic Health Check

**Endpoint**: `GET /api/health`

**Expected Response**:
```json
{
  "status": "healthy",
  "checks": {
    "database": true,
    "auth": true,
    "timestamp": "2026-01-22T..."
  }
}
```

**Test Steps**:

1. **Using curl**:
   ```bash
   curl https://your-deployment-url.vercel.app/api/health
   ```

2. **Using browser**:
   - Navigate to: `https://your-deployment-url.vercel.app/api/health`
   - Verify status 200 and JSON response

3. **Verify checks**:
   - [ ] `status` is "healthy"
   - [ ] `checks.database` is `true`
   - [ ] `checks.auth` is `true`
   - [ ] `checks.timestamp` is present and recent

**If health check fails**:
- Check Vercel logs: `vercel logs [deployment-url]`
- Verify DATABASE_URL environment variable is set
- Verify Clerk environment variables are set
- Check database connection from Vercel IP ranges

## Part 3: TRPC Endpoint Verification

### Test 2: Get Session (Protected Endpoint)

**Endpoint**: `GET /api/trpc/intake.getSession`

**Prerequisites**:
- You need a valid session ID from the database
- You need to be authenticated with Clerk

**Test Steps**:

1. **Sign in to the application**:
   - Navigate to: `https://your-deployment-url.vercel.app/sign-in`
   - Sign in with test credentials

2. **Get a valid session ID**:
   - Navigate to patient dashboard
   - Start or view an intake session
   - Note the session ID from the URL or network tab

3. **Test the endpoint**:
   - Open browser DevTools → Network tab
   - Navigate to the intake session
   - Find the `intake.getSession` request
   - Verify response status is 200

**Expected Response**:
```json
{
  "result": {
    "data": {
      "id": "session-id",
      "userId": "user-id",
      "messages": [...],
      "medicalData": {...},
      "status": "in_progress",
      ...
    }
  }
}
```

**Verification Checklist**:
- [ ] Status code is 200 (not 404 or 500)
- [ ] Response contains session data
- [ ] Messages array is present
- [ ] Medical data is present
- [ ] No errors in browser console
- [ ] No errors in Vercel logs

### Test 3: Send Message (Protected Mutation)

**Endpoint**: `POST /api/trpc/intake.sendMessage`

**Test Steps**:

1. **Navigate to an active intake session**:
   - Go to: `https://your-deployment-url.vercel.app/patient/intake/[session-id]`

2. **Send a test message**:
   - Type a message in the chat input
   - Click send
   - Observe the response

3. **Verify in DevTools**:
   - Open Network tab
   - Find the `intake.sendMessage` request
   - Check status code and response

**Expected Behavior**:
- [ ] Message sends successfully
- [ ] Status code is 200
- [ ] AI response is received
- [ ] Message appears in chat
- [ ] No 500 errors
- [ ] No timeout errors

**Expected Response Structure**:
```json
{
  "result": {
    "data": {
      "userMessage": {...},
      "aiMessage": {...},
      "updatedSession": {...}
    }
  }
}
```

## Part 4: Error Scenario Testing

### Test 4: Invalid Session ID

**Test Steps**:

1. **Attempt to access non-existent session**:
   - Navigate to: `https://your-deployment-url.vercel.app/patient/intake/invalid-session-id`

**Expected Behavior**:
- [ ] Returns 404 error
- [ ] Error message: "Intake session not found"
- [ ] No 500 error
- [ ] Error is logged in Vercel logs

### Test 5: Unauthorized Access

**Test Steps**:

1. **Sign out of the application**

2. **Attempt to access protected endpoint**:
   - Try to navigate to: `https://your-deployment-url.vercel.app/patient/intake/[session-id]`

**Expected Behavior**:
- [ ] Redirects to sign-in page
- [ ] Returns 401 error for API calls
- [ ] Error message: "You must be logged in to access this resource"
- [ ] No 500 error

### Test 6: AI Service Fallback

**Test Steps**:

1. **Send a message during high load** (or simulate AI failure):
   - Send multiple messages rapidly
   - Observe responses

**Expected Behavior**:
- [ ] If AI service fails, fallback message is returned
- [ ] No 500 errors
- [ ] User receives a response (even if fallback)
- [ ] Error is logged but user experience is maintained

## Part 5: Vercel Logs Monitoring

### Monitor Deployment Logs

**Using Vercel CLI**:
```bash
vercel logs [deployment-url] --follow
```

**Using Vercel Dashboard**:
1. Go to Vercel Dashboard → Your Project → Deployments
2. Click on your staging deployment
3. Click "View Function Logs"

### Verify No Critical Errors

**Check for**:
- [ ] No 404 errors on TRPC routes
- [ ] No 500 errors on TRPC routes
- [ ] No database connection errors
- [ ] No Clerk authentication errors
- [ ] No unhandled promise rejections
- [ ] No timeout errors

**Expected Log Patterns**:

✅ **Good logs**:
```
[TRPC Context] { timestamp: ..., hasAuth: true, userId: "user_..." }
[intake.sendMessage] Starting { sessionId: ..., userId: ..., contentLength: 50 }
[intake.sendMessage] Completed { sessionId: ..., duration: 1234, success: true }
[Environment Validation] All required variables present
```

❌ **Bad logs** (should NOT appear):
```
[TRPC Error] { code: "NOT_FOUND", path: "intake.getSession" }
[TRPC Error] { code: "INTERNAL_SERVER_ERROR", message: "..." }
Database connection failed
Clerk authentication failed
```

## Part 6: Performance Verification

### Test 7: Response Times

**Verify acceptable response times**:

1. **Health check**: < 1 second
2. **Get session**: < 2 seconds
3. **Send message**: < 5 seconds (including AI response)

**Test using browser DevTools**:
- Network tab → Check timing for each request
- Verify no requests exceed 30 seconds (Vercel timeout)

### Test 8: Cold Start Performance

**Test Steps**:

1. **Wait 5 minutes** (to allow function to go cold)

2. **Make a request**:
   - Navigate to a page that calls TRPC endpoints
   - Measure response time

**Expected Behavior**:
- [ ] Cold start completes within 10 seconds
- [ ] No timeout errors
- [ ] Subsequent requests are faster (< 2 seconds)

## Part 7: Integration Testing

### Test 9: End-to-End Intake Flow

**Test Steps**:

1. **Sign in as patient**
2. **Create new intake session**
3. **Send multiple messages**
4. **Verify AI responses**
5. **Check session persistence**
6. **Sign out and sign back in**
7. **Verify session is still accessible**

**Verification Checklist**:
- [ ] All steps complete without errors
- [ ] Data persists correctly
- [ ] No 404 or 500 errors
- [ ] Logs show successful operations

### Test 10: Error Recovery

**Test Steps**:

1. **Trigger an error** (e.g., send invalid data)
2. **Verify error is handled gracefully**
3. **Send a valid message**
4. **Verify system recovers**

**Expected Behavior**:
- [ ] Errors don't crash the application
- [ ] User sees friendly error messages
- [ ] System recovers after error
- [ ] Subsequent requests work normally

## Part 8: Final Verification Checklist

### Deployment Status
- [ ] Deployment shows "Ready" status in Vercel
- [ ] No build errors or warnings
- [ ] All environment variables are set correctly

### Health Check
- [ ] `/api/health` returns 200 with healthy status
- [ ] Database check passes
- [ ] Auth check passes

### TRPC Endpoints
- [ ] `intake.getSession` returns 200 with valid data
- [ ] `intake.sendMessage` returns 200 with AI response
- [ ] No 404 errors on TRPC routes
- [ ] No 500 errors on TRPC routes

### Error Handling
- [ ] Invalid session returns 404 with proper message
- [ ] Unauthorized access returns 401 with proper message
- [ ] AI service failures use fallback messages
- [ ] All errors are logged with context

### Logs
- [ ] No critical errors in Vercel logs
- [ ] Structured logging is working
- [ ] Error context is captured
- [ ] No sensitive data in logs

### Performance
- [ ] Response times are acceptable
- [ ] Cold starts complete within 10 seconds
- [ ] No timeout errors

### Integration
- [ ] End-to-end intake flow works
- [ ] Error recovery works
- [ ] Data persistence works

## Part 9: Reporting Results

### Document Findings

Create a summary with:

1. **Deployment URL**: [Your staging URL]
2. **Deployment Time**: [Timestamp]
3. **Test Results**: [Pass/Fail for each test]
4. **Issues Found**: [List any issues]
5. **Logs**: [Attach relevant log excerpts]

### Example Report Format

```markdown
## Staging Deployment Verification Results

**Deployment URL**: https://your-project-abc123.vercel.app
**Deployment Time**: 2026-01-22 10:30:00 UTC
**Tested By**: [Your Name]

### Test Results

| Test | Status | Notes |
|------|--------|-------|
| Health Check | ✅ Pass | All services healthy |
| Get Session | ✅ Pass | Returns data correctly |
| Send Message | ✅ Pass | AI responses working |
| Invalid Session | ✅ Pass | Returns 404 as expected |
| Unauthorized Access | ✅ Pass | Returns 401 as expected |
| AI Fallback | ✅ Pass | Fallback messages working |
| Log Monitoring | ✅ Pass | No critical errors |
| Performance | ✅ Pass | Response times acceptable |
| End-to-End Flow | ✅ Pass | Complete flow works |
| Error Recovery | ✅ Pass | System recovers gracefully |

### Issues Found

None - all tests passed successfully.

### Logs Sample

[Attach relevant log excerpts showing successful operations]

### Recommendation

✅ Ready for production deployment
```

## Troubleshooting Guide

### Issue: Health check returns 503

**Possible Causes**:
- Database connection failed
- Clerk authentication unavailable

**Solutions**:
1. Check DATABASE_URL environment variable
2. Verify database allows Vercel IP ranges
3. Check Clerk environment variables
4. Review Vercel logs for specific error

### Issue: TRPC endpoints return 404

**Possible Causes**:
- Route handler not properly exported
- Vercel build configuration issue

**Solutions**:
1. Verify `app/api/trpc/[trpc]/route.ts` exports GET and POST
2. Check `vercel.json` function configuration
3. Rebuild and redeploy

### Issue: TRPC endpoints return 500

**Possible Causes**:
- Unhandled error in procedure
- Database query failure
- AI service failure

**Solutions**:
1. Check Vercel logs for error details
2. Verify error handling is in place
3. Test AI service fallback
4. Check database connection

### Issue: Timeout errors

**Possible Causes**:
- Function exceeds 30-second limit
- Database query too slow
- AI service too slow

**Solutions**:
1. Optimize database queries
2. Add timeout to AI service calls
3. Increase function timeout in `vercel.json` (if needed)

## Next Steps

After successful staging verification:

1. **Mark task as complete**
2. **Proceed to Task 14**: Final checkpoint - Production readiness
3. **Prepare for production deployment**

## Notes

- Keep staging deployment active for testing
- Don't promote to production until Task 14 is complete
- Document any issues found for future reference
- Share results with team for review
