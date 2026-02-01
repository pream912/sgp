
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
        primary: "#B22222",
        secondary: "#191970",
        accent: "#CCCCCC",
        background: "#1A1A1A",
        text: "#F0F0F0",
        buttonBackground: "#B22222",
        buttonText: "#F0F0F0",
      }
    },
  },
  plugins: [],
}
    