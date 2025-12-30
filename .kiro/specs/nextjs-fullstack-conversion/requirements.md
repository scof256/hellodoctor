# Requirements Document

## Introduction

This document specifies the requirements for converting the existing Dr. Gemini medical intake application from a Vite/React SPA to a full-stack Next.js application. The conversion will maintain all existing functionality while adding proper backend API routes, environment variable security, and server-side protection for proprietary code (Gemini AI service logic).

## Glossary

- **Next_App**: The full-stack Next.js application with App Router
- **API_Routes**: Next.js server-side API endpoints under `/api/`
- **Gemini_Service**: The backend service that communicates with Google's Gemini AI
- **Chat_Interface**: The main chat UI component for patient/doctor interactions
- **Medical_Sidebar**: The sidebar displaying intake data and clinical handover
- **Direct_Message_System**: Human-to-human messaging between patient and doctor views
- **Booking_System**: The appointment scheduling modal and confirmation flow
- **A2A_Protocol**: Agent-to-Agent orchestration protocol for routing to specialist AI agents
- **SBAR**: Situation-Background-Assessment-Recommendation clinical handover format

## Requirements

### Requirement 1: Next.js Project Structure

**User Story:** As a developer, I want the application converted to Next.js App Router structure, so that I can leverage server-side capabilities and modern React patterns.

#### Acceptance Criteria

1. THE Next_App SHALL use Next.js 14+ with App Router (`/app` directory structure)
2. THE Next_App SHALL maintain TypeScript configuration compatible with the existing codebase
3. THE Next_App SHALL configure Tailwind CSS with the existing custom medical theme colors
4. THE Next_App SHALL organize client components in `/app/components/` directory
5. THE Next_App SHALL organize API routes in `/app/api/` directory
6. THE Next_App SHALL include proper `"use client"` directives for interactive components

### Requirement 2: Environment Variable Security

**User Story:** As a developer, I want API keys and sensitive configuration stored securely, so that proprietary credentials are never exposed to the frontend.

#### Acceptance Criteria

1. THE Next_App SHALL store the Gemini API key in `.env.local` as `GEMINI_API_KEY`
2. THE Next_App SHALL NOT prefix sensitive environment variables with `NEXT_PUBLIC_`
3. WHEN the frontend attempts to access server-only environment variables, THE Next_App SHALL return undefined
4. THE Next_App SHALL include a `.env.example` file documenting required environment variables without actual values
5. THE Next_App SHALL add `.env.local` to `.gitignore` to prevent accidental commits

### Requirement 3: Backend API for Chat Messages

**User Story:** As a user, I want to send chat messages through a secure backend API, so that the AI service logic and API keys remain protected.

#### Acceptance Criteria

1. WHEN a user sends a message, THE Next_App SHALL POST to `/api/chat` endpoint
2. THE `/api/chat` endpoint SHALL accept `{ history, medicalData, mode }` in the request body
3. THE `/api/chat` endpoint SHALL execute the Gemini_Service logic server-side
4. THE `/api/chat` endpoint SHALL return `{ response, groundingMetadata }` on success
5. IF the Gemini API call fails, THEN THE `/api/chat` endpoint SHALL return a 500 status with error details
6. THE `/api/chat` endpoint SHALL validate that required fields are present in the request

### Requirement 4: Backend API for Image Analysis

**User Story:** As a user, I want to upload medical images for AI analysis through a secure backend, so that image processing happens server-side.

#### Acceptance Criteria

1. WHEN images are included in a chat message, THE Next_App SHALL send base64 image data to the backend
2. THE Gemini_Service SHALL analyze images server-side before incorporating into chat context
3. THE `/api/chat` endpoint SHALL handle messages with attached images
4. IF image analysis fails, THEN THE Gemini_Service SHALL return a graceful error message in the response

### Requirement 5: Patient Chat Interface

**User Story:** As a patient, I want to interact with Dr. Gemini through a chat interface, so that I can describe my symptoms and receive intake guidance.

#### Acceptance Criteria

1. THE Chat_Interface SHALL display messages with role-based styling (user, model, doctor)
2. THE Chat_Interface SHALL show a progress tracker indicating current intake stage
3. THE Chat_Interface SHALL support image uploads via file input
4. THE Chat_Interface SHALL display uploaded images as thumbnails with remove option
5. THE Chat_Interface SHALL show loading state while awaiting AI response
6. THE Chat_Interface SHALL render markdown content in AI responses
7. THE Chat_Interface SHALL display grounding sources when available from Gemini
8. WHEN viewing images, THE Chat_Interface SHALL provide zoom controls in a modal viewer
9. THE Chat_Interface SHALL display the active AI agent label (Triage, ClinicalInvestigator, etc.)

