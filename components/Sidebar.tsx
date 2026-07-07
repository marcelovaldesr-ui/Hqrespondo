"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function Icon({ name }: { name: string }) {
  const common = {
    width: 15,
    height: 15,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.4,
    strokeLinecap: "round" as const,
  };
  switch (name) {
    case "dashboard":
      return (
        <svg {...common} aria-hidden="true">
          <rect x="1.5" y="1.5" width="5.2" height="5.2" rx="1" />
          <rect x="9.3" y="1.5" width="5.2" height="5.2" rx="1" />
          <rect x="1.5" y="9.3" width="5.2" height="5.2" rx="1" />
          <rect x="9.3" y="9.3" width="5.2" height="5.2" rx="1" />
        </svg>
      );
    case "target":
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="8" cy="8" r="6" />
          <circle cx="8" cy="8" r="2" fill="currentColor" stroke="none" />
        </svg>
      );
    case "kanban":
      return (
        <svg {...common} aria-hidden="true">
          <rect x="1.8" y="2" width="3.4" height="12" rx="1" />
          <rect x="6.3" y="2" width="3.4" height="8" rx="1" />
          <rect x="10.8" y="2" width="3.4" height="10" rx="1" />
        </svg>
      );
    case "bot":
      return (
        <svg {...common} aria-hidden="true">
          <rect x="2.5" y="5.5" width="11" height="8" rx="2" />
          <path d="M8 5.5V3" />
          <circle cx="8" cy="2.4" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="5.7" cy="9.5" r="1" fill="currentColor" stroke="none" />
          <circle cx="10.3" cy="9.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "file":
      return (
        <svg {...common} aria-hidden="true">
          <rect x="3" y="1.5" width="10" height="13" rx="1.5" />
          <path d="M5.5 5.5h5M5.5 8.5h5M5.5 11.5h3" />
        </svg>
      );
    case "map":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M2 3.5v10l4-1.5 4 1.5 4-1.5v-10L10 3.5 6 2 2 3.5z" />
          <path d="M6 2v10M10 3.5v10" />
        </svg>
      );
    case "check":
      return (
        <svg {...common} aria-hidden="true">
          <rect x="2" y="2" width="12" height="12" rx="2.5" />
          <path d="M5.2 8.2l2 2 3.6-4.2" />
        </svg>
      );
    case "money":
      return (
        <svg {...common} aria-hidden="true">
          <rect x="1.8" y="3.5" width="12.4" height="9" rx="1.5" />
          <circle cx="8" cy="8" r="2.2" />
        </svg>
      );
    case "spark":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M8 1.6l1.5 4 4 1.5-4 1.5L8 14.4 6.5 8.6l-4-1.5 4-1.5L8 1.6z" />
        </svg>
      );
    default:
      return null;
  }
}

/** Orden = flujo mental del día:
 *  Hoy → Prospectar → Pipeline → Clientes/Bots → Finanzas → Brief → Roadmap → Decisiones */
const LINKS = [
  { href: "/dashboard", label: "Centro de mando", icon: "dashboard" },
  { href: "/prospeccion", label: "Prospección", icon: "target" },
  { href: "/pipeline", label: "Pipeline", icon: "kanban" },
  { href: "/clientes", label: "Clientes & Bots", icon: "bot" },
  { href: "/growth", label: "Growth Studio", icon: "spark" },
  { href: "/finanzas", label: "Finanzas", icon: "money" },
  { href: "/brief", label: "Brief del Día", icon: "file" },
  { href: "/roadmap", label: "Roadmap", icon: "map" },
  { href: "/decisiones", label: "Decisiones", icon: "check" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="relative flex w-[4.75rem] shrink-0 flex-col border-r border-line bg-surface-1 px-2 py-5 sm:w-[15.5rem] sm:px-3">
      <div className="relative mb-8 flex items-center gap-2.5 px-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/isotipo.svg" alt="Respondo" className="h-8 w-8 shrink-0" />
        <span className="hidden text-[15px] font-semibold tracking-tight sm:inline">
          Respon<span className="text-brand">do</span>{" "}
          <span className="font-normal text-ink-dim">HQ</span>
        </span>
      </div>

      <nav className="relative flex flex-col gap-1">
        {LINKS.map((l) => {
          const active = pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`group flex items-center gap-3 rounded-lg border px-3 py-2.5 text-[13px] transition ${
                active
                  ? "border-brand/25 bg-brand/[0.07] text-brand"
                  : "border-transparent text-ink-mut hover:bg-surface-3 hover:text-ink"
              }`}
            >
              <span
                className={`grid h-7 w-7 place-items-center rounded-md border ${
                  active
                    ? "border-brand/30 bg-brand/10"
                    : "border-line bg-surface-3 text-ink-dim group-hover:text-ink"
                }`}
              >
                <Icon name={l.icon} />
              </span>
              <span className="hidden truncate sm:inline">{l.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto hidden border-t border-line px-3 pt-4 sm:block">
        <p className="mb-2.5 text-[10.5px] leading-relaxed text-ink-dim">
          Menos ruido. Más demos.
        </p>
        <div className="flex items-center justify-between font-mono text-[10px] text-ink-faint">
          <span className="flex items-center gap-1.5">
            <span className="led h-[5px] w-[5px] bg-ok" />
            Sistema activo
          </span>
          <span>v0.4</span>
        </div>
      </div>
    </aside>
  );
}
