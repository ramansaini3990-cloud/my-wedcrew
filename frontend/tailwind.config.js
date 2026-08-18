/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#F8F5F0',          // Warm off-white page background
          surface: '#FFFFFF',
          card: '#FFFFFF',
          primary: '#DE601E',     // Burnt Orange - main interactive accent
          primaryLight: '#E97B3D',
          primaryDark: '#B94A12',
          // Legacy accent token: now part of the burnt-orange family so the
          // whole site reads as one accent instead of two competing ones.
          gold: '#DE601E',
          goldLight: '#E97B3D',
          navy: '#0B1835',        // Dark Navy
          dark: '#0B1835',
          text: '#0B1835',
          textSec: '#64748B',     // Secondary slate text
          muted: '#94A3B8',       // Placeholders / tertiary text
          border: '#E5E7EB',
          success: '#22C55E',
          warning: '#F59E0B',
          danger: '#EF4444',
          info: '#2563EB',
          blue: '#2563EB',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
      },
      backgroundImage: {
        'primary-gradient': 'linear-gradient(135deg, #DE601E 0%, #B94A12 100%)',
        'gold-gradient': 'linear-gradient(135deg, #E97B3D 0%, #DE601E 100%)',
      }
    },
  },
  plugins: [],
}
