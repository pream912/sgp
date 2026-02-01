
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./dist/*.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ['"Playfair Display"','sans-serif'],
        body: ['"Inter"','sans-serif'],
      },
      colors: {
        primary: "#B00020",
        secondary: "#000080",
        accent: "#C0C0C0",
        background: "#1A1A1A",
        text: "#F0F0F0",
        buttonBackground: "#B00020",
        buttonText: "#F0F0F0",
      }
    },
  },
  plugins: [],
}
    