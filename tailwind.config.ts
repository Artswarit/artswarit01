
import type { Config } from "tailwindcss";
import animatePlugin from "tailwindcss-animate";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		screens: {
			'xs': '320px',
			'sm': '480px',
			'md': '768px',
			'lg': '1024px',
			'xl': '1280px',
			'2xl': '1400px',
		},
		extend: {
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				success: {
					DEFAULT: 'hsl(var(--success))',
					foreground: 'hsl(var(--success-foreground))',
					muted: 'hsl(var(--success-muted))'
				},
				warning: {
					DEFAULT: 'hsl(var(--warning))',
					foreground: 'hsl(var(--warning-foreground))',
					muted: 'hsl(var(--warning-muted))'
				},
				info: {
					DEFAULT: 'hsl(var(--info))',
					foreground: 'hsl(var(--info-foreground))',
					muted: 'hsl(var(--info-muted))'
				},
				surface: {
					DEFAULT: 'hsl(var(--surface))',
					muted: 'hsl(var(--surface-muted))'
				},

				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},
				artswarit: {
					purple: '#7C4DFF',
					'purple-light': '#9575FF',
					'purple-dark': '#5E35B1',
					gray: '#F5F5F7',
					black: '#333333'
				},
				/* Canonical brand tokens — prefer these over `artswarit.*` in new code */
				brand: {
					from: 'var(--brand-from)',
					to: 'var(--brand-to)',
					'from-dark': 'var(--brand-from-dark)',
					'to-dark': 'var(--brand-to-dark)'
				}
			},
			boxShadow: {
				'token-xs': 'var(--shadow-xs)',
				'token-sm': 'var(--shadow-sm)',
				'token-md': 'var(--shadow-md)',
				'token-lg': 'var(--shadow-lg)',
				'token-elevated': 'var(--shadow-elevated)',
				'token-brand': 'var(--shadow-brand)'
			},
			fontFamily: {
				sans: ['Inter', 'sans-serif'],
				heading: ['Poppins', 'sans-serif']
			},
			// HIG Dynamic Type ramp at the Large (default) size class, transcribed
			// from Apple's published text-style table rather than eyeballed. Each
			// entry pins size / leading / tracking / weight together, because
			// Apple varies all four per style: tracking goes *negative* as type
			// grows and *positive* at caption sizes, which is what keeps headings
			// tight and microcopy legible.
			//
			// Tracking is converted from Apple's absolute pt values to em so it
			// scales correctly (e.g. Body -0.43pt at 17pt = -0.0253em).
			fontSize: {
				// size          leading      tracking    weight
				'caption2':    ['0.6875rem', { lineHeight: '0.875rem',  letterSpacing: '0.0136em' }],  // 11/14  +0.15pt
				'caption1':    ['0.75rem',   { lineHeight: '0.9375rem', letterSpacing: '0.01em' }],    // 12/15  +0.12pt
				'footnote':    ['0.8125rem', { lineHeight: '1rem',      letterSpacing: '0.0023em' }],  // 13/16  +0.03pt
				'subhead':     ['0.9375rem', { lineHeight: '1.1875rem', letterSpacing: '0' }],         // 15/19   0
				'callout':     ['1rem',      { lineHeight: '1.25rem',   letterSpacing: '-0.02em' }],   // 16/20  -0.32pt
				'body':        ['1.0625rem', { lineHeight: '1.375rem',  letterSpacing: '-0.0253em' }], // 17/22  -0.43pt
				'headline':    ['1.0625rem', { lineHeight: '1.375rem',  letterSpacing: '-0.0253em', fontWeight: '600' }], // 17/22 semibold
				'title3':      ['1.25rem',   { lineHeight: '1.5625rem', letterSpacing: '-0.03em',   fontWeight: '600' }], // 20/25 semibold
				'title2':      ['1.375rem',  { lineHeight: '1.75rem',   letterSpacing: '-0.0318em', fontWeight: '700' }], // 22/28 bold
				'title1':      ['1.75rem',   { lineHeight: '2.125rem',  letterSpacing: '-0.0286em', fontWeight: '700' }], // 28/34 bold
				'largetitle':  ['2.125rem',  { lineHeight: '2.5625rem', letterSpacing: '-0.0309em', fontWeight: '700' }], // 34/41 bold
			},
			// Icon scale — see --icon-* in index.css. Use as `size-icon-md` etc.
			size: {
				'icon-xs': 'var(--icon-xs)',
				'icon-sm': 'var(--icon-sm)',
				'icon-md': 'var(--icon-md)',
				'icon-lg': 'var(--icon-lg)',
				'icon-xl': 'var(--icon-xl)',
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				},
				'fade-in': {
					'0%': { opacity: '0' },
					'100%': { opacity: '1' }
				},
				'slide-up': {
					'0%': { transform: 'translateY(20px)', opacity: '0' },
					'100%': { transform: 'translateY(0)', opacity: '1' }
				},
				'pulse-glow': {
					'0%, 100%': { opacity: '1' },
					'50%': { opacity: '0.7' }
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'fade-in': 'fade-in 0.5s ease-out',
				'slide-up': 'slide-up 0.5s ease-out',
				'pulse-glow': 'pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
			}
		}
	},
	plugins: [animatePlugin],
} satisfies Config;
