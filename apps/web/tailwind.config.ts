import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#1a1b1e",
          raised: "#222327",
          overlay: "#2a2b30",
          border: "#35363c",
        },
        accent: {
          DEFAULT: "#c4a574",
          muted: "#9a8460",
          dim: "#6b5d45",
        },
        warm: {
          50: "#f5f3ef",
          100: "#e8e4dc",
          200: "#c9c2b4",
          300: "#a89f8e",
          400: "#8a8070",
          500: "#6e6558",
        },
      },
      backgroundImage: {
        "card-gradient":
          "linear-gradient(145deg, rgba(42,43,48,0.9) 0%, rgba(26,27,30,0.95) 100%)",
        "sidebar-gradient":
          "linear-gradient(180deg, #1e1f23 0%, #1a1b1e 100%)",
      },
      boxShadow: {
        card: "0 4px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)",
        glow: "0 0 20px rgba(196,165,116,0.15)",
      },
    },
  },
  plugins: [],
};

export default config;
