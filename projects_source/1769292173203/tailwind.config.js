
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./dist/*.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ['"Montserrat"','sans-serif'],
        body: ['"Roboto"','sans-serif'],
      },
      colors: {
        primary: "#C42B2B",
        secondary: "#34495E",
        accent: "#2C7CCF",
        background: "#F9F9F9",
        text: "#1A1A1A",
        buttonBackground: "#C42B2B",
        buttonText: "#F9F9F9",
      }
    },
  },
  plugins: [],
}
    