import { TutorialStep } from '../components/Tutorial';

/**
 * Tutorial content for the WhatsApp-Simple UX
 * Three screens covering the main user journey
 */
export const tutorialSteps: TutorialStep[] = [
  {
    id: 'connect-doctor',
    title: 'Connect to Your Doctor',
    description:
      'Scan your doctor\'s QR code or use their link to connect instantly. It\'s that simple!',
    illustration: '👨‍⚕️',
  },
  {
    id: 'fill-medical-form',
    title: 'Fill Your Medical Form',
    description:
      'Chat with our friendly AI assistant to complete your medical history. Answer questions at your own pace.',
    illustration: '📋',
  },
  {
    id: 'book-appointment',
    title: 'Book Your Appointment',
    description:
      'Choose a time that works for you in just 3 taps. We\'ll send you a reminder before your appointment.',
    illustration: '📅',
  },
];

/**
 * Get tutorial steps for a specific language
 * Currently returns English, but can be extended for localization
 */
export function getTutorialSteps(language: 'en' | 'lg' | 'sw' = 'en'): TutorialStep[] {
  // For now, return English steps
  // In the future, this can be extended to support multiple languages
  return tutorialSteps;
}
