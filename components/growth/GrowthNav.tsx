"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/growth", label: "Panel" },
  { href: "/growth/ideas", label: "Ideas" },
  { href: "/growth/generador", label: "Generador" },
  { href: "/growth/calendario", label: "Calendario" },
  { href: "/growth/rubros", label: "Rubros" },
  { href: "/growth/battlecards", label: "Battlecards" },
  { href: "/growth/destacadas", label: "Destacadas" },
  { href: "/growth/copies", label: "Copies" },
];

export default function GrowthNav() {
  const pathname = usePathname();
  return (
    <nav className="mb-5 flex flex-wrap gap-1.5 border-b border-line pb-3">
      {TABS.map((t) => {
        const active =
          t.href === "/growth" ? pathname === "/growth" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`rounded-lg border px-3 py-1.5 text-[12.5px] transition ${
              active
                ? "border-brand/30 bg-brand/[0.07] text-brand"
                : "border-transparent text-ink-mut hover:bg-surface-3 hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
