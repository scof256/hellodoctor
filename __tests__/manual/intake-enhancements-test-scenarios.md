# Test Scenarios for Manual QA
## Intake Interface Enhancements

**Detailed Test Scenarios with Expected Outcomes**

---

## Scenario 1: Happy Path - Complete Vitals Collection

**User:** Patient  
**Device:** Desktop (1920px)  
**Objective:** Complete full vitals collection with all fields

### Steps:
1. Sign in as patient
2. Navigate to patient home
3. Click "Start New Intake" or similar action
4. Observe automatic vitals collection display
5. Fill in all fields:
   - Name: "John Smith"
   - Age: 42
   - Gender: Male
   - Temperature: 37.0°C
   - Weight: 80 kg
   - Blood Pressure: 120/80 mmHg
   - Current Status: "Feeling tired, mild headache"
6. Click Submit

### Expected Outcome:
✅ Vitals saved successfully  
✅ Triage decision made (likely "agent-assisted" or "direct-to-diagnosis")  
✅ Session transitions to next agent  
✅ No errors displayed  
✅ Progress indicator showed all steps  

### Verification:
- Check database: vitals data saved correctly
- Check medical sidebar: all vitals displayed
- Check triage decision: recorded in medical data

---

## Scenario 2: Minimal Data - Skip Optional Vitals

**User:** Patient  
**Device:** Mobile (375px)  
**Objective:** Complete vitals with only required fields

### Steps:
1. Sign in as patient on mobile device
2. Start new intake session
3. Fill in required fields only:
   - Name: "Jane Doe"
   - Age: 28
   - Gender: Female
4. Click "I don't have it" for all optional vitals:
   - Temperature: Skip
   - Weight: Skip
   - Blood Pressure: Skip
5. Enter Current Status: "Cough for 3 days"
6. Submit

### Expected Outcome:
✅ Form accepts submission with only required fields  
✅ No validation errors for skipped fields  
✅ Session progresses normally  
✅ Medical sidebar shows "Not collected" for missing vitals  

### Verification:
- Check vitals data: null values for skipped fields
- Check medical sidebar: missing vitals indicated clearly
- Check triage decision: made based on available data

---

## Scenario 3: Emergency - High Temperature

**User:** Patient  
**Device:** Desktop  
**Objective:** Trigger emergency alert with high temperature

### Steps:
1. Sign in as patient
2. Start new intake session
3. Fill in vitals:
   - Name: "Emergency Patient"
   - Age: 55
   - Gender: Female
   - Temperature: 40.5°C (104.9°F)
   - Weight: 65 kg
   - Blood Pressure: 130/85 mmHg
4. Submit

### Expected Outcome:
✅ Emergency alert displays immediately  
✅ Alert shows red/urgent styling  
✅ Temperature indicator shown: "Temperature: 40.5°C (Critical - Above 39.5°C)"  
✅ Recommendations displayed: "Seek immediate medical attention"  
✅ Acknowledge button present  
✅ Cannot proceed until acknowledged  

### Verification:
- Check emergency flag in database
- Check doctor view: emergency status visible
- Check triage decision: set to "emergency"

---

## Scenario 4: Emergency - Low Blood Pressure

**User:** Patient  
**Device:** Tablet (768px)  
**Objective:** Trigger emergency alert with low blood pressure

### Steps:
1. Sign in as patient on tablet
2. Start new intake session
3. Fill in vitals:
   - Name: "Low BP Patient"
   - Age: 70
   - Gender: Male
   - Temperature: 36.8°C
   - Weight: 72 kg
   - Blood Pressure: 85/55 mmHg
4. Submit

### Expected Outcome:
✅ Emergency alert displays  
✅ Blood pressure indicators shown:
   - "Systolic: 85 mmHg (Critical - Below 90 mmHg)"
   - "Diastolic: 55 mmHg (Critical - Below 60 mmHg)"  
