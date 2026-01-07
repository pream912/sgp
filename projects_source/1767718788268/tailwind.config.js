
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./dist/*.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ['"Playfair Display"','sans-serif'],
        body: ['"Lato"','sans-serif'],
      },
      colors: {
        primary: "#6B3F93",
        secondary: "#C78F9B",
        accent: "#ECC94B",
        background: "#F8F8F8",
        text: "#333333",
        buttonBackground: "#6B3F93",
        buttonText: "#F8F8F8",
      }
    },
  },
  plugins: [],
}
    