/**
 * Example integrations for ConfirmationScreen component
 * 
 * This file demonstrates how to integrate confirmation screens
 * for various user flows as specified in Requirements 4.3 and 7.7
 */

import React from 'react';
import { ConfirmationScreen } from './ConfirmationScreen';
import { CheckCircle, UserPlus, ClipboardCheck } from 'lucide-react';

/**
 * Example: Connection Success Confirmation
 * Requirements: 4.3
 * 
 * Shows after a patient successfully connects to a doctor
 */
export function ConnectionSuccessConfirmation({
  doctorName,
  doctorPhoto,
  doctorSpecialty,
  onContinue,
  onClose,
}: {
  doctorName: string;
  doctorPhoto?: string;
  doctorSpecialty?: string;
  onContinue: () => void;
  onClose: () => void;
}) {
  return (
    <ConfirmationScreen
      icon={<UserPlus className="text-[#25D366]" />}
      title="Connected Successfully!"
      message={`You are now connected with ${doctorName}`}
      details={[
        {
          label: 'Doctor',
          value: doctorName,
        },
        ...(doctorSpecialty
          ? [
              {
                label: 'Specialty',
                value: doctorSpecialty,
              },
            ]
          : []),
      ]}
      primaryAction={{
        label: 'Start Medical Form',
        onTap: onContinue,
      }}
      secondaryAction={{
        label: 'View Profile',
        onTap: onClose,
      }}
      autoClose={5000}
      onClose={onClose}
    />
  );
}

/**
 * Example: Intake Completion Confirmation
 * Requirements: 7.7
 * 
 * Shows after a patient completes their medical intake
 */
export function IntakeCompletionConfirmation({
  doctorName,
  onBookAppointment,
  onViewSummary,
  onClose,
}: {
  doctorName: string;
  onBookAppointment: () => void;
  onViewSummary: () => void;
  onClose: () => void;
}) {
  return (
    <ConfirmationScreen
      icon={<ClipboardCheck className="text-[#25D366]" />}
      title="Medical Form Complete!"
      message="Great job! Your medical information has been submitted successfully."
      details={[
        {
          label: 'Doctor',
          value: doctorName,
        },
        {
          label: 'Status',
          value: 'Ready for Review',
        },
      ]}
      primaryAction={{
        label: 'Book Appointment',
        onTap: onBookAppointment,
      }}
      secondaryAction={{
        label: 'View Summary',
        onTap: onViewSummary,
      }}
      autoClose={4000}
      onClose={onClose}
    />
  );
}

/**
 * Example: Generic Success Confirmation
 * 
 * Reusable confirmation for any successful action
 */
export function GenericSuccessConfirmation({
  title,
  message,
  details,
  primaryActionLabel,
  onPrimaryAction,
  onClose,
}: {
  title: string;
  message: string;
  details?: Array<{ label: string; value: string }>;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  onClose: () => void;
}) {
  return (
    <ConfirmationScreen
      icon={<CheckCircle className="text-[#25D366]" />}
      title={title}
      message={message}
      details={details}
      primaryAction={
        primaryActionLabel && onPrimaryAction
          ? {
              label: primaryActionLabel,
              onTap: onPrimaryAction,
            }
          : undefined
      }
      autoClose={3000}
      onClose={onClose}
    />
  );
}
