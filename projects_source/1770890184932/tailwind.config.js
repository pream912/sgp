
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./dist/*.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ['"Open Sans"','sans-serif'],
        body: ['"Lato"','sans-serif'],
      },
      colors: {
        primary: "#00897B",
        secondary: "#B2DFDB",
        accent: "#FFAB91",
        background: "#F8F8F8",
        text: "#212121",
        buttonBackground: "#00897B",
        buttonText: "#FFFFFF",
      }
    },
  },
  plugins: [],
}
    