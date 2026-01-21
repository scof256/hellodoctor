# Task 16.2: End-to-End Testing Guide
## Doctor Intake Immersive Interface

This document provides a comprehensive testing guide for the doctor intake immersive interface feature.

## Overview

The doctor intake immersive interface has been fully implemented with all core components wired together. This guide outlines the end-to-end flows that need to be tested to ensure the feature works correctly.

## Prerequisites

Before testing, ensure:
1. Database migrations have been run (0011_add-context-layer.sql, 0012_patient-intake-immutability.sql)
2. A test patient account exists with an active intake session
3. A test doctor account exists with access to the patient connection
4. The development server is running

## Test Flows

### Flow 1: Doctor Navigates to Intake Page

**Steps:**
1. Log in as a doctor
2. Navigate to `/doctor/patients`
3. Click on a patient with an active intake session
4. Click "View Intake" or navigate to `/doctor/patients/[connectionId]/intake`

**Expected Results:**
- ✅ Page loads successfully
- ✅ Loading skeleton displays while data is fetching
- ✅ Patient name and avatar display in header
- ✅ Stage progress indicator shows current stage and completeness percentage
- ✅ Connection status indicator shows "Connected" (green Wifi icon)
- ✅ "Mark as Reviewed" button appears if session status is "ready"
- ✅ Mobile sidebar toggle button appears on mobile devices

**Components Involved:**
- `DoctorIntakePage` (server component)
- `DoctorIntakeInterface` (client component)
- `PollingService` (real-time updates)

---

### Flow 2: Doctor Views Patient Messages

**Steps:**
1. Navigate to intake page (Flow 1)
2. Scroll through the message list in the chat interface

**Expected Results:**
- ✅ Messages display in chronological order (oldest to newest)
- ✅ Patient messages have gray background and are read-only
- ✅ Doctor messages have purple background
- ✅ Message timestamps display correctly
- ✅ Different message types have visual indicators:
  - Test results show with FileText icon
  - Exam findings show with Activity icon
  - Images display inline
- ✅ Auto-scroll to newest messages on initial load
- ✅ Scroll position preserved during real-time updates

**Components Involved:**
- `IntakeChatInterface`
- Message rendering logic

---

### Flow 3: Doctor Adds Test Result

**Steps:**
1. Navigate to intake page (Flow 1)
2. Click the "Test Result" button in the message input area
3. Fill in the test result modal:
   - Test Type: "Complete Blood Count"
   - Results: "WBC: 8.5, RBC: 4.8, Hemoglobin: 14.2"
4. Click "Add Test Result"

**Expected Results:**
- ✅ Modal opens with test result form
- ✅ Form fields are required and validated
- ✅ Submit button is disabled until both fields are filled
- ✅ Modal closes after successful submission
- ✅ Success toast notification appears
- ✅ New message appears in chat with test result formatting
- ✅ Message has purple background (doctor enhancement)
- ✅ Message has FileText icon indicator
- ✅ SBAR regenerates automatically (check sidebar)
- ✅ Clinical reasoning updates (check sidebar)

**Components Involved:**
- `MessageInput`
- `TestResultModal`
- `Toast` component
- tRPC `addMessage` mutation

---

### Flow 4: Doctor Adds Exam Finding

**Steps:**
1. Navigate to intake page (Flow 1)
2. Click the "Exam Finding" button in the message input area
3. Fill in the exam finding modal:
   - Body System: "Cardiovascular"
   - Findings: "Regular rate and rhythm, no murmurs, S1 and S2 normal"
4. Click "Add Exam Finding"

**Expected Results:**
- ✅ Modal opens with exam finding form
- ✅ Body system dropdown has predefined options
- ✅ Form fields are required and validated
- ✅ Submit button is disabled until both fields are filled
- ✅ Modal closes after successful submission
- ✅ Success toast notification appears
- ✅ New message appears in chat with exam finding formatting
- ✅ Message has purple background (doctor enhancement)
- ✅ Message has Activity icon indicator
- ✅ SBAR regenerates automatically (check sidebar)
- ✅ Clinical reasoning updates (check sidebar)

**Components Involved:**
- `MessageInput`
- `ExamFindingModal`
- `Toast` component
- tRPC `addMessage` mutation

---

### Flow 5: Doctor Uploads Image

**Steps:**
1. Navigate to intake page (Flow 1)
2. Click the "Image" button in the message input area
3. Select a valid image file (JPEG, PNG, or PDF under 8MB)
4. Wait for upload to complete

