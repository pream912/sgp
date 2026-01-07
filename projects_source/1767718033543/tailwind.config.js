
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
        primary: "#C00000",
        secondary: "#003399",
        accent: "#F0F0F0",
        background: "#121212",
        text: "#F0F0F0",
        buttonBackground: "#C00000",
        buttonText: "#F0F0F0",
      }
    },
  },
  plugins: [],
}
    