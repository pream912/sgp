
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
        primary: "#4CAF50",
        secondary: "#80CBC4",
        accent: "#FFB74D",
        background: "#F8F8F8",
        text: "#333333",
        buttonBackground: "#004D40",
        buttonText: "#FFFFFF",
      }
    },
  },
  plugins: [],
}
    