✅ Specific recommendations for low BP  
✅ Alert visible in both portrait and landscape  

### Verification:
- Emergency flag set correctly
- Both systolic and diastolic thresholds detected
- Recommendations appropriate for low BP

---

## Scenario 5: Emergency - Critical Symptoms

**User:** Patient  
**Device:** Mobile  
**Objective:** Trigger emergency alert with symptom keywords

### Steps:
1. Sign in as patient on mobile
2. Start new intake session
3. Fill in vitals:
   - Name: "Chest Pain Patient"
   - Age: 60
   - Gender: Male
   - Temperature: 37.2°C
   - Weight: 85 kg
   - Blood Pressure: 125/82 mmHg
   - Current Status: "severe chest pain radiating to left arm"
4. Submit

### Expected Outcome:
✅ Emergency alert displays despite normal vitals  
✅ Symptom-based indicator shown  
✅ Specific recommendations for chest pain  
✅ Alert emphasizes urgency  

### Verification:
- Symptom text analysis detected "severe chest pain"
- Emergency flag set
- Appropriate recommendations generated

---

## Scenario 6: Concerning Values - Not Emergency

**User:** Patient  
**Device:** Desktop  
**Objective:** Test highlighting of concerning but non-emergency values

### Steps:
1. Sign in as patient
2. Start new intake session
3. Fill in vitals:
   - Name: "Elevated Patient"
   - Age: 50
   - Gender: Female
   - Temperature: 38.5°C (101.3°F)
   - Weight: 70 kg
   - Blood Pressure: 145/95 mmHg
4. Submit

### Expected Outcome:
✅ No emergency alert (values below emergency thresholds)  
✅ Session progresses normally  
✅ Triage decision likely "agent-assisted" due to concerning values  
✅ In medical sidebar: concerning values highlighted in yellow/orange  

### Verification:
- No emergency flag
- Triage decision considers concerning values
- Medical sidebar highlights elevated temp and BP

---

## Scenario 7: Chat Layout - Many Messages

**User:** Doctor  
**Device:** Desktop  
**Objective:** Verify chat layout with long conversation

### Steps:
1. Sign in as doctor
2. Navigate to intake session with 30+ messages
3. Scroll to top of conversation
4. Scroll to bottom of conversation
5. Type a long message in input area
6. Send message
7. Observe auto-scroll behavior

### Expected Outcome:
✅ All messages visible when scrolling  
✅ No messages hidden under input section  
✅ Input section stays fixed at bottom  
✅ Messages container scrolls independently  
✅ Auto-scroll shows newest message fully (not cut off)  
✅ Proper padding between last message and input  

### Verification:
- Inspect element: check z-index values
- Measure: last message has clearance above input
- Test: scroll position after new message

---

## Scenario 8: Chat Layout - Mobile with Keyboard

**User:** Doctor  
**Device:** Mobile (375px)  
**Objective:** Verify chat layout when mobile keyboard appears

### Steps:
1. Sign in as doctor on mobile
2. Open intake session
3. Tap input field to open keyboard
4. Observe layout adjustment
5. Type message
6. Send message
7. Close keyboard

### Expected Outcome:
✅ Layout adjusts when keyboard appears  
✅ Messages remain accessible  
✅ Input field visible above keyboard  
✅ Can scroll messages while keyboard open  
✅ Layout restores when keyboard closes  

### Verification:
- Messages container height adjusts
- No overlap with keyboard
- Smooth transition

---

## Scenario 9: Medical Sidebar - Complete Data

**User:** Doctor  
**Device:** Desktop  
**Objective:** Verify medical sidebar displays all vitals correctly

### Steps:
1. Patient completes full vitals collection (Scenario 1)
2. Sign in as doctor
3. Navigate to that intake session
4. View medical sidebar

### Expected Outcome:
✅ Demographics section shows:
   - Name: "John Smith"
   - Age: 42 years
   - Gender: Male  
