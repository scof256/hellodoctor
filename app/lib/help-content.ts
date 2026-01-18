import { HelpContent } from '../components/FloatingHelp';

/**
 * Help content system for context-sensitive help
 * Provides help content for each screen in the application
 */

// Default contact options
const defaultContactOptions = {
  phone: '+256700000000',
  whatsapp: '256700000000',
  email: 'support@hellodoctor.ug',
};

/**
 * Help content for different screens/contexts
 */
export const helpContentMap: Record<string, HelpContent> = {
  // Home Screen
  home: {
    title: 'Home Screen Help',
    description:
      'This is your home screen. Here you can see your next actions and navigate to different parts of the app.',
    steps: [
      'Tap on any action card to start that task',
      'Use the bottom navigation to switch between sections',
      'Your most important action is always shown at the top',
    ],
    contactOptions: defaultContactOptions,
  },

  // Patient Home
  'patient-home': {
    title: 'Getting Started',
    description:
      'Welcome! Here are the main things you can do in HelloDoctor.',
    steps: [
      'Connect to your doctor by scanning their QR code',
      'Fill out your medical form by chatting with our AI assistant',
      'Book an appointment once your form is complete',
      'Check your messages to communicate with your doctor',
    ],
    contactOptions: defaultContactOptions,
  },

  // Intake/Medical Form
  intake: {
    title: 'Medical Form Help',
    description:
      'Our AI assistant will ask you questions about your health. Answer honestly and take your time.',
    steps: [
      'Read each question carefully',
      'Tap the microphone icon to answer with your voice',
      'Use the camera icon to upload photos if needed',
      'You can skip questions and come back later',
      'Your progress is saved automatically',
    ],
    contactOptions: defaultContactOptions,
  },

  // Booking/Appointments
  booking: {
    title: 'Booking an Appointment',
    description:
      'Book your appointment in just 3 simple steps.',
    steps: [
      'Choose between "This Week" or "Next Week"',
      'Select a day that works for you',
      'Pick a time slot (Morning, Afternoon, or Evening)',
      'Confirm your booking',
      'You\'ll receive a reminder before your appointment',
    ],
    contactOptions: defaultContactOptions,
  },

  // Appointments List
  appointments: {
    title: 'Your Appointments',
    description:
      'View all your upcoming and past appointments here.',
    steps: [
      'Upcoming appointments are shown at the top',
      'Tap an appointment to see details',
      'Join video calls from the appointment card',
      'You can reschedule or cancel if needed',
    ],
    contactOptions: defaultContactOptions,
  },

  // Messages
  messages: {
    title: 'Messaging Help',
    description:
      'Chat with your doctor just like WhatsApp.',
    steps: [
      'Type your message in the text box at the bottom',
      'Tap the camera icon to send photos',
      'Hold the microphone button to send voice messages',
      'Your doctor will be notified when you send a message',
      'Check marks show if your message was delivered and read',
    ],
    contactOptions: defaultContactOptions,
  },

  // Profile/Settings
  profile: {
    title: 'Profile & Settings',
    description:
      'Manage your account and app preferences here.',
    steps: [
      'Update your personal information',
      'Change your language preference',
      'Toggle between Simple and Advanced mode',
      'Manage notification settings',
      'View the tutorial again if needed',
    ],
    contactOptions: defaultContactOptions,
  },

  // QR Code Scanning
  'qr-scan': {
    title: 'Scanning QR Code',
    description:
      'Connect to your doctor by scanning their QR code.',
    steps: [
      'Ask your doctor to show you their QR code',
      'Point your camera at the QR code',
      'Make sure the code is clear and well-lit',
      'The app will automatically connect you',
      'You\'ll see a confirmation when connected',
    ],
    contactOptions: defaultContactOptions,
  },

  // Doctor Dashboard
  'doctor-dashboard': {
    title: 'Doctor Dashboard Help',
    description:
      'Manage your patients and appointments from here.',
    steps: [
      'View today\'s patients at the top',
      'Green "New" badges show patients with completed intake forms',
      'Tap a patient card to view their intake or send a message',
      'Your appointments are listed in chronological order',
      'Share your QR code to get new patients',
    ],
    contactOptions: defaultContactOptions,
  },

  // Doctor Patients
  'doctor-patients': {
    title: 'Managing Patients',
    description:
      'View and manage all your connected patients.',
    steps: [
      'Search for patients using the search bar',
      'Filter patients by status or connection date',
      'Tap a patient to view their medical intake',
      'Send messages or book appointments for patients',
      'Review patient history and notes',
    ],
    contactOptions: defaultContactOptions,
  },

  // Video Call/Meeting
  meeting: {
    title: 'Video Call Help',
    description:
      'Join your video appointment with your doctor.',
    steps: [
      'Make sure you have a stable internet connection',
      'Allow camera and microphone access when prompted',
      'Tap the video icon to turn your camera on/off',
      'Tap the microphone icon to mute/unmute',
      'Tap "Leave Call" when you\'re done',
    ],
    contactOptions: defaultContactOptions,
  },

  // Connection/Onboarding
  connect: {
    title: 'Connecting to Doctor',
    description:
      'Create your account and connect to your doctor.',
    steps: [
      'Enter your name and phone number',
      'Tap "Connect to Dr. [Name]"',
      'You\'ll see a confirmation screen',
      'Start filling your medical form right away',
    ],
    contactOptions: defaultContactOptions,
  },

  // Mode Toggle
  'mode-toggle': {
    title: 'Simple vs Advanced Mode',
    description:
      'Choose the interface that works best for you.',
    steps: [
      'Simple Mode: Shows only essential features with large buttons',
      'Advanced Mode: Shows all features and detailed information',
      'Tap the toggle in the top-right corner to switch',
      'Your data is preserved when switching modes',
      'Try both modes to see which you prefer',
    ],
    contactOptions: defaultContactOptions,
  },

  // Voice Input
  'voice-input': {
    title: 'Using Voice Input',
    description:
      'Answer questions using your voice instead of typing.',
    steps: [
      'Tap the microphone icon next to the text field',
      'Speak clearly when the icon turns red',
      'Your speech will be converted to text automatically',
      'Review the text and edit if needed',
      'Tap send when you\'re ready',
    ],
    contactOptions: defaultContactOptions,
  },

  // Offline Mode
  offline: {
    title: 'Working Offline',
    description:
      'The app works even without internet connection.',
    steps: [
      'You can read messages and view your appointments offline',
      'Fill out forms and compose messages offline',
      'Your changes will sync automatically when you\'re back online',
      'A yellow banner shows when you\'re offline',
      'Don\'t worry - nothing will be lost!',
    ],
    contactOptions: defaultContactOptions,
  },
};

