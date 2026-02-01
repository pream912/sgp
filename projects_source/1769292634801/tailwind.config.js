
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./dist/*.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ['"Inter"','sans-serif'],
        body: ['"Roboto"','sans-serif'],
      },
      colors: {
        primary: "#E53935",
        secondary: "#1976D2",
        accent: "#212121",
        background: "#F7F7F7",
        text: "#212121",
        buttonBackground: "#E53935",
        buttonText: "#F7F7F7",
      }
    },
  },
  plugins: [],
}
    