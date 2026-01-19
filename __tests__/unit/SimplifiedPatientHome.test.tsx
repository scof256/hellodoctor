import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { SimplifiedPatientHome } from '@/app/components/SimplifiedPatientHome';
import type { ConnectionSummary, AppointmentSummary } from '@/types/dashboard';

// Mock Next.js navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// Mock useLocalization hook
vi.mock('@/app/hooks/useLocalization', () => ({
  useLocalization: () => ({
    t: (key: string, params?: Record<string, any>) => {
      const translations: Record<string, string> = {
        'home.welcome': 'Welcome',
        'home.nextSteps': 'Here are your next steps',
        'home.getStarted': 'Connect with a doctor to get started',
        'home.noDoctor': 'Connect to a Doctor',
        'home.startIntake': 'Start Medical Form',
        'home.continueIntake': `Continue Medical Form (${params?.progress || 0}%)`,
        'home.bookAppointment': 'Book Appointment',
        'home.viewAppointment': 'Upcoming Appointment',
        'home.scanQR': 'Scan QR Code',
        'home.scanQRSubtitle': 'Connect with a new doctor',
        'tutorial.step1Description': 'Scan a QR code or use a doctor\'s link',
        'intake.startMessage': `Fill out your medical history for ${params?.name || 'your doctor'}`,
        'intake.continueMessage': 'Pick up where you left off',
        'booking.intakeCompleteMessage': `Your medical form is ready. Book a time with ${params?.name || 'your doctor'}`,
        'booking.appointmentWith': `with ${params?.name || 'doctor'}`,
        'dateTime.at': 'at',
      };
      return translations[key] || key;
    },
    formatDate: (date: Date) => date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
    formatTime: (date: Date) => date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
    locale: 'en',
    setLocale: vi.fn(),
  }),
}));

