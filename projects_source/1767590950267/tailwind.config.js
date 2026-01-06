
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
        primary: "#A52A2A",
        secondary: "#1A1A70",
        accent: "#B8860B",
        background: "#1A1A1A",
        text: "#F0F0F0",
        buttonBackground: "#A52A2A",
        buttonText: "#FFFFFF",
      }
    },
  },
  plugins: [],
}
    