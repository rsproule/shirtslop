/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    fontFamily: {
      sans: ['"Autour One"', "ui-sans-serif", "system-ui", "sans-serif"],
      autour: ['"Autour One"', "cursive"],
    },
    extend: {},
  },
  plugins: [],
};
