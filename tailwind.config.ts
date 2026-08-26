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
        // El escritorio y los papeles encima — cinco pasos, ahora de más
        // oscuro (el fondo) a más claro (el panel) y de vuelta al material.
        bg: "#F5F2EB",
        surface: {
          1: "#F0ECE3", // cromo: barra lateral, encabezados
          2: "#FDFBF7", // panel: la hoja
          3: "#F4F0E7", // subpanel, hover de fila — hundido, no elevado
          4: "#E9E3D6", // pista de barras, teclas, relleno material
        },
        // Líneas: tinta diluida, no luz. En claro un borde blanco no existe.
        line: "rgba(29,27,22,0.10)",
        line2: "rgba(29,27,22,0.20)",
        // Tinta
        ink: {
          DEFAULT: "#1D1B16", // negro cálido, nunca #000
          soft: "#3E3B33",
          mut: "#625E54",
          dim: "#6A655B",
          faint: "#868274",
        },
        // Marca Respondo, bajada a papel. El violeta original (#8B6BFF) sobre
        // crudo se ve de juguete; este mantiene el tono y gana cuerpo.
        brand: { DEFAULT: "#5C42C4", dark: "#452F9E" },
        violet: "#5C42C4",
        coral: "#A8482F",
        cyan: "#186F80",
        // Estado (reservados)
        ok: "#2F6B45",
        warn: "#7F5716",
        danger: "#A32B36",
        accent: "#2D5A9E",
        // Paleta categórica revalidada para papel
        series: {
          1: "#5C42C4",
          2: "#1B7F92",
          3: "#B4553F",
          4: "#2F6B45",
        },
      },
      borderRadius: {
        lg: "0.5rem",
        xl: "0.625rem",
      },
      boxShadow: {
        // En oscuro la separación la hacía un brillo interior arriba. En claro
        // eso no se ve: acá el papel se levanta con una sombra real, corta y
        // de tinta cálida, no negra.
        card: "0 1px 2px rgba(29,27,22,0.05)",
        raise: "0 1px 2px rgba(29,27,22,0.05), 0 6px 16px -10px rgba(29,27,22,0.18)",
        glow: "0 0 0 1px rgba(92,66,196,0.30), 0 2px 10px -4px rgba(92,66,196,0.22)",
        cyan: "0 0 0 1px rgba(24,111,128,0.30), 0 2px 10px -4px rgba(24,111,128,0.20)",
        pop: "0 18px 44px -18px rgba(29,27,22,0.28), 0 2px 6px rgba(29,27,22,0.07)",
      },
      fontFamily: {
        // Newsreader es una serif de lectura: acá va en el TEXTO CORRIDO, no
        // solo en los títulos. Es la decisión que hace que el brief se lea
        // como una nota escrita por alguien y no como salida de sistema.
        // Las variables las define next/font en app/layout.tsx.
        sans: ["var(--fuente-sans)", "Georgia", "serif"],
        display: ["var(--fuente-display)", "var(--fuente-sans)", "Georgia", "serif"],
        mono: ["var(--fuente-mono)", "ui-monospace", "monospace"],
      },
      keyframes: {
        breathe: { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.4" } },
        rise: {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        // `sweep` se fue con el barrido de escáner: era un efecto de sala de
        // control y sobre papel se ve como una mancha.
        breathe: "breathe 2.4s ease-in-out infinite",
        rise: "rise 0.32s cubic-bezier(0.22,1,0.36,1) both",
      },
    },
  },
  plugins: [],
};

export default config;
