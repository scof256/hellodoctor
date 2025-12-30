# Design Document: Next.js Full-Stack Conversion

## Overview

This design describes the architecture for converting the Dr. Gemini medical intake application from a Vite/React SPA to a full-stack Next.js 14+ application using the App Router. The primary goals are:

1. **Security**: Move all Gemini AI service logic and API keys to server-side API routes
2. **Functionality Preservation**: Maintain 100% feature parity with the existing application
3. **Modern Architecture**: Leverage Next.js App Router patterns with proper client/server component separation

The application will use a clear separation between:
- **Client Components**: Interactive UI (chat, sidebar, modals) marked with `"use client"`
- **Server Components**: Layout and static content
- **API Routes**: All AI/Gemini interactions via `/api/` endpoints

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser (Client)                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ ChatInterface│  │MedicalSidebar│  │ DirectChatOverlay      │  │
│  │ (use client) │  │ (use client) │  │ (use client)           │  │
│  └──────┬──────┘  └──────┬──────┘  └─────────────────────────┘  │
│         │                │                                       │
│         └────────┬───────┘                                       │
│                  ▼                                               │
│         ┌───────────────┐                                        │
│         │   App State   │  (React useState/useEffect)            │
│         │  - messages   │                                        │
│         │  - medicalData│                                        │
│         │  - viewMode   │                                        │
│         └───────┬───────┘                                        │
└─────────────────┼───────────────────────────────────────────────┘
                  │ fetch('/api/chat')
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Next.js Server                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    /api/chat/route.ts                       ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ ││
│  │  │ Orchestrator │──▶│ Agent Router│──▶│ Gemini API Call   │ ││
│  │  │ (determine   │  │ (load prompt)│  │ (GoogleGenAI SDK) │ ││
│  │  │  agent)      │  │              │  │                   │ ││
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Environment: GEMINI_API_KEY (server-only, not NEXT_PUBLIC_)    │
└─────────────────────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Google Gemini API                             │
│                 (gemini-2.0-flash model)                         │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Project Structure

```
/app
├── layout.tsx              # Root layout with metadata, fonts
├── page.tsx                # Main page (server component wrapper)
├── globals.css             # Tailwind + custom medical theme
├── /api
│   └── /chat
│       └── route.ts        # POST handler for chat messages
├── /components
│   ├── AppClient.tsx       # Main client app (converted from App.tsx)
│   ├── ChatInterface.tsx   # Chat UI component
│   ├── MedicalSidebar.tsx  # Sidebar with intake data
│   ├── BookingModal.tsx    # Appointment booking modal
│   ├── DirectChatOverlay.tsx # Direct messaging overlay
│   └── DirectMessageModal.tsx # Direct message compose modal
├── /lib
│   └── gemini-service.ts   # Server-only Gemini service
└── /types
    └── index.ts            # TypeScript type definitions
/.env.local                 # GEMINI_API_KEY (gitignored)
/.env.example               # Template for required env vars
/tailwind.config.ts         # Tailwind with medical theme
/next.config.js             # Next.js configuration
```

### API Route Interface

**POST /api/chat**

Request Body:
```typescript
interface ChatRequest {
  history: Message[];           // Conversation history
  medicalData: MedicalData;     // Current intake state
  mode: 'patient' | 'doctor';   // View mode
}
```

Response Body:
```typescript
interface ChatResponse {
  response: AgentResponse;      // AI response with thought, reply, updatedData
  groundingMetadata?: any;      // Optional grounding sources
}
```

Error Response:
```typescript
interface ErrorResponse {
  error: string;
  details?: string;
}
```

### Component Props Interfaces

```typescript
// ChatInterface
interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (text: string, images: string[]) => void;
  isLoading: boolean;
  currentStage?: IntakeStage;
  completeness?: number;
  variant?: 'patient' | 'doctor';
}

// MedicalSidebar
interface MedicalSidebarProps {
  data: MedicalData;
  thought: DoctorThought;
  onTopicTrigger: (field: keyof MedicalData) => void;
}

// BookingModal
interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (date: string) => void;
}

// DirectChatOverlay
interface DirectChatOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  messages: DirectMessage[];
  onSendMessage: (text: string) => void;
  currentUser: 'doctor' | 'patient';
}
```

## Data Models

### Core Types (preserved from existing)

```typescript
export interface Message {
  id: string;
  role: 'user' | 'model' | 'doctor';
  text: string;
  images?: string[];              // base64 encoded
  timestamp: Date;
  groundingMetadata?: any;
  activeAgent?: AgentRole;
}

export interface DirectMessage {
  id: string;
  sender: 'doctor' | 'patient';
  text: string;
  timestamp: Date;
  read: boolean;
}

export type AgentRole = 
  | 'Triage' 
  | 'ClinicalInvestigator' 
  | 'RecordsClerk' 
  | 'HistorySpecialist' 
  | 'HandoverSpecialist';

export interface MedicalData {
  chiefComplaint: string | null;
  hpi: string | null;
  medicalRecords: string[];
  recordsCheckCompleted: boolean;
  medications: string[];
  allergies: string[];
  pastMedicalHistory: string[];
  familyHistory: string | null;
  socialHistory: string | null;
  reviewOfSystems: string[];
  currentAgent: AgentRole;
  clinicalHandover: SBAR | null;
  ucgRecommendations: string | null;
  bookingStatus: 'collecting' | 'ready' | 'booked';
  appointmentDate?: string;
}

export interface SBAR {
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
}

export interface DoctorThought {
  differentialDiagnosis: {
    condition: string;
    probability: string;
    reasoning: string;
  }[];
  missingInformation: string[];
  strategy: string;
  nextMove: string;
}

export interface AgentResponse {
  thought: DoctorThought;
  reply: string;
  updatedData: Partial<MedicalData>;
  activeAgent: AgentRole;
}

export type IntakeStage = 
  | 'triage' 
  | 'investigation' 
  | 'records' 
  | 'profile' 
  | 'context' 
  | 'summary';
```

