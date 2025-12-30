# Implementation Plan: Next.js Full-Stack Conversion

## Overview

This plan converts the Dr. Gemini medical intake application from Vite/React to Next.js 14+ with App Router. Tasks are organized to build incrementally: project setup → types → server-side service → API routes → client components → integration.

## Tasks

- [x] 1. Initialize Next.js project and configuration
  - [x] 1.1 Create Next.js 14+ project with App Router, TypeScript, and Tailwind CSS
    - Initialize with `create-next-app` or manual setup
    - Configure `tsconfig.json` for strict mode
    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 1.2 Configure Tailwind with custom medical theme colors
    - Add `medical` color palette (medical-50 through medical-900)
    - Add custom animations (animate-in, fade-in, slide-in)
    - _Requirements: 1.3_
  - [x] 1.3 Set up environment variables
    - Create `.env.local` with `GEMINI_API_KEY`
    - Create `.env.example` template
    - Update `.gitignore` to exclude `.env.local`
    - _Requirements: 2.1, 2.2, 2.4, 2.5_

- [x] 2. Create type definitions and constants
  - [x] 2.1 Create `/app/types/index.ts` with all TypeScript interfaces
    - Message, DirectMessage, MedicalData, SBAR, DoctorThought, AgentResponse
    - AgentRole, IntakeStage type aliases
    - INITIAL_MEDICAL_DATA, INITIAL_THOUGHT constants
    - _Requirements: 3.2, 10.2_
  - [x] 2.2 Write property test for Agent Role validity
    - **Property 4: Agent Role Validity**
    - **Validates: Requirements 10.2, 10.4**

- [x] 3. Implement server-side Gemini service
  - [x] 3.1 Create `/app/lib/gemini-service.ts` with GeminiService class
    - Port A2A protocol prompts (orchestrator, agent prompts)
    - Implement `determineAgent` orchestrator method
    - Implement `sendMessage` method with mode handling
    - Implement `analyzeSingleImage` helper
    - _Requirements: 10.1, 10.2, 10.3, 10.5, 10.6_
  - [x] 3.2 Implement JSON response parsing with fallbacks
    - Parse JSON from markdown code blocks
    - Fallback to brace matching
    - Fallback to raw text response
    - _Requirements: 11.1, 11.2, 11.3, 11.4_
  - [x] 3.3 Implement medical data merge logic
    - Merge arrays with deduplication (medications, allergies, etc.)
    - Preserve existing data while adding new
    - _Requirements: 11.5_
  - [x] 3.4 Write property test for JSON parsing round-trip
    - **Property 2: JSON Response Parsing Round-Trip**
    - **Validates: Requirements 11.1, 11.2**
  - [x] 3.5 Write property test for medical data array merge
    - **Property 3: Medical Data Array Merge Preservation**
    - **Validates: Requirements 11.5**
  - [x] 3.6 Write property test for doctor mode orchestrator bypass
    - **Property 5: Doctor Mode Orchestrator Bypass**
    - **Validates: Requirements 6.3**

- [x] 4. Checkpoint - Verify server-side logic
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Create API route for chat
  - [x] 5.1 Create `/app/api/chat/route.ts` POST handler
    - Validate request body (history, medicalData, mode)
    - Call GeminiService.sendMessage
    - Return response with groundingMetadata
    - Handle errors with appropriate status codes
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 4.4_
  - [x] 5.2 Write property test for API request/response contract
    - **Property 1: API Request/Response Contract**
    - **Validates: Requirements 3.2, 3.4, 3.6, 4.3**

- [x] 6. Create client components
  - [x] 6.1 Create `/app/components/ChatInterface.tsx`
    - Port from existing with `"use client"` directive
    - Message display with role-based styling
    - Progress tracker (desktop stepper, mobile bar)
    - Image upload and preview
    - Markdown rendering with react-markdown
    - Image viewer modal with zoom
    - Agent label display
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9_
  - [x] 6.2 Create `/app/components/MedicalSidebar.tsx`
    - Port from existing with `"use client"` directive
    - Intake progress bar
    - Tab switching (Intake Data / Dr. Handover)
    - AI reasoning display (differential diagnosis, strategy)
    - Structured data fields with topic triggers
    - SBAR cards display
    - UCG recommendations section
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_
  - [x] 6.3 Create `/app/components/BookingModal.tsx`
    - Port from existing with `"use client"` directive
    - Time slot selection
    - Confirmation animation
    - _Requirements: 9.2, 9.3, 9.4_
  - [x] 6.4 Create `/app/components/DirectChatOverlay.tsx`
    - Port from existing with `"use client"` directive
    - Message display with sender distinction
    - Input form
    - _Requirements: 8.1, 8.3, 8.4_
  - [x] 6.5 Create `/app/components/DirectMessageModal.tsx`
    - Port from existing with `"use client"` directive
    - _Requirements: 8.1_

- [x] 7. Create main application client component
  - [x] 7.1 Create `/app/components/AppClient.tsx`
    - Port App.tsx logic with `"use client"` directive
    - State management (messages, medicalData, viewMode, etc.)
    - API call to `/api/chat` instead of direct Gemini service
    - View mode toggle (patient/doctor)
    - Direct messaging state (separate from AI chat)
    - Booking flow integration
    - Mobile sidebar toggle
    - _Requirements: 6.1, 6.2, 6.4, 8.2, 8.5, 8.6, 9.1, 9.5, 12.1, 12.2_
  - [x] 7.2 Write property test for unread message count
    - **Property 6: Unread Message Count Accuracy**
    - **Validates: Requirements 8.2**

- [x] 8. Create Next.js app structure
  - [x] 8.1 Create `/app/layout.tsx` root layout
    - HTML structure with metadata
    - Font configuration
    - Global styles import
    - _Requirements: 1.1_
  - [x] 8.2 Create `/app/page.tsx` main page
    - Import and render AppClient component
    - _Requirements: 1.1_
  - [x] 8.3 Create `/app/globals.css` with Tailwind directives
    - Base Tailwind imports
    - Custom utility classes
    - _Requirements: 1.3_

- [x] 9. Checkpoint - Full integration test
  - Ensure all tests pass, ask the user if questions arise.
  - Verify patient chat flow works end-to-end
  - Verify doctor mode works
  - Verify direct messaging works
  - Verify booking flow works

- [x] 10. Final cleanup and documentation
  - [x] 10.1 Update package.json with Next.js scripts and dependencies
    - Add next, react, react-dom
    - Add @google/genai, react-markdown, lucide-react
    - Configure scripts (dev, build, start)
    - _Requirements: 1.1_
  - [x] 10.2 Create next.config.js with any required configuration
    - _Requirements: 1.1_
  - [x] 10.3 Update README with setup instructions
    - Environment variable setup
    - Development and production commands
    - _Requirements: 2.4_

## Notes

- All tasks including property-based tests are required
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
