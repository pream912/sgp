
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
        primary: "#3C8D7D",
        secondary: "#7DBCCB",
        accent: "#F0A3A7",
        background: "#F8F8F8",
        text: "#1A1A1A",
        buttonBackground: "#3C8D7D",
        buttonText: "#FFFFFF",
      }
    },
  },
  plugins: [],
}
    