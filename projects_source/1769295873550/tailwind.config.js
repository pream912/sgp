
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./dist/*.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ['"Inter"','sans-serif'],
        body: ['"Open Sans"','sans-serif'],
      },
      colors: {
        primary: "#003300",
        secondary: "#4CAF50",
        accent: "#F48FB1",
        background: "#F8F9FA",
        text: "#1A1A1A",
        buttonBackground: "#003300",
        buttonText: "#FFFFFF",
      }
    },
  },
  plugins: [],
}
    