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
      transitionDuration: {
        'motion-fast': '150ms',
        motion: '200ms',
        'motion-slow': '280ms',
        'motion-out': '320ms',
        'motion-progress': '500ms',
      },
      transitionTimingFunction: {
        'motion-standard': 'cubic-bezier(0.22, 1, 0.36, 1)',
        'motion-emphasized': 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
      keyframes: {
        uiPageIn: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        uiFadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        uiModalIn: {
          '0%': { opacity: '0', transform: 'translateY(1rem) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        uiBackdropIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
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
        setSlideIn: {
          '0%': { opacity: '0', transform: 'translateY(-8px) scaleY(0.92)', maxHeight: '0px' },
          '100%': { opacity: '1', transform: 'translateY(0) scaleY(1)', maxHeight: '100px' },
        },
        landingGlowPulse: {
          '0%, 100%': { opacity: '0.35' },
          '50%': { opacity: '0.65' },
        },
      },
      animation: {
        'ui-page-in': 'uiPageIn 280ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'ui-fade-in': 'uiFadeIn 280ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'ui-modal-in': 'uiModalIn 280ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'ui-backdrop-in': 'uiBackdropIn 280ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'pr-backdrop': 'prBackdrop 0.55s ease-out both',
        'pr-card-in': 'prCardIn 0.95s cubic-bezier(0.22, 1, 0.32, 1.2) both',
        'pr-reveal-line': 'prRevealLine 0.55s ease-out both',
        'pr-spark': 'prSpark 1s ease-out forwards',
        'sign-out-icon': 'signOutIcon 0.45s cubic-bezier(0.34, 1.3, 0.64, 1) both',
        'set-slide-in': 'setSlideIn 250ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'landing-glow': 'landingGlowPulse 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
