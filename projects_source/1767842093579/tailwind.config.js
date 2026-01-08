
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
        primary: "#367C9B",
        secondary: "#6BB98A",
        accent: "#E75B5B",
        background: "#F4F4F4",
        text: "#222222",
        buttonBackground: "#367C9B",
        buttonText: "#FFFFFF",
      }
    },
  },
  plugins: [],
}
    