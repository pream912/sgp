
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./dist/*.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ['"Lora"','sans-serif'],
        body: ['"Inter"','sans-serif'],
      },
      colors: {
        primary: "#B31B1B",
        secondary: "#00008B",
        accent: "#C0C0C0",
        background: "#1A1A1A",
        text: "#F0F0F0",
        buttonBackground: "#B31B1B",
        buttonText: "#F0F0F0",
      }
    },
  },
  plugins: [],
}
    