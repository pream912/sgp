
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
        primary: "#B02020",
        secondary: "#203060",
        accent: "#B8A060",
        background: "#121212",
        text: "#F0F0F0",
        buttonBackground: "#B02020",
        buttonText: "#FFFFFF",
      }
    },
  },
  plugins: [],
}
    