**Expected Results:**
- ✅ File picker opens
- ✅ Upload progress bar displays during upload
- ✅ Progress percentage updates in real-time
- ✅ Success toast notification appears after upload
- ✅ Image message appears in chat
- ✅ Image displays inline in the message
- ✅ Message has purple background (doctor enhancement)
- ✅ SBAR regenerates automatically (check sidebar)

**Error Cases to Test:**
- ✅ Invalid file type (e.g., .txt) shows error toast
- ✅ File too large (>8MB) shows error toast
- ✅ Upload failure shows error toast with retry option

**Components Involved:**
- `MessageInput`
- `useUploadThing` hook
- `Toast` component
- tRPC `addImageMessage` mutation

---

### Flow 6: Doctor Sends Text Message

**Steps:**
1. Navigate to intake page (Flow 1)
2. Type a message in the text input area
3. Press Ctrl+Enter or click "Send" button

**Expected Results:**
- ✅ Textarea auto-resizes as content grows (max 200px)
- ✅ Draft auto-saves every 2 seconds (check save indicator)
- ✅ Save status indicator shows "Saving..." then "Saved"
- ✅ Character count displays when typing
- ✅ Send button is disabled when input is empty
- ✅ Loading state shows while sending
- ✅ Success toast notification appears
- ✅ Message appears in chat with purple background
- ✅ Draft is cleared after successful send
- ✅ Input field is cleared
- ✅ SBAR regenerates automatically (check sidebar)

**Components Involved:**
- `MessageInput`
- `DraftPersistenceService`
- `Toast` component
- tRPC `addMessage` mutation

---

### Flow 7: SBAR Updates in Real-Time

**Steps:**
1. Navigate to intake page (Flow 1)
2. Open the medical sidebar (click "Medical Data" on mobile)
3. Switch to "Dr. Handover" tab
4. Add a test result or exam finding (Flow 3 or 4)
5. Wait for SBAR to regenerate

**Expected Results:**
- ✅ SBAR section displays with four color-coded cards:
  - Situation (blue)
  - Background (green)
  - Assessment (yellow/amber)
  - Recommendation (red)
- ✅ "Updating analysis..." message shows during regeneration
- ✅ Loading spinner displays during regeneration
- ✅ SBAR content updates after regeneration completes
- ✅ Timestamp updates to show "just now" or time since last update
- ✅ Copy button copies SBAR to clipboard
- ✅ Export button downloads SBAR as text file
- ✅ Scroll position is preserved during update (within 50px tolerance)

**Components Involved:**
- `MedicalSidebar`
- `SBARDisplay` (from existing components)
- `PollingService`
- tRPC `getSBAR` query

---

### Flow 8: Clinical Reasoning Updates

**Steps:**
1. Navigate to intake page (Flow 1)
2. Open the medical sidebar
3. Switch to "Dr. Handover" tab
4. Observe the Clinical Reasoning section

**Expected Results:**
- ✅ Clinical Reasoning section displays above SBAR
- ✅ Section is collapsible (click header to expand/collapse)
- ✅ Loading state shows "Generating clinical analysis..." when updating
- ✅ Clinical Strategy displays as narrative text
- ✅ Differential Diagnosis displays as ranked list with:
  - Condition name
  - Probability badge (High/Medium/Low with color coding)
  - Likelihood bar (visual indicator)
  - Reasoning text
- ✅ Missing Information displays with red flag icon
- ✅ Recommended Next Steps displays with lightbulb icon
- ✅ Content updates in real-time via polling

**Components Involved:**
- `MedicalSidebar`
- `ClinicalReasoning`
- `PollingService`
- tRPC `getClinicalReasoning` query

---

### Flow 9: Mark as Reviewed

**Steps:**
1. Navigate to intake page with session status "ready" (Flow 1)
2. Click "Mark as Reviewed" button in header
3. Wait for mutation to complete

**Expected Results:**
- ✅ Button shows loading spinner during mutation
- ✅ Button is disabled during mutation
- ✅ Success state updates immediately
- ✅ Button changes to "Reviewed" badge with checkmark icon
- ✅ Badge has blue background
- ✅ Session status updates in database
- ✅ Review timestamp is recorded
- ✅ Reviewing doctor is recorded
- ✅ Button no longer clickable after review

**Components Involved:**
- `DoctorIntakeInterface`
- tRPC `markAsReviewed` mutation

---

### Flow 10: Real-Time Polling

**Steps:**
1. Navigate to intake page (Flow 1)
2. Observe the connection status indicator
3. Wait for polling to occur (every 3 seconds)
4. Simulate network failure (disconnect internet)
5. Wait for error state
6. Reconnect internet
7. Click "Reconnect" button

