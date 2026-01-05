
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
        body: ['"Roboto"', 'sans-serif'],
      },
      colors: {
        primary: "#003366",
        secondary: "#66BB6A",
        accent: "#D46A6A",
        background: "#F8F8F8",
        text: "#1A1A1A",
        buttonBackground: "#003366",
        buttonText: "#FFFFFF",
      }
    },
  },
  plugins: [],
}
    