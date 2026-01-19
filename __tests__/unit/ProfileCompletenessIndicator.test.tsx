import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { ProfileCompletenessIndicator } from '@/app/components/ProfileCompletenessIndicator';
import userEvent from '@testing-library/user-event';

describe('ProfileCompletenessIndicator', () => {
  describe('Requirement 5.1: Display completeness percentage', () => {
    it('should display 0% completeness', () => {
      render(
        <ProfileCompletenessIndicator
          score={0}
          missingFields={['professionalBio', 'specializations', 'education']}
        />
      );

      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('should display 50% completeness', () => {
      render(
        <ProfileCompletenessIndicator
          score={50}
          missingFields={['education', 'certifications']}
        />
      );

      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('should display 100% completeness', () => {
      render(
        <ProfileCompletenessIndicator
          score={100}
          missingFields={[]}
        />
      );

      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('should display intermediate completeness values', () => {
      render(
        <ProfileCompletenessIndicator
          score={75}
          missingFields={['certifications']}
        />
      );

      expect(screen.getByText('75%')).toBeInTheDocument();
    });
  });

  describe('Requirement 5.2: Display missing fields', () => {
    it('should display all missing fields when count is 5 or less', () => {
      const missingFields = [
        'professionalBio',
        'specializations',
        'education',
        'certifications',
        'profilePhoto',
      ];

      render(
        <ProfileCompletenessIndicator
          score={30}
          missingFields={missingFields}
        />
      );

      expect(screen.getByText('Professional Biography')).toBeInTheDocument();
      expect(screen.getByText('Medical Specializations')).toBeInTheDocument();
      expect(screen.getByText('Education History')).toBeInTheDocument();
      expect(screen.getByText('Certifications')).toBeInTheDocument();
      expect(screen.getByText('Profile Photo')).toBeInTheDocument();
    });

    it('should display only first 5 fields when more than 5 are missing', () => {
      const missingFields = [
        'professionalBio',
        'specializations',
        'education',
        'certifications',
        'profilePhoto',
        'languages',
        'officeAddress',
      ];

      render(
        <ProfileCompletenessIndicator
          score={10}
          missingFields={missingFields}
        />
      );

      // First 5 should be visible
      expect(screen.getByText('Professional Biography')).toBeInTheDocument();
      expect(screen.getByText('Medical Specializations')).toBeInTheDocument();
      expect(screen.getByText('Education History')).toBeInTheDocument();
      expect(screen.getByText('Certifications')).toBeInTheDocument();
      expect(screen.getByText('Profile Photo')).toBeInTheDocument();

      // Should show "+2 more fields" indicator
      expect(screen.getByText('+2 more fields')).toBeInTheDocument();

      // Last 2 should not be directly visible
      expect(screen.queryByText('Languages Spoken')).not.toBeInTheDocument();
      expect(screen.queryByText('Office Address')).not.toBeInTheDocument();
    });

    it('should display user-friendly field labels', () => {
      render(
        <ProfileCompletenessIndicator
          score={50}
          missingFields={['yearsOfExperience', 'languages']}
        />
      );

      expect(screen.getByText('Years of Experience')).toBeInTheDocument();
      expect(screen.getByText('Languages Spoken')).toBeInTheDocument();
    });

    it('should show completion message when no fields are missing', () => {
      render(
        <ProfileCompletenessIndicator
          score={100}
          missingFields={[]}
        />
      );

      expect(screen.getByText('🎉 Profile Complete!')).toBeInTheDocument();
      expect(
        screen.getByText(/Your professional profile is fully complete/)
      ).toBeInTheDocument();
    });

    it('should show instruction text when fields are missing', () => {
      render(
        <ProfileCompletenessIndicator
          score={50}
          missingFields={['education']}
        />
      );

      expect(
        screen.getByText('Complete these fields to improve your profile:')
      ).toBeInTheDocument();
    });
  });

  describe('Call-to-action button', () => {
    it('should render button when onCompleteProfile callback is provided and fields are missing', () => {
      const onCompleteProfile = vi.fn();

      render(
        <ProfileCompletenessIndicator
          score={50}
          missingFields={['education']}
          onCompleteProfile={onCompleteProfile}
        />
      );

      expect(screen.getByText('Complete Profile')).toBeInTheDocument();
    });

    it('should not render button when onCompleteProfile is not provided', () => {
      render(
        <ProfileCompletenessIndicator
          score={50}
          missingFields={['education']}
        />
      );

      expect(screen.queryByText('Complete Profile')).not.toBeInTheDocument();
    });

    it('should not render button when profile is complete', () => {
      const onCompleteProfile = vi.fn();

      render(
        <ProfileCompletenessIndicator
          score={100}
          missingFields={[]}
          onCompleteProfile={onCompleteProfile}
        />
      );

      expect(screen.queryByText('Complete Profile')).not.toBeInTheDocument();
    });

    it('should call onCompleteProfile when button is clicked', async () => {
      const user = userEvent.setup();
      const onCompleteProfile = vi.fn();

      render(
        <ProfileCompletenessIndicator
          score={50}
          missingFields={['education']}
          onCompleteProfile={onCompleteProfile}
        />
      );

      const button = screen.getByText('Complete Profile');
      await user.click(button);

      expect(onCompleteProfile).toHaveBeenCalledTimes(1);
    });
  });

  describe('Visual indicators', () => {
    it('should render circular progress bar', () => {
      const { container } = render(
        <ProfileCompletenessIndicator
          score={75}
          missingFields={['education']}
        />
      );

      // Check for SVG element
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();

      // Check for circles (background and progress)
      const circles = container.querySelectorAll('circle');
      expect(circles).toHaveLength(2);
    });

    it('should display "Complete" label', () => {
      render(
        <ProfileCompletenessIndicator
          score={75}
          missingFields={['education']}
        />
      );

      expect(screen.getByText('Complete')).toBeInTheDocument();
    });

    it('should display "Profile Completeness" heading', () => {
      render(
        <ProfileCompletenessIndicator
          score={75}
          missingFields={['education']}
        />
      );

      expect(screen.getByText('Profile Completeness')).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty missing fields array', () => {
      render(
        <ProfileCompletenessIndicator
          score={100}
          missingFields={[]}
        />
      );

      expect(screen.getByText('100%')).toBeInTheDocument();
      expect(screen.getByText('🎉 Profile Complete!')).toBeInTheDocument();
    });

    it('should handle single missing field', () => {
      render(
        <ProfileCompletenessIndicator
          score={90}
          missingFields={['officeAddress']}
        />
      );

      expect(screen.getByText('90%')).toBeInTheDocument();
      expect(screen.getByText('Office Address')).toBeInTheDocument();
    });

    it('should handle exactly 5 missing fields without showing "more" indicator', () => {
      const missingFields = [
        'professionalBio',
        'specializations',
        'education',
        'certifications',
        'profilePhoto',
      ];

      render(
        <ProfileCompletenessIndicator
          score={30}
          missingFields={missingFields}
        />
      );

      expect(screen.queryByText(/more fields/)).not.toBeInTheDocument();
    });

    it('should handle exactly 6 missing fields with "more" indicator', () => {
      const missingFields = [
        'professionalBio',
        'specializations',
        'education',
        'certifications',
        'profilePhoto',
        'languages',
      ];

      render(
        <ProfileCompletenessIndicator
          score={20}
          missingFields={missingFields}
        />
      );

      expect(screen.getByText('+1 more fields')).toBeInTheDocument();
    });
  });
});
