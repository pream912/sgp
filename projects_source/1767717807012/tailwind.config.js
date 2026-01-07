
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
        primary: "#4DD0E1",
        secondary: "#B0BEC5",
        accent: "#26C6DA",
        background: "#F8F8F8",
        text: "#212121",
        buttonBackground: "#4DD0E1",
        buttonText: "#212121",
      }
    },
  },
  plugins: [],
}
    