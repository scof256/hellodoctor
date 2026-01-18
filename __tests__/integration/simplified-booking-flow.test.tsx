/**
 * Integration test for Simplified Booking Flow
 * Tests that users can complete booking in 3 taps
 * Requirements: 7.1, 7.2, 7.3, 7.5, 7.6, 7.7
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import SimplifiedBookingModal from '../../app/components/SimplifiedBookingModal';

// Mock tRPC
const mockMutate = vi.fn();
const mockInvalidate = vi.fn();

vi.mock('../../src/trpc/react', () => {
  const mockApi = {
    appointment: {
      getAvailableSlots: {
        useQuery: vi.fn(),
      },
      create: {
        useMutation: vi.fn(),
      },
    },
    useUtils: vi.fn(() => ({
      intake: {
        getSession: {
          invalidate: mockInvalidate,
        },
        getMyIntakeSessions: {
          invalidate: mockInvalidate,
        },
        getAllSessionsWithAppointments: {
          invalidate: mockInvalidate,
        },
      },
      appointment: {
        getMyAppointments: {
          invalidate: mockInvalidate,
        },
      },
    })),
  };
  
  return {
    api: mockApi,
  };
});

describe('Simplified Booking Flow Integration', () => {
  const mockOnClose = vi.fn();
  const mockOnBooked = vi.fn();
  const mockConnectionId = 'conn-123';
  const mockDoctorId = 'doc-456';

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Import the mocked module
    const trpcModule = await import('../../src/trpc/react');
    const { api } = trpcModule;
    
    // Mock getAvailableSlots query
    api.appointment.getAvailableSlots.useQuery.mockReturnValue({
      data: {
        slots: [
          { startTime: '09:00', endTime: '09:30', isAvailable: true, location: 'Clinic A' },
          { startTime: '10:00', endTime: '10:30', isAvailable: true, location: 'Clinic A' },
          { startTime: '11:00', endTime: '11:30', isAvailable: true, location: 'Clinic A' },
          { startTime: '13:00', endTime: '13:30', isAvailable: true, location: 'Clinic A' },
          { startTime: '14:00', endTime: '14:30', isAvailable: true, location: 'Clinic A' },
          { startTime: '18:00', endTime: '18:30', isAvailable: true, location: 'Clinic A' },
          { startTime: '19:00', endTime: '19:30', isAvailable: true, location: 'Clinic A' },
        ],
      },
      isLoading: false,
    });

    // Mock create mutation
    api.appointment.create.useMutation.mockReturnValue({
      mutate: vi.fn((_, { onSuccess }) => {
        // Simulate successful booking
        setTimeout(() => onSuccess(), 0);
      }),
      isPending: false,
    });
  });

  it('should complete booking flow in 3 taps (week -> day -> time)', async () => {
    render(
      <SimplifiedBookingModal
        isOpen={true}
        onClose={mockOnClose}
        connectionId={mockConnectionId}
        doctorId={mockDoctorId}
        onBooked={mockOnBooked}
      />
    );

    // Step 1: Week Selection - should show "This Week" and "Next Week"
    expect(screen.getByText('Choose a Week')).toBeInTheDocument();
    expect(screen.getByText('This Week')).toBeInTheDocument();
    expect(screen.getByText('Next Week')).toBeInTheDocument();

    // Tap 1: Select "This Week"
    const thisWeekButton = screen.getByText('This Week').closest('button');
    expect(thisWeekButton).toBeInTheDocument();
    fireEvent.click(thisWeekButton!);

    // Step 2: Day Selection - should show horizontal scrollable day cards
    await waitFor(() => {
      expect(screen.getByText('Choose a Day')).toBeInTheDocument();
    });

    // Should show day cards (at least today)
    const today = new Date();
    const todayNum = today.getDate();
    const dayCards = screen.getAllByText(todayNum.toString());
    expect(dayCards.length).toBeGreaterThan(0);

    // Tap 2: Select today
    const todayCard = dayCards[0]?.closest('button');
    expect(todayCard).toBeInTheDocument();
    fireEvent.click(todayCard!);

    // Step 3: Time Selection - should show times grouped by Morning/Afternoon/Evening
    await waitFor(() => {
      expect(screen.getByText('Choose a Time')).toBeInTheDocument();
    });

    // Should show time groupings
    expect(screen.getByText('Morning')).toBeInTheDocument();
    expect(screen.getByText('Afternoon')).toBeInTheDocument();
    expect(screen.getByText('Evening')).toBeInTheDocument();

    // Should show available times
    expect(screen.getByText('09:00')).toBeInTheDocument();
    expect(screen.getByText('13:00')).toBeInTheDocument();
    expect(screen.getByText('18:00')).toBeInTheDocument();

    // Tap 3: Select a time (morning slot)
    const morningSlot = screen.getByText('09:00').closest('button');
    expect(morningSlot).toBeInTheDocument();
    fireEvent.click(morningSlot!);

    // Step 4: Confirmation - should show booking details
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Confirm Booking' })).toBeInTheDocument();
    });

    // Should show appointment details
    expect(screen.getByText('Date & Time')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Location')).toBeInTheDocument();

    // Should show confirm button
    const confirmButton = screen.getByRole('button', { name: 'Confirm Booking' });
    expect(confirmButton).toBeInTheDocument();
  });

  it('should show success screen after confirmation', async () => {
    render(
      <SimplifiedBookingModal
        isOpen={true}
        onClose={mockOnClose}
        connectionId={mockConnectionId}
        doctorId={mockDoctorId}
        onBooked={mockOnBooked}
      />
    );

    // Navigate through the flow
    const thisWeekButton = screen.getByText('This Week').closest('button');
    fireEvent.click(thisWeekButton!);

    await waitFor(() => {
      expect(screen.getByText('Choose a Day')).toBeInTheDocument();
    });

    const today = new Date();
    const todayNum = today.getDate();
    const dayCards = screen.getAllByText(todayNum.toString());
    const todayCard = dayCards[0]?.closest('button');
    fireEvent.click(todayCard!);

    await waitFor(() => {
      expect(screen.getByText('Choose a Time')).toBeInTheDocument();
    });

    const morningSlot = screen.getByText('09:00').closest('button');
    fireEvent.click(morningSlot!);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Confirm Booking' })).toBeInTheDocument();
    });

    // Click confirm
    const confirmButton = screen.getByRole('button', { name: 'Confirm Booking' });
    fireEvent.click(confirmButton);

    // Should show success screen
    await waitFor(() => {
      expect(screen.getByText('Booking Confirmed!')).toBeInTheDocument();
    });

    expect(screen.getByText(/Your appointment has been successfully scheduled/i)).toBeInTheDocument();
  });

  it('should allow navigation back through steps', async () => {
    render(
      <SimplifiedBookingModal
        isOpen={true}
        onClose={mockOnClose}
        connectionId={mockConnectionId}
        doctorId={mockDoctorId}
        onBooked={mockOnBooked}
      />
    );

    // Go to day selection
    const thisWeekButton = screen.getByText('This Week').closest('button');
    fireEvent.click(thisWeekButton!);

    await waitFor(() => {
      expect(screen.getByText('Choose a Day')).toBeInTheDocument();
    });

    // Should have back button
    const backButton = screen.getByText('Back').closest('button');
    expect(backButton).toBeInTheDocument();

    // Click back
    fireEvent.click(backButton!);

    // Should return to week selection
    await waitFor(() => {
      expect(screen.getByText('Choose a Week')).toBeInTheDocument();
    });
  });

  it('should group times correctly into Morning, Afternoon, and Evening', async () => {
    render(
      <SimplifiedBookingModal
        isOpen={true}
        onClose={mockOnClose}
        connectionId={mockConnectionId}
        doctorId={mockDoctorId}
        onBooked={mockOnBooked}
      />
    );

    // Navigate to time selection
    const thisWeekButton = screen.getByText('This Week').closest('button');
    fireEvent.click(thisWeekButton!);

    await waitFor(() => {
      expect(screen.getByText('Choose a Day')).toBeInTheDocument();
    });

    const today = new Date();
    const todayNum = today.getDate();
    const dayCards = screen.getAllByText(todayNum.toString());
    const todayCard = dayCards[0]?.closest('button');
    fireEvent.click(todayCard!);

    await waitFor(() => {
      expect(screen.getByText('Choose a Time')).toBeInTheDocument();
    });

    // Verify groupings exist
    expect(screen.getByText('Morning')).toBeInTheDocument();
    expect(screen.getByText('Afternoon')).toBeInTheDocument();
    expect(screen.getByText('Evening')).toBeInTheDocument();

    // Verify times are in correct groups
    // Morning times (< 12:00): 09:00, 10:00, 11:00
    const morningSection = screen.getByText('Morning').parentElement;
    expect(morningSection?.textContent).toContain('09:00');
    expect(morningSection?.textContent).toContain('10:00');
    expect(morningSection?.textContent).toContain('11:00');

    // Afternoon times (12:00-17:00): 13:00, 14:00
    const afternoonSection = screen.getByText('Afternoon').parentElement;
    expect(afternoonSection?.textContent).toContain('13:00');
    expect(afternoonSection?.textContent).toContain('14:00');

    // Evening times (>= 17:00): 18:00, 19:00
    const eveningSection = screen.getByText('Evening').parentElement;
    expect(eveningSection?.textContent).toContain('18:00');
    expect(eveningSection?.textContent).toContain('19:00');
  });

  it('should toggle between in-person and online appointments', async () => {
    render(
      <SimplifiedBookingModal
        isOpen={true}
        onClose={mockOnClose}
        connectionId={mockConnectionId}
        doctorId={mockDoctorId}
        onBooked={mockOnBooked}
      />
    );

    // Navigate to time selection
    const thisWeekButton = screen.getByText('This Week').closest('button');
    fireEvent.click(thisWeekButton!);

    await waitFor(() => {
      expect(screen.getByText('Choose a Day')).toBeInTheDocument();
    });

    const today = new Date();
    const todayNum = today.getDate();
    const dayCards = screen.getAllByText(todayNum.toString());
    const todayCard = dayCards[0]?.closest('button');
    fireEvent.click(todayCard!);

    await waitFor(() => {
      expect(screen.getByText('Choose a Time')).toBeInTheDocument();
    });

    // Should show toggle buttons
    const inPersonButton = screen.getByText('In-person');
    const onlineButton = screen.getByText('Online');
    
    expect(inPersonButton).toBeInTheDocument();
    expect(onlineButton).toBeInTheDocument();

    // Click online
    fireEvent.click(onlineButton);

    // Select a time and go to confirmation
    const morningSlot = screen.getByText('09:00').closest('button');
    fireEvent.click(morningSlot!);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Confirm Booking' })).toBeInTheDocument();
    });

    // Should show "Online (Video Call)" in confirmation
    expect(screen.getByText('Online (Video Call)')).toBeInTheDocument();
  });

  it('should display large, tappable cards for week selection', () => {
    render(
      <SimplifiedBookingModal
        isOpen={true}
        onClose={mockOnClose}
        connectionId={mockConnectionId}
        doctorId={mockDoctorId}
        onBooked={mockOnBooked}
      />
    );

    // Week selection cards should be large and prominent
    const thisWeekButton = screen.getByText('This Week').closest('button');
    const nextWeekButton = screen.getByText('Next Week').closest('button');

    expect(thisWeekButton).toBeInTheDocument();
    expect(nextWeekButton).toBeInTheDocument();

    // Should have calendar icons (check by class name)
    const calendarIcons = document.querySelectorAll('.lucide-calendar');
    expect(calendarIcons.length).toBeGreaterThanOrEqual(2);
  });

  it('should show loading state while fetching slots', async () => {
    const trpcModule = await import('../../src/trpc/react');
    const { api } = trpcModule;
    
    // Mock loading state
    api.appointment.getAvailableSlots.useQuery.mockReturnValue({
      data: null,
      isLoading: true,
    });

    render(
      <SimplifiedBookingModal
        isOpen={true}
        onClose={mockOnClose}
        connectionId={mockConnectionId}
        doctorId={mockDoctorId}
        onBooked={mockOnBooked}
      />
    );

    // Navigate to time selection
    const thisWeekButton = screen.getByText('This Week').closest('button');
    fireEvent.click(thisWeekButton!);

    await waitFor(() => {
      expect(screen.getByText('Choose a Day')).toBeInTheDocument();
    });

    const today = new Date();
    const todayNum = today.getDate();
    const dayCards = screen.getAllByText(todayNum.toString());
    const todayCard = dayCards[0]?.closest('button');
    fireEvent.click(todayCard!);

    await waitFor(() => {
      expect(screen.getByText('Choose a Time')).toBeInTheDocument();
    });

    // Should show skeleton loaders (animated pulse elements)
    const skeletonElements = document.querySelectorAll('.animate-pulse');
    expect(skeletonElements.length).toBeGreaterThan(0);
  });

  it('should handle no available slots gracefully', async () => {
    const trpcModule = await import('../../src/trpc/react');
    const { api } = trpcModule;
    
    // Mock empty slots
    api.appointment.getAvailableSlots.useQuery.mockReturnValue({
      data: {
        slots: [],
      },
      isLoading: false,
    });

    render(
      <SimplifiedBookingModal
        isOpen={true}
        onClose={mockOnClose}
        connectionId={mockConnectionId}
        doctorId={mockDoctorId}
        onBooked={mockOnBooked}
      />
    );

    // Navigate to time selection
    const thisWeekButton = screen.getByText('This Week').closest('button');
    fireEvent.click(thisWeekButton!);

    await waitFor(() => {
      expect(screen.getByText('Choose a Day')).toBeInTheDocument();
    });

    const today = new Date();
    const todayNum = today.getDate();
    const dayCards = screen.getAllByText(todayNum.toString());
    const todayCard = dayCards[0]?.closest('button');
    fireEvent.click(todayCard!);

    await waitFor(() => {
      expect(screen.getByText('Choose a Time')).toBeInTheDocument();
    });

    // Should show no slots message
    expect(screen.getByText('No times available for this day')).toBeInTheDocument();
  });
});