describe('SimplifiedPatientHome Component', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  // Helper to create mock connection data
  const createMockConnection = (
    intakeStatus: 'not_started' | 'in_progress' | 'ready' | 'reviewed',
    completeness: number = 0
  ): ConnectionSummary => ({
    id: 'conn-1',
    status: 'active',
    connectedAt: new Date(),
    doctor: {
      id: 'doc-1',
      firstName: 'John',
      lastName: 'Smith',
      imageUrl: null,
      specialty: 'General Practice',
      clinicName: 'Test Clinic',
    },
    intakeStatus: {
      status: intakeStatus,
      completeness: completeness,
      sessionId: 'session-1',
    },
  });

  // Helper to create mock appointment data
  const createMockAppointment = (): AppointmentSummary => ({
    id: 'apt-1',
    scheduledAt: new Date('2026-02-01T10:00:00'),
    duration: 30,
    status: 'confirmed',
    connectionId: 'conn-1',
    intakeSessionId: 'session-1',
    doctor: {
      id: 'doc-1',
      firstName: 'John',
      lastName: 'Smith',
      imageUrl: null,
      specialty: 'General Practice',
      clinicName: 'Test Clinic',
    },
  });

  describe('Requirement 5.1: Maximum 3 action cards', () => {
    it('should display maximum 3 action cards', () => {
      const connections = [
        createMockConnection('not_started'),
        createMockConnection('in_progress', 50),
        createMockConnection('ready', 100),
      ];

      const { container } = render(
        <SimplifiedPatientHome connections={connections} appointments={[]} />
      );

      // Count ActionCard components by looking for the card structure
      const actionCards = container.querySelectorAll('button[class*="min-h-[120px]"]');
      expect(actionCards.length).toBeLessThanOrEqual(3);
    });

    it('should display exactly 3 cards when multiple connections exist', () => {
      const connections = [
        createMockConnection('not_started'),
        createMockConnection('in_progress', 50),
      ];

      const { container } = render(
        <SimplifiedPatientHome connections={connections} appointments={[]} />
      );

      const actionCards = container.querySelectorAll('button[class*="min-h-[120px]"]');
      expect(actionCards.length).toBe(3); // Primary + secondary + messages
    });
  });

  describe('Requirement 5.2: Start Medical Form when intake not started', () => {
    it('should show "Start Medical Form" card when intake not started', () => {
      const connections = [createMockConnection('not_started')];

      render(<SimplifiedPatientHome connections={connections} appointments={[]} />);

      expect(screen.getByText('Start Medical Form')).toBeInTheDocument();
      expect(
        screen.getByText(/Fill out your medical history for Dr. John Smith/i)
      ).toBeInTheDocument();
    });

    it('should mark "Start Medical Form" card as primary (with hover-pulse)', () => {
      const connections = [createMockConnection('not_started')];

      const { container } = render(
        <SimplifiedPatientHome connections={connections} appointments={[]} />
      );

      // Find the Start Medical Form button
      const startButton = screen.getByText('Start Medical Form').closest('button');
      
      // Check if it has the hover-pulse animation class
      expect(startButton).toHaveClass('animate-pulse-glow-hover');
    });
  });

  describe('Requirement 5.3: Continue Medical Form when incomplete', () => {
    it('should show "Continue Medical Form" with percentage when intake in progress', () => {
      const connections = [createMockConnection('in_progress', 65)];

      render(<SimplifiedPatientHome connections={connections} appointments={[]} />);

      expect(screen.getByText(/Continue Medical Form \(65%\)/i)).toBeInTheDocument();
      // Use getAllByText since the percentage appears in both subtitle and progress indicator
      const percentageTexts = screen.getAllByText(/65% complete/i);
      expect(percentageTexts.length).toBeGreaterThan(0);
    });

    it('should display progress bar for incomplete intake', () => {
      const connections = [createMockConnection('in_progress', 45)];

      const { container } = render(
        <SimplifiedPatientHome connections={connections} appointments={[]} />
      );

      // Check for progress bar
      const progressBar = container.querySelector('div[style*="width: 45%"]');
      expect(progressBar).toBeInTheDocument();
    });

    it('should mark "Continue Medical Form" as primary', () => {
      const connections = [createMockConnection('in_progress', 50)];

      const { container } = render(
        <SimplifiedPatientHome connections={connections} appointments={[]} />
      );

      const continueButton = screen.getByText(/Continue Medical Form \(50%\)/i).closest('button');
      expect(continueButton).toHaveClass('animate-pulse-glow-hover');
    });
  });

  describe('Requirement 5.4: Book Appointment when intake complete', () => {
    it('should show "Book Appointment" when intake is ready', () => {
      const connections = [createMockConnection('ready', 100)];

      render(<SimplifiedPatientHome connections={connections} appointments={[]} />);

      expect(screen.getByText('Book Appointment')).toBeInTheDocument();
      expect(
        screen.getByText(/Your medical form is ready/i)
      ).toBeInTheDocument();
    });

    it('should show "Book Appointment" when intake is reviewed', () => {
      const connections = [createMockConnection('reviewed', 100)];

      render(<SimplifiedPatientHome connections={connections} appointments={[]} />);

      expect(screen.getByText('Book Appointment')).toBeInTheDocument();
    });

    it('should mark "Book Appointment" as primary with green checkmark', () => {
      const connections = [createMockConnection('ready', 100)];

      const { container } = render(
        <SimplifiedPatientHome connections={connections} appointments={[]} />
      );

      const bookButton = screen.getByText('Book Appointment').closest('button');
      expect(bookButton).toHaveClass('animate-pulse-glow-hover');
    });
  });

  describe('Requirement 5.5: Appointment details when booked', () => {
    it('should show appointment details as primary card when appointment exists', () => {
      const connections = [createMockConnection('ready', 100)];
      const appointments = [createMockAppointment()];

      render(
        <SimplifiedPatientHome connections={connections} appointments={appointments} />
      );

      expect(screen.getByText('Upcoming Appointment')).toBeInTheDocument();
      expect(screen.getByText(/02\/01\/2026/i)).toBeInTheDocument();
      expect(screen.getByText(/10:00/i)).toBeInTheDocument();
    });

    it('should prioritize appointment card over other cards', () => {
      const connections = [createMockConnection('ready', 100)];
      const appointments = [createMockAppointment()];

      render(
        <SimplifiedPatientHome connections={connections} appointments={appointments} />
      );

      // Appointment card should be shown
      expect(screen.getByText('Upcoming Appointment')).toBeInTheDocument();
      
      // Book Appointment card should NOT be shown (appointment takes priority)
      expect(screen.queryByText('Book Appointment')).not.toBeInTheDocument();
    });

    it('should mark appointment card as primary', () => {
      const connections = [createMockConnection('ready', 100)];
      const appointments = [createMockAppointment()];

      const { container } = render(
        <SimplifiedPatientHome connections={connections} appointments={appointments} />
      );

      const appointmentButton = screen.getByText('Upcoming Appointment').closest('button');
      expect(appointmentButton).toHaveClass('animate-pulse-glow-hover');
    });
  });

  describe('No connections state', () => {
    it('should show connect message when no connections exist', () => {
      render(<SimplifiedPatientHome connections={[]} appointments={[]} />);

      expect(screen.getByText('Connect to a Doctor')).toBeInTheDocument();
      expect(
        screen.getByText(/Scan a QR code or use a doctor's link/i)
      ).toBeInTheDocument();
    });

    it('should show appropriate welcome message when no connections', () => {
      render(<SimplifiedPatientHome connections={[]} appointments={[]} />);

      expect(screen.getByText('Welcome')).toBeInTheDocument();
      expect(
        screen.getByText(/Connect with a doctor to get started/i)
      ).toBeInTheDocument();
    });
  });

  describe('Doctor info display', () => {
    it('should display doctor information card when connected', () => {
      const connections = [createMockConnection('not_started')];

      render(<SimplifiedPatientHome connections={connections} appointments={[]} />);

      expect(screen.getByText('Dr. John Smith')).toBeInTheDocument();
      expect(screen.getByText('General Practice')).toBeInTheDocument();
    });

    it('should not display doctor info when no connections', () => {
      render(<SimplifiedPatientHome connections={[]} appointments={[]} />);

      expect(screen.queryByText(/Dr\./)).not.toBeInTheDocument();
    });
  });

  describe('Multiple connections handling', () => {
    it('should show secondary doctor card when space available', () => {
      const connections = [
        createMockConnection('ready', 100),
        {
          ...createMockConnection('not_started'),
          id: 'conn-2',
          doctor: {
            id: 'doc-2',
            firstName: 'Jane',
            lastName: 'Doe',
            imageUrl: null,
            specialty: 'Cardiology',
            clinicName: 'Heart Clinic',
          },
        },
      ];

      render(<SimplifiedPatientHome connections={connections} appointments={[]} />);

      // Should show primary doctor's card
      expect(screen.getByText('Book Appointment')).toBeInTheDocument();
      
      // Should show secondary doctor's card
      expect(screen.getByText(/Jane Doe/i)).toBeInTheDocument();
    });

    it('should limit total cards to 3 even with multiple connections', () => {
      const connections = [
        createMockConnection('ready', 100),
        {
          ...createMockConnection('in_progress', 50),
          id: 'conn-2',
        },
        {
          ...createMockConnection('not_started'),
          id: 'conn-3',
        },
      ];

      const { container } = render(
        <SimplifiedPatientHome connections={connections} appointments={[]} />
      );

      const actionCards = container.querySelectorAll('button[class*="min-h-[120px]"]');
      expect(actionCards.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Large icons requirement (Requirement 5.6)', () => {
    it('should use large icons (64px minimum) for action cards', () => {
      const connections = [createMockConnection('not_started')];

      const { container } = render(
        <SimplifiedPatientHome connections={connections} appointments={[]} />
      );

      // Check for icon container with 64px dimensions
      const iconContainer = container.querySelector('div.w-16.h-16');
      expect(iconContainer).toBeInTheDocument();
    });
  });

  describe('QR Scan Card - Requirements 1.1, 1.2, 2.1, 2.2, 2.3', () => {
    it('should include QR scan card when patient has no connections', () => {
      render(<SimplifiedPatientHome connections={[]} appointments={[]} />);

      expect(screen.getByText('Scan QR Code')).toBeInTheDocument();
      expect(screen.getByText('Connect with a new doctor')).toBeInTheDocument();
    });

    it('should include QR scan card when patient has connections', () => {
      const connections = [createMockConnection('not_started')];

      render(<SimplifiedPatientHome connections={connections} appointments={[]} />);

      expect(screen.getByText('Scan QR Code')).toBeInTheDocument();
    });

    it('should include QR scan card when intake is in progress', () => {
      const connections = [createMockConnection('in_progress', 50)];

      render(<SimplifiedPatientHome connections={connections} appointments={[]} />);

      expect(screen.getByText('Scan QR Code')).toBeInTheDocument();
    });

    it('should include QR scan card when intake is complete', () => {
      const connections = [createMockConnection('ready', 100)];

      render(<SimplifiedPatientHome connections={connections} appointments={[]} />);

      expect(screen.getByText('Scan QR Code')).toBeInTheDocument();
    });

    it('should include QR scan card when appointment is booked', () => {
      const connections = [createMockConnection('ready', 100)];
      const appointments = [createMockAppointment()];

      render(
        <SimplifiedPatientHome connections={connections} appointments={appointments} />
      );

      expect(screen.getByText('Scan QR Code')).toBeInTheDocument();
    });

    it('should display QR scan card as first card before "Start Medical Form"', () => {
      const connections = [createMockConnection('not_started')];

      const { container } = render(
        <SimplifiedPatientHome connections={connections} appointments={[]} />
      );

      const actionCards = container.querySelectorAll('button[class*="min-h-[120px]"]');
      const firstCard = actionCards[0];
      
      // First card should contain QR scan text
      expect(firstCard?.textContent).toContain('Scan QR Code');
    });

    it('should display QR scan card as first card before "Continue Medical Form"', () => {
      const connections = [createMockConnection('in_progress', 50)];

      const { container } = render(
        <SimplifiedPatientHome connections={connections} appointments={[]} />
      );

      const actionCards = container.querySelectorAll('button[class*="min-h-[120px]"]');
      const firstCard = actionCards[0];
      
      expect(firstCard?.textContent).toContain('Scan QR Code');
    });

    it('should display QR scan card as first card before "Book Appointment"', () => {
      const connections = [createMockConnection('ready', 100)];

      const { container } = render(
        <SimplifiedPatientHome connections={connections} appointments={[]} />
      );

      const actionCards = container.querySelectorAll('button[class*="min-h-[120px]"]');
      const firstCard = actionCards[0];
      
      expect(firstCard?.textContent).toContain('Scan QR Code');
    });

    it('should display QR scan card as first card before appointment details', () => {
      const connections = [createMockConnection('ready', 100)];
      const appointments = [createMockAppointment()];

      const { container } = render(
        <SimplifiedPatientHome connections={connections} appointments={appointments} />
      );

      const actionCards = container.querySelectorAll('button[class*="min-h-[120px]"]');
      const firstCard = actionCards[0];
      
      expect(firstCard?.textContent).toContain('Scan QR Code');
    });

    it('should navigate to /patient/scan-qr when QR scan card is tapped', () => {
      const connections = [createMockConnection('not_started')];

      render(<SimplifiedPatientHome connections={connections} appointments={[]} />);

      const qrScanButton = screen.getByText('Scan QR Code').closest('button');
      qrScanButton?.click();

      expect(mockPush).toHaveBeenCalledWith('/patient/scan-qr');
    });

    it('should count QR scan card toward the 3-card maximum', () => {
      const connections = [
        createMockConnection('ready', 100),
        {
          ...createMockConnection('in_progress', 50),
          id: 'conn-2',
        },
      ];

      const { container } = render(
        <SimplifiedPatientHome connections={connections} appointments={[]} />
      );

      const actionCards = container.querySelectorAll('button[class*="min-h-[120px]"]');
      
      // Should have exactly 3 cards: QR scan, primary action, secondary action
      expect(actionCards.length).toBe(3);
      
      // First card should be QR scan
      expect(actionCards[0]?.textContent).toContain('Scan QR Code');
    });

    it('should mark QR scan card as non-primary (no pulse animation)', () => {
      const connections = [createMockConnection('not_started')];

      const { container } = render(
        <SimplifiedPatientHome connections={connections} appointments={[]} />
      );

      const qrScanButton = screen.getByText('Scan QR Code').closest('button');
      
      // QR scan card should NOT have pulse animation
      expect(qrScanButton).not.toHaveClass('animate-pulse-glow');
    });

    it('should display QR scan card with multiple connections', () => {
      const connections = [
        createMockConnection('ready', 100),
        {
          ...createMockConnection('not_started'),
          id: 'conn-2',
          doctor: {
            id: 'doc-2',
            firstName: 'Jane',
            lastName: 'Doe',
            imageUrl: null,
            specialty: 'Cardiology',
            clinicName: 'Heart Clinic',
          },
        },
      ];

      render(<SimplifiedPatientHome connections={connections} appointments={[]} />);

      // QR scan card should still be present
      expect(screen.getByText('Scan QR Code')).toBeInTheDocument();
      
      // And should be first
      const { container } = render(
        <SimplifiedPatientHome connections={connections} appointments={[]} />
      );
      const actionCards = container.querySelectorAll('button[class*="min-h-[120px]"]');
      expect(actionCards[0]?.textContent).toContain('Scan QR Code');
    });
  });
});
