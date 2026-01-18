'use client';

import React from 'react';
import { FloatingHelp } from './FloatingHelp';
import { getHelpContent } from '../lib/help-content';

/**
 * Example component demonstrating how to use FloatingHelp
 * 
 * Usage:
 * 1. Import FloatingHelp and getHelpContent
 * 2. Add FloatingHelp component to your page/component
 * 3. Pass the appropriate contextId for your screen
 * 4. Optionally customize position (default is bottom-right)
 */

export function PatientHomeWithHelp() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Patient Home Screen</h1>
      <p>This is an example of a patient home screen with help button.</p>
      
      {/* Add FloatingHelp with context-specific content */}
      <FloatingHelp 
        contextId="patient-home" 
        helpContent={getHelpContent('patient-home')}
      />
    </div>
  );
}

export function IntakeScreenWithHelp() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Medical Intake Form</h1>
      <p>This is an example of an intake screen with help button.</p>
      
      {/* Add FloatingHelp with intake-specific content */}
      <FloatingHelp 
        contextId="intake" 
        helpContent={getHelpContent('intake')}
      />
    </div>
  );
}

export function BookingScreenWithHelp() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Book Appointment</h1>
      <p>This is an example of a booking screen with help button.</p>
      
      {/* Add FloatingHelp with booking-specific content */}
      <FloatingHelp 
        contextId="booking" 
        helpContent={getHelpContent('booking')}
        position="bottom-left" // Optional: change position
      />
    </div>
  );
}

export function CustomHelpExample() {
  // You can also provide custom help content directly
  const customHelpContent = {
    title: 'Custom Help',
    description: 'This is custom help content for a specific feature.',
    steps: [
      'Step 1: Do something specific',
      'Step 2: Do something else',
      'Step 3: Complete the task',
    ],
    contactOptions: {
      phone: '+256700000000',
      whatsapp: '256700000000',
      email: 'support@example.com',
    },
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Custom Screen</h1>
      <p>This is an example with custom help content.</p>
      
      {/* Add FloatingHelp with custom content */}
      <FloatingHelp 
        contextId="custom-screen" 
        helpContent={customHelpContent}
      />
    </div>
  );
}
