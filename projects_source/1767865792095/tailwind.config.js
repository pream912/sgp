
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
        primary: "#4CAF50",
        secondary: "#E57373",
        accent: "#64B5F6",
        background: "#F5F5F5",
        text: "#212121",
        buttonBackground: "#2E7D32",
        buttonText: "#FFFFFF",
      }
    },
  },
  plugins: [],
}
    