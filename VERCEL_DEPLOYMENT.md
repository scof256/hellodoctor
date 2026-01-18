# Vercel Deployment Guide

This guide will help you deploy your Next.js doctor appointment application to Vercel.

## Prerequisites

1. A [Vercel account](https://vercel.com/signup)
2. [Vercel CLI](https://vercel.com/docs/cli) installed (optional, but recommended)
3. All required environment variables ready

## Required Environment Variables

You'll need to set up the following environment variables in your Vercel project:

### Database
- `DATABASE_URL` - PostgreSQL connection string (Neon recommended)

### Authentication (Clerk)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Your Clerk publishable key
- `CLERK_SECRET_KEY` - Your Clerk secret key
- `CLERK_WEBHOOK_SECRET` - Webhook secret for Clerk events
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL` - `/sign-in`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL` - `/sign-up`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` - `/onboarding`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` - `/onboarding`

### File Upload
- `UPLOADTHING_TOKEN` - Your UploadThing token

### AI Services
- `GEMINI_API_KEY` - Google Gemini API key (required for transcription)
- `GEMINI_MODEL` - `gemini-2.0-flash` (optional, has default)
- `GEMINI_TRANSCRIPTION_MODEL` - `gemini-2.0-flash` (optional, has default)
- `GEMINI_ANALYSIS_MODEL` - `gemini-2.0-flash` (optional, has default)
- `OPENAI_API_KEY` - OpenAI API key (optional, if using OpenAI)
- `OPENAI_BASE_URL` - Custom OpenAI base URL (optional)
- `OPENAI_MODEL` - `gpt-4o` (optional, has default)
- `AI_PROVIDER` - `gemini` or `openai` (default: `gemini`)

### Video Conferencing
- `STREAM_API_KEY` - Stream Video SDK API key
- `STREAM_SECRET_KEY` - Stream Video SDK secret key

### Application
- `NEXT_PUBLIC_APP_URL` - Your production URL (e.g., `https://your-app.vercel.app`)

## Deployment Steps

### Option 1: Deploy via Vercel Dashboard (Recommended for first deployment)

1. **Connect Your Repository**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "Add New Project"
   - Import your Git repository (GitHub, GitLab, or Bitbucket)

2. **Configure Project**
   - Framework Preset: Next.js (auto-detected)
   - Root Directory: `./` (leave as default)
   - Build Command: `npm run build` (auto-detected)
   - Output Directory: `.next` (auto-detected)

3. **Add Environment Variables**
   - In the project settings, go to "Environment Variables"
   - Add all required variables listed above
   - Make sure to set them for Production, Preview, and Development environments as needed

4. **Deploy**
   - Click "Deploy"
   - Wait for the build to complete
   - Your app will be live at `https://your-project.vercel.app`

### Option 2: Deploy via Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Deploy to Preview**
   ```bash
   vercel
   ```

4. **Deploy to Production**
   ```bash
   vercel --prod
   ```

5. **Set Environment Variables**
   ```bash
   vercel env add DATABASE_URL production
   vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production
   # ... add all other variables
   ```

## Post-Deployment Configuration

### 1. Update Clerk Settings
- Go to your [Clerk Dashboard](https://dashboard.clerk.com)
- Update the following URLs to match your Vercel deployment:
  - Authorized redirect URLs
  - Webhook endpoint: `https://your-app.vercel.app/api/auth/webhook`

### 2. Configure Database
- Ensure your database (Neon PostgreSQL) allows connections from Vercel
- Run migrations if needed:
  ```bash
  npm run db:push
  ```

### 3. Update CORS Settings
- If using external APIs, update CORS settings to allow your Vercel domain

### 4. Configure Custom Domain (Optional)
- In Vercel Dashboard → Project Settings → Domains
- Add your custom domain
- Update DNS records as instructed
- Update `NEXT_PUBLIC_APP_URL` environment variable

## Vercel Configuration

The project includes a `vercel.json` file with optimized settings:

- **Regions**: Deployed to `iad1` (US East) - adjust based on your user base
- **Function Timeouts**: 
  - Default API routes: 30 seconds
  - Webhook routes: 60 seconds
- **Security Headers**: Configured for API routes
- **Build Optimizations**: Telemetry disabled for faster builds

## Monitoring and Debugging

### View Logs
```bash
vercel logs [deployment-url]
```

### View Build Logs
- Go to Vercel Dashboard → Your Project → Deployments
- Click on a deployment to see detailed logs

### Environment Variables
- Check in Vercel Dashboard → Project Settings → Environment Variables
- Ensure all required variables are set correctly

## Troubleshooting

### Build Failures

**TypeScript Errors**
- The project has `typescript.ignoreBuildErrors: true` in `next.config.js`
- This is temporary - fix TypeScript errors for production

**ESLint Errors**
- The project has `eslint.ignoreDuringBuilds: true` in `next.config.js`
- This is temporary - fix ESLint errors for production

### Database Connection Issues
- Verify `DATABASE_URL` is correctly set
- Ensure database allows connections from Vercel IPs
- Check if SSL mode is required: `?sslmode=require`

### Authentication Issues
- Verify all Clerk environment variables are set
- Check Clerk Dashboard for correct redirect URLs
- Ensure webhook endpoint is accessible

### API Timeout Issues
- Increase function timeout in `vercel.json` if needed
- Consider moving long-running tasks to background jobs

## Performance Optimization

The project includes several optimizations:

1. **Code Splitting**: Configured in `next.config.js`
2. **Bundle Analysis**: Run `npm run build:analyze` locally
3. **Image Optimization**: Next.js automatic image optimization
4. **Lazy Loading**: Components are lazy-loaded where appropriate

## Security Considerations

1. **Environment Variables**: Never commit `.env.local` to Git
2. **API Routes**: Protected with CSRF validation in middleware
3. **Authentication**: All routes protected except public pages
4. **Headers**: Security headers configured in `vercel.json`

## Continuous Deployment

Vercel automatically deploys:
- **Production**: When you push to your main/master branch
- **Preview**: When you create a pull request or push to other branches

## Rollback

If you need to rollback to a previous deployment:
1. Go to Vercel Dashboard → Your Project → Deployments
2. Find the previous working deployment
3. Click "..." → "Promote to Production"

## Support

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment Docs](https://nextjs.org/docs/deployment)
- [Vercel Support](https://vercel.com/support)

## Cost Considerations

- **Hobby Plan**: Free for personal projects
- **Pro Plan**: $20/month for commercial projects
- **Enterprise**: Custom pricing for large-scale applications

Monitor your usage in the Vercel Dashboard to avoid unexpected charges.
