# Manual QA and Visual Verification Guide
## Intake Interface Enhancements

**Feature:** intake-interface-enhancements  
**Date:** January 22, 2026  
**Status:** Ready for Manual Testing

---

## Overview

This guide provides step-by-step instructions for manually testing the intake interface enhancements. The testing covers vitals collection, triage decisions, chat layout fixes, medical sidebar display, emergency alerts, and responsive behavior across different devices.

---

## Prerequisites

Before starting manual testing:

1. ✅ Ensure the development server is running (`npm run dev`)
2. ✅ Have test accounts ready:
   - Patient account (for intake flow)
   - Doctor account (for reviewing intake sessions)
3. ✅ Access to multiple devices/browsers:
   - Desktop browser (Chrome, Firefox, Safari)
   - Mobile device or browser dev tools (responsive mode)
   - Tablet (optional but recommended)
4. ✅ Clear browser cache and cookies before testing
5. ✅ Have a thermometer, blood pressure monitor (or test values) ready

---

## Test Scenarios

### 1. Vitals Collection on Different Devices

#### 1.1 Desktop Testing (≥1024px)

**Objective:** Verify vitals collection interface works properly on desktop screens

**Steps:**
1. Open browser in desktop mode (full screen, ≥1024px width)
2. Sign in as a patient
3. Navigate to patient home and start a new intake session
4. Observe the vitals collection interface

**Expected Results:**
- ✅ Vitals collection interface displays automatically on session start
- ✅ Progress indicator shows current step (e.g., "Step 1 of 6")
- ✅ Form fields are clearly labeled with placeholders
- ✅ Required fields (Name, Age, Gender) are marked with asterisks
- ✅ Optional fields (Temperature, Weight, BP) have "I don't have it" buttons
- ✅ Unit selection dropdowns are visible for temperature (°C/°F) and weight (kg/lbs)
- ✅ Input fields use appropriate types (text, number, select, radio)
- ✅ Layout is clean and not cramped
- ✅ All buttons are easily clickable

**Test Data:**
- Name: "John Doe"
- Age: 35
- Gender: Male
- Temperature: 37.5°C
- Weight: 75 kg
- Blood Pressure: 120/80 mmHg

**Screenshot Checklist:**
- [ ] Initial vitals collection screen
- [ ] Progress indicator at each step
- [ ] Unit selection dropdowns
- [ ] Completed vitals form

---

#### 1.2 Mobile Testing (≤768px)

**Objective:** Verify vitals collection interface is mobile-friendly

**Steps:**
1. Open browser in mobile mode (375px width - iPhone SE size)
2. Sign in as a patient
3. Start a new intake session
4. Complete vitals collection

**Expected Results:**
- ✅ Interface adapts to mobile screen size
- ✅ Form fields stack vertically
- ✅ Touch targets are at least 44x44px
- ✅ Progress indicator is visible and readable
- ✅ Keyboard doesn't obscure input fields
- ✅ "I don't have it" buttons are easily tappable
- ✅ Unit dropdowns work on mobile
- ✅ No horizontal scrolling required
- ✅ Submit button is always visible

**Test Data:**
- Name: "Jane Smith"
- Age: 28
- Gender: Female
- Skip all optional vitals

**Screenshot Checklist:**
- [ ] Mobile vitals collection screen
- [ ] Keyboard interaction
- [ ] Skip buttons on mobile
- [ ] Completed state on mobile

---

#### 1.3 Tablet Testing (768px - 1024px)

**Objective:** Verify vitals collection works on tablet screens

**Steps:**
1. Open browser in tablet mode (768px width - iPad size)
2. Test in both portrait and landscape orientations
3. Complete vitals collection flow

**Expected Results:**
- ✅ Layout adapts appropriately for tablet size
- ✅ Form is readable in both orientations
- ✅ Touch interactions work smoothly
- ✅ Progress indicator remains visible

**Screenshot Checklist:**
- [ ] Tablet portrait view
- [ ] Tablet landscape view

---

### 2. Chat Layout Fix Verification

#### 2.1 Desktop Chat Layout

