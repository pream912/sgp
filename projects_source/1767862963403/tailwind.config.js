
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
        primary: "#4FB392",
        secondary: "#66CCF5",
        accent: "#FCF3D9",
        background: "#F7FDFD",
        text: "#333333",
        buttonBackground: "#4FB392",
        buttonText: "#FFFFFF",
      }
    },
  },
  plugins: [],
}
    