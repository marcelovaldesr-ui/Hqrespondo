import type { Config } from "tailwindcss";

/**
 * RespondoHQ — sistema visual "sala de control" (oscuro).
 *
 * Reglas del sistema:
 *  · Las superficies suben en luminosidad, nunca con sombras: en oscuro las
 *    sombras no se leen. La separación la hace el borde (hairline) + el brillo
 *    interior superior.
 *  · Los números SIEMPRE en mono con cifras tabulares. Es lo que hace que una
 *    columna se pueda escanear de arriba abajo.
 *  · `series-1..4` es la paleta CATEGÓRICA de gráficos. Está validada para
 *    fondo #0B0B14 (banda de luminosidad, piso de croma, separación para
 *    daltonismo y contraste). No usarlos para estado.
 *  · `ok / warn / danger / accent` son colores de ESTADO, reservados. Nunca
 *    se reciclan como "serie 5".
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Lienzo y superficies — escalera de 5 pasos
        bg: "#07070E",
        surface: {
          1: "#0B0B14", // cromo: sidebar, barra superior
          2: "#101019", // panel
          3: "#16161F", // subpanel, hover de fila
          4: "#1E1E2A", // input, track de barras
        },
        // Hairlines luminosos
        line: "rgba(255,255,255,0.075)",
        line2: "rgba(255,255,255,0.14)",
        // Tinta
        ink: {
          DEFAULT: "#F3F4F8",
          soft: "#CBCEDA",
          mut: "#979CAF",
          dim: "#70768B",
          faint: "#4C5163",
        },
        // Marca Respondo
        brand: { DEFAULT: "#8B6BFF", dark: "#6A46F5" },
        violet: "#8B6BFF",
        coral: "#FF7A63",
        cyan: "#34D9F0",
        // Estado (reservados)
        ok: "#2FD98C",
        warn: "#FFB43D",
        danger: "#FF5C6E",
        accent: "#5B8CFF",
        // Paleta categórica validada para gráficos sobre #0B0B14
        series: {
          1: "#9174FF",
          2: "#12A0BA",
          3: "#E66551",
          4: "#00AF77",
        },
      },
      borderRadius: {
        lg: "0.625rem",
        xl: "0.75rem",
      },
      boxShadow: {
        // borde interior superior: hace que el panel se sienta físico
        card: "inset 0 1px 0 rgba(255,255,255,0.045)",
        raise:
          "inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 24px -12px rgba(0,0,0,0.7)",
        glow: "0 0 0 1px rgba(139,107,255,0.28), 0 0 26px -6px rgba(139,107,255,0.4)",
        cyan: "0 0 0 1px rgba(52,217,240,0.28), 0 0 24px -6px rgba(52,217,240,0.38)",
        pop: "0 24px 60px -20px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.06)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["'Space Grotesk'", "Inter", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      keyframes: {
        sweep: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        breathe: {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
        rise: {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        sweep: "sweep 3.4s ease-in-out infinite",
        breathe: "breathe 2.4s ease-in-out infinite",
        rise: "rise 0.32s cubic-bezier(0.22,1,0.36,1) both",
      },
    },
  },
  plugins: [],
};

export default config;
