import "./globals.css";
import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import CommandPalette from "@/components/CommandPalette";

const texto = Inter({
  subsets: ["latin"],
  variable: "--fuente-sans",
  display: "swap",
});
const display = Inter({
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
  description: "Revenue Command Center de Respondo",
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
      <body className="bg-bg text-ink antialiased">
        <div className="app-frame flex min-h-screen bg-bg">
          <Sidebar />
          <main className="relative flex-1 min-w-0 overflow-x-auto bg-bg px-4 py-5 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
        <CommandPalette />
      </body>
    </html>
  );
}