**Objective:** Verify chat messages are not hidden under input section on desktop

**Steps:**
1. Open doctor intake interface on desktop
2. Navigate to an active intake session with multiple messages
3. Scroll through the conversation
4. Type a long message in the input area
5. Send multiple messages quickly

**Expected Results:**
- ✅ All message bubbles are visible above the input section
- ✅ No messages are hidden or obscured by the input area
- ✅ Messages container is scrollable independently
- ✅ Input section stays fixed at the bottom
- ✅ Z-index layering is correct (input above background, not above messages)
- ✅ Auto-scroll works and newest message is fully visible
- ✅ Proper spacing between last message and input section (padding visible)

**Visual Checks:**
- [ ] Scroll to top - all messages visible
- [ ] Scroll to bottom - last message not hidden
- [ ] Input section doesn't overlap messages
- [ ] Proper height calculation for messages container

**Screenshot Checklist:**
- [ ] Full conversation view
- [ ] Bottom of conversation with input visible
- [ ] Long message in input area

---

#### 2.2 Mobile Chat Layout

**Objective:** Verify chat layout works on mobile devices

**Steps:**
1. Open doctor intake interface on mobile (375px width)
2. View an intake session with 20+ messages
3. Test scrolling behavior
4. Open mobile keyboard by focusing input

**Expected Results:**
- ✅ Messages are fully visible on mobile
- ✅ Input section adapts to mobile keyboard
- ✅ Scrolling works smoothly
- ✅ No overlap between messages and input
- ✅ Auto-scroll positions correctly on mobile
- ✅ Messages container adjusts when keyboard appears

**Screenshot Checklist:**
- [ ] Mobile chat view without keyboard
- [ ] Mobile chat view with keyboard open
- [ ] Scrolling behavior on mobile

---

#### 2.3 Responsive Resize Testing

**Objective:** Verify layout maintains integrity during viewport changes

**Steps:**
1. Open chat interface at desktop size (1920px)
2. Slowly resize browser window down to mobile size (375px)
3. Observe layout changes at each breakpoint
4. Resize back up to desktop

**Expected Results:**
- ✅ Layout transitions smoothly at breakpoints
- ✅ No sudden jumps or overlaps during resize
- ✅ Messages remain visible throughout resize
- ✅ Input section maintains proper position
- ✅ Spacing adjusts appropriately

**Screenshot Checklist:**
- [ ] Layout at 1920px
- [ ] Layout at 1024px
- [ ] Layout at 768px
- [ ] Layout at 375px

---

### 3. Emergency Alert Display and Interaction

#### 3.1 Emergency Temperature Detection

**Objective:** Test emergency alert for high/low temperature

**Steps:**
1. Start new intake session as patient
2. Enter vitals with emergency temperature:
   - High: 40°C (104°F)
   - Low: 34°C (93.2°F)
3. Submit vitals

**Expected Results:**
- ✅ Emergency alert displays immediately after submission
- ✅ Alert shows prominent red/urgent styling
- ✅ Specific temperature indicator is shown
- ✅ Recommendations for immediate action are displayed
- ✅ "Acknowledge" button is present and functional
- ✅ Normal intake progression is blocked until acknowledged
- ✅ Alert is visible to both patient and doctor views

**Test Cases:**
- [ ] Temperature 40°C - High emergency
- [ ] Temperature 34°C - Low emergency
- [ ] Temperature 39.6°C - Just above threshold
- [ ] Temperature 34.9°C - Just below threshold

**Screenshot Checklist:**
- [ ] Emergency alert for high temperature
- [ ] Emergency alert for low temperature
- [ ] Alert on patient view
- [ ] Alert on doctor view

---

#### 3.2 Emergency Blood Pressure Detection

**Objective:** Test emergency alert for abnormal blood pressure

**Steps:**
1. Start new intake session
2. Enter vitals with emergency blood pressure:
   - High systolic: 185/80 mmHg
   - Low systolic: 85/70 mmHg
   - High diastolic: 120/125 mmHg
   - Low diastolic: 120/55 mmHg
3. Submit vitals

