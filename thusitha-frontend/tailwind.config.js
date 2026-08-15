/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          light: '#818cf8', // indigo-400
          DEFAULT: '#4f46e5', // indigo-600
          dark: '#312e81', // indigo-900
        },
        secondary: {
          light: '#f472b6', // pink-400
          DEFAULT: '#ec4899', // pink-500
          dark: '#be185d', // pink-700
        },
        accent: {
          light: '#22d3ee', // cyan-400
          DEFAULT: '#06b6d4', // cyan-500
          dark: '#164e63', // cyan-900
        },
        success: {
          light: '#4ade80',
          DEFAULT: '#16a34a',
          dark: '#14532d',
        },
        warning: {
          light: '#fbbf24',
          DEFAULT: '#d97706',
          dark: '#78350f',
        },
        danger: {
          light: '#f87171',
          DEFAULT: '#dc2626',
          dark: '#7f1d1d',
        },
        surface: '#ffffff',
        background: '#f8fafc',
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans Sinhala', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
        'glass-hover': '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
      }
    },
  },
  plugins: [],
}
