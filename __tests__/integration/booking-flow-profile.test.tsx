/**
 * Integration test for Booking Flow with Profile Integration
 * Tests that doctor profile summary is displayed in booking flow
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import BookingModal from '../../app/components/BookingModal';

// Mock tRPC
const mockGetPublicProfile = vi.fn();
const mockGetAvailableSlots = vi.fn();
const mockCreateAppointment = vi.fn();
const mockInvalidate = vi.fn();

vi.mock('@/trpc/react', () => ({
  api: {
    doctor: {
      getPublicProfile: {
        useQuery: (input: any, options: any) => mockGetPublicProfile(input, options),
      },
    },
    appointment: {
      getAvailableSlots: {
        useQuery: (input: any, options: any) => mockGetAvailableSlots(input, options),
      },
      create: {
        useMutation: () => ({
          mutate: mockCreateAppointment,
          isPending: false,
        }),
      },
    },
    useUtils: () => ({
      intake: {
        getSession: { invalidate: mockInvalidate },
        getMyIntakeSessions: { invalidate: mockInvalidate },
        getAllSessionsWithAppointments: { invalidate: mockInvalidate },
      },
      appointment: {
        getMyAppointments: { invalidate: mockInvalidate },
      },
    }),
  },
}));

describe('Booking Flow Profile Integration', () => {
  const mockOnClose = vi.fn();
  const mockOnBooked = vi.fn();

  const mockDoctorProfile = {
    doctorId: 'doctor-123',
    name: 'Jane Smith',
    profilePhotoUrl: 'https://example.com/photo.jpg',
    specializations: ['Cardiology', 'Internal Medicine', 'Preventive Care'],
    yearsOfExperience: 15,
    consultationFee: 50000,
  };

  const mockSlots = {
    slots: [
      {
        startTime: '09:00',
        endTime: '09:30',
        isAvailable: true,
        location: 'Main Clinic',
      },
      {
        startTime: '10:00',
        endTime: '10:30',
        isAvailable: true,
        location: 'Main Clinic',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    mockGetPublicProfile.mockReturnValue({
      data: mockDoctorProfile,
      isLoading: false,
    });

    mockGetAvailableSlots.mockReturnValue({
      data: mockSlots,
      isLoading: false,
    });
  });

  /**
   * Test: Profile summary display
   * Requirement 7.1, 7.2
   */
  it('should display doctor profile summary in booking modal', async () => {
    render(
      <BookingModal
        isOpen={true}
        onClose={mockOnClose}
        connectionId="conn-123"
        doctorId="doctor-123"
        onBooked={mockOnBooked}
      />
    );

    // Wait for profile to load
    await waitFor(() => {
      expect(screen.getByText('Dr. Jane Smith')).toBeInTheDocument();
    });

    // Verify profile photo is displayed
    const profileImage = screen.getByAltText('Dr. Jane Smith');
    expect(profileImage).toBeInTheDocument();
    expect(profileImage).toHaveAttribute('src', 'https://example.com/photo.jpg');

    // Verify specializations are displayed (at least first 3)
    expect(screen.getByText('Cardiology')).toBeInTheDocument();
    expect(screen.getByText('Internal Medicine')).toBeInTheDocument();
    expect(screen.getByText('Preventive Care')).toBeInTheDocument();

    // Verify years of experience is displayed
    expect(screen.getByText(/15 years exp\./i)).toBeInTheDocument();
  });

  /**
   * Test: Consultation fee visibility
   * Requirement 7.4
   */
  it('should display consultation fee before booking confirmation', async () => {
    render(
      <BookingModal
        isOpen={true}
        onClose={mockOnClose}
        connectionId="conn-123"
        doctorId="doctor-123"
        onBooked={mockOnBooked}
      />
    );

    // Wait for profile to load
    await waitFor(() => {
      expect(screen.getByText('Dr. Jane Smith')).toBeInTheDocument();
    });

    // Verify consultation fee is visible
    expect(screen.getByText(/UGX 50,000/i)).toBeInTheDocument();
  });

  /**
   * Test: View full profile link
   * Requirement 7.3
   */
  it('should provide link to view full doctor profile', async () => {
    render(
      <BookingModal
        isOpen={true}
        onClose={mockOnClose}
        connectionId="conn-123"
        doctorId="doctor-123"
        onBooked={mockOnBooked}
      />
    );

    // Wait for profile to load
    await waitFor(() => {
      expect(screen.getByText('Dr. Jane Smith')).toBeInTheDocument();
    });

    // Verify "View Full Profile" link exists
    const viewProfileLink = screen.getByText(/view full profile/i);
    expect(viewProfileLink).toBeInTheDocument();
    expect(viewProfileLink.closest('a')).toHaveAttribute('href', '/doctor/profile/view/doctor-123');
  });

  /**
   * Test: Profile loading state
   * Requirement 7.1
   */
  it('should show loading skeleton while profile is loading', () => {
    mockGetPublicProfile.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    render(
      <BookingModal
        isOpen={true}
        onClose={mockOnClose}
        connectionId="conn-123"
        doctorId="doctor-123"
        onBooked={mockOnBooked}
      />
    );

    // Verify skeleton is displayed (check for animate-pulse class)
    const skeleton = document.querySelector('.animate-pulse');
    expect(skeleton).toBeInTheDocument();
  });

  /**
   * Test: Profile with minimal data
   * Requirement 7.2
   */
  it('should display profile summary with minimal required fields', async () => {
    const minimalProfile = {
      doctorId: 'doctor-123',
      name: 'John Doe',
      profilePhotoUrl: null,
      specializations: [],
      yearsOfExperience: null,
      consultationFee: null,
    };

    mockGetPublicProfile.mockReturnValue({
      data: minimalProfile,
      isLoading: false,
    });

    render(
      <BookingModal
        isOpen={true}
        onClose={mockOnClose}
        connectionId="conn-123"
        doctorId="doctor-123"
        onBooked={mockOnBooked}
      />
    );

    // Wait for profile to load
    await waitFor(() => {
      expect(screen.getByText('Dr. John Doe')).toBeInTheDocument();
    });

    // Verify name is displayed even without other fields
    expect(screen.getByText('Dr. John Doe')).toBeInTheDocument();
    
    // Verify "View Full Profile" link still exists
    expect(screen.getByText(/view full profile/i)).toBeInTheDocument();
  });

  /**
   * Test: Profile summary positioned before booking controls
   * Requirement 7.1, 7.2
   */
  it('should display profile summary at the top of booking flow', async () => {
    render(
      <BookingModal
        isOpen={true}
        onClose={mockOnClose}
        connectionId="conn-123"
        doctorId="doctor-123"
        onBooked={mockOnBooked}
      />
    );

    // Wait for profile to load
    await waitFor(() => {
      expect(screen.getByText('Dr. Jane Smith')).toBeInTheDocument();
    });

    // Get the modal content
    const modalContent = screen.getByText('Book Appointment').closest('div');
    expect(modalContent).toBeInTheDocument();

    // Verify profile appears before date selection
    const profileElement = screen.getByText('Dr. Jane Smith');
    const dateSelectionElement = screen.getByText(/this week/i);
    
    // Profile should appear in the DOM before date selection
    expect(profileElement.compareDocumentPosition(dateSelectionElement))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  /**
   * Test: Consultation fee remains visible throughout booking flow
   * Requirement 7.4
   */
  it('should keep consultation fee visible while selecting time slots', async () => {
    const user = userEvent.setup();

    render(
      <BookingModal
        isOpen={true}
        onClose={mockOnClose}
        connectionId="conn-123"
        doctorId="doctor-123"
        onBooked={mockOnBooked}
      />
    );

    // Wait for profile to load
    await waitFor(() => {
      expect(screen.getByText('Dr. Jane Smith')).toBeInTheDocument();
    });

    // Verify consultation fee is visible initially
    expect(screen.getByText(/UGX 50,000/i)).toBeInTheDocument();

    // Select a date (if date selection is available)
    const thisWeekButton = screen.getByText(/this week/i);
    await user.click(thisWeekButton);

    // Consultation fee should still be visible
    expect(screen.getByText(/UGX 50,000/i)).toBeInTheDocument();
  });

  /**
   * Test: Profile with many specializations
   * Requirement 7.2
   */
  it('should display up to 3 specializations with overflow indicator', async () => {
    const profileWithManySpecs = {
      ...mockDoctorProfile,
      specializations: ['Cardiology', 'Internal Medicine', 'Preventive Care', 'Geriatrics', 'Pediatrics'],
    };

    mockGetPublicProfile.mockReturnValue({
      data: profileWithManySpecs,
      isLoading: false,
    });

    render(
      <BookingModal
        isOpen={true}
        onClose={mockOnClose}
        connectionId="conn-123"
        doctorId="doctor-123"
        onBooked={mockOnBooked}
      />
    );

    // Wait for profile to load
    await waitFor(() => {
      expect(screen.getByText('Dr. Jane Smith')).toBeInTheDocument();
    });

    // Verify first 3 specializations are displayed
    expect(screen.getByText('Cardiology')).toBeInTheDocument();
    expect(screen.getByText('Internal Medicine')).toBeInTheDocument();
    expect(screen.getByText('Preventive Care')).toBeInTheDocument();

    // Verify overflow indicator
    expect(screen.getByText('+2 more')).toBeInTheDocument();
  });
});
