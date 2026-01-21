# Dr. Gemini - Medical Intake Agent

AI-powered medical intake and clinical decision support system built with Next.js 14+ and Google Gemini AI.

## Features

- **Patient Intake Mode**: AI-guided medical history collection with multi-agent orchestration
- **Doctor Consultation Mode**: Clinical decision support system for healthcare providers
- **Direct Messaging**: Human-to-human communication between patient and doctor
- **SBAR Clinical Handover**: Structured clinical documentation generation
- **Appointment Booking**: Integrated scheduling system
- **Image Analysis**: Upload and analyze medical images, lab results, prescriptions

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **AI**: Google Gemini API with A2A (Agent-to-Agent) Protocol
- **Styling**: Tailwind CSS with custom medical theme
- **Testing**: Vitest with fast-check for property-based testing
- **Language**: TypeScript

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Google Gemini API key

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd dr-gemini-nextjs
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Edit `.env.local` and add your Gemini API key:
```
GEMINI_API_KEY=your_api_key_here
```

### Development

Start the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm start
```

### Testing

Run all tests:
```bash
npm run test:run
```

Run tests in watch mode:
```bash
npm test
```

## Project Structure

```
/app
├── api/chat/route.ts      # Chat API endpoint (server-side)
├── components/            # React client components
│   ├── AppClient.tsx      # Main application component
│   ├── ChatInterface.tsx  # Chat UI
│   ├── MedicalSidebar.tsx # Medical data sidebar
│   ├── BookingModal.tsx   # Appointment booking
│   └── DirectChatOverlay.tsx # Direct messaging
├── lib/
│   ├── gemini-service.ts  # Gemini AI service (server-only)
│   └── parse-utils.ts     # Response parsing utilities
├── types/index.ts         # TypeScript definitions
├── layout.tsx             # Root layout
├── page.tsx               # Main page
└── globals.css            # Global styles
```

## Security

- API keys are stored in `.env.local` (server-side only)
- Gemini service logic runs exclusively on the server
- No sensitive code or credentials exposed to the frontend

## A2A Protocol

The application uses an Agent-to-Agent protocol with specialized AI agents:

1. **Triage**: Initial symptom identification
2. **ClinicalInvestigator**: Hypothesis-driven history taking
3. **RecordsClerk**: Medical records and image analysis
4. **HistorySpecialist**: Patient history collection
5. **HandoverSpecialist**: SBAR generation and booking

## License

Private - All rights reserved
