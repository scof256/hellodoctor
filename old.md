# Dr. Gemini A2A Architecture & Protocol Guidelines

## 1. Core Architecture: The Single-Context A2A Loop

This application runs on a **Single-Context Agent-to-Agent (A2A)** architecture. It does not use LangChain or multiple API round-trips for conversation history. It uses a **Router-Injector** pattern.

### The Protocol (Code Implementation)
Every interaction follows this strict cycle in `services/gemini.ts`:

1.  **Orchestrate:** Send chat history + current `MedicalData` to the model to decide the *next* agent.
2.  **Inject:** Append the specific System Instruction for that Agent to the context.
3.  **Generate:** The model outputs a strict JSON payload.
4.  **Update:** The React app parses the JSON and updates the `MedicalData` state.

### The JSON Interface (`JSON_SCHEMA_INSTRUCTION`)
Every agent **MUST** output this exact structure. This is the API contract between the LLM and the UI.

```json
{
  "thought": {
    "differentialDiagnosis": [
      { "condition": "Appendicitis", "probability": "High", "reasoning": "RLQ pain + rebound tenderness" }
    ],
    "strategy": "Funneling",
    "missingInformation": ["Social History", "Allergies"],
    "nextMove": "Ask about fever"
  },
  "reply": "Does it hurt more when you cough or move?",
  "updatedData": {
    "hpi": "Pain started 2 hours ago in RLQ...",
    "recordsCheckCompleted": false,
    "bookingStatus": "collecting" // or "ready"
    // ... any other MedicalData field
  },
  "activeAgent": "ClinicalInvestigator" // Visual badge helper
}
```

---

## 2. The Orchestrator (Router Logic)

The "Brain" of the operation is the `determineAgent` function. It uses a lightweight prompt to decide who speaks next.

**The Routing Logic (Pseudo-code):**
```typescript
// Priority Logic in Orchestrator Prompt
if (state.chiefComplaint === null) {
  return "Triage";
} 
else if (state.clinicalHandover.assessment === null || state.hpi_is_evolving) {
  // Urgent: If we are discussing symptoms, stay here.
  return "ClinicalInvestigator"; 
} 
else if (state.recordsCheckCompleted === false) {
  // Interject: Once HPI is stable, ask for files.
  return "RecordsClerk";
} 
else if (state.medications.isEmpty || state.socialHistory.isEmpty) {
  // Clean up: Fill the profile gaps.
  return "HistorySpecialist";
} 
else {
  // Finalize: Everything is known.
  return "HandoverSpecialist";
}
```

---

## 3. The Agent Roster & Behavior

### A. Triage Specialist (`Triage`)
*   **Code Trigger:** `!data.chiefComplaint`
*   **System Instruction Snippet:**
    > "Ask 'What brings you in today?'. If user gives a long story, EXTRACT the Chief Complaint into `updatedData.chiefComplaint` and immediately yield."

### B. Clinical Investigator (`ClinicalInvestigator`)
*   **Code Trigger:** Default when investigating symptoms.
*   **System Instruction Snippet:**
    > "Use Bayesian reasoning. Update `differentialDiagnosis` in the `thought` block with every turn. Use 'Contextual Weaving': if a symptom implies a lifestyle cause (e.g., Cough), update `socialHistory` immediately."

### C. Records Clerk (`RecordsClerk`)
*   **Code Trigger:** `!data.recordsCheckCompleted` AND HPI is stable.
*   **System Instruction Snippet:**
    > "Ask: 'Do you have a discharge letter or pill bottles? Snap a photo.' If user says No, set `recordsCheckCompleted: true` in `updatedData` to stop this agent from triggering again."

### D. History Specialist (`HistorySpecialist`)
*   **Code Trigger:** `recordsCheckCompleted === true` AND (`meds` or `allergies` is empty).
*   **System Instruction Snippet:**
    > "Use 'The Batched Negative'. Ask: 'Do you have any medical conditions, daily meds, or allergies, or are you generally healthy?'. Update all 3 lists in one JSON payload."

### E. Handover Specialist (`HandoverSpecialist`)
*   **Code Trigger:** All data present.
*   **System Instruction Snippet:**
    > "Review entire chat. Generate SBAR. Set `bookingStatus: 'ready'`."

---

## 4. Chat Progression & State Machine

The UI displays a progress bar (`<ChatInterface />`), but the logic is driven by the `MedicalData` state.

**State Flow Diagram:**

1.  **Stage: Basics (`Triage`)**
    *   *Input:* "My ear hurts."
    *   *Update:* `chiefComplaint: "Ear pain"`
    *   *Transition:* $\to$ Investigator.

2.  **Stage: Symptoms (`Investigator`)**
    *   *Loop:* Ask questions until `differentialDiagnosis` has high confidence.
    *   *Logic:* If user mentions "I have a picture of the rash", the Orchestrator forces $\to$ RecordsClerk.

3.  **Stage: Records (`RecordsClerk`)**
    *   *Action:* Ask for upload.
    *   *Update:* `recordsCheckCompleted: true`.
    *   *Transition:* $\to$ HistorySpecialist.

4.  **Stage: History (`HistorySpecialist`)**
    *   *Action:* Batched check for Meds/Allergies.
    *   *Update:* `medications: [...]`, `allergies: [...]`.
    *   *Transition:* $\to$ HandoverSpecialist.

5.  **Stage: Summary (`HandoverSpecialist`)**
    *   *Action:* Generate SBAR.
    *   *Update:* `bookingStatus: "ready"`.

---

## 5. The Booking Trigger Mechanism

The "Book Now" button is **hidden** by default. It is revealed purely by state.

**1. The Trigger (AI Output):**
The `HandoverSpecialist` MUST return this payload to unlock the UI:
```json
{
  "updatedData": {
    "bookingStatus": "ready",
    "clinicalHandover": {
      "situation": "45yo Male with Otitis Media...",
      "background": "NKDA, Hypertension...",
      "assessment": "Acute Otitis Media (High Prob)",
      "recommendation": "Amoxicillin course, Ibuprofen."
    }
  }
}
```

**2. The Listener (React Component):**
In `App.tsx`:
```tsx
{medicalData.bookingStatus === 'ready' && (
  <button onClick={() => setIsBookingModalOpen(true)}>
    Book Appointment
  </button>
)}
```

**3. The Confirmation:**
When the user selects a slot in `BookingModal`:
1.  Update State: `bookingStatus: 'booked'`.
2.  Inject System Message: "Appointment confirmed for [Date]."

---

## 6. Design System & UI Specifications

### A. Color Theory & Themes
*   **Patient Mode:** Slate-50 background, Medical Blue (`#0284c7`) accents.
*   **Doctor Mode:** Purple-50 background, Consultant Purple (`#7e22ce`) accents.
*   **Agent Badges:**
    *   `Triage`: Teal
    *   `Investigator`: Blue
    *   `Records`: Orange
    *   `History`: Indigo
    *   `Handover`: Green

### B. Layout Structure
*   **Desktop:** Split screen (66% Chat / 33% Sidebar).
*   **Mobile:** Sidebar becomes a slide-over drawer triggered by a menu button.

### C. Component Details
*   **Sidebar Tabs:** Switch between "Intake Data" (Raw inputs) and "Dr. Handover" (SBAR Synthesis).
*   **SBAR Cards:** Must use distinct color coding (Blue/Situation, Slate/Background, Amber/Assessment, Emerald/Recommendation).
*   **Direct Message Overlay:** A floating "Messenger-style" window for human-to-human intervention that bypasses the AI context.
