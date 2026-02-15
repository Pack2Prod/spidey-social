/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './pages/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        noir: {
          black: '#0A0A0B',
          charcoal: '#1A1A1F',
          graphite: '#2A2A32',
          steel: '#3D3D47',
          ash: '#6B6B76',
          smoke: '#9E9EA8',
          fog: '#C8C8D0',
          light: '#E8E8EC',
        },
        web: {
          crimson: '#8B1A1A',
          red: '#C62828',
          ember: '#D4442A',
          amber: '#D4A038',
          'amber-dim': '#8B7028',
        },
      },
      fontFamily: {
        display: ['Playfair Display', 'serif'],
        body: ['Source Sans 3', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 15px rgba(139,26,26,0.6)',
      },
    },
  },
  plugins: [],
};
