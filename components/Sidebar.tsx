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
    <aside className="relative z-20 flex w-[4.5rem] shrink-0 flex-col border-r border-[#1E293B] bg-[#0B1220] text-slate-300 sm:w-[14.5rem] select-none">
      {/* Marca Respondo HQ */}
      <div className="flex h-14 items-center gap-2.5 border-b border-[#1E293B] px-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/isotipo.svg" alt="Respondo" className="h-7 w-7 shrink-0 drop-shadow-sm" />
        <div className="hidden items-center gap-1.5 sm:flex">
          <span className="font-sans text-[15px] font-bold tracking-tight text-white">
            Respon<span className="text-brand">do</span>
          </span>
          <span className="rounded bg-accent/15 px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-wider text-accent border border-accent/30">
            HQ
          </span>
        </div>
      </div>

      {/* Buscador / Paleta de comandos (⌘K) */}
      <div className="px-3 pb-1 pt-3">
        <button
          onClick={abrirPaleta}
          className="group flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-left transition hover:border-white/20 hover:bg-white/[0.08]"
          aria-label="Abrir buscador de secciones"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="shrink-0 text-slate-400 group-hover:text-accent transition-colors"
            aria-hidden="true"
          >
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" strokeLinecap="round" />
          </svg>
          <span className="hidden flex-1 text-[12px] text-slate-400 group-hover:text-slate-200 sm:inline transition-colors">
            Ir a…
          </span>
          <span className="hidden items-center rounded border border-white/10 bg-white/10 px-1 font-mono text-[10px] text-slate-400 group-hover:text-slate-200 sm:inline-flex">
            ⌘K
          </span>
        </button>
      </div>

      {/* Navegación agrupada */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
        {NAV_GROUPS.map((grupo) => (
          <div key={grupo.titulo}>
            <p className="mb-1.5 hidden px-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 sm:block">
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
                    className={`group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] transition-colors ${
                      active
                        ? "bg-white/10 text-white font-medium shadow-2xs"
                        : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-100"
                    }`}
                  >
                    {/* Indicador de activo */}
                    {active && (
                      <span
                        className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-brand"
                        aria-hidden="true"
                      />
                    )}
                    <span
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border transition-colors ${
                        active
                          ? "border-brand/40 bg-brand/20 text-accent"
                          : "border-white/5 bg-white/[0.03] text-slate-400 group-hover:border-white/10 group-hover:text-slate-200"
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

      {/* Pie de estado operativo */}
      <div className="mt-auto hidden border-t border-[#1E293B] px-4 py-3 sm:block">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-wider text-slate-400">
            <span className="led led-glow-green led-pulse bg-ok" />
            En línea
          </span>
          <span className="num font-mono text-[11px] font-medium text-slate-300">
            {hora || "--:--"}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between font-mono text-[9.5px] text-slate-500">
          <span>Revenue OS</span>
          <span className="text-accent font-semibold">V2</span>
        </div>
      </div>
    </aside>
  );
}
