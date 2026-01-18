# Manual Testing Checklist: Authentication UI Restoration

This document provides a comprehensive manual testing checklist for the Authentication UI Restoration feature. Follow these steps to verify all authentication flows work correctly across different roles and modes.

## Prerequisites

Before starting manual testing:
- [ ] Application is running locally or in test environment
- [ ] You have test accounts for: Patient, Doctor, and Admin roles
- [ ] Browser developer tools are available for inspection
- [ ] You can clear browser cache/cookies between tests

## Test Environment Setup

1. **Create Test Accounts** (if not already available):
   - Patient account (Simple Mode)
   - Patient account (Standard Mode)
   - Doctor account
   - Admin account

2. **Browser Setup**:
   - Use incognito/private browsing for clean sessions
   - Test on both desktop and mobile viewports
   - Have browser developer tools ready

---

## Test Suite 1: Patient in Simple Mode

### 1.1 UserButton Visibility
**Requirements: 1.1, 1.2, 1.3, 1.4**

- [ ] **Desktop View**
  - Navigate to `/patient` dashboard
  - Verify UserButton is visible in the sidebar
  - UserButton should have sufficient contrast and size
  - Click UserButton and verify menu appears

- [ ] **Mobile View** (viewport < 768px)
  - Navigate to `/patient` dashboard
  - Verify UserButton is visible in the top header
  - UserButton should be touch-friendly (min 44x44px)
  - Click UserButton and verify menu appears

### 1.2 Settings Navigation from Bottom Nav
**Requirements: 3.1, 3.2, 3.3, 3.4**

- [ ] Navigate to `/patient` dashboard in Simple Mode
- [ ] Verify Bottom Navigation is visible at bottom of screen
- [ ] Verify Settings icon/item is present in Bottom Nav
- [ ] Verify Bottom Nav has maximum 4 items
- [ ] Click Settings item in Bottom Nav
- [ ] Verify navigation to `/patient/settings` page

### 1.3 Logout from Settings Page
**Requirements: 2.1, 2.2, 2.3, 2.4, 2.5**

- [ ] Navigate to `/patient/settings`
- [ ] Verify Logout button is visible and accessible
- [ ] Click Logout button
- [ ] Verify confirmation dialog appears with:
  - Title: "Confirm Logout" (or localized equivalent)
  - Message: "Are you sure you want to logout?"
  - Cancel button
  - Logout button
- [ ] Click Cancel button
- [ ] Verify dialog closes and session is maintained
- [ ] Click Logout button again
- [ ] Click Logout button in confirmation dialog
- [ ] Verify redirect to `/sign-in` page
- [ ] Verify user is logged out (cannot access `/patient` without re-authentication)

### 1.4 Logout from UserButton
**Requirements: 4.1, 4.2, 4.3, 5.1, 5.2, 5.3**

- [ ] Sign in as patient
- [ ] Navigate to `/patient` dashboard
- [ ] Click UserButton (in sidebar on desktop, header on mobile)
- [ ] Click "Sign out" option in UserButton menu
- [ ] Verify redirect to `/sign-in` page
- [ ] Verify user is logged out

---

## Test Suite 2: Patient in Standard Mode

### 2.1 UserButton Visibility
**Requirements: 1.1, 1.2, 1.3**

- [ ] Switch to Standard Mode (if in Simple Mode)
- [ ] **Desktop View**
  - Verify UserButton is visible in the sidebar
  - UserButton should have sufficient contrast and size
  - Click UserButton and verify menu appears

- [ ] **Mobile View**
  - Verify UserButton is visible in the top header
  - Click UserButton and verify menu appears

### 2.2 Settings Access
**Requirements: 2.1**

- [ ] Navigate to `/patient/settings` (via direct URL or navigation)
- [ ] Verify Settings page loads correctly
- [ ] Verify Logout button is visible

### 2.3 Logout Flow
**Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 5.1, 5.2, 5.3**

- [ ] Test logout from settings page (same as 1.3)
- [ ] Test logout from UserButton (same as 1.4)
- [ ] Verify both methods redirect to `/sign-in`

