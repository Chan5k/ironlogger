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
          DEFAULT: '#3b82f6',
          muted: '#60a5fa',
        },
      },
    },
  },
  plugins: [],
};
