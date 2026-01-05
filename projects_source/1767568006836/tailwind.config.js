
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
        primary: "#007788",
        secondary: "#44A077",
        accent: "#FF99AA",
        background: "#F8FDFE",
        text: "#223344",
        buttonBackground: "#007788",
        buttonText: "#FFFFFF",
      }
    },
  },
  plugins: [],
}
    