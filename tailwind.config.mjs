/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "theintro-green": "#00ff88",
        "green-400": "#34D399"
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
        "3xl": "1.875rem",
        "4xl": "2.25rem",
        full: "9999px"
      }
    }
  },
  plugins: []
}
