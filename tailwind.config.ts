import type { Config } from 'tailwindcss'

const config: Config = {
    darkMode: ['class'],
    content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
  	extend: {
  		colors: {
  			medical: {
  				'50': '#f0fdf4',
  				'100': '#dcfce7',
  				'200': '#bbf7d0',
  				'300': '#86efac',
  				'400': '#4ade80',
  				'500': '#22c55e',
  				'600': '#16a34a',
  				'700': '#15803d',
  				'800': '#166534',
  				'900': '#14532d'
  			},
  			whatsapp: {
  				primary: '#25D366',
  				primaryDark: '#128C7E',
  				primaryLight: '#DCF8C6',
  				secondary: '#34B7F1',
  				background: '#E5DDD5',
  				messageBg: '#FFFFFF',
  				gray: {
  					'50': '#F7F8FA',
  					'100': '#F0F2F5',
  					'200': '#E9EDEF',
  					'300': '#8696A0',
  					'400': '#667781',
  					'500': '#54656F'
  				}
  			},
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		fontSize: {
  			body: [
  				'16px',
  				{
  					lineHeight: '1.5'
  				}
  			],
  			button: [
  				'20px',
  				{
  					lineHeight: '1.2'
  				}
  			],
  			title: [
  				'24px',
  				{
  					lineHeight: '1.3'
  				}
  			],
  			subtitle: [
  				'14px',
  				{
  					lineHeight: '1.4'
  				}
  			]
  		},
  		spacing: {
  			card: '16px',
  			section: '24px'
  		},
  		borderRadius: {
  			card: '16px',
  			bubble: '8px',
  			button: '24px',
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		animation: {
  			in: 'animateIn 0.3s ease-out',
  			bounce: 'bounce 1s infinite',
  			pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
  			'pulse-glow': 'pulseGlow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
  		},
  		keyframes: {
  			animateIn: {
  				'0%': {
  					opacity: '0',
  					transform: 'translateY(10px)'
  				},
  				'100%': {
  					opacity: '1',
  					transform: 'translateY(0)'
  				}
  			},
  			pulseGlow: {
  				'0%, 100%': {
  					boxShadow: '0 0 0 0 rgba(37, 211, 102, 0.7)',
  					transform: 'scale(1)'
  				},
  				'50%': {
  					boxShadow: '0 0 0 10px rgba(37, 211, 102, 0)',
  					transform: 'scale(1.02)'
  				}
  			}
  		}
  	}
  },
  plugins: [
    require('@tailwindcss/typography'),
      require("tailwindcss-animate")
],
}

export default config
