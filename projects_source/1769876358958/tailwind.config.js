
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
        primary: "#0A4C0A",
        secondary: "#66B2B2",
        accent: "#FFC7A8",
        background: "#F5F5F5",
        text: "#1A1A1A",
        buttonBackground: "#0A4C0A",
        buttonText: "#FFFFFF",
      }
    },
  },
  plugins: [],
}
    