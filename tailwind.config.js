/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./app.js",
    "./src/**/*.{js,ts,jsx,tsx,html}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-dark': '#08080a',
        'card-bg': 'rgba(18, 18, 22, 0.6)',
        'card-border': 'rgba(255, 255, 255, 0.08)',
        'accent-purple': '#a855f7',
        'accent-blue': '#06b6d4',
        'accent-glow': 'rgba(168, 85, 247, 0.35)',
        'glass-bg': 'rgba(10, 10, 12, 0.7)',
      },
      fontFamily: {
        heading: ['Space Grotesk', 'sans-serif'],
        body: ['Outfit', 'sans-serif'],
        cursive: ['Great Vibes', 'Alex Brush', 'Sacramento', 'cursive'],
      },
      boxShadow: {
        'purple-glow': '0 0 15px rgba(168, 85, 247, 0.35)',
        'blue-glow': '0 0 15px rgba(6, 182, 212, 0.35)',
        'card-glow': '0 20px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(168, 85, 247, 0.15)',
      },
    },
  },
  plugins: [],
}
