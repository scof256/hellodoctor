# Vercel Deployment Checklist

Use this checklist to ensure a smooth deployment to Vercel.

## Pre-Deployment

- [ ] All code is committed and pushed to your Git repository
- [ ] `.env.local` is NOT committed (check `.gitignore`)
- [ ] Database is set up and accessible (Neon PostgreSQL recommended)
- [ ] All third-party services are configured:
  - [ ] Clerk account created
  - [ ] UploadThing account created
  - [ ] Google Gemini API key obtained
  - [ ] Stream Video SDK account created
  - [ ] OpenAI API key (if using OpenAI)

## Vercel Setup

- [ ] Vercel account created
- [ ] Repository connected to Vercel
- [ ] Project created in Vercel Dashboard

## Environment Variables

Copy these from your `.env.local` to Vercel:

### Required Variables
- [ ] `DATABASE_URL`
- [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- [ ] `CLERK_SECRET_KEY`
- [ ] `CLERK_WEBHOOK_SECRET`
- [ ] `UPLOADTHING_TOKEN`
- [ ] `GEMINI_API_KEY`
- [ ] `STREAM_API_KEY`
- [ ] `STREAM_SECRET_KEY`
- [ ] `NEXT_PUBLIC_APP_URL` (set to your Vercel URL)

### Clerk URLs (set these in Vercel)
- [ ] `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`
- [ ] `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`
- [ ] `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/onboarding`
- [ ] `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding`

### Optional Variables
- [ ] `OPENAI_API_KEY` (if using OpenAI)
- [ ] `OPENAI_BASE_URL` (if using custom OpenAI endpoint)
- [ ] `OPENAI_MODEL` (default: gpt-4o)
- [ ] `AI_PROVIDER` (default: gemini)
- [ ] `GEMINI_MODEL` (default: gemini-2.0-flash)
- [ ] `GEMINI_TRANSCRIPTION_MODEL` (default: gemini-2.0-flash)
- [ ] `GEMINI_ANALYSIS_MODEL` (default: gemini-2.0-flash)

## First Deployment

- [ ] Click "Deploy" in Vercel Dashboard
- [ ] Wait for build to complete
- [ ] Check deployment logs for errors
- [ ] Note your deployment URL (e.g., `https://your-app.vercel.app`)

## Post-Deployment Configuration

### Update Clerk
- [ ] Go to Clerk Dashboard → Your Application
- [ ] Update "Authorized redirect URLs" to include:
  - `https://your-app.vercel.app/sign-in`
  - `https://your-app.vercel.app/sign-up`
  - `https://your-app.vercel.app/onboarding`
- [ ] Update webhook endpoint:
  - URL: `https://your-app.vercel.app/api/auth/webhook`
  - Events: Select all user events
  - Copy webhook secret to Vercel env vars

### Update Environment Variables
- [ ] Update `NEXT_PUBLIC_APP_URL` in Vercel to your actual deployment URL
- [ ] Redeploy if you changed environment variables

### Database
- [ ] Verify database connection works
- [ ] Run migrations if needed: `npm run db:push`
- [ ] Check database allows connections from Vercel

## Testing

- [ ] Visit your deployment URL
- [ ] Test sign-up flow
- [ ] Test sign-in flow
- [ ] Test protected routes
- [ ] Test API endpoints
- [ ] Test file uploads
- [ ] Test video conferencing
- [ ] Test AI features (chat, transcription)

## Production Readiness

### Code Quality
- [ ] Fix TypeScript errors (currently ignored in build)
- [ ] Fix ESLint errors (currently ignored in build)
- [ ] Remove console.logs from production code
- [ ] Add error tracking (Sentry, LogRocket, etc.)

### Performance
- [ ] Run `npm run build:analyze` locally
- [ ] Check bundle sizes
- [ ] Optimize images
- [ ] Enable caching where appropriate

### Security
- [ ] Review all environment variables
- [ ] Ensure no secrets in code
- [ ] Test CSRF protection
- [ ] Test authentication flows
- [ ] Review API route security

### Monitoring
- [ ] Set up Vercel Analytics
- [ ] Configure error tracking
- [ ] Set up uptime monitoring
- [ ] Configure alerts for errors

## Custom Domain (Optional)

- [ ] Add custom domain in Vercel Dashboard
- [ ] Update DNS records
- [ ] Wait for DNS propagation
- [ ] Update `NEXT_PUBLIC_APP_URL` to custom domain
- [ ] Update Clerk redirect URLs to custom domain
- [ ] Redeploy

## Continuous Deployment

- [ ] Verify automatic deployments work on push to main
- [ ] Verify preview deployments work on pull requests
- [ ] Set up branch protection rules
- [ ] Configure deployment notifications

## Rollback Plan

- [ ] Know how to rollback in Vercel Dashboard
- [ ] Test rollback process
- [ ] Document rollback procedure for team

## Documentation

- [ ] Update README with production URL
- [ ] Document deployment process for team
- [ ] Create runbook for common issues
- [ ] Document environment variables

## Final Checks

- [ ] All features working in production
- [ ] No console errors in browser
- [ ] Mobile responsive
- [ ] Performance acceptable
- [ ] SEO meta tags present
- [ ] Analytics tracking working

## Notes

- Vercel automatically deploys on push to main branch
- Preview deployments are created for pull requests
- Environment variables can be updated in Vercel Dashboard
- Logs are available in Vercel Dashboard → Deployments

## Support Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Clerk Documentation](https://clerk.com/docs)
- [Stream Video SDK](https://getstream.io/video/docs/)
