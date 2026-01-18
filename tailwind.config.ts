import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        medical: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        // WhatsApp-style color palette
        whatsapp: {
          primary: '#25D366',      // WhatsApp green for primary actions
          primaryDark: '#128C7E',  // Darker green for hover states
          primaryLight: '#DCF8C6', // Light green for user message bubbles
          secondary: '#34B7F1',    // WhatsApp blue for links
          background: '#E5DDD5',   // Chat background (light beige)
          messageBg: '#FFFFFF',    // System message bubble background
          gray: {
            50: '#F7F8FA',
            100: '#F0F2F5',
            200: '#E9EDEF',
            300: '#8696A0',
            400: '#667781',
            500: '#54656F',
          },
        },
      },
      fontSize: {
        // WhatsApp-style font sizes
        'body': ['16px', { lineHeight: '1.5' }],      // Minimum body text
        'button': ['20px', { lineHeight: '1.2' }],    // Button text
        'title': ['24px', { lineHeight: '1.3' }],     // Screen titles
        'subtitle': ['14px', { lineHeight: '1.4' }],  // Subtitles and secondary text
      },
      spacing: {
        // WhatsApp-style spacing
        'card': '16px',
        'section': '24px',
      },
      borderRadius: {
        // WhatsApp-style border radius
        'card': '16px',
        'bubble': '8px',
        'button': '24px',
      },
      animation: {
        'in': 'animateIn 0.3s ease-out',
        'bounce': 'bounce 1s infinite',
        'pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-glow': 'pulseGlow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        animateIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGlow: {
          '0%, 100%': { 
            boxShadow: '0 0 0 0 rgba(37, 211, 102, 0.7)',
            transform: 'scale(1)',
          },
          '50%': { 
            boxShadow: '0 0 0 10px rgba(37, 211, 102, 0)',
            transform: 'scale(1.02)',
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}

export default config
