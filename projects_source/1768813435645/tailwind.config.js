
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./dist/*.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ['"Montserrat"','sans-serif'],
        body: ['"Open Sans"','sans-serif'],
      },
      colors: {
        primary: "#4F949F",
        secondary: "#E0A3A2",
        accent: "#F0F8FF",
        background: "#F5F5F5",
        text: "#1A1A1A",
        buttonBackground: "#4F949F",
        buttonText: "#F0F0F0",
      }
    },
  },
  plugins: [],
}
    