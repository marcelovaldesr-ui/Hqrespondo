import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#06090D",
        surface: {
          1: "#090D12",
          2: "#10161D",
          3: "#0B1016",
          4: "#141B24",
        },
        line: "rgba(163, 185, 206, 0.10)",
        line2: "rgba(163, 185, 206, 0.18)",
        ink: {
          DEFAULT: "#EAF2FA",
          soft: "#C2CDD8",
          mut: "#93A1AF",
          dim: "#657281",
          faint: "#3D4854",
        },
        brand: {
          DEFAULT: "#30EA88",
          dark: "#06281A",
        },
        accent: "#55D6FF",
        violet: "#8B7CFF",
        warn: "#FFC54A",
        danger: "#FF665C",
      },
      boxShadow: {
        glow: "0 0 42px rgba(48, 234, 136, 0.14)",
        cyan: "0 0 38px rgba(85, 214, 255, 0.13)",
        card: "inset 0 1px 0 rgba(255,255,255,0.045), 0 18px 48px rgba(0,0,0,0.28)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
