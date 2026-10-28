/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      // Monochrome: near-black ink on near-white. Colour is reserved for status
      // (green = safe/intact, red = leak/blocked/tampered) and team markers.
      colors: {
        bg: '#FAFAFA',
        ink: '#0A0A0A',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.04)',
        lift: '0 8px 24px -8px rgba(0,0,0,0.12)',
      },
      keyframes: {
        flowpulse: {
          '0%,100%': { opacity: 0.35 },
          '50%': { opacity: 1 },
        },
      },
      animation: {
        flowpulse: 'flowpulse 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
