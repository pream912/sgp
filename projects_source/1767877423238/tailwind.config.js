
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./dist/*.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ['"Montserrat"','sans-serif'],
        body: ['"Inter"','sans-serif'],
      },
      colors: {
        primary: "#6366f1",
        secondary: "#4f46e5",
        accent: "#818cf8",
        background: "#eef2ff",
        text: "#312e81",
        buttonBackground: "#4f46e5",
        buttonText: "#ffffff",
      }
    },
  },
  plugins: [],
}
    