**Expected Results:**
- ✅ Emergency alert displays for each condition
- ✅ Specific blood pressure indicator is shown
- ✅ Appropriate recommendations are provided
- ✅ Alert styling is urgent and prominent

**Test Cases:**
- [ ] Systolic 185 mmHg - High emergency
- [ ] Systolic 85 mmHg - Low emergency
- [ ] Diastolic 125 mmHg - High emergency
- [ ] Diastolic 55 mmHg - Low emergency

**Screenshot Checklist:**
- [ ] High systolic BP alert
- [ ] Low systolic BP alert
- [ ] High diastolic BP alert
- [ ] Low diastolic BP alert

---

#### 3.3 Emergency Symptom Detection

**Objective:** Test emergency alert for critical symptoms

**Steps:**
1. Start new intake session
2. Enter normal vitals
3. In the "Current Status" field, enter critical symptoms:
   - "severe chest pain"
   - "difficulty breathing"
   - "loss of consciousness"
4. Submit vitals

**Expected Results:**
- ✅ Emergency alert displays for critical symptoms
- ✅ Symptom-based indicator is shown
- ✅ Specific recommendations for symptoms are provided
- ✅ Alert prevents normal progression

**Test Cases:**
- [ ] "severe chest pain" - Emergency detected
- [ ] "difficulty breathing" - Emergency detected
- [ ] "loss of consciousness" - Emergency detected
- [ ] "severe bleeding" - Emergency detected

**Screenshot Checklist:**
- [ ] Symptom-based emergency alert
- [ ] Multiple emergency indicators

---

#### 3.4 Emergency Alert Interaction

**Objective:** Test emergency alert acknowledgment flow

**Steps:**
1. Trigger emergency alert (any method)
2. Click "Acknowledge" button
3. Observe workflow continuation

**Expected Results:**
- ✅ Acknowledge button is clearly visible
- ✅ Button click dismisses alert
- ✅ Emergency flag remains in medical data
- ✅ Doctor can see emergency status in sidebar
- ✅ Workflow continues appropriately after acknowledgment

**Screenshot Checklist:**
- [ ] Alert with acknowledge button
- [ ] Post-acknowledgment state

---

### 4. Medical Sidebar Vitals Display

#### 4.1 Complete Vitals Display

**Objective:** Verify all collected vitals are displayed correctly in medical sidebar

**Steps:**
1. As patient, complete vitals collection with all fields:
   - Name: "Test Patient"
   - Age: 45
   - Gender: Female
   - Temperature: 37.2°C
   - Weight: 68 kg
   - Blood Pressure: 118/76 mmHg
2. As doctor, open the intake session
3. View medical sidebar

**Expected Results:**
- ✅ All demographics are displayed (Name, Age, Gender)
- ✅ All vitals are shown with correct values
- ✅ Units are displayed correctly (°C, kg, mmHg)
- ✅ Collection timestamps are shown for each vital
- ✅ Values are formatted properly
- ✅ Layout is clean and organized

**Screenshot Checklist:**
- [ ] Medical sidebar with complete vitals
- [ ] Demographics section
- [ ] Vitals section with timestamps

---

#### 4.2 Missing Vitals Indication

**Objective:** Verify missing vitals are clearly indicated

**Steps:**
1. As patient, complete vitals with only required fields:
   - Name: "Minimal Patient"
   - Age: 30
   - Gender: Male
   - Skip all optional vitals
2. As doctor, view medical sidebar

**Expected Results:**
- ✅ Demographics are displayed
- ✅ Missing vitals show "Not collected" or similar indicator
- ✅ Missing vitals are styled differently (gray text)
- ✅ Clear distinction between collected and missing data
- ✅ No errors or blank spaces

**Screenshot Checklist:**
- [ ] Sidebar with missing vitals
- [ ] "Not collected" indicators

---

#### 4.3 Concerning Values Highlighting

**Objective:** Verify concerning vital values are visually highlighted

**Steps:**
1. As patient, enter concerning but not emergency vitals:
   - Temperature: 38.5°C (elevated but not emergency)
   - Blood Pressure: 145/95 mmHg (elevated)
