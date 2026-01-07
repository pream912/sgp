
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
        primary: "#00A3A3",
        secondary: "#495057",
        accent: "#E0FFFF",
        background: "#F8F9FA",
        text: "#212529",
        buttonBackground: "#00A3A3",
        buttonText: "#FFFFFF",
      }
    },
  },
  plugins: [],
}
    