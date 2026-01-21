#!/bin/bash

# Staging Deployment Verification Script
# This script helps verify the staging deployment

echo "==================================="
echo "Staging Deployment Verification"
echo "==================================="
echo ""

# Check if deployment URL is provided
if [ -z "$1" ]; then
    echo "Usage: ./scripts/verify-staging.sh <deployment-url>"
    echo "Example: ./scripts/verify-staging.sh https://your-project-abc123.vercel.app"
    exit 1
fi

DEPLOYMENT_URL=$1

echo "Testing deployment at: $DEPLOYMENT_URL"
echo ""

# Test 1: Health Check
echo "Test 1: Health Check"
echo "-----------------------------------"
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$DEPLOYMENT_URL/api/health")
HEALTH_BODY=$(echo "$HEALTH_RESPONSE" | head -n -1)
HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | tail -n 1)

echo "Status Code: $HEALTH_STATUS"
echo "Response: $HEALTH_BODY"

if [ "$HEALTH_STATUS" = "200" ]; then
    echo "✅ Health check passed"
else
    echo "❌ Health check failed"
fi
echo ""

# Test 2: TRPC Route Resolution
echo "Test 2: TRPC Route Resolution"
echo "-----------------------------------"
echo "Testing if TRPC routes are accessible..."

# Test with an unauthenticated request (should return 401, not 404)
TRPC_RESPONSE=$(curl -s -w "\n%{http_code}" "$DEPLOYMENT_URL/api/trpc/intake.getSession?input=%7B%22sessionId%22%3A%22test%22%7D")
TRPC_STATUS=$(echo "$TRPC_RESPONSE" | tail -n 1)

echo "Status Code: $TRPC_STATUS"

if [ "$TRPC_STATUS" = "404" ]; then
    echo "❌ TRPC routes not found (404 error)"
elif [ "$TRPC_STATUS" = "401" ] || [ "$TRPC_STATUS" = "403" ]; then
    echo "✅ TRPC routes accessible (authentication required as expected)"
else
    echo "⚠️  Unexpected status code: $TRPC_STATUS"
fi
echo ""

# Test 3: Environment Validation
echo "Test 3: Environment Validation"
echo "-----------------------------------"
echo "Checking if environment variables are validated..."
echo "This should be visible in Vercel logs during deployment"
echo "✅ If deployment succeeded, environment validation passed"
echo ""

# Summary
echo "==================================="
echo "Verification Summary"
echo "==================================="
echo ""
echo "Next Steps:"
echo "1. Sign in to the application at: $DEPLOYMENT_URL/sign-in"
echo "2. Test intake session creation and messaging"
echo "3. Monitor Vercel logs: vercel logs $DEPLOYMENT_URL --follow"
echo "4. Complete the full verification checklist in:"
echo "   __tests__/manual/staging-deployment-verification.md"
echo ""
echo "For detailed testing, see:"
echo "   __tests__/manual/staging-deployment-verification.md"
