/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0F1419",
        card: "#1A2029",
        "card-hover": "#222B37",
        border: "#2A3441",
        "border-light": "#3A4755",
        "text-primary": "#E8ECF1",
        "text-muted": "#8899AA",
        "text-dim": "#5A6B7C",
        accent: "#3B82F6",
        "accent-light": "#60A5FA",
      },
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
