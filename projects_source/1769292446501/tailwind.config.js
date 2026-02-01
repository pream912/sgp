
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./dist/*.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ['"Montserrat"','sans-serif'],
        body: ['"Roboto"','sans-serif'],
      },
      colors: {
        primary: "#1A922C",
        secondary: "#1976D2",
        accent: "#F08080",
        background: "#F8F9FA",
        text: "#343A40",
        buttonBackground: "#1A922C",
        buttonText: "#FFFFFF",
      }
    },
  },
  plugins: [],
}
    