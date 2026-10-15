/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: '#FFF8EA',
        'cream-card': '#FFFFFF',
        'leaf-green': '#176B45',
        'leaf-dark': '#0E492E',
        'mint-green': '#DDF3DF',
        'haldi-yellow': '#FFC857',
        'tomato-red': '#E96850',
        'ink-brown': '#342B25',
        'ink-muted': '#6B5E55',
        'notebook-line': '#E8DFC8',
        'margin-red': '#F3A193'
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'sans-serif'],
        handwriting: ['Caveat', 'cursive']
      },
      boxShadow: {
        'bahi': '3px 4px 0px 0px #342B25',
        'bahi-lg': '6px 8px 0px 0px #342B25',
        'bahi-sm': '2px 2px 0px 0px #342B25',
        'soft': '0 10px 30px -5px rgba(52, 43, 37, 0.08)',
      }
    },
  },
  plugins: [],
}
