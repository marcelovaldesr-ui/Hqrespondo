"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fechaCorta } from "@/lib/format";
import type { Decision } from "@/lib/types";

export default function Decisiones({ initial }: { initial: Decision[] }) {
  const router = useRouter();
  const [titulo, setTitulo] = useState("");
  const [detalle, setDetalle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const visibles = q.trim()
    ? initial.filter((d) =>
        `${d.titulo} ${d.detalle ?? ""} ${d.decidido_por ?? ""}`
          .toLowerCase()
          .includes(q.toLowerCase()),
      )
    : initial;

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/decisiones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo, detalle: detalle || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setTitulo("");
      setDetalle("");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function eliminar(d: Decision) {
    if (!confirm(`¿Eliminar la decisión "${d.titulo}"?`)) return;
    const res = await fetch(`/api/decisiones/${d.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(`No se pudo eliminar: ${data.error ?? res.status}`);
    }
    router.refresh();
  }

  return (
    <div>
      <form onSubmit={crear} className="panel-hot mb-5 flex flex-col gap-2.5 p-4">
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="¿Qué se decidió? — ej: Cerramos precios definitivos del plan Cotizador"
          className="input"
        />
        <textarea
          value={detalle}
          onChange={(e) => setDetalle(e.target.value)}
          placeholder="Contexto y porqué (opcional pero recomendado: en 3 meses no se van a acordar)"
          rows={2}
          className="input resize-y text-sm"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-danger">{error}</span>
          <button type="submit" disabled={!titulo.trim() || saving} className="btn-primary text-xs">
            {saving ? "Guardando…" : "Registrar decisión"}
          </button>
        </div>
      </form>

      {initial.length > 3 && (
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar en decisiones — precio, marca, foco…"
          className="input mb-3 w-full py-2 text-sm"
          aria-label="Buscar decisiones"
        />
      )}

      {initial.length === 0 ? (
        <div className="panel border-dashed border-line2 p-10 text-center text-sm text-ink-dim">
          Sin decisiones registradas aún. Registra cada definición importante
          (precios, nichos, marca, foco) para no repetir la misma discusión en
          un mes más — este registro es la memoria del equipo.
        </div>
      ) : visibles.length === 0 ? (
        <div className="panel border-dashed border-line2 p-8 text-center text-sm text-ink-dim">
          Nada calza con “{q}”. Si la decisión no está registrada… puede que
          nunca se haya cerrado: buen momento para decidirla y anotarla.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {visibles.map((d) => (
            <div key={d.id} className="group panel px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[11px] text-ink-dim">
                  {fechaCorta(d.created_at)}
                </span>
                <span className="flex-1 text-[14px] font-medium text-ink">
                  {d.titulo}
                </span>
                {d.decidido_por && (
                  <span className="chip px-2 py-0 text-[10px]">{d.decidido_por}</span>
                )}
                <button
                  onClick={() => eliminar(d)}
                  className="btn-ghost hidden px-2 py-0.5 hover:border-danger/40 hover:bg-danger/10 hover:text-danger group-hover:inline-flex"
                  aria-label={`Eliminar ${d.titulo}`}
                >
                  ×
                </button>
              </div>
              {d.detalle && (
                <p className="mt-2 border-t border-line pt-2 text-[12.5px] leading-relaxed text-ink-mut">
                  {d.detalle}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
