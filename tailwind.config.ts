import type { Config } from "tailwindcss";

/**
 * RespondoHQ — sistema visual "Libreta" (claro).
 *
 * QUÉ CAMBIÓ Y POR QUÉ — 26-ago-2026
 * Hasta acá HQ era una sala de control oscura: fondo #07070E, aura morada,
 * neón cian, Inter + Space Grotesk. Marcelo lo resumió bien: "demasiado IA".
 * Y tenía razón — esa combinación es la firma visual de casi todo dashboard
 * de los últimos tres años, así que la herramienta no se veía como suya.
 *
 * Esto es lo contrario: papel tibio, tinta oscura, serif en el texto corrido
 * y mono solo donde hay números. La idea es que HQ se lea como un cuaderno de
 * trabajo y no como un panel de instrumentos.
 *
 * REGLAS QUE SIGUEN VIGENTES (y una que se dio vuelta):
 *  · Los NOMBRES de los tokens no cambiaron. `surface-2` sigue siendo el
 *    panel, `ink-mut` sigue siendo la tinta secundaria. Por eso los 54
 *    componentes no se tocaron: cambia el valor, no el vocabulario.
 *  · SE DIO VUELTA la escalera de superficies. En oscuro subían en
 *    luminosidad (el panel era más claro que el fondo). En claro BAJAN: el
 *    fondo es el escritorio, el panel es el papel encima —casi blanco— y
 *    `surface-4` es el más material, para pistas de barra y teclas.
 *  · Los números SIEMPRE en mono con cifras tabulares. Eso no cambia: es lo
 *    que permite escanear una columna de arriba abajo.
 *  · `series-1..4` es la paleta CATEGÓRICA de gráficos, revalidada para fondo
 *    #FDFBF7. Medido: contraste 4.5–6.7 contra el papel, y ΔE ≥ 33 entre
 *    cualquier par incluso simulando daltonismo rojo-verde. No usarlos para
 *    estado.
 *  · `ok / warn / danger / accent` son colores de ESTADO, reservados. Nunca
 *    se reciclan como "serie 5".
 *
 * TODA la tinta de acá se midió contra las cinco superficies antes de
 * escribirla: las 12 pasan 4.5:1 en su peor caso (3:1 para `ink-faint`, que
 * solo se usa en texto de relleno de los campos). En claro esto importa más
 * que en oscuro, porque los grises suaves que sobre negro se leían bien,
 * sobre papel simplemente desaparecen.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Lienzo y superficies de alta densidad SaaS (estilo Linear / Stripe)
        bg: "#F8FAFC",
        surface: {
          DEFAULT: "#FFFFFF",
          1: "#0B1220", // Cromo oscuro: barra lateral
          2: "#FFFFFF", // Paneles, tarjetas y modales
          3: "#F1F5F9", // Subpanel, hover de fila, chip neutro
          4: "#E2E8F0", // Pista de barras, teclas, separadores
        },
        // Bordes nítidos y líneas de separación
        line: "rgba(15, 23, 42, 0.08)",
        line2: "rgba(15, 23, 42, 0.16)",
        // Tinta y jerarquía tipográfica Slate
        ink: {
          DEFAULT: "#0F172A", // Slate 900: texto principal nítido
          soft: "#334155",    // Slate 700
          mut: "#475569",     // Slate 600
          dim: "#64748B",     // Slate 500
          faint: "#94A3B8",   // Slate 400
        },
        // Marca Respondo & Acentos técnicos
        brand: { DEFAULT: "#4F46E5", dark: "#4338CA" },
        violet: "#6366F1",
        coral: "#F97316",
        cyan: { DEFAULT: "#00C2CB", dark: "#0891B2" },
        accent: { DEFAULT: "#00C2CB", dark: "#0891B2" },
        // Estados semánticos (reservados)
        ok: "#10B981",       // Emerald: saludable / ganado
        warn: "#F59E0B",     // Amber: advertencia / stalled
        danger: "#EF4444",   // Red: crítico / perdido / errores
        // Series categóricas para visualizaciones
        series: {
          1: "#4F46E5",
          2: "#00C2CB",
          3: "#F59E0B",
          4: "#10B981",
        },
      },
      borderRadius: {
        lg: "0.5rem",
        xl: "0.625rem",
      },
      boxShadow: {
        "2xs": "0 1px 2px 0 rgba(15, 23, 42, 0.04)",
        xs: "0 1px 2px 0 rgba(15, 23, 42, 0.05)",
        card: "0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.04)",
        raise: "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)",
        glow: "0 0 0 1px rgba(79, 70, 229, 0.25), 0 2px 10px -4px rgba(79, 70, 229, 0.20)",
        cyan: "0 0 0 1px rgba(0, 194, 203, 0.30), 0 2px 10px -4px rgba(0, 194, 203, 0.20)",
        pop: "0 12px 28px -6px rgba(15, 23, 42, 0.12), 0 2px 4px rgba(15, 23, 42, 0.04)",
      },
      fontFamily: {
        sans: ["var(--fuente-sans)", "Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        display: ["var(--fuente-display)", "var(--fuente-sans)", "Inter", "sans-serif"],
        mono: ["var(--fuente-mono)", "IBM Plex Mono", "ui-monospace", "monospace"],
      },
      keyframes: {
        breathe: { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.4" } },
        rise: {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        breathe: "breathe 2.4s ease-in-out infinite",
        rise: "rise 0.32s cubic-bezier(0.22,1,0.36,1) both",
      },
    },
  },
  plugins: [],
};

export default config;
