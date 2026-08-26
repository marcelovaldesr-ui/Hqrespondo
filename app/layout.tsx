import "./globals.css";
import type { Metadata } from "next";
import { IBM_Plex_Mono, Newsreader } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import CommandPalette from "@/components/CommandPalette";

/**
 * Las fuentes se sirven desde nuestro propio dominio.
 *
 * Antes entraban por `@import url(fonts.googleapis.com)` al inicio del CSS:
 * una petición externa, en cada carga, y encima bloqueante (un @import al tope
 * de una hoja de estilos se resuelve en serie antes de pintar). Con next/font
 * se descargan al compilar y se sirven junto con la app: sin dependencia de
 * terceros en tiempo de ejecución, sin salto de tipografía y sin filtrar a
 * Google qué páginas abre el equipo.
 *
 * QUÉ CAMBIÓ — 26-ago-2026
 * Eran Inter + Space Grotesk + JetBrains Mono. Son buenas fuentes, pero es la
 * combinación por defecto de casi todo dashboard: HQ no se veía como nuestro.
 *
 * Ahora son dos, no tres, y con una división más clara:
 *  · Newsreader (serif de lectura) para TODO el texto corrido, no solo los
 *    títulos. Es lo que hace que el brief del día se lea como una nota escrita
 *    por alguien del equipo en vez de una salida de sistema.
 *  · IBM Plex Mono para números, etiquetas y cualquier cosa que se escanee en
 *    columna. Ahí el mono no es estilo: es lo que alinea las cifras.
 *
 * Si con el uso la serif termina cansando en las tablas densas —es el riesgo
 * conocido de esta elección—, se cambia `--fuente-sans` a una sans y el resto
 * del sistema queda igual. Es una línea.
 *
 * Newsreader es variable (ejes opsz y wght): no se le pide `weight` para que
 * el navegador interpole y venga un solo archivo en vez de cuatro.
 */
const texto = Newsreader({
  subsets: ["latin"],
  variable: "--fuente-sans",
  display: "swap",
});
const display = Newsreader({
  subsets: ["latin"],
  variable: "--fuente-display",
  display: "swap",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--fuente-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Respondo HQ",
  description: "Centro de operaciones de Respondo",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      className={`${texto.variable} ${display.variable} ${mono.variable}`}
    >
      {/* Se fueron `grid-bg` y `canvas-aura`: eran la retícula de instrumento y
          los dos halos de color del fondo. Sobre papel no aportan textura,
          aportan suciedad. El fondo ahora es el fondo. */}
      <body>
        <div className="app-frame flex">
          <Sidebar />
          <main className="relative flex-1 overflow-x-auto px-4 py-5 sm:px-5 lg:px-7">
            {children}
          </main>
        </div>
        <CommandPalette />
      </body>
    </html>
  );
}
