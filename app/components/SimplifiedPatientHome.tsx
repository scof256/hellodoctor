"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ActionCard } from "./ActionCard";
import { LanguageSelector } from "./LanguageSelector";
import { useLocalization } from "../hooks/useLocalization";
import { ClipboardList, Calendar, CheckCircle2, Clock } from "lucide-react";
import type { ConnectionSummary, AppointmentSummary } from "@/types/dashboard";

interface SimplifiedPatientHomeProps {
  connections: ConnectionSummary[];
  appointments: AppointmentSummary[];
}

/**
 * SimplifiedPatientHome Component
 * 
 * Displays maximum 3 action cards based on patient's current state.
 * Implements Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 * 
 * Card Priority Logic:
 * 1. If appointment booked: Show appointment details (primary)
 * 2. If intake complete: Show "Book Appointment" (primary)
 * 3. If intake in progress: Show "Continue Medical Form (X%)" (primary)
 * 4. If intake not started: Show "Start Medical Form" (primary with pulse)
 * 
 * Maximum 3 cards displayed at any time.
 */
export function SimplifiedPatientHome({
  connections,
  appointments,
}: SimplifiedPatientHomeProps) {
  const router = useRouter();
  const { t, formatDate, formatTime } = useLocalization();

  // Get the primary connection (most recent)
  const primaryConnection = connections[0];

  // Get the next upcoming appointment
  const nextAppointment = appointments[0];

  // Determine which action cards to show (max 3)
  const actionCards: Array<{
    key: string;
    title: string;
    subtitle?: string;
    icon: React.ReactNode;
    iconColor: string;
    progress?: number;
    isPrimary: boolean;
    onTap: () => void;
  }> = [];

  if (!primaryConnection) {
    // No connections - show connect message
    actionCards.push({
      key: "connect",
      title: t('home.noDoctor'),
      subtitle: t('tutorial.step1Description'),
      icon: <ClipboardList className="w-8 h-8" />,
      iconColor: "#25D366",
      isPrimary: true,
      onTap: () => {
        // Show instructions or navigate to help
        // For now, we'll show an alert with instructions
        alert(t('home.connectInstructions') || 'To connect with a doctor:\n\n1. Ask your doctor for their QR code or connection link\n2. Scan the QR code or click the link\n3. Sign in or create an account\n4. You will be automatically connected!');
      },
    });
  } else {
    const intakeStatus = primaryConnection.intakeStatus;
    const doctorName = `Dr. ${primaryConnection.doctor.firstName || ""} ${
      primaryConnection.doctor.lastName || ""
    }`.trim();

    // Check if there's an upcoming appointment
    if (nextAppointment) {
      // Show appointment details as primary card
      const appointmentDate = new Date(nextAppointment.scheduledAt);
      const formattedDate = formatDate(appointmentDate);
      const formattedTime = formatTime(appointmentDate);

      actionCards.push({
        key: "appointment",
        title: t('home.viewAppointment'),
        subtitle: `${formattedDate} ${t('dateTime.at')} ${formattedTime} ${t('booking.appointmentWith', { name: doctorName.replace('Dr. ', '') })}`,
        icon: <Calendar className="w-8 h-8" />,
        iconColor: "#25D366",
        isPrimary: true,
        onTap: () => {
          router.push("/patient/appointments");
        },
      });
    } else if (
      intakeStatus?.status === "ready" ||
      intakeStatus?.status === "reviewed"
    ) {
      // Intake complete - show "Book Appointment" as primary
      actionCards.push({
        key: "book",
        title: t('home.bookAppointment'),
        subtitle: t('booking.intakeCompleteMessage', { name: doctorName }),
        icon: <CheckCircle2 className="w-8 h-8" />,
        iconColor: "#25D366",
        isPrimary: true,
        onTap: () => {
          router.push(`/patient/intake/${primaryConnection.id}`);
        },
      });
    } else if (intakeStatus?.status === "in_progress") {
      // Intake in progress - show "Continue Medical Form (X%)"
      const completeness = intakeStatus.completeness || 0;
      actionCards.push({
        key: "continue-intake",
        title: t('home.continueIntake', { progress: completeness }),
        subtitle: t('intake.continueMessage'),
        icon: <Clock className="w-8 h-8" />,
        iconColor: "#FFA500",
        progress: completeness,
        isPrimary: true,
        onTap: () => {
          router.push(`/patient/intake/${primaryConnection.id}`);
        },
      });
    } else {
      // Intake not started - show "Start Medical Form" with pulse
      actionCards.push({
        key: "start-intake",
        title: t('home.startIntake'),
        subtitle: t('intake.startMessage', { name: doctorName }),
        icon: <ClipboardList className="w-8 h-8" />,
        iconColor: "#25D366",
        isPrimary: true,
        onTap: () => {
          router.push(`/patient/intake/${primaryConnection.id}`);
        },
      });
    }

    // Add secondary cards if we have room (max 3 total)
    if (actionCards.length < 3 && connections.length > 1) {
      // Show second doctor if available
      const secondConnection = connections[1];
      if (secondConnection) {
        const secondDoctorName = `Dr. ${
          secondConnection.doctor.firstName || ""
        } ${secondConnection.doctor.lastName || ""}`.trim();
        const secondIntakeStatus = secondConnection.intakeStatus;

        if (
          secondIntakeStatus?.status === "ready" ||
          secondIntakeStatus?.status === "reviewed"
        ) {
          actionCards.push({
            key: "book-second",
            title: "Book with Another Doctor",
            subtitle: `Book appointment with ${secondDoctorName}`,
            icon: <Calendar className="w-8 h-8" />,
            iconColor: "#0088CC",
            isPrimary: false,
            onTap: () => {
              router.push(`/patient/intake/${secondConnection.id}`);
            },
          });
        } else if (secondIntakeStatus?.status === "in_progress") {
          actionCards.push({
            key: "continue-second",
            title: "Continue Form",
            subtitle: `${secondIntakeStatus.completeness}% complete with ${secondDoctorName}`,
            icon: <Clock className="w-8 h-8" />,
            iconColor: "#0088CC",
            progress: secondIntakeStatus.completeness,
            isPrimary: false,
            onTap: () => {
              router.push(`/patient/intake/${secondConnection.id}`);
            },
          });
        } else {
          actionCards.push({
            key: "start-second",
            title: "Start Form",
            subtitle: `Fill out medical history for ${secondDoctorName}`,
            icon: <ClipboardList className="w-8 h-8" />,
            iconColor: "#0088CC",
            isPrimary: false,
            onTap: () => {
              router.push(`/patient/intake/${secondConnection.id}`);
            },
          });
        }
      }
    }

    // Add "View Messages" card if we still have room
    if (actionCards.length < 3) {
      actionCards.push({
        key: "messages",
        title: "View Messages",
        subtitle: "Chat with your doctors",
        icon: <span className="text-4xl">💬</span>,
        iconColor: "#0088CC",
        isPrimary: false,
        onTap: () => {
          router.push("/patient/messages");
        },
      });
    }
  }

  // Ensure we only show maximum 3 cards (Requirements: 5.1)
  const displayCards = actionCards.slice(0, 3);

  return (
    <div className="space-y-4">
      {/* Welcome Header with Language Selector */}
      <div className="mb-6 flex items-start justify-between">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">{t('home.welcome')}</h1>
          <p className="text-gray-600 mt-2 text-lg">
            {primaryConnection
              ? t('home.nextSteps')
              : t('home.getStarted')}
          </p>
        </div>
        <div className="ml-4">
          <LanguageSelector variant="dropdown" className="min-w-[150px]" />
        </div>
      </div>

      {/* Action Cards - Maximum 3 */}
      <div className="space-y-4">
        {displayCards.map((card) => (
          <ActionCard
            key={card.key}
            title={card.title}
            subtitle={card.subtitle}
            icon={card.icon}
            iconColor={card.iconColor}
            progress={card.progress}
            isPrimary={card.isPrimary}
            onTap={card.onTap}
          />
        ))}
      </div>

      {/* Doctor Info Card (if connected) */}
      {primaryConnection && (
        <div className="mt-8 p-4 bg-gray-50 rounded-xl border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#25D366] bg-opacity-20 flex items-center justify-center">
              {primaryConnection.doctor.imageUrl ? (
                <img
                  src={primaryConnection.doctor.imageUrl}
                  alt="Doctor"
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <span className="text-2xl font-bold text-[#25D366]">
                  {primaryConnection.doctor.firstName?.charAt(0) || "D"}
                </span>
              )}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">
                Dr. {primaryConnection.doctor.firstName}{" "}
                {primaryConnection.doctor.lastName}
              </p>
              <p className="text-sm text-gray-600">
                {primaryConnection.doctor.specialty || "General Practice"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
