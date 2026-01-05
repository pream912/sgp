
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ['"Montserrat"', 'sans-serif'],
        body: ['"Open Sans"', 'sans-serif'],
      },
      colors: {
        primary: "#F54927",
        secondary: "#78909C",
        accent: "#00CED1",
        background: "#F5F8FA",
        text: "#263238",
        buttonBackground: "#00A3A3",
        buttonText: "#FFFFFF",
      }
    },
  },
  plugins: [],
}
    