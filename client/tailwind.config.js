/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      colors: {
        surface: {
          DEFAULT: '#0f1419',
          card: '#1a2332',
          elevated: '#243044',
        },
        accent: {
          DEFAULT: '#2563eb',
          muted: '#3b82f6',
        },
      },
      keyframes: {
        prBackdrop: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        prCardIn: {
          '0%': { opacity: '0', transform: 'scale(0.45) translateY(2.5rem)' },
          '45%': { opacity: '1', transform: 'scale(1.08) translateY(-0.25rem)' },
          '70%': { transform: 'scale(0.97) translateY(0)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        prRevealLine: {
          '0%': { opacity: '0', transform: 'translateY(1rem)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        prSpark: {
          '0%': { opacity: '0', transform: 'scale(0) rotate(0deg)' },
          '35%': { opacity: '1', transform: 'scale(1) rotate(140deg)' },
          '100%': { opacity: '0', transform: 'scale(0.35) rotate(320deg)' },
        },
        signOutIcon: {
          '0%': { opacity: '0', transform: 'scale(0.5) rotate(-12deg)' },
          '60%': { opacity: '1', transform: 'scale(1.08) rotate(3deg)' },
          '100%': { opacity: '1', transform: 'scale(1) rotate(0deg)' },
        },
      },
      animation: {
        'pr-backdrop': 'prBackdrop 0.55s ease-out both',
        'pr-card-in': 'prCardIn 0.95s cubic-bezier(0.22, 1, 0.32, 1.2) both',
        'pr-reveal-line': 'prRevealLine 0.55s ease-out both',
        'pr-spark': 'prSpark 1s ease-out forwards',
        'sign-out-icon': 'signOutIcon 0.45s cubic-bezier(0.34, 1.3, 0.64, 1) both',
      },
    },
  },
  plugins: [],
};
