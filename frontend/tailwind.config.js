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
          bg: '#FAF8F5', // Main background
          surface: '#FFFFFF', // Surface / Sidebar
          card: '#FFFFFF', // Card background
          gold: '#D4AF37', // Gold Accent
          goldLight: '#E8CA58', // Light Gold for hover
          rose: '#E6B7A9', // Rose Gold Accent
          text: '#111827', // Primary text (Dark Professional Gray)
          textSec: '#4B5563', // Secondary text (Readable Gray)
          success: '#22C55E',
          danger: '#EF4444',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #D4AF37 0%, #AA8725 100%)',
        'dark-gradient': 'linear-gradient(180deg, rgba(250,248,245,0) 0%, rgba(250,248,245,1) 100%)',
      }
    },
  },
  plugins: [],
}