---

## Test Suite 3: Doctor Role

### 3.1 UserButton Visibility
**Requirements: 4.1, 4.2**

- [ ] Sign in as doctor
- [ ] Navigate to `/doctor` dashboard
- [ ] **Desktop View**
  - Verify UserButton is visible in the sidebar user section
  - UserButton should be clearly visible
  - Click UserButton and verify menu appears

- [ ] **Mobile View**
  - Verify UserButton is visible in the top header
  - Click UserButton and verify menu appears

### 3.2 Logout from UserButton
**Requirements: 4.2, 4.3, 5.1, 5.2, 5.4**

- [ ] Click UserButton in sidebar/header
- [ ] Click "Sign out" option in UserButton menu
- [ ] Verify redirect to `/` (home page, not sign-in)
- [ ] Verify user is logged out
- [ ] Verify cannot access `/doctor` without re-authentication

### 3.3 Settings Page Logout (if available)
**Requirements: 5.1, 5.2, 5.4**

- [ ] If doctor has settings page, navigate to it
- [ ] Test logout flow
- [ ] Verify redirect to `/` (home page)

---

## Test Suite 4: Admin Role

### 4.1 UserButton Visibility
**Requirements: 4.1, 4.2**

- [ ] Sign in as admin
- [ ] Navigate to `/admin` dashboard
- [ ] **Desktop View**
  - Verify UserButton is visible in the sidebar
  - Click UserButton and verify menu appears

- [ ] **Mobile View**
  - Verify UserButton is visible in the top header
  - Click UserButton and verify menu appears

### 4.2 Logout from UserButton
**Requirements: 4.2, 4.3, 5.1, 5.2, 5.4**

- [ ] Click UserButton in sidebar/header
- [ ] Click "Sign out" option in UserButton menu
- [ ] Verify redirect to `/` (home page, not sign-in)
- [ ] Verify user is logged out
- [ ] Verify cannot access `/admin` without re-authentication

---

## Test Suite 5: Sign-In Access from Public Pages

### 5.1 Public Home Page
**Requirements: 6.1, 6.2**

- [ ] Log out completely (clear session)
- [ ] Navigate to `/` (public home page)
- [ ] Verify page loads without authentication
- [ ] Verify Sign In button/link is visible in navigation
- [ ] Verify Sign In button/link is visible in hero section
- [ ] Verify Sign In button/link is visible in CTA section
- [ ] Count total sign-in access points (should be at least 2-3)

### 5.2 Navigation to Sign-In Page
**Requirements: 6.2**

- [ ] Click Sign In button in navigation
- [ ] Verify navigation to `/sign-in` page
- [ ] Verify Clerk sign-in form is displayed
- [ ] Go back to home page
- [ ] Click Sign In button in hero section
- [ ] Verify navigation to `/sign-in` page

### 5.3 Sign-In and Dashboard Redirect
**Requirements: 6.3, 6.4, 6.5**

- [ ] **Patient Sign-In**
  - Navigate to `/sign-in`
  - Sign in with patient credentials
  - Verify redirect to `/patient` dashboard
  - Verify patient dashboard loads correctly

- [ ] **Doctor Sign-In**
  - Log out
  - Navigate to `/sign-in`
  - Sign in with doctor credentials
  - Verify redirect to `/doctor` dashboard
  - Verify doctor dashboard loads correctly

- [ ] **Admin Sign-In**
  - Log out
  - Navigate to `/sign-in`
  - Sign in with admin credentials
  - Verify redirect to `/admin` dashboard
  - Verify admin dashboard loads correctly

---

## Test Suite 6: Error Handling

### 6.1 Logout Error Handling
**Requirements: 5.5**

- [ ] Sign in as patient
- [ ] Navigate to `/patient/settings`
- [ ] Disconnect network (or use browser dev tools to simulate offline)
- [ ] Click Logout button
- [ ] Click Confirm in dialog
- [ ] Verify error toast/message appears
- [ ] Verify session is maintained (user still logged in)
- [ ] Verify dialog closes
- [ ] Reconnect network
- [ ] Try logout again and verify it works

