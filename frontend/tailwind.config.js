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
          bg: '#FFFCF8',
          surface: '#FFFFFF',
          card: '#FFFFFF',
          primary: '#A80046', // Deep Burgundy/Wine/Magenta
          primaryLight: '#C90055', 
          gold: '#C9A227', // Elegant Champagne Gold
          goldLight: '#E5C04A',
          navy: '#0B1733', // Dark Navy
          text: '#0B1733',
          textSec: '#64748B',
          success: '#22C55E',
          danger: '#EF4444',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
      },
      backgroundImage: {
        'primary-gradient': 'linear-gradient(135deg, #A80046 0%, #7A0033 100%)',
        'gold-gradient': 'linear-gradient(135deg, #C9A227 0%, #A6841E 100%)',
      }
    },
  },
  plugins: [],
}
