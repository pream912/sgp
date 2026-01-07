
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
        primary: "#42A5F5",
        secondary: "#81C784",
        accent: "#F48FB1",
        background: "#F8F8F8",
        text: "#333333",
        buttonBackground: "#42A5F5",
        buttonText: "#FFFFFF",
      }
    },
  },
  plugins: [],
}
    