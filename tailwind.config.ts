import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Legacy teal scale (kept for any remaining brand-teal-* utilities)
        brand: {
          teal: {
            50: '#e9faf8',
            100: '#d0f4f1',
            200: '#a3e9e3',
            300: '#6fdad2',
            400: '#3fc5c0',
            500: '#17b0ae',
            600: '#0f9b96',
            700: '#0c7e7a',
            800: '#0b6360',
            900: '#0c5250',
            950: '#053331',
          },
        },
        // Rainbow accents — playful early-years palette (Montessori-style reference)
        accent: {
          sunny: '#ffc93c',
          orange: '#f7931e',
          coral: '#ef5350',
          pink: '#ec4f8b',
          leaf: '#4caf50',
          sky: '#3a8ee6',
          grape: '#8b5cf6',
        },
        // Semantic colour aliases — royal-blue primary, magenta secondary, navy ink on
        // cream. DEFAULTs are deepened from the reference so white text passes WCAG AA.
        primary: {
          DEFAULT: '#2463d6',
          foreground: '#ffffff',
          hover: '#1b4fae',
          light: '#e6efff',
        },
        secondary: {
          DEFAULT: '#d42a6b',
          foreground: '#ffffff',
          hover: '#b51f59',
          light: '#ffe4ef',
        },
        background: '#fff8ec',
        surface: '#ffffff',
        'surface-raised': '#fff3e0',
        'text-primary': '#1f2b57',
        'text-secondary': '#4a5578',
        'text-muted': '#7d87a6',
        border: '#efe3d0',
        // Status colours — light-theme tuned (DEFAULT readable on white, light = pale tint)
        success: {
          DEFAULT: '#16a34a',
          light: '#e6f6ec',
          foreground: '#ffffff',
        },
        warning: {
          DEFAULT: '#c2740a',
          light: '#fbf0d6',
          foreground: '#ffffff',
        },
        error: {
          DEFAULT: '#dc2626',
          light: '#fce4e4',
          foreground: '#ffffff',
        },
        info: {
          DEFAULT: '#2563eb',
          light: '#e6edfc',
          foreground: '#ffffff',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Nunito', 'system-ui', 'sans-serif'],
        // Rounded display face for headings — matches the Creche Wise marketing site.
        display: ['var(--font-display)', 'Fredoka', 'var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.625rem',
        xl: '0.875rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      boxShadow: {
        card: '0 10px 30px -4px rgb(31 43 87 / 0.08), 0 2px 6px -2px rgb(31 43 87 / 0.05)',
        'card-hover': '0 0 0 1px rgb(36 99 214 / 0.22), 0 14px 34px -6px rgb(36 99 214 / 0.24)',
        glow: '0 0 28px 0 rgb(36 99 214 / 0.25)',
        sidebar: '4px 0 30px 0 rgb(36 99 214 / 0.16)',
      },
      keyframes: {
        'nav-progress': {
          '0%': { width: '0%' },
          '100%': { width: '82%' },
        },
      },
      animation: {
        'nav-progress': 'nav-progress 3s cubic-bezier(0.08, 0.82, 0.17, 1) forwards',
      },
    },
  },
  plugins: [],
}

export default config