✅ Vitals section shows:
   - Temperature: 37.0°C (with timestamp)
   - Weight: 80 kg (with timestamp)
   - Blood Pressure: 120/80 mmHg (with timestamp)  
✅ All values formatted correctly  
✅ Units displayed properly  
✅ Timestamps in readable format  

### Verification:
- All data matches submitted values
- Timestamps are accurate
- Layout is organized and readable

---

## Scenario 10: Medical Sidebar - Missing Data

**User:** Doctor  
**Device:** Desktop  
**Objective:** Verify medical sidebar handles missing vitals

### Steps:
1. Patient completes minimal vitals (Scenario 2)
2. Sign in as doctor
3. Navigate to that intake session
4. View medical sidebar

### Expected Outcome:
✅ Demographics displayed correctly  
✅ Missing vitals show clear indicators:
   - Temperature: "Not collected" (gray text)
   - Weight: "Not collected" (gray text)
   - Blood Pressure: "Not collected" (gray text)  
✅ No blank spaces or errors  
✅ Clear visual distinction from collected data  

### Verification:
- Missing data clearly indicated
- No confusion about what's missing
- Layout remains clean

---

## Scenario 11: Medical Sidebar - Triage Decision

**User:** Doctor  
**Device:** Desktop  
**Objective:** Verify triage decision display in sidebar

### Steps:
1. Patient completes vitals (any scenario)
2. Sign in as doctor
3. View medical sidebar
4. Locate triage decision section

### Expected Outcome:
✅ Triage decision type displayed:
   - "Agent-Assisted" or "Direct-to-Diagnosis" or "Emergency"  
✅ Decision rationale shown  
✅ Factors listed (e.g., "Concerning vital signs", "Complex symptoms")  
✅ Emergency decisions styled prominently (red)  
✅ Explanation is clear and helpful  

### Verification:
- Decision matches expected outcome
- Rationale makes sense
- Factors are specific and accurate

---

## Scenario 12: Responsive - Breakpoint Transitions

**User:** Patient  
**Device:** Browser with responsive mode  
**Objective:** Test layout at all breakpoints

### Steps:
1. Open vitals collection at 1920px
2. Resize to 1024px (observe changes)
3. Resize to 768px (observe changes)
4. Resize to 375px (observe changes)
5. Resize back to 1920px

### Expected Outcome:
✅ Smooth transitions at each breakpoint  
✅ No sudden jumps or layout breaks  
✅ All elements remain accessible  
✅ Text remains readable  
✅ No horizontal scrolling at any size  
✅ Touch targets appropriate for screen size  

### Verification:
- Test at each breakpoint
- Check for layout issues
- Verify usability at each size

---

## Scenario 13: Responsive - Orientation Change

**User:** Patient  
**Device:** Mobile device (physical or emulated)  
**Objective:** Test orientation change handling

### Steps:
1. Open vitals collection in portrait mode
2. Fill in Name and Age
3. Rotate device to landscape
4. Continue filling form
5. Rotate back to portrait
6. Submit form

### Expected Outcome:
✅ Layout adapts to orientation  
✅ Form data preserved during rotation  
✅ No layout breaks or overlaps  
✅ Can continue from where left off  
✅ Submit works in both orientations  

### Verification:
- Data not lost during rotation
- Layout appropriate for each orientation
- No errors or glitches

---

## Scenario 14: Accessibility - Keyboard Navigation

**User:** Patient  
**Device:** Desktop  
**Objective:** Complete vitals using only keyboard

### Steps:
1. Open vitals collection
2. Use only keyboard (no mouse):
   - Tab to navigate between fields
   - Enter/Space to select options
   - Arrow keys for dropdowns
   - Enter to submit
3. Complete entire form with keyboard

### Expected Outcome:
✅ All fields reachable via Tab  
✅ Focus indicators clearly visible  
✅ Tab order is logical (top to bottom)  
✅ Dropdowns work with keyboard  
✅ Radio buttons work with arrow keys  
✅ "I don't have it" buttons work with Enter/Space  
✅ Submit button activatable with Enter  

