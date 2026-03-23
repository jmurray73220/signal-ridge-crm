/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0d1117',
        surface: '#1c2333',
        border: '#30363d',
        accent: '#c9a84c',
        'text-primary': '#e6edf3',
        'text-muted': '#8b949e',
        'status-green': '#238636',
        'status-amber': '#9e6a03',
        'status-red': '#da3633',
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
