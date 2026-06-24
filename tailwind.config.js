/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Modern Enterprise Palette
        brand: '#4f46e5', // Sleek Indigo
        ink: '#0f172a',   // Deep Slate for high-contrast text
        muted: '#64748b', // Soft Slate for secondary text
        panel: '#ffffff', // Crisp white for cards
        line: '#e2e8f0',  // Subtle borders
        coral: '#ef4444', // Destructive/Absent actions
        gold: '#f59e0b',  // Warnings/Pending states
        background: '#f8fafc', // Very light cool gray for the main app background
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(15, 23, 42, 0.05)',
        'float': '0 10px 40px -4px rgba(15, 23, 42, 0.08)',
      }
    },
  },
  plugins: [],
}