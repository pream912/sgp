
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./dist/*.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ['"Poppins"','sans-serif'],
        body: ['"Open Sans"','sans-serif'],
      },
      colors: {
        primary: "#2980B9",
        secondary: "#27AE60",
        accent: "#FFBF00",
        background: "#ffffff",
        text: "#1A1A1A",
        buttonBackground: "#2980B9",
        buttonText: "#FFFFFF",
      }
    },
  },
  plugins: [],
}
    