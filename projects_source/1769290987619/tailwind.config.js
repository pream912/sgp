
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./dist/*.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ['"Inter"','sans-serif'],
        body: ['"Open Sans"','sans-serif'],
      },
      colors: {
        primary: "#8B1A1A",
        secondary: "#1A1A1A",
        accent: "#0077B6",
        background: "#F8F8F8",
        text: "#231F20",
        buttonBackground: "#8B1A1A",
        buttonText: "#FFFFFF",
      }
    },
  },
  plugins: [],
}
    