2. As doctor, view medical sidebar

**Expected Results:**
- ✅ Concerning values are highlighted (yellow/orange color)
- ✅ Normal values have standard styling
- ✅ Visual distinction is clear
- ✅ Highlighting doesn't obscure readability

**Test Cases:**
- [ ] Temperature 38.5°C - Yellow highlight
- [ ] BP 145/95 mmHg - Yellow highlight
- [ ] Temperature 37.0°C - Normal styling
- [ ] BP 120/80 mmHg - Normal styling

**Screenshot Checklist:**
- [ ] Sidebar with concerning values highlighted
- [ ] Sidebar with normal values

---

#### 4.4 Triage Decision Display

**Objective:** Verify triage decision and rationale are displayed

**Steps:**
1. Complete vitals collection with different scenarios:
   - Scenario A: Normal vitals, simple symptoms → Direct-to-diagnosis
   - Scenario B: Concerning vitals, complex symptoms → Agent-assisted
   - Scenario C: Emergency vitals → Emergency
2. As doctor, view triage decision in sidebar

**Expected Results:**
- ✅ Triage decision type is displayed
- ✅ Decision rationale is shown
- ✅ Factors that influenced decision are listed
- ✅ Emergency decisions are styled prominently
- ✅ Explanations are clear and helpful

**Screenshot Checklist:**
- [ ] Direct-to-diagnosis decision display
- [ ] Agent-assisted decision display
- [ ] Emergency decision display
- [ ] Decision rationale section

---

### 5. Responsive Behavior Testing

#### 5.1 Breakpoint Testing

**Objective:** Test all major responsive breakpoints

**Breakpoints to Test:**
- 375px (Mobile - iPhone SE)
- 414px (Mobile - iPhone Pro Max)
- 768px (Tablet - iPad Portrait)
- 1024px (Tablet - iPad Landscape)
- 1280px (Desktop - Small)
- 1920px (Desktop - Large)

**Steps:**
1. Open intake interface at each breakpoint
2. Test vitals collection
3. Test chat interface
4. Test medical sidebar

**Expected Results:**
- ✅ Layout adapts appropriately at each breakpoint
- ✅ No horizontal scrolling
- ✅ All elements remain accessible
- ✅ Text remains readable
- ✅ Touch targets are appropriately sized
- ✅ Images and icons scale properly

**Screenshot Checklist:**
- [ ] 375px view
- [ ] 768px view
- [ ] 1024px view
- [ ] 1920px view

---

#### 5.2 Orientation Change Testing

**Objective:** Test behavior when device orientation changes

**Steps:**
1. Open intake interface on mobile device
2. Start vitals collection in portrait mode
3. Rotate to landscape mode
4. Continue vitals collection
5. Rotate back to portrait

**Expected Results:**
- ✅ Layout adapts to orientation change
- ✅ Form data is preserved during rotation
- ✅ No layout breaks or overlaps
- ✅ User can continue from where they left off

**Screenshot Checklist:**
- [ ] Portrait orientation
- [ ] Landscape orientation
- [ ] Transition between orientations

---

### 6. Accessibility Testing

#### 6.1 Keyboard Navigation

**Objective:** Verify all interactive elements are keyboard accessible

**Steps:**
1. Open vitals collection interface
2. Use only keyboard (Tab, Shift+Tab, Enter, Space)
3. Navigate through all form fields
4. Submit form using keyboard

**Expected Results:**
- ✅ All form fields are reachable via Tab
- ✅ Focus indicators are visible
- ✅ Tab order is logical
- ✅ Dropdowns work with keyboard
- ✅ Buttons are activatable with Enter/Space
- ✅ "I don't have it" buttons work with keyboard

**Checklist:**
- [ ] Tab through all fields
- [ ] Focus indicators visible
- [ ] Logical tab order
- [ ] Form submission via keyboard

---

#### 6.2 Screen Reader Testing

**Objective:** Verify interface works with screen readers

**Steps:**
1. Enable screen reader (NVDA, JAWS, or VoiceOver)
2. Navigate vitals collection interface
3. Listen to announcements for each field
4. Submit form

