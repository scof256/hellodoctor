/**
 * Unit tests for profile publication controls
 * Tests publish button visibility, unpublish button visibility, and verification status check
 * Requirements: 3.1, 3.2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DoctorProfilePage from '@/app/(dashboard)/doctor/profile/page';
import { api } from '@/trpc/react';

// Mock the tRPC hooks
vi.mock('@/trpc/react', async () => {
  const actual = await vi.importActual('@/trpc/react');
  return {
    ...actual,
    api: {
      doctor: {
        getProfessionalProfile: {
          useQuery: vi.fn(),
        },
        updateProfessionalProfile: {
          useMutation: vi.fn(),
        },
        uploadProfilePhoto: {
          useMutation: vi.fn(),
        },
        deleteProfilePhoto: {
          useMutation: vi.fn(),
        },
        publishProfile: {
          useMutation: vi.fn(),
        },
        unpublishProfile: {
          useMutation: vi.fn(),
        },
      },
    },
  };
});

describe('Profile Publication Controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper function to setup common mocks
  const setupMocks = (profileData: any) => {
    (api.doctor.getProfessionalProfile.useQuery as any).mockReturnValue({
      data: profileData,
      isLoading: false,
      refetch: vi.fn(),
    });

    (api.doctor.updateProfessionalProfile.useMutation as any).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });

    (api.doctor.uploadProfilePhoto.useMutation as any).mockReturnValue({
      mutateAsync: vi.fn(),
    });

    (api.doctor.deleteProfilePhoto.useMutation as any).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });

    (api.doctor.publishProfile.useMutation as any).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });

    (api.doctor.unpublishProfile.useMutation as any).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
  };

  describe('Publish Button Visibility', () => {
    it('should show publish button when profile is not published and doctor is verified', async () => {
      setupMocks({
        id: 'profile-1',
        doctorId: 'doctor-1',
        isPublished: false,
        completenessScore: 80,
        doctor: {
          id: 'doctor-1',
          userId: 'user-1',
          slug: 'dr-smith',
          verificationStatus: 'verified',
        },
        user: {
          id: 'user-1',
          email: 'doctor@example.com',
          firstName: 'John',
          lastName: 'Smith',
        },
      });

      render(<DoctorProfilePage />);

      // Wait for component to render
      await waitFor(() => {
        expect(screen.getByText('Profile Publication')).toBeInTheDocument();
      });

      // Publish button should be visible
      const publishButton = screen.getByRole('button', { name: /publish profile/i });
      expect(publishButton).toBeInTheDocument();
      expect(publishButton).not.toBeDisabled();

      // Unpublish button should not be visible
      expect(screen.queryByRole('button', { name: /unpublish profile/i })).not.toBeInTheDocument();
    });

    it('should disable publish button when doctor is not verified', async () => {
      setupMocks({
        id: 'profile-1',
        doctorId: 'doctor-1',
        isPublished: false,
        completenessScore: 80,
        doctor: {
          id: 'doctor-1',
          userId: 'user-1',
          slug: 'dr-smith',
          verificationStatus: 'pending',
        },
        user: {
          id: 'user-1',
          email: 'doctor@example.com',
          firstName: 'John',
          lastName: 'Smith',
        },
      });

      render(<DoctorProfilePage />);

      // Wait for component to render
      await waitFor(() => {
        expect(screen.getByText('Profile Publication')).toBeInTheDocument();
      });

      // Publish button should be disabled
      const publishButton = screen.getByRole('button', { name: /publish profile/i });
      expect(publishButton).toBeInTheDocument();
      expect(publishButton).toBeDisabled();

      // Verification warning should be visible
      expect(screen.getByText('Verification Required')).toBeInTheDocument();
      expect(screen.getByText(/current status:/i)).toBeInTheDocument();
    });
  });

  describe('Unpublish Button Visibility', () => {
    it('should show unpublish button when profile is published', async () => {
      setupMocks({
        id: 'profile-1',
        doctorId: 'doctor-1',
        isPublished: true,
        completenessScore: 80,
        doctor: {
          id: 'doctor-1',
          userId: 'user-1',
          slug: 'dr-smith',
          verificationStatus: 'verified',
        },
        user: {
          id: 'user-1',
          email: 'doctor@example.com',
          firstName: 'John',
          lastName: 'Smith',
        },
      });

      render(<DoctorProfilePage />);

      // Wait for component to render
      await waitFor(() => {
        expect(screen.getByText('Profile Publication')).toBeInTheDocument();
      });

      // Unpublish button should be visible
      const unpublishButton = screen.getByRole('button', { name: /unpublish profile/i });
      expect(unpublishButton).toBeInTheDocument();
      expect(unpublishButton).not.toBeDisabled();

      // Publish button should not be visible
      expect(screen.queryByRole('button', { name: /^publish profile$/i })).not.toBeInTheDocument();

      // Published status should be shown
      expect(screen.getByText('Profile is Published')).toBeInTheDocument();
    });
  });

  describe('Verification Status Check', () => {
    it('should show verification warning for pending status', async () => {
      setupMocks({
        id: 'profile-1',
        doctorId: 'doctor-1',
        isPublished: false,
        completenessScore: 80,
        doctor: {
          id: 'doctor-1',
          userId: 'user-1',
          slug: 'dr-smith',
          verificationStatus: 'pending',
        },
        user: {
          id: 'user-1',
          email: 'doctor@example.com',
          firstName: 'John',
          lastName: 'Smith',
        },
      });

      render(<DoctorProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('Verification Required')).toBeInTheDocument();
      });

      expect(screen.getByText(/your profile cannot be published/i)).toBeInTheDocument();
      expect(screen.getByText(/pending/i)).toBeInTheDocument();
    });

    it('should show verification warning for rejected status', async () => {
      setupMocks({
        id: 'profile-1',
        doctorId: 'doctor-1',
        isPublished: false,
        completenessScore: 80,
        doctor: {
          id: 'doctor-1',
          userId: 'user-1',
          slug: 'dr-smith',
          verificationStatus: 'rejected',
        },
        user: {
          id: 'user-1',
          email: 'doctor@example.com',
          firstName: 'John',
          lastName: 'Smith',
        },
      });

      render(<DoctorProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('Verification Required')).toBeInTheDocument();
      });

      expect(screen.getByText(/your profile cannot be published/i)).toBeInTheDocument();
      expect(screen.getByText(/rejected/i)).toBeInTheDocument();
    });

    it('should not show verification warning for verified status', async () => {
      setupMocks({
        id: 'profile-1',
        doctorId: 'doctor-1',
        isPublished: false,
        completenessScore: 80,
        doctor: {
          id: 'doctor-1',
          userId: 'user-1',
          slug: 'dr-smith',
          verificationStatus: 'verified',
        },
        user: {
          id: 'user-1',
          email: 'doctor@example.com',
          firstName: 'John',
          lastName: 'Smith',
        },
      });

      render(<DoctorProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('Profile Publication')).toBeInTheDocument();
      });

      // Verification warning should not be visible
      expect(screen.queryByText('Verification Required')).not.toBeInTheDocument();
    });
  });

  describe('Publication Confirmation Dialogs', () => {
    it('should show publish confirmation dialog when publish button is clicked', async () => {
      const user = userEvent.setup();
      
      setupMocks({
        id: 'profile-1',
        doctorId: 'doctor-1',
        isPublished: false,
        completenessScore: 80,
        doctor: {
          id: 'doctor-1',
          userId: 'user-1',
          slug: 'dr-smith',
          verificationStatus: 'verified',
        },
        user: {
          id: 'user-1',
          email: 'doctor@example.com',
          firstName: 'John',
          lastName: 'Smith',
        },
      });

      render(<DoctorProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('Profile Publication')).toBeInTheDocument();
      });

      // Click publish button
      const publishButton = screen.getByRole('button', { name: /publish profile/i });
      await user.click(publishButton);

      // Confirmation dialog should appear
      await waitFor(() => {
        expect(screen.getByText('Publish Your Profile?')).toBeInTheDocument();
      });

      expect(screen.getByText(/publishing your profile will make it visible/i)).toBeInTheDocument();
      expect(screen.getByText(/patients will see your profile information/i)).toBeInTheDocument();
    });

    it('should show unpublish confirmation dialog when unpublish button is clicked', async () => {
      const user = userEvent.setup();
      
      setupMocks({
        id: 'profile-1',
        doctorId: 'doctor-1',
        isPublished: true,
        completenessScore: 80,
        doctor: {
          id: 'doctor-1',
          userId: 'user-1',
          slug: 'dr-smith',
          verificationStatus: 'verified',
        },
        user: {
          id: 'user-1',
          email: 'doctor@example.com',
          firstName: 'John',
          lastName: 'Smith',
        },
      });

      render(<DoctorProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('Profile Publication')).toBeInTheDocument();
      });

      // Click unpublish button
      const unpublishButton = screen.getByRole('button', { name: /unpublish profile/i });
      await user.click(unpublishButton);

      // Confirmation dialog should appear
      await waitFor(() => {
        expect(screen.getByText('Unpublish Your Profile?')).toBeInTheDocument();
      });

      expect(screen.getByText(/unpublishing will hide your profile/i)).toBeInTheDocument();
      expect(screen.getByText(/patients will not see your profile/i)).toBeInTheDocument();
    });
  });
});
