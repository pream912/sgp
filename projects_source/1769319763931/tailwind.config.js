
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
        primary: "#C62828",
        secondary: "#4A5568",
        accent: "#64B5F6",
        background: "#F8F8F8",
        text: "#1A202C",
        buttonBackground: "#C62828",
        buttonText: "#FFFFFF",
      }
    },
  },
  plugins: [],
}
    