### Verification:
- No fields skipped in tab order
- Focus always visible
- All interactions possible with keyboard

---

## Scenario 15: Accessibility - Screen Reader

**User:** Patient  
**Device:** Desktop with screen reader  
**Objective:** Complete vitals using screen reader

### Steps:
1. Enable screen reader (NVDA/JAWS/VoiceOver)
2. Navigate to vitals collection
3. Listen to announcements
4. Complete form using screen reader

### Expected Outcome:
✅ Page title announced  
✅ Form purpose announced  
✅ Each field label announced clearly  
✅ Required fields indicated ("required")  
✅ Field types announced (text, number, select)  
✅ Error messages announced  
✅ Progress indicator announced  
✅ Button purposes clear  

### Verification:
- All content accessible to screen reader
- Announcements are helpful
- Form structure is logical

---

## Scenario 16: Cross-Browser - Chrome

**User:** Patient & Doctor  
**Device:** Desktop  
**Objective:** Verify functionality in Chrome

### Steps:
1. Open application in Chrome (latest)
2. Test vitals collection (Scenario 1)
3. Test emergency alert (Scenario 3)
4. Test chat layout (Scenario 7)
5. Check browser console for errors

### Expected Outcome:
✅ All features work correctly  
✅ No console errors  
✅ Styling renders properly  
✅ Animations smooth  
✅ No performance issues  

---

## Scenario 17: Cross-Browser - Firefox

**User:** Patient & Doctor  
**Device:** Desktop  
**Objective:** Verify functionality in Firefox

### Steps:
1. Open application in Firefox (latest)
2. Test vitals collection (Scenario 1)
3. Test emergency alert (Scenario 3)
4. Test chat layout (Scenario 7)
5. Check browser console for errors

### Expected Outcome:
✅ All features work correctly  
✅ No console errors  
✅ Styling renders properly  
✅ Animations smooth  
✅ No performance issues  

---

## Scenario 18: Cross-Browser - Safari

**User:** Patient & Doctor  
**Device:** Desktop/Mobile  
**Objective:** Verify functionality in Safari

### Steps:
1. Open application in Safari (latest)
2. Test vitals collection (Scenario 1)
3. Test emergency alert (Scenario 3)
4. Test chat layout (Scenario 7)
5. Check browser console for errors

### Expected Outcome:
✅ All features work correctly  
✅ No console errors  
✅ Styling renders properly  
✅ Animations smooth  
✅ No performance issues  

---

## Test Execution Tracking

| Scenario | Status | Tester | Date | Issues Found |
|----------|--------|--------|------|--------------|
| 1. Happy Path | ⬜ | | | |
| 2. Minimal Data | ⬜ | | | |
| 3. Emergency Temp | ⬜ | | | |
| 4. Emergency BP | ⬜ | | | |
| 5. Emergency Symptoms | ⬜ | | | |
| 6. Concerning Values | ⬜ | | | |
| 7. Chat Layout Desktop | ⬜ | | | |
| 8. Chat Layout Mobile | ⬜ | | | |
| 9. Sidebar Complete | ⬜ | | | |
| 10. Sidebar Missing | ⬜ | | | |
| 11. Sidebar Triage | ⬜ | | | |
| 12. Responsive Breakpoints | ⬜ | | | |
| 13. Orientation Change | ⬜ | | | |
| 14. Keyboard Navigation | ⬜ | | | |
| 15. Screen Reader | ⬜ | | | |
| 16. Chrome | ⬜ | | | |
| 17. Firefox | ⬜ | | | |
| 18. Safari | ⬜ | | | |

**Legend:** ⬜ Not Started | 🔄 In Progress | ✅ Passed | ❌ Failed | ⚠️ Passed with Issues

---

**End of Test Scenarios**
