
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
        primary: "#2E7D32",
        secondary: "#C62828",
        accent: "#81D4FA",
        background: "#FDFDFD",
        text: "#1A1A1A",
        buttonBackground: "#2E7D32",
        buttonText: "#FDFDFD",
      }
    },
  },
  plugins: [],
}
    