/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      boxShadow: {
        'soft': '0 6px 30px -12px rgba(0,0,0,0.25)'
      }
    },
  },
  plugins: [],
}
