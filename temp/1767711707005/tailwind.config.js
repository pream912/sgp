
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
        primary: "#D36B6F",
        secondary: "#6AA36D",
        accent: "#5EA8BF",
        background: "#FDFDFB",
        text: "#2C2C2C",
        buttonBackground: "#D36B6F",
        buttonText: "#FFFFFF",
      }
    },
  },
  plugins: [],
}
    