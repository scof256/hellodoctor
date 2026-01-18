import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import enTranslations from '../locales/en.json';
import lgTranslations from '../locales/lg.json';
import swTranslations from '../locales/sw.json';

// Initialize i18next
i18n
  .use(LanguageDetector) // Detect user language
  .use(initReactI18next) // Pass i18n instance to react-i18next
  .init({
    resources: {
      en: {
        translation: enTranslations,
      },
      lg: {
        translation: lgTranslations,
      },
      sw: {
        translation: swTranslations,
      },
    },
    fallbackLng: 'en', // Fallback language
    supportedLngs: ['en', 'lg', 'sw'], // Supported languages
    debug: false, // Set to true for debugging
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    detection: {
      // Order of language detection methods
      // 1. Check localStorage first (user preference)
      // 2. Check browser navigator language
      // 3. Check HTML lang attribute
      order: ['localStorage', 'navigator', 'htmlTag'],
      // Cache user language preference in localStorage
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
      // Convert browser language codes to our supported languages
      convertDetectedLanguage: (lng: string) => {
        // Handle language codes like 'en-US', 'sw-TZ', 'lg-UG'
        const code = lng.split('-')[0];
        // Map to our supported languages
        if (code === 'en') return 'en';
        if (code === 'lg') return 'lg';
        if (code === 'sw') return 'sw';
        // Default to English if not supported
        return 'en';
      },
    },
  });

export default i18n;
