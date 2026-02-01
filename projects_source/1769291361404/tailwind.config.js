
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./dist/*.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ['"Inter"','sans-serif'],
        body: ['"Roboto"','sans-serif'],
      },
      colors: {
        primary: "#990000",
        secondary: "#333333",
        accent: "#007BFF",
        background: "#F8F8F8",
        text: "#1A1A1A",
        buttonBackground: "#990000",
        buttonText: "#F8F8F8",
      }
    },
  },
  plugins: [],
}
    