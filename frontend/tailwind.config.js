/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'selector',
  theme: {
    extend: {
      colors: {
        background: {
          light: '#f8fafc', // slate-50
          dark: '#0f172a',  // slate-900
        },
        surface: {
          light: '#ffffff', // white
          dark: '#1e293b',  // slate-800
        }
      },
      fontFamily: {
        display: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
