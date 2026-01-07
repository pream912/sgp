
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./dist/*.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ['"Poppins"','sans-serif'],
        body: ['"Lato"','sans-serif'],
      },
      colors: {
        primary: "#007B8C",
        secondary: "#6C757D",
        accent: "#2EC4B6",
        background: "#F8F9FA",
        text: "#212529",
        buttonBackground: "#007B8C",
        buttonText: "#FFFFFF",
      }
    },
  },
  plugins: [],
}
    