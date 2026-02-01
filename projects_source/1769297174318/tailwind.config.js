
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
        primary: "#20B2AA",
        secondary: "#A9A9A9",
        accent: "#80CBC4",
        background: "#FDFDFD",
        text: "#333333",
        buttonBackground: "#20B2AA",
        buttonText: "#FFFFFF",
      }
    },
  },
  plugins: [],
}
    