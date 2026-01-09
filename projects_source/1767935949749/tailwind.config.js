
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./dist/*.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ['"Merriweather Sans"','sans-serif'],
        body: ['"Open Sans"','sans-serif'],
      },
      colors: {
        primary: "#37C7C7",
        secondary: "#D0D0D0",
        accent: "#2A9D8F",
        background: "#F8FDFD",
        text: "#212121",
        buttonBackground: "#37C7C7",
        buttonText: "#F8FDFD",
      }
    },
  },
  plugins: [],
}
    