'use client';

import { useLocalization } from '../hooks/useLocalization';

interface LanguageSelectorProps {
  variant?: 'dropdown' | 'buttons';
  className?: string;
}

/**
 * Language selector component
 * Allows users to switch between English, Luganda, and Swahili
 */
export function LanguageSelector({ variant = 'dropdown', className = '' }: LanguageSelectorProps) {
  const { t, changeLanguage, currentLanguage } = useLocalization();

  const languages = [
    { code: 'en' as const, name: t('settings.english'), flag: '🇬🇧' },
    { code: 'lg' as const, name: t('settings.luganda'), flag: '🇺🇬' },
    { code: 'sw' as const, name: t('settings.swahili'), flag: '🇹🇿' },
  ];

  if (variant === 'buttons') {
    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        <label className="text-sm font-medium text-gray-700">
          {t('settings.language')}
        </label>
        <div className="flex gap-2">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => changeLanguage(lang.code)}
              className={`
                flex-1 px-4 py-3 rounded-lg border-2 transition-all
                ${
                  currentLanguage === lang.code
                    ? 'border-whatsapp-green bg-whatsapp-green/10 text-whatsapp-green font-semibold'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                }
              `}
            >
              <div className="flex flex-col items-center gap-1">
                <span className="text-2xl">{lang.flag}</span>
                <span className="text-sm">{lang.name}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Dropdown variant
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor="language-select" className="text-sm font-medium text-gray-700">
        {t('settings.language')}
      </label>
      <select
        id="language-select"
        value={currentLanguage}
        onChange={(e) => changeLanguage(e.target.value as 'en' | 'lg' | 'sw')}
        className="
          px-4 py-3 rounded-lg border-2 border-gray-300
          bg-white text-gray-900 text-base
          focus:border-whatsapp-green focus:ring-2 focus:ring-whatsapp-green/20
          transition-all cursor-pointer
        "
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.flag} {lang.name}
          </option>
        ))}
      </select>
    </div>
  );
}
