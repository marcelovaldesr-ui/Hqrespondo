import "./globals.css";
import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
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
 */
const sans = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--fuente-sans",
  display: "swap",
});
const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--fuente-display",
  display: "swap",
});
const mono = JetBrains_Mono({
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
      className={`${sans.variable} ${display.variable} ${mono.variable}`}
    >
      <body className="grid-bg canvas-aura">
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
