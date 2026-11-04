 /** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bulsuMaroon: '#8B1E2D',
        bulsuGold: '#F4D35E',
      }
    },
  },
  plugins: [],
}