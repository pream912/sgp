
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./dist/*.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ['"Poppins"','sans-serif'],
        body: ['"Roboto"','sans-serif'],
      },
      colors: {
        primary: "#2C5A3A",
        secondary: "#D6979F",
        accent: "#A6DBEE",
        background: "#F2F7F9",
        text: "#30363B",
        buttonBackground: "#2C5A3A",
        buttonText: "#FFFFFF",
      }
    },
  },
  plugins: [],
}
    