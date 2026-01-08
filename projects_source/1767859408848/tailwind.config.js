
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./dist/*.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ['"Lato"','sans-serif'],
        body: ['"Open Sans"','sans-serif'],
      },
      colors: {
        primary: "#4FC3D0",
        secondary: "#E0F2F7",
        accent: "#2C8A9B",
        background: "#F8F8F8",
        text: "#1A1A1A",
        buttonBackground: "#4FC3D0",
        buttonText: "#1A1A1A",
      }
    },
  },
  plugins: [],
}
    