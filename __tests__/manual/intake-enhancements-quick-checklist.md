# Quick Manual Testing Checklist
## Intake Interface Enhancements

**Quick Reference Guide for Manual QA**

---

## 🖥️ Desktop Testing (≥1024px)

### Vitals Collection
- [ ] Interface displays automatically on session start
- [ ] Progress indicator visible (e.g., "Step 1 of 6")
- [ ] Required fields marked with asterisks
- [ ] "I don't have it" buttons present for optional fields
- [ ] Unit selection dropdowns work (°C/°F, kg/lbs)
- [ ] Form validation shows helpful errors
- [ ] Submit button works correctly

### Chat Layout
- [ ] All messages visible above input section
- [ ] No overlap between messages and input
- [ ] Messages container scrolls independently
- [ ] Input section fixed at bottom
- [ ] Auto-scroll shows newest message fully
- [ ] Proper spacing/padding visible

### Medical Sidebar
- [ ] Demographics displayed correctly
- [ ] All vitals shown with units and timestamps
- [ ] Missing vitals show "Not collected"
- [ ] Concerning values highlighted (yellow/orange)
- [ ] Triage decision and rationale displayed

---

## 📱 Mobile Testing (≤768px)

### Vitals Collection
- [ ] Interface adapts to mobile screen
- [ ] Fields stack vertically
- [ ] Touch targets ≥44x44px
- [ ] No horizontal scrolling
- [ ] Keyboard doesn't obscure fields
- [ ] Submit button always visible

### Chat Layout
- [ ] Messages visible on mobile
- [ ] Input adapts to mobile keyboard
- [ ] Smooth scrolling
- [ ] No overlap issues

---

## 🚨 Emergency Alerts

### Temperature
- [ ] Alert for temp >39.5°C (103.1°F)
- [ ] Alert for temp <35°C (95°F)
- [ ] Red/urgent styling
- [ ] Specific recommendations shown
- [ ] Acknowledge button works

### Blood Pressure
- [ ] Alert for systolic >180 or <90 mmHg
- [ ] Alert for diastolic >120 or <60 mmHg
- [ ] Appropriate recommendations

### Symptoms
- [ ] Alert for "severe chest pain"
- [ ] Alert for "difficulty breathing"
- [ ] Alert for "loss of consciousness"
- [ ] Workflow blocked until acknowledged

---

## 📐 Responsive Testing

### Breakpoints
- [ ] 375px (iPhone SE)
- [ ] 768px (iPad Portrait)
- [ ] 1024px (iPad Landscape)
- [ ] 1920px (Desktop)

### Orientation
- [ ] Portrait → Landscape transition smooth
- [ ] Form data preserved during rotation
- [ ] No layout breaks

---

## ♿ Accessibility

### Keyboard Navigation
- [ ] All fields reachable via Tab
- [ ] Focus indicators visible
- [ ] Logical tab order
- [ ] Buttons work with Enter/Space

### Screen Reader
- [ ] Labels announced correctly
- [ ] Required fields indicated
- [ ] Error messages announced

### Color Contrast
- [ ] Text contrast ≥4.5:1
- [ ] Button contrast ≥4.5:1
- [ ] Emergency alerts high contrast

---

## 🌐 Cross-Browser

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] No console errors in any browser

---

## ✅ Final Sign-Off

- [ ] All critical paths tested
- [ ] All issues documented
- [ ] Screenshots captured
- [ ] Ready for production / Needs fixes

**Tester:** ___________________  
**Date:** ___________________  
**Status:** ✅ Pass / ⚠️ Issues / ❌ Fail
