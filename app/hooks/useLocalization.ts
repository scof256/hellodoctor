import { useTranslation } from 'react-i18next';
import {
  formatDate,
  formatTime,
  formatDateTime,
  formatPhoneNumber,
  formatCurrency,
  getRelativeDateLabel,
  parsePhoneInput,
  isValidPhoneNumber,
} from '../lib/localization-utils';

/**
 * Custom hook for localization with formatting utilities
 */
export function useLocalization() {
  const { t, i18n } = useTranslation();

  const changeLanguage = (lng: 'en' | 'lg' | 'sw') => {
    i18n.changeLanguage(lng);
  };

  const currentLanguage = i18n.language as 'en' | 'lg' | 'sw';

  return {
    // Translation function
    t,
    
    // Language management
    changeLanguage,
    currentLanguage,
    
    // Formatting utilities
    formatDate,
    formatTime,
    formatDateTime,
    formatPhoneNumber,
    formatCurrency,
    getRelativeDateLabel: (date: Date | string) => getRelativeDateLabel(date, t),
    parsePhoneInput,
    isValidPhoneNumber,
  };
}