**Expected Results:**
- ✅ Connection status shows "Connected" (green Wifi icon) when active
- ✅ Connection status shows "Connecting..." (spinning loader) during poll
- ✅ Polling occurs every 3 seconds (Requirement 8.1)
- ✅ New messages appear automatically without refresh
- ✅ SBAR updates automatically without refresh
- ✅ Clinical reasoning updates automatically without refresh
- ✅ Error banner appears when connection fails:
  - Red background
  - "Connection Lost" message
  - Error details displayed
  - "Reconnect" button visible
- ✅ Exponential backoff occurs on repeated failures
- ✅ Polling stops after max retries (5)
- ✅ Manual reconnect button restarts polling
- ✅ Error banner dismisses when connection restored

**Components Involved:**
- `DoctorIntakeInterface`
- `PollingService`
- `ErrorBanner` (warning banner)

---

### Flow 11: Draft Persistence

**Steps:**
1. Navigate to intake page (Flow 1)
2. Type a message in the text input
3. Wait 2 seconds (debounce period)
4. Observe save status indicator
5. Refresh the page
6. Check if draft is restored

**Expected Results:**
- ✅ Save status shows "Saving..." while saving
- ✅ Save status shows "Saved" with checkmark after save
- ✅ Draft persists to local storage
- ✅ Draft is restored on page reload
- ✅ Draft expires after 24 hours
- ✅ Draft is cleared after successful message send
- ✅ Warning toast appears if local storage is unavailable

**Components Involved:**
- `MessageInput`
- `DraftPersistenceService`
- `Toast` component

---

### Flow 12: Mobile Sidebar Behavior

**Steps:**
1. Navigate to intake page on mobile device or resize browser to mobile width (<768px)
2. Click "Medical Data" button in header
3. Observe sidebar slide-out animation
4. Click outside sidebar (overlay)
5. Observe sidebar slide-in animation

**Expected Results:**
- ✅ Sidebar is hidden by default on mobile
- ✅ "Medical Data" button is visible in header
- ✅ Clicking button opens sidebar with smooth slide-out animation
- ✅ Sidebar overlays the chat interface
- ✅ Dark overlay appears behind sidebar
- ✅ Clicking overlay closes sidebar
- ✅ Close button (X) appears in sidebar header
- ✅ Clicking close button closes sidebar
- ✅ Sidebar width is full screen on small mobile, 384px on larger mobile
- ✅ Smooth transitions (300ms duration)

**Components Involved:**
- `DoctorIntakeInterface`
- `MedicalSidebar`

---

### Flow 13: Desktop Layout

**Steps:**
1. Navigate to intake page on desktop (>1024px width)
2. Observe the two-column layout

**Expected Results:**
- ✅ Chat interface occupies left column (flexible width)
- ✅ Medical sidebar occupies right column (fixed 400px width)
- ✅ Sidebar is always visible (not slide-out)
- ✅ No mobile toggle button visible
- ✅ No overlay behind sidebar
- ✅ Smooth transitions between tabs
- ✅ Stage progress shows full horizontal stepper
- ✅ All button labels are visible (not icon-only)

**Components Involved:**
- `DoctorIntakeInterface`
- `MedicalSidebar`

---

### Flow 14: Touch Target Accessibility (Mobile)

**Steps:**
1. Navigate to intake page on mobile device
2. Test all interactive elements with touch

**Expected Results:**
- ✅ All buttons meet 44x44px minimum touch target size:
  - Back button
  - Sidebar toggle button
  - Mark as reviewed button
  - Reconnect button
  - Message input action buttons (Image, Test Result, Exam Finding)
  - Send button
  - Modal close buttons
  - Modal action buttons (Cancel, Submit)
  - Tab buttons
  - Section collapse buttons
- ✅ Touch targets have adequate spacing
- ✅ No accidental taps on adjacent elements
- ✅ Buttons provide visual feedback on tap (hover states)

**Components Involved:**
- All interactive components

---

### Flow 15: Keyboard Interactions

**Steps:**
1. Navigate to intake page
2. Test keyboard shortcuts and navigation

**Expected Results:**
- ✅ Ctrl+Enter sends message from textarea
- ✅ Tab key navigates through interactive elements
- ✅ Enter key activates focused buttons
- ✅ Escape key closes modals
- ✅ Textarea maintains focus after typing
- ✅ Mobile keyboard doesn't break layout

**Components Involved:**
- `MessageInput`
- Modal components

---

### Flow 16: Error Handling

**Steps:**
1. Test various error scenarios

**Scenarios to Test:**

