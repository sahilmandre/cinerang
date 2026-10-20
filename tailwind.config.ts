/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Aurora palette — green-tinted midnight surfaces, signature lime accent.
        accent: '#95FF50',
        'accent-2': '#2dd4bf',
        base: '#0a0e0a',
        card: '#121a13',
        ink: '#e8f5e3',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-outfit)', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 28px -6px rgba(149, 255, 80, 0.4)',
        card: '0 14px 36px -14px rgba(0, 0, 0, 0.7)',
      },
      backgroundImage: {
        aurora: 'linear-gradient(135deg, #95ff50 0%, #2dd4bf 100%)',
        'aurora-soft':
          'linear-gradient(135deg, rgba(149,255,80,0.18) 0%, rgba(45,212,191,0.18) 100%)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'hero-zoom': {
          from: { transform: 'scale(1)' },
          to: { transform: 'scale(1.07)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fade-in 0.6s ease both',
        'hero-zoom': 'hero-zoom 9s ease-out both',
      },
    },
  },
  plugins: [],
};
