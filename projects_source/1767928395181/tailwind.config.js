
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
        primary: "#5CB8A7",
        secondary: "#FF8A8A",
        accent: "#4CAF9D",
        background: "#F0F8F8",
        text: "#1A1A1A",
        buttonBackground: "#5CB8A7",
        buttonText: "#FFFFFF",
      }
    },
  },
  plugins: [],
}
    