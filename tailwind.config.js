/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--atlas-navy-1)",
        card: "var(--atlas-card)",
        "card-hover": "var(--atlas-card-hover)",
        border: "var(--atlas-border)",
        "border-light": "var(--atlas-border-light)",
        "text-primary": "var(--atlas-text)",
        "text-muted": "var(--atlas-text-secondary)",
        "text-dim": "var(--atlas-text-dim)",
        accent: "var(--atlas-gold)",
        "accent-light": "var(--atlas-gold-bright)",
        atlas: {
          navy: {
            1: "var(--atlas-navy-1)",
            2: "var(--atlas-navy-2)",
            3: "var(--atlas-navy-3)",
            4: "var(--atlas-navy-4)",
            5: "var(--atlas-navy-5)",
          },
          gold: "var(--atlas-gold)",
          "gold-dim": "var(--atlas-gold-dim)",
          "gold-bright": "var(--atlas-gold-bright)",
          red: "var(--atlas-red)",
          amber: "var(--atlas-amber)",
          green: "var(--atlas-green)",
          blue: "var(--atlas-blue)",
          purple: "var(--atlas-purple)",
        },
      },
      fontFamily: {
        sans: ["Space Grotesk", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "system-ui", "sans-serif"],
        data: ["JetBrains Mono", "monospace"],
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
