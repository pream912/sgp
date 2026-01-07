
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
        primary: "#2E7D32",
        secondary: "#64B5F6",
        accent: "#E57373",
        background: "#F8F8F8",
        text: "#1A1A1A",
        buttonBackground: "#2E7D32",
        buttonText: "#FFFFFF",
      }
    },
  },
  plugins: [],
}
    