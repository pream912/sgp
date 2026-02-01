
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
        primary: "#E43A4F",
        secondary: "#2C3E50",
        accent: "#3498DB",
        background: "#F8F8F8",
        text: "#1A1A1A",
        buttonBackground: "#C0392B",
        buttonText: "#FFFFFF",
      }
    },
  },
  plugins: [],
}
    