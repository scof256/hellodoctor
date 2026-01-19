/**
 * Integration tests for Doctor Profile Editor
 * Tests form submission flow, validation error display, and data preservation
 * Requirements: 1.2, 1.3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

// Mock the tRPC client
const mockGetProfessionalProfile = vi.fn();
const mockUpdateProfessionalProfile = vi.fn();
const mockUploadProfilePhoto = vi.fn();

vi.mock('@/trpc/react', () => ({
  api: {
    doctor: {
      getProfessionalProfile: {
        useQuery: () => mockGetProfessionalProfile(),
      },
      updateProfessionalProfile: {
        useMutation: () => mockUpdateProfessionalProfile(),
      },
      uploadProfilePhoto: {
        useMutation: () => mockUploadProfilePhoto(),
      },
    },
  },
}));

// Mock ProfilePhotoUploader component
vi.mock('@/app/components/ProfilePhotoUploader', () => ({
  ProfilePhotoUploader: ({ currentPhotoUrl, onPhotoUploaded }: any) => (
    <div data-testid="profile-photo-uploader">
      {currentPhotoUrl && <img src={currentPhotoUrl} alt="Profile" />}
      <button onClick={() => onPhotoUploaded?.('https://example.com/photo.jpg', 'photo-key')}>
        Upload Photo
      </button>
    </div>
  ),
}));

// Mock ProfileCompletenessIndicator component
vi.mock('@/app/components/ProfileCompletenessIndicator', () => ({
  ProfileCompletenessIndicator: ({ score, missingFields }: any) => (
    <div data-testid="completeness-indicator">
      <span>Score: {score}%</span>
      <span>Missing: {missingFields.join(', ')}</span>
    </div>
  ),
}));

// Import the component after mocks are set up
import DoctorProfilePage from '@/app/(dashboard)/doctor/profile/page';

describe('Profile Editor Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Form Submission Flow', () => {
    it('should successfully submit valid profile data', async () => {
      // Mock successful profile fetch
      mockGetProfessionalProfile.mockReturnValue({
        data: null,
        isLoading: false,
      });

      // Mock successful profile update
      const mockMutateAsync = vi.fn().mockResolvedValue({
        id: 'profile-1',
        professionalBio: 'Test bio with more than fifty characters to meet the minimum requirement',
        yearsOfExperience: 10,
      });

      mockUpdateProfessionalProfile.mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: false,
      });

      mockUploadProfilePhoto.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      const user = userEvent.setup();
      render(<DoctorProfilePage />);

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByLabelText(/biography/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      // Fill in the biography field using fireEvent for faster execution
      const bioField = screen.getByLabelText(/biography/i);
      await user.clear(bioField);
      await user.type(bioField, 'Test bio with more than fifty characters to meet the minimum requirement');

      // Fill in years of experience
      const experienceField = screen.getByLabelText(/years of experience/i);
      await user.clear(experienceField);
      await user.type(experienceField, '10');

      // Submit the form
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      // Verify the mutation was called with correct data
      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            professionalBio: 'Test bio with more than fifty characters to meet the minimum requirement',
            yearsOfExperience: 10,
          })
        );
      }, { timeout: 5000 });
    });
  });

  describe('Validation Error Display', () => {
    it('should display validation errors for invalid biography length', async () => {
      // Mock profile fetch
      mockGetProfessionalProfile.mockReturnValue({
        data: null,
        isLoading: false,
      });

      mockUpdateProfessionalProfile.mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
      });

      mockUploadProfilePhoto.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      const user = userEvent.setup();
      render(<DoctorProfilePage />);

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByLabelText(/biography/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      // Enter a biography that's too short
      const bioField = screen.getByLabelText(/biography/i);
      await user.type(bioField, 'Too short');

      // Try to submit
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      // Verify validation error is displayed
      await waitFor(() => {
        expect(screen.getByText(/biography must be at least 50 characters/i)).toBeInTheDocument();
      }, { timeout: 5000 });
    });
  });

  describe('Data Preservation on Errors', () => {
    it('should preserve entered data when validation fails', async () => {
      // Mock profile fetch
      mockGetProfessionalProfile.mockReturnValue({
        data: null,
        isLoading: false,
      });

      mockUpdateProfessionalProfile.mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
      });

      mockUploadProfilePhoto.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      const user = userEvent.setup();
      render(<DoctorProfilePage />);

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByLabelText(/biography/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      // Enter data
      const bioText = 'This is a test biography that is too short';
      const bioField = screen.getByLabelText(/biography/i);
      await user.type(bioField, bioText);

      const experienceField = screen.getByLabelText(/years of experience/i);
      await user.type(experienceField, '10');

      // Try to submit (will fail validation)
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      // Wait for validation error
      await waitFor(() => {
        expect(screen.getByText(/biography must be at least 50 characters/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      // Verify data is still in the fields
      expect(bioField).toHaveValue(bioText);
      expect(experienceField).toHaveValue(10);
    });
  });

  describe('Profile Pre-population', () => {
    it('should pre-populate form fields with existing profile data', async () => {
      // Mock existing profile data
      const existingProfile = {
        id: 'profile-1',
        doctorId: 'doctor-1',
        professionalBio: 'Experienced physician with over 15 years in internal medicine',
        yearsOfExperience: 15,
        specializations: ['Internal Medicine', 'Cardiology'],
        education: [],
        certifications: [],
        languages: ['English', 'Spanish'],
        officeAddress: '123 Medical Plaza',
        officePhone: '+1-555-123-4567',
        officeEmail: 'office@example.com',
        consultationFee: 150,
        profilePhotoUrl: 'https://example.com/photo.jpg',
        completenessScore: 85,
      };

      mockGetProfessionalProfile.mockReturnValue({
        data: existingProfile,
        isLoading: false,
      });

      mockUpdateProfessionalProfile.mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
      });

      mockUploadProfilePhoto.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      render(<DoctorProfilePage />);

      // Wait for form to load and populate
      await waitFor(() => {
        const bioField = screen.getByLabelText(/biography/i) as HTMLTextAreaElement;
        expect(bioField.value).toBe(existingProfile.professionalBio);
      }, { timeout: 5000 });

      // Verify all fields are pre-populated
      const experienceField = screen.getByLabelText(/years of experience/i) as HTMLInputElement;
      expect(experienceField.value).toBe('15');

      const addressField = screen.getByLabelText(/office address/i) as HTMLTextAreaElement;
      expect(addressField.value).toBe(existingProfile.officeAddress);

      const phoneField = screen.getByLabelText(/office phone/i) as HTMLInputElement;
      expect(phoneField.value).toBe(existingProfile.officePhone);

      const emailField = screen.getByLabelText(/office email/i) as HTMLInputElement;
      expect(emailField.value).toBe(existingProfile.officeEmail);

      const feeField = screen.getByLabelText(/consultation fee/i) as HTMLInputElement;
      expect(feeField.value).toBe('150');
    });
  });
});
