import "./globals.css";
import type { Metadata } from "next";
import Sidebar from "@/components/Sidebar";

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
      <body>
        <div className="app-frame flex">
          <Sidebar />
          <main className="relative flex-1 overflow-x-auto px-4 py-4 sm:px-5 lg:px-8 lg:py-6">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
