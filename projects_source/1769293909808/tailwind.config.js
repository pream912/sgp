
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./dist/*.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ['"Poppins"','sans-serif'],
        body: ['"Inter"','sans-serif'],
      },
      colors: {
        primary: "#D35D62",
        secondary: "#5E8F67",
        accent: "#6BBED7",
        background: "#F5F8FA",
        text: "#2C3E50",
        buttonBackground: "#D35D62",
        buttonText: "#F5F8FA",
      }
    },
  },
  plugins: [],
}
    