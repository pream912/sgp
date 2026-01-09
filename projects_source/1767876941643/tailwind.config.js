
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./dist/*.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ['"Exo 2"','sans-serif'],
        body: ['"Open Sans"','sans-serif'],
      },
      colors: {
        primary: "#14b8a6",
        secondary: "#0d9488",
        accent: "#2dd4bf",
        background: "#f0fdfa",
        text: "#134e4a",
        buttonBackground: "#2dd4bf",
        buttonText: "#134e4a",
      }
    },
  },
  plugins: [],
}
    