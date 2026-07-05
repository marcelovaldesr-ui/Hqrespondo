import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#F7F8FA",
        surface: {
          1: "#FFFFFF",
          2: "#FFFFFF",
          3: "#F1F3F6",
          4: "#E9ECF0",
        },
        line: "rgba(23, 34, 46, 0.09)",
        line2: "rgba(23, 34, 46, 0.16)",
        ink: {
          DEFAULT: "#1B2430",
          soft: "#333E4A",
          mut: "#5B6673",
          dim: "#8B95A1",
          faint: "#B7BFC9",
        },
        brand: {
          DEFAULT: "#16A34A",
          dark: "#FFFFFF",
        },
        accent: "#2563EB",
        violet: "#7C6FF0",
        warn: "#D97706",
        danger: "#DC2626",
      },
      boxShadow: {
        glow: "0 1px 2px rgba(16, 24, 40, 0.06)",
        cyan: "0 1px 2px rgba(16, 24, 40, 0.06)",
        card: "0 1px 2px rgba(16, 24, 40, 0.05), 0 1px 3px rgba(16, 24, 40, 0.05)",
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
