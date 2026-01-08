
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
        primary: "#30A39C",
        secondary: "#E0F4F4",
        accent: "#F2A154",
        background: "#FDFDFD",
        text: "#333333",
        buttonBackground: "#004D40",
        buttonText: "#FFFFFF",
      }
    },
  },
  plugins: [],
}
    