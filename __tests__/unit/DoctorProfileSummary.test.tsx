import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DoctorProfileSummary } from '@/app/components/DoctorProfileSummary';

describe('DoctorProfileSummary', () => {
  const mockDoctorId = '123e4567-e89b-12d3-a456-426614174000';

  describe('rendering with complete profile', () => {
    it('should display doctor name with "Dr." prefix', () => {
      render(
        <DoctorProfileSummary
          doctorId={mockDoctorId}
          name="John Smith"
          profilePhotoUrl="https://example.com/photo.jpg"
          specializations={['Cardiology', 'Internal Medicine']}
          yearsOfExperience={15}
          consultationFee={50000}
          currency="UGX"
        />
      );

      expect(screen.getByText('Dr. John Smith')).toBeInTheDocument();
    });

    it('should display profile photo when provided', () => {
      render(
        <DoctorProfileSummary
          doctorId={mockDoctorId}
          name="Jane Doe"
          profilePhotoUrl="https://example.com/photo.jpg"
          specializations={['Pediatrics']}
          yearsOfExperience={10}
          consultationFee={40000}
        />
      );

      const img = screen.getByAltText('Dr. Jane Doe');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg');
    });

    it('should display all specializations when 3 or fewer', () => {
      render(
        <DoctorProfileSummary
          doctorId={mockDoctorId}
          name="Alice Johnson"
          specializations={['Cardiology', 'Internal Medicine', 'Geriatrics']}
          yearsOfExperience={20}
          consultationFee={60000}
        />
      );

      expect(screen.getByText('Cardiology')).toBeInTheDocument();
      expect(screen.getByText('Internal Medicine')).toBeInTheDocument();
      expect(screen.getByText('Geriatrics')).toBeInTheDocument();
      expect(screen.queryByText(/\+\d+ more/)).not.toBeInTheDocument();
    });

    it('should display first 3 specializations and count when more than 3', () => {
      render(
        <DoctorProfileSummary
          doctorId={mockDoctorId}
          name="Bob Williams"
          specializations={['Cardiology', 'Internal Medicine', 'Geriatrics', 'Nephrology', 'Endocrinology']}
          yearsOfExperience={25}
          consultationFee={70000}
        />
      );

      expect(screen.getByText('Cardiology')).toBeInTheDocument();
      expect(screen.getByText('Internal Medicine')).toBeInTheDocument();
      expect(screen.getByText('Geriatrics')).toBeInTheDocument();
      expect(screen.getByText('+2 more')).toBeInTheDocument();
      expect(screen.queryByText('Nephrology')).not.toBeInTheDocument();
    });

    it('should display years of experience with correct singular/plural', () => {
      const { rerender } = render(
        <DoctorProfileSummary
          doctorId={mockDoctorId}
          name="Carol Davis"
          yearsOfExperience={1}
          consultationFee={30000}
        />
      );

      expect(screen.getByText('1 year exp.')).toBeInTheDocument();

      rerender(
        <DoctorProfileSummary
          doctorId={mockDoctorId}
          name="Carol Davis"
          yearsOfExperience={5}
          consultationFee={30000}
        />
      );

      expect(screen.getByText('5 years exp.')).toBeInTheDocument();
    });

    it('should display consultation fee with currency', () => {
      render(
        <DoctorProfileSummary
          doctorId={mockDoctorId}
          name="David Brown"
          yearsOfExperience={12}
          consultationFee={50000}
          currency="UGX"
        />
      );

      expect(screen.getByText(/UGX 50,000/)).toBeInTheDocument();
    });

    it('should use default currency UGX when not provided', () => {
      render(
        <DoctorProfileSummary
          doctorId={mockDoctorId}
          name="Eve Martinez"
          yearsOfExperience={8}
          consultationFee={45000}
        />
      );

      expect(screen.getByText(/UGX 45,000/)).toBeInTheDocument();
    });

    it('should display "View Full Profile" link with correct href', () => {
      render(
        <DoctorProfileSummary
          doctorId={mockDoctorId}
          name="Frank Wilson"
          yearsOfExperience={10}
          consultationFee={40000}
        />
      );

      const link = screen.getByRole('link', { name: /View Full Profile/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', `/doctor/profile/view/${mockDoctorId}`);
    });
  });

  describe('rendering with incomplete profile', () => {
    it('should display placeholder icon when no profile photo', () => {
      render(
        <DoctorProfileSummary
          doctorId={mockDoctorId}
          name="Grace Lee"
          profilePhotoUrl={null}
          specializations={['Dermatology']}
          yearsOfExperience={7}
          consultationFee={35000}
        />
      );

      // Check that the placeholder div exists (has specific classes)
      const placeholder = screen.getByText('Dr. Grace Lee').parentElement?.parentElement?.querySelector('.bg-slate-100');
      expect(placeholder).toBeInTheDocument();
    });

    it('should not display specializations section when empty', () => {
      render(
        <DoctorProfileSummary
          doctorId={mockDoctorId}
          name="Henry Taylor"
          specializations={[]}
          yearsOfExperience={5}
          consultationFee={30000}
        />
      );

      // No specialization badges should be present
      const badges = screen.queryAllByText(/Cardiology|Internal Medicine|Pediatrics/);
      expect(badges).toHaveLength(0);
    });

    it('should not display years of experience when null', () => {
      render(
        <DoctorProfileSummary
          doctorId={mockDoctorId}
          name="Iris Anderson"
          specializations={['Psychiatry']}
          yearsOfExperience={null}
          consultationFee={40000}
        />
      );

      expect(screen.queryByText(/year/)).not.toBeInTheDocument();
      expect(screen.queryByText(/exp\./)).not.toBeInTheDocument();
    });

    it('should not display years of experience when undefined', () => {
      render(
        <DoctorProfileSummary
          doctorId={mockDoctorId}
          name="Jack Thomas"
          specializations={['Orthopedics']}
          yearsOfExperience={undefined}
          consultationFee={45000}
        />
      );

      expect(screen.queryByText(/year/)).not.toBeInTheDocument();
      expect(screen.queryByText(/exp\./)).not.toBeInTheDocument();
    });

    it('should not display consultation fee when null', () => {
      render(
        <DoctorProfileSummary
          doctorId={mockDoctorId}
          name="Karen White"
          specializations={['Neurology']}
          yearsOfExperience={10}
          consultationFee={null}
        />
      );

      expect(screen.queryByText(/UGX/)).not.toBeInTheDocument();
    });

    it('should not display consultation fee when undefined', () => {
      render(
        <DoctorProfileSummary
          doctorId={mockDoctorId}
          name="Leo Harris"
          specializations={['Radiology']}
          yearsOfExperience={8}
          consultationFee={undefined}
        />
      );

      expect(screen.queryByText(/UGX/)).not.toBeInTheDocument();
    });

    it('should handle profile with no specializations, experience, or fee', () => {
      render(
        <DoctorProfileSummary
          doctorId={mockDoctorId}
          name="Maria Garcia"
          specializations={[]}
          yearsOfExperience={null}
          consultationFee={null}
        />
      );

      // Should still display name and link
      expect(screen.getByText('Dr. Maria Garcia')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /View Full Profile/i })).toBeInTheDocument();
      
      // Should not display any badges or info
      expect(screen.queryByText(/year/)).not.toBeInTheDocument();
      expect(screen.queryByText(/UGX/)).not.toBeInTheDocument();
    });
  });

  describe('"View Full Profile" link', () => {
    it('should always display "View Full Profile" link regardless of profile completeness', () => {
      const { rerender } = render(
        <DoctorProfileSummary
          doctorId={mockDoctorId}
          name="Nancy Rodriguez"
          specializations={['Surgery', 'Trauma']}
          yearsOfExperience={15}
          consultationFee={80000}
        />
      );

      expect(screen.getByRole('link', { name: /View Full Profile/i })).toBeInTheDocument();

      rerender(
        <DoctorProfileSummary
          doctorId={mockDoctorId}
          name="Nancy Rodriguez"
          specializations={[]}
          yearsOfExperience={null}
          consultationFee={null}
        />
      );

      expect(screen.getByRole('link', { name: /View Full Profile/i })).toBeInTheDocument();
    });

    it('should use correct doctor ID in link href', () => {
      const customDoctorId = '987e6543-e21b-12d3-a456-426614174999';
      
      render(
        <DoctorProfileSummary
          doctorId={customDoctorId}
          name="Oscar Martinez"
          yearsOfExperience={10}
          consultationFee={50000}
        />
      );

      const link = screen.getByRole('link', { name: /View Full Profile/i });
      expect(link).toHaveAttribute('href', `/doctor/profile/view/${customDoctorId}`);
    });
  });
});