/**
 * Get help content for a specific context
 * Returns default help if context not found
 */
export function getHelpContent(contextId: string): HelpContent {
  return (
    helpContentMap[contextId] || {
      title: 'Help',
      description:
        'Need assistance? We\'re here to help! Contact us using one of the options below.',
      steps: [
        'Try exploring the app - most features are self-explanatory',
        'Look for the ? button on any screen for context-specific help',
        'Contact our support team if you need personal assistance',
      ],
      contactOptions: defaultContactOptions,
    }
  );
}

/**
 * Get help content for a specific language
 * Currently returns English, but can be extended for localization
 */
export function getLocalizedHelpContent(
  contextId: string,
  language: 'en' | 'lg' | 'sw' = 'en'
): HelpContent {
  // For now, return English content
  // In the future, this can be extended to support multiple languages
  return getHelpContent(contextId);
}

/**
 * Update contact options globally
 * Useful for customizing support contacts per deployment
 */
export function updateContactOptions(options: {
  phone?: string;
  whatsapp?: string;
  email?: string;
}) {
  Object.keys(helpContentMap).forEach((key) => {
    helpContentMap[key].contactOptions = {
      ...helpContentMap[key].contactOptions,
      ...options,
    };
  });
}

/**
 * Add or update help content for a specific context
 */
export function setHelpContent(contextId: string, content: HelpContent) {
  helpContentMap[contextId] = content;
}

/**
 * Get all available context IDs
 */
export function getAvailableContexts(): string[] {
  return Object.keys(helpContentMap);
}
