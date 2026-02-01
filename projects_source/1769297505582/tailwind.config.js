
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
        primary: "#E07A7C",
        secondary: "#8CC98A",
        accent: "#A6D7DD",
        background: "#F9FBFB",
        text: "#2C2C2C",
        buttonBackground: "#2C3E50",
        buttonText: "#F0F0F0",
      }
    },
  },
  plugins: [],
}
    