### Initial State Constants

```typescript
export const INITIAL_MEDICAL_DATA: MedicalData = {
  chiefComplaint: null,
  hpi: null,
  medicalRecords: [],
  recordsCheckCompleted: false,
  medications: [],
  allergies: [],
  pastMedicalHistory: [],
  familyHistory: null,
  socialHistory: null,
  reviewOfSystems: [],
  currentAgent: 'Triage',
  clinicalHandover: null,
  ucgRecommendations: null,
  bookingStatus: 'collecting'
};

export const INITIAL_THOUGHT: DoctorThought = {
  differentialDiagnosis: [],
  missingInformation: ["Chief Complaint"],
  strategy: "A2A Handshake: Triage Agent",
  nextMove: "Identify Chief Complaint"
};
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*



### Property 1: API Request/Response Contract

*For any* valid chat request containing `history` (array of messages), `medicalData` (MedicalData object), and `mode` ('patient' | 'doctor'), the `/api/chat` endpoint SHALL return a response containing a `response` object with `thought`, `reply`, `updatedData`, and `activeAgent` fields.

**Validates: Requirements 3.2, 3.4, 3.6, 4.3**

### Property 2: JSON Response Parsing Round-Trip

*For any* valid AgentResponse object, serializing it to JSON (as the AI model would return) and then parsing it with the Gemini service's parser SHALL produce an equivalent object with `thought`, `reply`, and `updatedData` fields extracted correctly.

**Validates: Requirements 11.1, 11.2**

### Property 3: Medical Data Array Merge Preservation

*For any* existing MedicalData with array fields (medications, allergies, pastMedicalHistory, medicalRecords, reviewOfSystems) and any update containing new items for those arrays, merging the update SHALL result in a MedicalData object containing all original items plus all new items (union with deduplication).

**Validates: Requirements 11.5**

### Property 4: Agent Role Validity

*For any* successful response from the Gemini service, the `activeAgent` field SHALL be one of the five valid AgentRole values: 'Triage', 'ClinicalInvestigator', 'RecordsClerk', 'HistorySpecialist', or 'HandoverSpecialist'.

**Validates: Requirements 10.2, 10.4**

### Property 5: Doctor Mode Orchestrator Bypass

*For any* chat request with `mode` set to 'doctor', the Gemini service SHALL NOT invoke the A2A orchestrator routing logic and SHALL use the CDSS (Clinical Decision Support System) prompt directly.

**Validates: Requirements 6.3**

### Property 6: Unread Message Count Accuracy

*For any* sequence of direct messages where N messages are sent by the opposite party while the chat is closed, the unread count badge SHALL display exactly N until the chat is opened.

**Validates: Requirements 8.2**

## Error Handling

### API Route Error Handling

```typescript
// /api/chat/route.ts error handling pattern
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.history || !body.medicalData || !body.mode) {
      return NextResponse.json(
        { error: 'Missing required fields', details: 'history, medicalData, and mode are required' },
        { status: 400 }
      );
    }
    
    // Process request...
    const result = await geminiService.sendMessage(body.history, body.medicalData, body.mode);
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

### Client-Side Error Handling

```typescript
// In AppClient.tsx
const handleSendMessage = async (text: string, images: string[]) => {
  setIsLoading(true);
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history: [...messages, userMsg], medicalData, mode: viewMode })
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    // Process successful response...
    
  } catch (error) {
    // Display error message to user
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'model',
      text: "I apologize, but I encountered a connection error. Please try again.",
      timestamp: new Date()
    }]);
  } finally {
    setIsLoading(false);
  }
};
```

### Gemini Service Error Handling

- **Orchestrator Failure**: Default to 'ClinicalInvestigator' agent
- **JSON Parse Failure**: Attempt brace matching fallback, then return raw text
- **Image Analysis Failure**: Return graceful error message, continue with text-only processing
- **API Timeout**: Return connection error message to client

## Testing Strategy

### Dual Testing Approach

This project will use both unit tests and property-based tests for comprehensive coverage:

- **Unit Tests**: Verify specific examples, edge cases, and error conditions
- **Property-Based Tests**: Verify universal properties across generated inputs

### Testing Framework

- **Framework**: Vitest (compatible with Next.js)
- **Property-Based Testing Library**: fast-check
- **Minimum Iterations**: 100 per property test

### Test Organization

```
/__tests__
├── /api
│   └── chat.test.ts           # API route tests
├── /lib
│   └── gemini-service.test.ts # Service logic tests
├── /components
│   └── *.test.tsx             # Component tests
└── /properties
    └── *.property.test.ts     # Property-based tests
```

### Property Test Implementation

Each correctness property will be implemented as a property-based test with:
- Explicit reference to the design document property number
- Tag format: **Feature: nextjs-fullstack-conversion, Property {number}: {property_text}**
- Minimum 100 iterations using fast-check

### Unit Test Coverage

Unit tests will cover:
- API route request validation
- Error response formatting
- Component rendering with various props
- State transitions (booking flow, view mode switching)
- Edge cases (empty messages, missing data fields)

### Integration Test Coverage

Integration tests will verify:
- Full chat flow from UI to API to response rendering
- Image upload and processing flow
- Direct messaging state management
- Booking confirmation flow