**Expected Results:**
- ✅ Labels are announced correctly
- ✅ Required fields are indicated
- ✅ Error messages are announced
- ✅ Progress indicator is announced
- ✅ Button purposes are clear
- ✅ Form structure is logical

**Checklist:**
- [ ] Field labels announced
- [ ] Required field indicators
- [ ] Error announcements
- [ ] Button descriptions

---

#### 6.3 Color Contrast

**Objective:** Verify sufficient color contrast for readability

**Steps:**
1. Use browser dev tools or contrast checker
2. Check contrast ratios for:
   - Text on backgrounds
   - Button text
   - Error messages
   - Emergency alerts
   - Highlighted values

**Expected Results:**
- ✅ Normal text has 4.5:1 contrast ratio minimum
- ✅ Large text has 3:1 contrast ratio minimum
- ✅ Emergency alerts have high contrast
- ✅ Concerning value highlights maintain readability

**Checklist:**
- [ ] Body text contrast
- [ ] Button contrast
- [ ] Error message contrast
- [ ] Alert contrast

---

### 7. Cross-Browser Testing

#### 7.1 Chrome Testing

**Steps:**
1. Open application in Google Chrome (latest version)
2. Test all scenarios above

**Expected Results:**
- ✅ All features work as expected
- ✅ No console errors
- ✅ Styling renders correctly

---

#### 7.2 Firefox Testing

**Steps:**
1. Open application in Mozilla Firefox (latest version)
2. Test all scenarios above

**Expected Results:**
- ✅ All features work as expected
- ✅ No console errors
- ✅ Styling renders correctly

---

#### 7.3 Safari Testing

**Steps:**
1. Open application in Safari (latest version)
2. Test all scenarios above

**Expected Results:**
- ✅ All features work as expected
- ✅ No console errors
- ✅ Styling renders correctly

---

## Issue Tracking Template

If you encounter any issues during testing, document them using this template:

```markdown
### Issue #[NUMBER]

**Title:** [Brief description]

**Severity:** Critical / High / Medium / Low

**Device/Browser:** [e.g., iPhone 12 / Chrome 120]

**Steps to Reproduce:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happens]

**Screenshots:**
[Attach screenshots]

**Additional Notes:**
[Any other relevant information]
```

---

## Sign-Off Checklist

After completing all manual tests, verify:

- [ ] All vitals collection scenarios tested on desktop
- [ ] All vitals collection scenarios tested on mobile
- [ ] All vitals collection scenarios tested on tablet
- [ ] Chat layout verified on all screen sizes
- [ ] Emergency alerts tested for all trigger conditions
- [ ] Emergency alert interaction tested
- [ ] Medical sidebar vitals display verified
- [ ] Missing vitals indication verified
- [ ] Concerning values highlighting verified
- [ ] Triage decision display verified
- [ ] All responsive breakpoints tested
- [ ] Orientation changes tested
- [ ] Keyboard navigation verified
- [ ] Screen reader compatibility verified
- [ ] Color contrast verified
- [ ] Chrome browser tested
- [ ] Firefox browser tested
- [ ] Safari browser tested
- [ ] All issues documented
- [ ] Screenshots captured for documentation

---

## Test Results Summary

**Tester Name:** ___________________  
**Date:** ___________________  
**Overall Status:** ✅ Pass / ⚠️ Pass with Issues / ❌ Fail

**Total Issues Found:** ___________________  
- Critical: ___________________
- High: ___________________
- Medium: ___________________
- Low: ___________________

**Notes:**
___________________________________________
___________________________________________
___________________________________________

**Recommendation:**
- [ ] Ready for production
- [ ] Requires minor fixes
- [ ] Requires major fixes
- [ ] Requires redesign

---

## Next Steps

After completing manual QA:

1. Document all findings in issue tracker
2. Create bug tickets for any issues found
3. Prioritize fixes based on severity
4. Retest after fixes are implemented
5. Obtain final sign-off from stakeholders
6. Proceed with deployment if all tests pass

---

**End of Manual Testing Guide**