### 6.2 Sign-In Error Handling

- [ ] Navigate to `/sign-in`
- [ ] Try signing in with invalid credentials
- [ ] Verify Clerk displays appropriate error message
- [ ] Verify user remains on sign-in page

---

## Test Suite 7: Cross-Browser Testing

Repeat key tests across different browsers:

### 7.1 Chrome/Edge
- [ ] Patient logout from settings (Test 1.3)
- [ ] Doctor logout from UserButton (Test 3.2)
- [ ] Sign-in access from public page (Test 5.1)

### 7.2 Firefox
- [ ] Patient logout from settings (Test 1.3)
- [ ] Doctor logout from UserButton (Test 3.2)
- [ ] Sign-in access from public page (Test 5.1)

### 7.3 Safari (if available)
- [ ] Patient logout from settings (Test 1.3)
- [ ] Doctor logout from UserButton (Test 3.2)
- [ ] Sign-in access from public page (Test 5.1)

---

## Test Suite 8: Responsive Design Testing

### 8.1 Mobile Devices (< 768px)
- [ ] Test UserButton visibility in header
- [ ] Test Bottom Nav settings navigation
- [ ] Test logout confirmation dialog (should be mobile-friendly)
- [ ] Test sign-in buttons on public page

### 8.2 Tablet Devices (768px - 1024px)
- [ ] Test UserButton visibility
- [ ] Test logout flows
- [ ] Test sign-in access

### 8.3 Desktop (> 1024px)
- [ ] Test UserButton visibility in sidebar
- [ ] Test logout flows
- [ ] Test sign-in access

---

## Test Suite 9: Accessibility Testing

### 9.1 Keyboard Navigation
- [ ] Navigate to UserButton using Tab key
- [ ] Open UserButton menu using Enter/Space
- [ ] Navigate through menu items using arrow keys
- [ ] Activate logout using Enter/Space
- [ ] Navigate through confirmation dialog using Tab
- [ ] Confirm/Cancel using Enter/Space

### 9.2 Screen Reader Testing (if available)
- [ ] Verify UserButton has appropriate aria-label
- [ ] Verify logout button is announced correctly
- [ ] Verify confirmation dialog is announced
- [ ] Verify sign-in buttons have descriptive labels

---

## Test Results Summary

After completing all tests, fill out this summary:

### Passed Tests
- Total tests passed: _____ / _____
- Critical issues found: _____
- Minor issues found: _____

### Failed Tests
List any failed tests with details:

1. Test: _______________
   - Expected: _______________
   - Actual: _______________
   - Severity: Critical / Major / Minor

2. Test: _______________
   - Expected: _______________
   - Actual: _______________
   - Severity: Critical / Major / Minor

### Browser Compatibility
- Chrome/Edge: ✓ / ✗
- Firefox: ✓ / ✗
- Safari: ✓ / ✗

### Device Compatibility
- Mobile: ✓ / ✗
- Tablet: ✓ / ✗
- Desktop: ✓ / ✗

### Overall Assessment
- [ ] All critical tests passed
- [ ] Ready for production
- [ ] Requires fixes before deployment

### Notes
Add any additional observations or recommendations:

---

## Reporting Issues

If you find any issues during manual testing:

1. **Document the issue**:
   - Test case number
   - Steps to reproduce
   - Expected behavior
   - Actual behavior
   - Screenshots/videos if applicable
   - Browser/device information

2. **Severity classification**:
   - **Critical**: Feature completely broken, blocks user flow
   - **Major**: Feature partially broken, workaround available
   - **Minor**: Cosmetic issue, doesn't affect functionality

3. **Report to development team** with all documentation

---

## Sign-Off

**Tester Name**: _______________
**Date**: _______________
**Signature**: _______________

**Approved for Production**: Yes / No

**Approver Name**: _______________
**Date**: _______________
**Signature**: _______________
