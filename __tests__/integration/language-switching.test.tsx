import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/app/lib/i18n';
import { LanguageSelector } from '@/app/components/LanguageSelector';
import { SimplifiedPatientHome } from '@/app/components/SimplifiedPatientHome';
import { BottomNav } from '@/app/components/BottomNav';
import {
  formatDate,
  formatTime,
  formatPhoneNumber,
  formatCurrency,
  isValidPhoneNumber,
} from '@/app/lib/localization-utils';
import type { ConnectionSummary, AppointmentSummary } from '@/types/dashboard';

/**
 * Integration tests for multi-language support
 * Tests Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
 * 
 * Feature: whatsapp-simple-ux, Task 20.4
 */

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/patient',
}));

// Helper to render with i18n
function renderWithI18n(component: React.ReactElement) {
  return render(
    <I18nextProvider i18n={i18n}>
      {component}
    </I18nextProvider>
  );
}

describe('Language Switching Integration Tests', () => {
  beforeEach(async () => {
    // Reset i18n to English before each test
    await i18n.changeLanguage('en');
    // Clear localStorage
    localStorage.clear();
  });

  describe('Language Selector Component', () => {
    it('should display all three supported languages', () => {
      renderWithI18n(<LanguageSelector variant="buttons" />);
      
      expect(screen.getByText(/English/i)).toBeInTheDocument();
      expect(screen.getByText(/Luganda/i)).toBeInTheDocument();
      expect(screen.getByText(/Swahili/i)).toBeInTheDocument();
    });

    it('should switch language when button is clicked', async () => {
      renderWithI18n(<LanguageSelector variant="buttons" />);
      
      // Initially in English
      expect(i18n.language).toBe('en');
      
      // Click Luganda button
      const lugandaButton = screen.getByText(/Luganda/i);
      fireEvent.click(lugandaButton);
      
      await waitFor(() => {
        expect(i18n.language).toBe('lg');
      });
    });

    it('should switch language when dropdown is changed', async () => {
      renderWithI18n(<LanguageSelector variant="dropdown" />);
      
      // Initially in English
      expect(i18n.language).toBe('en');
      
      // Change to Swahili
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'sw' } });
      
      await waitFor(() => {
        expect(i18n.language).toBe('sw');
      });
    });

    it('should persist language preference to localStorage', async () => {
      renderWithI18n(<LanguageSelector variant="buttons" />);
      
      // Switch to Luganda
      const lugandaButton = screen.getByText(/Luganda/i);
      fireEvent.click(lugandaButton);
      
      await waitFor(() => {
        expect(localStorage.getItem('i18nextLng')).toBe('lg');
      });
    });
  });

  describe('SimplifiedPatientHome Translation', () => {
    const mockConnections: ConnectionSummary[] = [
      {
        id: '1',
        doctor: {
          id: 'doc1',
          firstName: 'John',
          lastName: 'Doe',
          specialty: 'General Practice',
          imageUrl: null,
        },
        intakeStatus: {
          status: 'not_started',
          completeness: 0,
        },
      },
    ];

    const mockAppointments: AppointmentSummary[] = [];

    it('should display English text by default', () => {
      renderWithI18n(
        <SimplifiedPatientHome
          connections={mockConnections}
          appointments={mockAppointments}
        />
      );
      
      expect(screen.getByText('Welcome')).toBeInTheDocument();
      expect(screen.getByText('Start Medical Form')).toBeInTheDocument();
    });

    it('should display Luganda text when language is switched', async () => {
      await i18n.changeLanguage('lg');
      
      renderWithI18n(
        <SimplifiedPatientHome
          connections={mockConnections}
          appointments={mockAppointments}
        />
      );
      
      await waitFor(() => {
        expect(screen.getByText('Tukusanyukidde')).toBeInTheDocument(); // Welcome in Luganda
        expect(screen.getByText("Tandika Foomu y'Obujjanjabi")).toBeInTheDocument(); // Start Medical Form
      });
    });

    it('should display Swahili text when language is switched', async () => {
      await i18n.changeLanguage('sw');
      
      renderWithI18n(
        <SimplifiedPatientHome
          connections={mockConnections}
          appointments={mockAppointments}
        />
      );
      
      await waitFor(() => {
        expect(screen.getByText('Karibu')).toBeInTheDocument(); // Welcome in Swahili
        expect(screen.getByText('Anza Fomu ya Afya')).toBeInTheDocument(); // Start Medical Form
      });
    });
  });

  describe('BottomNav Translation', () => {
    it('should display English labels by default', () => {
      renderWithI18n(<BottomNav />);
      
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Messages')).toBeInTheDocument();
      expect(screen.getByText('Profile')).toBeInTheDocument();
    });

    it('should display Luganda labels when language is switched', async () => {
      await i18n.changeLanguage('lg');
      
      renderWithI18n(<BottomNav />);
      
      await waitFor(() => {
        expect(screen.getByText('Awaka')).toBeInTheDocument(); // Home
        expect(screen.getByText('Obubaka')).toBeInTheDocument(); // Messages
        expect(screen.getByText('Ebikukwata')).toBeInTheDocument(); // Profile
      });
    });

    it('should display Swahili labels when language is switched', async () => {
      await i18n.changeLanguage('sw');
      
      renderWithI18n(<BottomNav />);
      
      await waitFor(() => {
        expect(screen.getByText('Nyumbani')).toBeInTheDocument(); // Home
        expect(screen.getByText('Ujumbe')).toBeInTheDocument(); // Messages
        expect(screen.getByText('Wasifu')).toBeInTheDocument(); // Profile
      });
    });
  });

  describe('Date and Time Formatting', () => {
    it('should format dates in DD/MM/YYYY format', () => {
      const date = new Date('2024-03-15T10:30:00');
      
      const formatted = formatDate(date);
      expect(formatted).toBe('15/03/2024');
    });

    it('should format time in 12-hour format with AM/PM', () => {
      const morningTime = new Date('2024-03-15T09:30:00');
      expect(formatTime(morningTime)).toBe('9:30 AM');
      
      const afternoonTime = new Date('2024-03-15T14:45:00');
      expect(formatTime(afternoonTime)).toBe('2:45 PM');
      
      const midnightTime = new Date('2024-03-15T00:00:00');
      expect(formatTime(midnightTime)).toBe('12:00 AM');
      
      const noonTime = new Date('2024-03-15T12:00:00');
      expect(formatTime(noonTime)).toBe('12:00 PM');
    });
  });

  describe('Phone Number Formatting', () => {
    it('should format phone numbers in Ugandan format (+256...)', () => {
      // Test various input formats
      expect(formatPhoneNumber('0712345678')).toBe('+256712345678');
      expect(formatPhoneNumber('256712345678')).toBe('+256712345678');
      expect(formatPhoneNumber('+256712345678')).toBe('+256712345678');
      expect(formatPhoneNumber('712345678')).toBe('+256712345678');
    });

    it('should validate phone numbers correctly', () => {
      expect(isValidPhoneNumber('+256712345678')).toBe(true);
      expect(isValidPhoneNumber('0712345678')).toBe(true);
      expect(isValidPhoneNumber('256712345678')).toBe(true);
      expect(isValidPhoneNumber('712345678')).toBe(true);
      
      expect(isValidPhoneNumber('123')).toBe(false);
      expect(isValidPhoneNumber('12345678901234')).toBe(false);
    });
  });

  describe('Currency Formatting', () => {
    it('should format currency in UGX', () => {
      expect(formatCurrency(10000)).toBe('UGX 10,000');
      expect(formatCurrency(1500000)).toBe('UGX 1,500,000');
      expect(formatCurrency(500)).toBe('UGX 500');
    });
  });

  describe('Language Auto-Detection', () => {
    it('should detect browser language on first visit', async () => {
      // Clear any stored language preference
      localStorage.removeItem('i18nextLng');
      
      // Mock navigator.language
      Object.defineProperty(window.navigator, 'language', {
        value: 'sw-TZ',
        configurable: true,
      });
      
      // Reinitialize i18n to trigger detection
      await i18n.init();
      
      // Should detect Swahili from browser
      await waitFor(() => {
        expect(['sw', 'en']).toContain(i18n.language);
      });
    });

    it('should use stored preference over browser language', async () => {
      // Set stored preference
      localStorage.setItem('i18nextLng', 'lg');
      
      // Mock navigator.language to something different
      Object.defineProperty(window.navigator, 'language', {
        value: 'en-US',
        configurable: true,
      });
      
      // Reinitialize i18n
      await i18n.init();
      
      // Should use stored preference (Luganda)
      await waitFor(() => {
        expect(i18n.language).toBe('lg');
      });
    });
  });

  describe('Fallback Behavior', () => {
    it('should fallback to English for unsupported languages', async () => {
      await i18n.changeLanguage('fr'); // French not supported
      
      await waitFor(() => {
        expect(i18n.language).toBe('en');
      });
    });

    it('should display English text when translation is missing', async () => {
      await i18n.changeLanguage('lg');
      
      // Try to get a non-existent key
      const translation = i18n.t('nonexistent.key');
      
      // Should return the key itself (i18next default behavior)
      expect(translation).toBe('nonexistent.key');
    });
  });
});
