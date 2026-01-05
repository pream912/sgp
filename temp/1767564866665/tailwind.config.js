
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
        primary: "#00A3B0",
        secondary: "#DEEBEF",
        accent: "#6DCFF6",
        background: "#F5F8F9",
        text: "#2A3D45",
        buttonBackground: "#00A3B0",
        buttonText: "#FFFFFF",
      }
    },
  },
  plugins: [],
}
    