import "./globals.css";
import type { Metadata } from "next";
import Sidebar from "@/components/Sidebar";
import CommandPalette from "@/components/CommandPalette";

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
    <html lang="es">
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
