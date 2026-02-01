
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./dist/*.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ['"Montserrat"','sans-serif'],
        body: ['"Inter"','sans-serif'],
      },
      colors: {
        primary: "#8A1723",
        secondary: "#4A4A4A",
        accent: "#2C3E50",
        background: "#F0F0F0",
        text: "#1A1A1A",
        buttonBackground: "#8A1723",
        buttonText: "#FFFFFF",
      }
    },
  },
  plugins: [],
}
    