### Requirement 6: Doctor Consultation Mode

**User Story:** As a doctor, I want to switch to consultation mode, so that I can interact with the AI as a clinical decision support system.

#### Acceptance Criteria

1. THE Next_App SHALL provide a toggle to switch between patient and doctor view modes
2. WHEN in doctor mode, THE Chat_Interface SHALL use purple theme styling
3. WHEN in doctor mode, THE Gemini_Service SHALL bypass A2A routing and act as CDSS
4. THE doctor mode SHALL maintain a separate message history from patient mode
5. THE Chat_Interface SHALL display "Consultant Mode Active" header in doctor view

### Requirement 7: Medical Sidebar Display

**User Story:** As a user, I want to see structured medical data in a sidebar, so that I can track intake progress and view clinical analysis.

#### Acceptance Criteria

1. THE Medical_Sidebar SHALL display intake progress as a percentage bar
2. THE Medical_Sidebar SHALL have tabs for "Intake Data" and "Dr. Handover"
3. THE Medical_Sidebar SHALL display AI clinical reasoning including differential diagnosis
4. THE Medical_Sidebar SHALL show structured data fields (Chief Complaint, HPI, Medications, Allergies)
5. WHEN a data field is missing, THE Medical_Sidebar SHALL show a clickable prompt to trigger that topic
6. THE Medical_Sidebar SHALL display SBAR clinical handover when available
7. THE Medical_Sidebar SHALL display Uganda Clinical Guidelines recommendations when available
8. THE Medical_Sidebar SHALL be responsive (overlay on mobile, fixed on desktop)

### Requirement 8: Direct Messaging System

**User Story:** As a patient or doctor, I want to send direct messages to each other, so that we can communicate without AI processing.

#### Acceptance Criteria

1. THE Direct_Message_System SHALL provide a floating button to open direct chat
2. THE Direct_Message_System SHALL show unread message count badge
3. WHEN direct chat is open, THE Direct_Message_System SHALL display message history
4. THE Direct_Message_System SHALL distinguish messages by sender (patient vs doctor)
5. THE Direct_Message_System SHALL NOT send direct messages through the AI backend
6. THE Direct_Message_System SHALL clear unread count when chat is opened

### Requirement 9: Appointment Booking

**User Story:** As a patient, I want to book an appointment after intake is complete, so that I can schedule a visit with the doctor.

#### Acceptance Criteria

1. WHEN intake status is "ready", THE Next_App SHALL show a "Book Now" button
2. THE Booking_System SHALL display available time slots in a modal
3. WHEN a slot is selected and confirmed, THE Booking_System SHALL update booking status to "booked"
4. THE Booking_System SHALL display confirmation animation after booking
5. THE Chat_Interface SHALL display a confirmation message with the appointment date

### Requirement 10: A2A Protocol Orchestration

**User Story:** As a system, I want to route patient messages to specialized AI agents, so that each aspect of intake is handled by the appropriate specialist.

#### Acceptance Criteria

1. THE Gemini_Service SHALL implement an orchestrator to determine the active agent
2. THE Gemini_Service SHALL support five agent roles: Triage, ClinicalInvestigator, RecordsClerk, HistorySpecialist, HandoverSpecialist
3. WHEN the orchestrator selects an agent, THE Gemini_Service SHALL use that agent's specific prompt
4. THE Gemini_Service SHALL return the active agent role in the response
5. THE Gemini_Service SHALL update medical data based on agent responses
6. IF orchestrator fails, THEN THE Gemini_Service SHALL default to ClinicalInvestigator agent

### Requirement 11: Response Parsing and Data Extraction

**User Story:** As a system, I want to parse AI responses and extract structured medical data, so that the sidebar can display organized information.

#### Acceptance Criteria

1. THE Gemini_Service SHALL parse JSON responses from the AI model
2. THE Gemini_Service SHALL extract `thought`, `reply`, and `updatedData` from responses
3. WHEN JSON parsing fails, THE Gemini_Service SHALL attempt fallback brace matching
4. IF all parsing fails, THEN THE Gemini_Service SHALL return the raw text as the reply
5. THE Gemini_Service SHALL merge updated data with existing medical data preserving arrays

### Requirement 12: Mobile Responsiveness

**User Story:** As a mobile user, I want the application to be fully functional on small screens, so that I can complete intake from my phone.

#### Acceptance Criteria

1. THE Next_App SHALL hide the sidebar by default on mobile screens
2. THE Next_App SHALL provide a hamburger menu to toggle sidebar on mobile
3. THE Chat_Interface SHALL use simplified progress tracker on mobile
4. THE Booking_System button SHALL be positioned as floating action button on mobile
5. THE Direct_Message_System SHALL expand to full screen on mobile devices
