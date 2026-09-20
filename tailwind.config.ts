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
        // Brand palette — cheerful early-years (teal primary, playful accents)
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
        // Playful accent colours for feature tiles / category chips
        accent: {
          sunny: '#ffca3a',
          coral: '#ff6b6b',
          pink: '#ff7fa8',
          leaf: '#8ac926',
          sky: '#4cc9f0',
          grape: '#b57edc',
        },
        // Semantic colour aliases — bright, warm, cream-based theme
        primary: {
          DEFAULT: '#14b3ad',
          foreground: '#ffffff',
          hover: '#0f9b96',
          light: '#d6f4f2',
        },
        secondary: {
          DEFAULT: '#ff7fa8',
          foreground: '#ffffff',
          hover: '#f4638f',
          light: '#ffe4ee',
        },
        background: '#fff8ee',
        surface: '#ffffff',
        'surface-raised': '#fff3e0',
        'text-primary': '#2b3a4a',
        'text-secondary': '#5c6b7a',
        'text-muted': '#93a0ac',
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
      },
      borderRadius: {
        DEFAULT: '0.625rem',
        xl: '0.875rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      boxShadow: {
        card: '0 4px 16px -2px rgb(20 179 173 / 0.10), 0 2px 6px -2px rgb(20 179 173 / 0.08)',
        'card-hover': '0 0 0 1px rgb(20 179 173 / 0.22), 0 14px 34px -6px rgb(20 179 173 / 0.24)',
        glow: '0 0 28px 0 rgb(20 179 173 / 0.25)',
        sidebar: '4px 0 30px 0 rgb(20 179 173 / 0.16)',
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
