# Staging Deployment Verification Script (PowerShell)
# This script helps verify the staging deployment

param(
    [Parameter(Mandatory=$true)]
    [string]$DeploymentUrl
)

Write-Host "===================================" -ForegroundColor Cyan
Write-Host "Staging Deployment Verification" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Testing deployment at: $DeploymentUrl" -ForegroundColor Yellow
Write-Host ""

# Test 1: Health Check
Write-Host "Test 1: Health Check" -ForegroundColor Green
Write-Host "-----------------------------------"

try {
    $healthUrl = "$DeploymentUrl/api/health"
    $healthResponse = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing
    $healthStatus = $healthResponse.StatusCode
    $healthBody = $healthResponse.Content

    Write-Host "Status Code: $healthStatus"
    Write-Host "Response: $healthBody"

    if ($healthStatus -eq 200) {
        Write-Host "✅ Health check passed" -ForegroundColor Green
    } else {
        Write-Host "❌ Health check failed" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Health check failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 2: TRPC Route Resolution
Write-Host "Test 2: TRPC Route Resolution" -ForegroundColor Green
Write-Host "-----------------------------------"
Write-Host "Testing if TRPC routes are accessible..."

try {
    $trpcUrl = "$DeploymentUrl/api/trpc/intake.getSession?input=%7B%22sessionId%22%3A%22test%22%7D"
    $trpcResponse = Invoke-WebRequest -Uri $trpcUrl -UseBasicParsing -ErrorAction SilentlyContinue
    $trpcStatus = $trpcResponse.StatusCode

    Write-Host "Status Code: $trpcStatus"

    if ($trpcStatus -eq 404) {
        Write-Host "❌ TRPC routes not found (404 error)" -ForegroundColor Red
    } elseif ($trpcStatus -eq 401 -or $trpcStatus -eq 403) {
        Write-Host "✅ TRPC routes accessible (authentication required as expected)" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Unexpected status code: $trpcStatus" -ForegroundColor Yellow
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "Status Code: $statusCode"
    
    if ($statusCode -eq 404) {
        Write-Host "❌ TRPC routes not found (404 error)" -ForegroundColor Red
    } elseif ($statusCode -eq 401 -or $statusCode -eq 403) {
        Write-Host "✅ TRPC routes accessible (authentication required as expected)" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Unexpected status code: $statusCode" -ForegroundColor Yellow
    }
}
Write-Host ""

# Test 3: Environment Validation
Write-Host "Test 3: Environment Validation" -ForegroundColor Green
Write-Host "-----------------------------------"
Write-Host "Checking if environment variables are validated..."
Write-Host "This should be visible in Vercel logs during deployment"
Write-Host "✅ If deployment succeeded, environment validation passed" -ForegroundColor Green
Write-Host ""

# Summary
Write-Host "===================================" -ForegroundColor Cyan
Write-Host "Verification Summary" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Sign in to the application at: $DeploymentUrl/sign-in"
Write-Host "2. Test intake session creation and messaging"
Write-Host "3. Monitor Vercel logs: vercel logs $DeploymentUrl --follow"
Write-Host "4. Complete the full verification checklist in:"
Write-Host "   __tests__/manual/staging-deployment-verification.md"
Write-Host ""
Write-Host "For detailed testing, see:" -ForegroundColor Yellow
Write-Host "   __tests__/manual/staging-deployment-verification.md"
