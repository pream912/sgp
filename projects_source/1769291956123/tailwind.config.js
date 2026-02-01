
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./dist/*.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ['"Poppins"','sans-serif'],
        body: ['"Open Sans"','sans-serif'],
      },
      colors: {
        primary: "#B71C1C",
        secondary: "#333333",
        accent: "#E60000",
        background: "#FFFFFF",
        text: "#333333",
        buttonBackground: "#B71C1C",
        buttonText: "#FFFFFF",
      }
    },
  },
  plugins: [],
}
    