/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172026",
        muted: "#667085",
        line: "#d7dde5",
        panel: "#f7f9fb",
        brand: "#0f766e",
        coral: "#df694d",
        gold: "#d99b2b"
      },
      boxShadow: {
        soft: "0 16px 50px rgba(23, 32, 38, 0.08)"
      }
    }
  },
  plugins: []
};