**A. Message Send Failure:**
- Disconnect internet
- Try to send a message
- Expected: Error toast with retry option

**B. Image Upload Failure:**
- Upload invalid file type
- Expected: Error toast with clear message

**C. Polling Failure:**
- Disconnect internet during active session
- Expected: Error banner with reconnect button

**D. API Errors:**
- Simulate 500 error from backend
- Expected: Error toast with user-friendly message

**Expected Results:**
- ✅ All errors display user-friendly messages
- ✅ Error messages include retry buttons where appropriate
- ✅ Toast notifications auto-dismiss after 5 seconds
- ✅ Error banners persist until resolved
- ✅ No console errors visible to user
- ✅ Application remains functional after errors

**Components Involved:**
- `ErrorBanner`
- `InlineError`
- `Toast` component
- `ErrorComponents`

---

### Flow 17: Loading States

**Steps:**
1. Test all loading states

**Scenarios to Test:**

**A. Initial Page Load:**
- Navigate to intake page
- Expected: Loading skeleton displays

**B. Message Submission:**
- Send a message
- Expected: Send button shows loading spinner

**C. Image Upload:**
- Upload an image
- Expected: Progress bar displays with percentage

**D. SBAR Generation:**
- Add test result
- Expected: "Updating analysis..." message displays

**E. Clinical Reasoning:**
- Wait for reasoning to generate
- Expected: Loading spinner with "Generating clinical analysis..." message

**Expected Results:**
- ✅ All loading states display appropriate indicators
- ✅ Loading states prevent duplicate actions
- ✅ Loading states provide feedback on progress
- ✅ No blank screens during loading
- ✅ Skeleton screens match final layout

**Components Involved:**
- `MessageListSkeleton`
- `MessageInput`
- `SBARDisplay`
- `ClinicalReasoning`

---

## Performance Testing

### Metrics to Verify:

1. **Initial Page Load:**
   - Time to first contentful paint < 2 seconds
   - Time to interactive < 3 seconds

2. **Real-Time Updates:**
   - Polling interval exactly 3 seconds
   - Update latency < 500ms after poll completes

3. **Message Rendering:**
   - Smooth scrolling with 100+ messages
   - No jank during auto-scroll

4. **Mobile Performance:**
   - Sidebar animations smooth (60fps)
   - Touch interactions responsive (<100ms)

---

## Browser Compatibility

Test on:
- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)
- ✅ Mobile Safari (iOS)
- ✅ Chrome Mobile (Android)

---

## Accessibility Testing

### Screen Reader Testing:
- ✅ All interactive elements have aria-labels
- ✅ Loading states announced to screen readers
- ✅ Error messages announced to screen readers
- ✅ SBAR updates announced to screen readers

### Keyboard Navigation:
- ✅ All functionality accessible via keyboard
- ✅ Focus indicators visible
- ✅ Tab order logical

### Color Contrast:
- ✅ All text meets WCAG AA standards (4.5:1 for normal text)
- ✅ Color-coded elements have additional indicators (not color-only)

---

## Database Verification

After testing, verify in database:

1. **Context Layer Separation:**
   ```sql
   SELECT id, content, "contextLayer", "messageType"
   FROM chat_messages
   WHERE "connectionId" = '[test-connection-id]'
   ORDER BY "createdAt" DESC;
   ```
   - ✅ Patient messages have contextLayer = 'patient-intake'
   - ✅ Doctor messages have contextLayer = 'doctor-enhancement'

2. **Immutability:**
   - Try to update a patient-intake message
   - Expected: Database trigger prevents update

3. **Session Status:**
   ```sql
   SELECT id, status, "reviewedAt", "reviewedBy"
   FROM intake_sessions
   WHERE id = '[test-session-id]';
   ```
   - ✅ Status updates to 'reviewed' after marking
   - ✅ reviewedAt timestamp is set
   - ✅ reviewedBy contains doctor user ID

---

## Known Issues / Limitations

Document any issues found during testing:

1. [Issue description]
   - Steps to reproduce
   - Expected behavior
   - Actual behavior
   - Severity (Critical/High/Medium/Low)

---

## Sign-Off

After completing all test flows, sign off on the feature:

- [ ] All critical flows tested and passing
- [ ] All error scenarios handled gracefully
- [ ] All loading states display correctly
- [ ] Mobile and desktop layouts work correctly
- [ ] Performance metrics meet requirements
- [ ] Accessibility requirements met
- [ ] Database verification complete
- [ ] No critical bugs found

**Tested By:** _______________
**Date:** _______________
**Notes:** _______________

