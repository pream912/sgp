
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
        primary: "#48C9B0",
        secondary: "#D87093",
        accent: "#87CEEB",
        background: "#F5F5F5",
        text: "#333333",
        buttonBackground: "#48C9B0",
        buttonText: "#FFFFFF",
      }
    },
  },
  plugins: [],
}
    