/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
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
        app: {
          canvas: 'rgb(var(--rgb-app-canvas) / <alpha-value>)',
          panel: 'rgb(var(--rgb-app-panel) / <alpha-value>)',
          'panel-deep': 'rgb(var(--rgb-app-panel-deep) / <alpha-value>)',
          'panel-muted': 'rgb(var(--rgb-app-panel-muted) / <alpha-value>)',
        },
        surface: {
          DEFAULT: 'rgb(var(--rgb-surface) / <alpha-value>)',
          card: 'rgb(var(--rgb-surface-card) / <alpha-value>)',
          elevated: 'rgb(var(--rgb-surface-elevated) / <alpha-value>)',
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
        uiBackdropOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        /** Centered nutrition / dialog modals */
        uiNutritionModalIn: {
          '0%': { opacity: '0', transform: 'scale(0.94) translateY(10px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        uiNutritionModalOut: {
          '0%': { opacity: '1', transform: 'scale(1) translateY(0)' },
          '100%': { opacity: '0', transform: 'scale(0.94) translateY(10px)' },
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
        aiStaggerIn: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        aiBtnPop: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(0.95)' },
          '100%': { transform: 'scale(1)' },
        },
        /** Pinned workout save/actions bar (slides above rest timer) */
        workoutDockIn: {
          '0%': { opacity: '0', transform: 'translateY(1.25rem)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        workoutDockOut: {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(1.25rem)' },
        },
        aiSpinnerPulse: {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.08)' },
        },
        /** Open Food Facts score panel (barcode scan) */
        offScoreReveal: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        offNutriPop: {
          '0%': { opacity: '0', transform: 'scale(0.35) rotate(-14deg)' },
          '58%': { opacity: '1', transform: 'scale(1.1) rotate(3deg)' },
          '100%': { opacity: '1', transform: 'scale(1) rotate(0deg)' },
        },
        offChipPop: {
          '0%': { opacity: '0', transform: 'scale(0.82) translateY(4px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
      },
      animation: {
        'ui-page-in': 'uiPageIn 280ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'ui-fade-in': 'uiFadeIn 280ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'ui-modal-in': 'uiModalIn 280ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'ui-backdrop-in': 'uiBackdropIn 280ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'ui-backdrop-out': 'uiBackdropOut 240ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'ui-nutrition-modal-in':
          'uiNutritionModalIn 320ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'ui-nutrition-modal-out':
          'uiNutritionModalOut 300ms cubic-bezier(0.32, 0.72, 0, 1) both',
        'pr-backdrop': 'prBackdrop 0.55s ease-out both',
        'pr-card-in': 'prCardIn 0.95s cubic-bezier(0.22, 1, 0.32, 1.2) both',
        'pr-reveal-line': 'prRevealLine 0.55s ease-out both',
        'pr-spark': 'prSpark 1s ease-out forwards',
        'sign-out-icon': 'signOutIcon 0.45s cubic-bezier(0.34, 1.3, 0.64, 1) both',
        'set-slide-in': 'setSlideIn 250ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'landing-glow': 'landingGlowPulse 6s ease-in-out infinite',
        'ai-stagger-in': 'aiStaggerIn 350ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'ai-btn-pop': 'aiBtnPop 200ms cubic-bezier(0.22, 1, 0.36, 1)',
        'ai-spinner-pulse': 'aiSpinnerPulse 1.8s ease-in-out infinite',
        'workout-dock-in':
          'workoutDockIn 380ms cubic-bezier(0.32, 0.72, 0, 1) both',
        'workout-dock-out':
          'workoutDockOut 340ms cubic-bezier(0.32, 0.72, 0, 1) both',
        'off-score-reveal':
          'offScoreReveal 420ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'off-nutri-pop':
          'offNutriPop 0.72s cubic-bezier(0.34, 1.45, 0.64, 1) both',
        'off-chip-pop': 'offChipPop 0.45s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
};
