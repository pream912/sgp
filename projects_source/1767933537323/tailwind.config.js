
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./dist/*.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ['"Montserrat"','sans-serif'],
        body: ['"Lato"','sans-serif'],
      },
      colors: {
        primary: "#3CB371",
        secondary: "#5DADE2",
        accent: "#FFA07A",
        background: "#F8F8F8",
        text: "#1A1A1A",
        buttonBackground: "#3CB371",
        buttonText: "#FFFFFF",
      }
    },
  },
  plugins: [],
}
    