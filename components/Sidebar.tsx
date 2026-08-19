"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV_GROUPS, NavIcon } from "./navConfig";

export default function Sidebar() {
  const pathname = usePathname();
  const [hora, setHora] = useState("");

  useEffect(() => {
    const tick = () =>
      setHora(
        new Date().toLocaleTimeString("es-CL", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
      );
    tick();
    const id = setInterval(tick, 20_000);
    return () => clearInterval(id);
  }, []);

  function abrirPaleta() {
    window.dispatchEvent(new CustomEvent("hq:paleta"));
  }

  return (
    <aside className="relative z-20 flex w-[4.25rem] shrink-0 flex-col border-r border-line bg-surface-1 sm:w-[13.75rem]">
      {/* Marca */}
      <div className="flex h-14 items-center gap-2.5 border-b border-line px-3.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/isotipo.svg" alt="Respondo" className="h-7 w-7 shrink-0" />
        <span className="hidden font-display text-[14px] font-semibold tracking-tight sm:inline">
          Respon<span className="text-brand">do</span>
          <span className="ml-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-ink-dim">
            HQ
          </span>
        </span>
      </div>

      {/* Buscador / paleta de comandos */}
      <div className="px-2.5 pb-1 pt-3">
        <button
          onClick={abrirPaleta}
          className="group flex w-full items-center gap-2 rounded-lg border border-line2 bg-surface-3/60 px-2.5 py-2 text-left transition hover:border-brand/40 hover:bg-surface-3"
          aria-label="Abrir buscador de secciones"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="shrink-0 text-ink-dim group-hover:text-brand"
            aria-hidden="true"
          >
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" strokeLinecap="round" />
          </svg>
          <span className="hidden flex-1 text-[12px] text-ink-dim sm:inline">
            Ir a…
          </span>
          <span className="kbd hidden sm:inline-flex">⌘K</span>
        </button>
      </div>

      {/* Navegación agrupada por momento del día */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-2">
        {NAV_GROUPS.map((grupo) => (
          <div key={grupo.titulo} className="mb-4 last:mb-0">
            <p className="mb-1.5 hidden px-1.5 font-mono text-[9.5px] font-medium uppercase tracking-[0.2em] text-ink-faint sm:block">
              {grupo.titulo}
            </p>
            <div className="flex flex-col gap-0.5">
              {grupo.links.map((l) => {
                const active = pathname.startsWith(l.href);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    title={l.label}
                    className={`group relative flex items-center gap-2.5 rounded-lg px-2 py-[7px] text-[12.5px] transition ${
                      active
                        ? "bg-brand/[0.11] text-ink"
                        : "text-ink-mut hover:bg-surface-3 hover:text-ink"
                    }`}
                  >
                    {/* Riel de activo */}
                    <span
                      className={`absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-r transition-all ${
                        active
                          ? "bg-gradient-to-b from-brand to-coral opacity-100"
                          : "opacity-0"
                      }`}
                      aria-hidden="true"
                    />
                    <span
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border transition ${
                        active
                          ? "border-brand/40 bg-brand/15 text-brand"
                          : "border-line bg-surface-3/60 text-ink-dim group-hover:border-line2 group-hover:text-ink-soft"
                      }`}
                    >
                      <NavIcon name={l.icon} />
                    </span>
                    <span className="hidden truncate sm:inline">{l.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Pie de estado */}
      <div className="mt-auto hidden border-t border-line px-3 py-3 sm:block">
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-mut">
            <span className="led led-glow-green led-pulse bg-ok" />
            En línea
          </span>
          <span className="num text-[11px] text-ink-soft">{hora || "--:--"}</span>
        </div>
        <div className="hairline mb-2" />
        <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-faint">
          Menos ruido · más demos
        </p>
      </div>
    </aside>
  );
}
