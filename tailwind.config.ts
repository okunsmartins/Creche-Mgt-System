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
        // Brand palette — soft violet / lavender
        brand: {
          purple: {
            50: '#f6f3fe',
            100: '#ece6fc',
            200: '#dbcff9',
            300: '#c3aef3',
            400: '#a888ea',
            500: '#8b6fe0',
            600: '#7a5cd6',
            700: '#6949be',
            800: '#573c9b',
            900: '#48347d',
            950: '#2e2050',
          },
        },
        // Semantic colour aliases — light lavender theme
        primary: {
          DEFAULT: '#8b6fe0',
          foreground: '#ffffff',
          hover: '#7a5cd6',
          light: '#ece6fc',
        },
        secondary: {
          DEFAULT: '#ef8fb3',
          foreground: '#ffffff',
          hover: '#e97aa4',
          light: '#fce7ef',
        },
        background: '#f3f0fb',
        surface: '#ffffff',
        'surface-raised': '#f7f4fd',
        'text-primary': '#322c47',
        'text-secondary': '#635c78',
        'text-muted': '#9993ac',
        border: '#e8e2f6',
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
        card: '0 4px 16px -2px rgb(139 111 224 / 0.10), 0 2px 6px -2px rgb(139 111 224 / 0.08)',
        'card-hover': '0 0 0 1px rgb(139 111 224 / 0.22), 0 14px 34px -6px rgb(139 111 224 / 0.24)',
        glow: '0 0 28px 0 rgb(139 111 224 / 0.25)',
        sidebar: '4px 0 30px 0 rgb(139 111 224 / 0.16)',
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
