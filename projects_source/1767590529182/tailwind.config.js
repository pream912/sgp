
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ['"Montserrat"', 'sans-serif'],
        body: ['"Open Sans"', 'sans-serif'],
      },
      colors: {
        primary: "#A51C30",
        secondary: "#0D3C5E",
        accent: "#D4D9E2",
        background: "#1A1A1A",
        text: "#F0F0F0",
        buttonBackground: "#A51C30",
        buttonText: "#F0F0F0",
      }
    },
  },
  plugins: [],
}
    