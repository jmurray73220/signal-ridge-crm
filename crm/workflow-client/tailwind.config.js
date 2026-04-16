/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0a1628',
        'bg-deep': '#050d18',
        surface: '#12213a',
        'surface-alt': '#1a2b4a',
        border: '#24375a',
        'border-soft': '#1e3151',
        accent: '#c9a84c',
        'accent-muted': '#a38936',
        'text-primary': '#e6edf3',
        'text-muted': '#8ea4c2',
        'status-green': '#2ea043',
        'status-amber': '#d29922',
        'status-red': '#da3633',
        'status-blue': '#4493f8',
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
