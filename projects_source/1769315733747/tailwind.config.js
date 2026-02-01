
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./dist/*.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ['"Playfair Display"','sans-serif'],
        body: ['"Inter"','sans-serif'],
      },
      colors: {
        primary: "#9D1B2B",
        secondary: "#1E3F66",
        accent: "#A7B9CD",
        background: "#121212",
        text: "#EAEAEA",
        buttonBackground: "#9D1B2B",
        buttonText: "#EAEAEA",
      }
    },
  },
  plugins: [],
}
    