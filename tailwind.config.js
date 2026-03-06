/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0D1B2A",
        card: "#132238",
        "card-hover": "#1A2D45",
        border: "#1E3A5F",
        "border-light": "#2A4A6B",
        "text-primary": "#FFFFFF",
        "text-muted": "#A0AEC0",
        "text-dim": "#5A7A9A",
        accent: "#C9A84C",
        "accent-light": "#D4B95E",
      },
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 8px rgba(201,168,76,0.2)" },
          "50%": { boxShadow: "0 0 16px rgba(201,168,76,0.4)" },
        },
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "glow-pulse": "glowPulse 2s ease-in-out infinite",
      },
      boxShadow: {
        glow: "0 0 12px rgba(201,168,76,0.25)",
      },
    },
  },
  plugins: [],
};
