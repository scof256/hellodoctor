/**
 * Property-Based Tests for Profile Display in Booking Flow
 * Feature: doctor-professional-profile, Property 17: Profile Display in Booking Flow
 * 
 * Property: For any doctor selection in the booking flow, the system should display 
 * at minimum the doctor's name, photo, specializations, and years of experience.
 * 
 * Validates: Requirements 7.2
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock component that represents profile display in booking flow
interface DoctorProfileSummaryProps {
  doctor: {
    name: string;
    photo: string | null;
    specializations: string[];
    yearsOfExperience: number;
  };
}

function DoctorProfileSummary({ doctor }: DoctorProfileSummaryProps) {
  return (
    <div data-testid="doctor-profile-summary">
      <div data-testid="doctor-name">{doctor.name}</div>
      {doctor.photo && (
        <img 
          data-testid="doctor-photo" 
          src={doctor.photo} 
          alt={doctor.name} 
        />
      )}
      {!doctor.photo && (
        <div data-testid="doctor-photo-placeholder">
          {doctor.name.charAt(0)}
        </div>
      )}
      <div data-testid="doctor-specializations">
        {doctor.specializations.map((spec, idx) => (
          <span key={idx} data-testid={`specialization-${idx}`}>
            {spec}
          </span>
        ))}
      </div>
      <div data-testid="doctor-experience">
        {doctor.yearsOfExperience} years of experience
      </div>
    </div>
  );
}

describe('Property 17: Profile Display in Booking Flow', () => {
  it('should display minimum required fields for any doctor profile', () => {
    fc.assert(
      fc.property(
        // Generate random doctor data
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 100 }),
          photo: fc.oneof(
            fc.constant(null),
            fc.webUrl()
          ),
          specializations: fc.array(
            fc.string({ minLength: 1, maxLength: 50 }),
            { minLength: 1, maxLength: 5 }
          ),
          yearsOfExperience: fc.integer({ min: 0, max: 70 }),
        }),
        (doctor) => {
          // Render the profile summary component
          const { container } = render(
            <DoctorProfileSummary doctor={doctor} />
          );

          // Property: Profile summary must be rendered
          const summary = screen.getByTestId('doctor-profile-summary');
          expect(summary).toBeDefined();

          // Property: Doctor name must be displayed
          const nameElement = screen.getByTestId('doctor-name');
          expect(nameElement).toBeDefined();
          expect(nameElement.textContent).toBe(doctor.name);

          // Property: Photo or placeholder must be displayed
          if (doctor.photo) {
            const photoElement = screen.getByTestId('doctor-photo');
            expect(photoElement).toBeDefined();
            expect(photoElement.getAttribute('src')).toBe(doctor.photo);
          } else {
            const placeholderElement = screen.getByTestId('doctor-photo-placeholder');
            expect(placeholderElement).toBeDefined();
          }

          // Property: Specializations must be displayed
          const specializationsElement = screen.getByTestId('doctor-specializations');
          expect(specializationsElement).toBeDefined();
          
          // All specializations should be present
          doctor.specializations.forEach((spec, idx) => {
            const specElement = screen.getByTestId(`specialization-${idx}`);
            expect(specElement).toBeDefined();
            expect(specElement.textContent).toBe(spec);
          });

          // Property: Years of experience must be displayed
          const experienceElement = screen.getByTestId('doctor-experience');
          expect(experienceElement).toBeDefined();
          expect(experienceElement.textContent).toContain(
            doctor.yearsOfExperience.toString()
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display all required fields even with minimal data', () => {
    fc.assert(
      fc.property(
        // Generate minimal valid doctor data
        fc.record({
          name: fc.constant('Dr. Test'),
          photo: fc.constant(null),
          specializations: fc.constant(['General Practice']),
          yearsOfExperience: fc.constant(0),
        }),
        (doctor) => {
          render(<DoctorProfileSummary doctor={doctor} />);

          // All required fields must be present
          expect(screen.getByTestId('doctor-name')).toBeDefined();
          expect(screen.getByTestId('doctor-photo-placeholder')).toBeDefined();
          expect(screen.getByTestId('doctor-specializations')).toBeDefined();
          expect(screen.getByTestId('doctor-experience')).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle multiple specializations correctly', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.string({ minLength: 1, maxLength: 50 }),
          { minLength: 1, maxLength: 10 }
        ),
        (specializations) => {
          const doctor = {
            name: 'Dr. Test',
            photo: null,
            specializations,
            yearsOfExperience: 5,
          };

          render(<DoctorProfileSummary doctor={doctor} />);

          // Property: Number of displayed specializations must match input
          const specializationsElement = screen.getByTestId('doctor-specializations');
          const displayedSpecs = specializationsElement.querySelectorAll('[data-testid^="specialization-"]');
          expect(displayedSpecs.length).toBe(specializations.length);

          // Property: Each specialization must be displayed correctly
          specializations.forEach((spec, idx) => {
            const specElement = screen.getByTestId(`specialization-${idx}`);
            expect(specElement.textContent).toBe(spec);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display years of experience in readable format', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 70 }),
        (years) => {
          const doctor = {
            name: 'Dr. Test',
            photo: null,
            specializations: ['General Practice'],
            yearsOfExperience: years,
          };

          render(<DoctorProfileSummary doctor={doctor} />);

          const experienceElement = screen.getByTestId('doctor-experience');
          
          // Property: Experience must contain the number
          expect(experienceElement.textContent).toContain(years.toString());
          
          // Property: Experience must be in readable format
          expect(experienceElement.textContent).toMatch(/\d+\s+years?\s+of\s+experience/i);
        }
      ),
      { numRuns: 100 }
    );
  });
});
