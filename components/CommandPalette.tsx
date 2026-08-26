"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ALL_LINKS, NAV_GROUPS, NavIcon } from "./navConfig";

/**
 * Paleta de comandos (⌘K / Ctrl+K).
 * Salto directo a cualquier sección sin sacar la mano del teclado. Es puro
 * cliente: no llama a ninguna API, así que no puede fallar ni costar nada.
 */
export default function CommandPalette() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const grupoDe = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of NAV_GROUPS) for (const l of g.links) m.set(l.href, g.titulo);
    return m;
  }, []);

  const norm = (s: string) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  const resultados = useMemo(() => {
    const t = norm(q.trim());
    if (!t) return ALL_LINKS;
    return ALL_LINKS.filter((l) =>
      norm(`${l.label} ${l.hint ?? ""} ${grupoDe.get(l.href) ?? ""}`).includes(t),
    );
  }, [q, grupoDe]);

  useEffect(() => setSel(0), [q]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAbierto((v) => !v);
      }
      if (e.key === "Escape") setAbierto(false);
    }
    function onAbrir() {
      setAbierto(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("hq:paleta", onAbrir as EventListener);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("hq:paleta", onAbrir as EventListener);
    };
  }, []);

  useEffect(() => {
    if (abierto) {
      setQ("");
      setSel(0);
      const t = setTimeout(() => inputRef.current?.focus(), 20);
      return () => clearTimeout(t);
    }
  }, [abierto]);

  if (!abierto) return null;

  function ir(href: string) {
    setAbierto(false);
    router.push(href);
  }

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => (resultados.length ? (s + 1) % resultados.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) =>
        resultados.length ? (s - 1 + resultados.length) % resultados.length : 0,
      );
    } else if (e.key === "Enter" && resultados[sel]) {
      e.preventDefault();
      ir(resultados[sel].href);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Ir a una sección"
    >
      <button
        className="absolute inset-0 bg-ink/45 backdrop-blur-sm"
        onClick={() => setAbierto(false)}
        aria-label="Cerrar"
        tabIndex={-1}
      />
      <div className="glass animate-rise relative w-full max-w-lg overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          <span className="font-mono text-sm text-brand" aria-hidden="true">
            &gt;
          </span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Ir a una sección…"
            className="flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-faint"
          />
          <span className="kbd">esc</span>
        </div>

        <div className="max-h-[52vh] overflow-y-auto p-1.5">
          {resultados.length === 0 && (
            <p className="px-3 py-6 text-center text-[12.5px] text-ink-dim">
              Nada calza con «{q}»
            </p>
          )}
          {resultados.map((l, i) => (
            <button
              key={l.href}
              onClick={() => ir(l.href)}
              onMouseEnter={() => setSel(i)}
              className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition ${
                i === sel ? "bg-brand/[0.13]" : "hover:bg-surface-3"
              }`}
            >
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-md border ${
                  i === sel
                    ? "border-brand/40 bg-brand/15 text-brand"
                    : "border-line bg-surface-3 text-ink-dim"
                }`}
              >
                <NavIcon name={l.icon} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-ink">
                  {l.label}
                </span>
                {l.hint && (
                  <span className="block truncate text-[11px] text-ink-dim">
                    {l.hint}
                  </span>
                )}
              </span>
              <span className="shrink-0 font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-faint">
                {grupoDe.get(l.href)}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 border-t border-line bg-surface-1/60 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
          <span className="flex items-center gap-1">
            <span className="kbd">↑</span>
            <span className="kbd">↓</span> navegar
          </span>
          <span className="flex items-center gap-1">
            <span className="kbd">↵</span> abrir
          </span>
        </div>
      </div>
    </div>
  );
}
