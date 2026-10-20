import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        noche: { DEFAULT: "#0b0e28", 950: "#06081a", 900: "#0b0e28", 800: "#141a45", 700: "#1d2560", 600: "#2a347c" },
        neon: { DEFAULT: "#00f0ff", 300: "#7df8ff", 700: "#00a9b8" },
        oro: { DEFAULT: "#f2c94c", 300: "#f8df8e", 600: "#c99a1e" },
        vivo: "#ff3b6b",
      },
      fontFamily: {
        sans: ["var(--font-cuerpo)", "system-ui", "sans-serif"],
        display: ["var(--font-titulo)", "var(--font-cuerpo)", "sans-serif"],
      },
      boxShadow: {
        neon: "0 0 0 1px rgba(0,240,255,.35), 0 0 24px rgba(0,240,255,.18)",
        comic: "4px 4px 0 0 #06081a",
      },
    },
  },
  plugins: [],
};

export default config;
