
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
        secondary: "#E8F5E9",
        accent: "#66BB6A",
        background: "#FFFFFF",
        text: "#1A1A1A",
        buttonBackground: "#2E7D32",
        buttonText: "#FFFFFF",
      }
    },
  },
  plugins: [],
}
    