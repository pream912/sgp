
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./dist/*.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ['"Oswald"','sans-serif'],
        body: ['"Lato"','sans-serif'],
      },
      colors: {
        primary: "#A82020",
        secondary: "#1E3A8A",
        accent: "#E0E0E0",
        background: "#1A1A1A",
        text: "#F0F0F0",
        buttonBackground: "#A82020",
        buttonText: "#F0F0F0",
      }
    },
  },
  plugins: [],
}
    