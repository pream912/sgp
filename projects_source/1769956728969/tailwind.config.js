
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./dist/*.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ['"Montserrat"','sans-serif'],
        body: ['"Lato"','sans-serif'],
      },
      colors: {
        primary: "#A30000",
        secondary: "#000066",
        accent: "#CCCCCC",
        background: "#000000",
        text: "#F0F0F0",
        buttonBackground: "#A30000",
        buttonText: "#FFFFFF",
      }
    },
  },
  plugins: [],
}
    