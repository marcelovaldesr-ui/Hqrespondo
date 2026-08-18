/** Navegación compartida entre el sidebar y la paleta de comandos. */

export type NavLink = { href: string; label: string; icon: string; hint?: string };
export type NavGroup = { titulo: string; links: NavLink[] };

/** Agrupada por el momento del día en que se usa, no por módulo técnico. */
export const NAV_GROUPS: NavGroup[] = [
  {
    titulo: "Hoy",
    links: [
      { href: "/dashboard", label: "Centro de mando", icon: "dashboard", hint: "Estado general y prioridades" },
      { href: "/llamadas", label: "Llamadas del día", icon: "phone", hint: "Lista para marcar" },
      { href: "/brief", label: "Brief del día", icon: "file", hint: "Resumen generado" },
    ],
  },
  {
    titulo: "Vender",
    links: [
      { href: "/prospeccion", label: "Prospección", icon: "target", hint: "Buscar y calificar" },
      { href: "/pipeline", label: "Pipeline", icon: "kanban", hint: "Oportunidades por etapa" },
      { href: "/clientes", label: "Clientes & Bots", icon: "bot", hint: "Cuentas y salud de bots" },
    ],
  },
  {
    titulo: "Crecer",
    links: [{ href: "/growth", label: "Growth Studio", icon: "spark", hint: "Contenido e ideas" }],
  },
  {
    titulo: "Gestión",
    links: [
      { href: "/finanzas", label: "Finanzas", icon: "money", hint: "Cobros y gastos" },
      { href: "/roadmap", label: "Roadmap", icon: "map", hint: "Qué se construye" },
      { href: "/decisiones", label: "Decisiones", icon: "check", hint: "Bitácora de acuerdos" },
    ],
  },
];

export const ALL_LINKS: NavLink[] = NAV_GROUPS.flatMap((g) => g.links);

export function NavIcon({ name, size = 14 }: { name: string; size?: number }) {
  const p = {
    width: size,
    height: size,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.45,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "dashboard":
      return (
        <svg {...p}>
          <rect x="1.8" y="1.8" width="5" height="5" rx="1.2" />
          <rect x="9.2" y="1.8" width="5" height="5" rx="1.2" />
          <rect x="1.8" y="9.2" width="5" height="5" rx="1.2" />
          <rect x="9.2" y="9.2" width="5" height="5" rx="1.2" />
        </svg>
      );
    case "target":
      return (
        <svg {...p}>
          <circle cx="8" cy="8" r="5.8" />
          <circle cx="8" cy="8" r="2.6" />
          <circle cx="8" cy="8" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      );
    case "kanban":
      return (
        <svg {...p}>
          <rect x="1.8" y="2" width="3.3" height="12" rx="1" />
          <rect x="6.35" y="2" width="3.3" height="7.5" rx="1" />
          <rect x="10.9" y="2" width="3.3" height="10" rx="1" />
        </svg>
      );
    case "bot":
      return (
        <svg {...p}>
          <rect x="2.4" y="5.4" width="11.2" height="8.2" rx="2.2" />
          <path d="M8 5.4V3.2" />
          <circle cx="8" cy="2.3" r="1" fill="currentColor" stroke="none" />
          <circle cx="5.7" cy="9.4" r="0.95" fill="currentColor" stroke="none" />
          <circle cx="10.3" cy="9.4" r="0.95" fill="currentColor" stroke="none" />
        </svg>
      );
    case "file":
      return (
        <svg {...p}>
          <path d="M3.2 2.2h6l3.6 3.5v8.1H3.2z" />
          <path d="M9 2.2v3.6h3.6M5.6 8.6h4.8M5.6 11.2h3.2" />
        </svg>
      );
    case "map":
      return (
        <svg {...p}>
          <path d="M2 3.6v10l4-1.6 4 1.6 4-1.6v-10L10 3.6 6 2 2 3.6z" />
          <path d="M6 2v10M10 3.6v10" />
        </svg>
      );
    case "check":
      return (
        <svg {...p}>
          <rect x="2" y="2" width="12" height="12" rx="2.6" />
          <path d="M5.1 8.1l2.1 2.1 3.7-4.3" />
        </svg>
      );
    case "money":
      return (
        <svg {...p}>
          <rect x="1.8" y="3.6" width="12.4" height="8.8" rx="1.6" />
          <circle cx="8" cy="8" r="2" />
          <path d="M4.3 8h.01M11.7 8h.01" />
        </svg>
      );
    case "spark":
      return (
        <svg {...p}>
          <path d="M8 1.6l1.45 3.95L13.4 7l-3.95 1.45L8 12.4 6.55 8.45 2.6 7l3.95-1.45L8 1.6z" />
        </svg>
      );
    case "phone":
      return (
        <svg {...p}>
          <path d="M3.2 2.3h2.5l1.3 3.1-1.6 1.3a9.4 9.4 0 0 0 3.9 3.9l1.3-1.6 3.1 1.3v2.5c0 .7-.6 1.3-1.3 1.3C7 14.1 1.9 9 1.9 3.6c0-.7.6-1.3 1.3-1.3z" />
        </svg>
      );
    default:
      return null;
  }
}
