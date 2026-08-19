"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CANALES,
  CANAL_LABEL,
  CONTENT_STATUS,
  CONTENT_STATUS_LABEL,
  FORMATOS,
  FORMATO_LABEL,
  PILAR_KEYS,
  PILAR_LABEL,
  type Canal,
  type ContentCalendarItem,
  type ContentStatus,
  type Formato,
  type PilarKey,
} from "@/lib/growth/types";
import { RUBROS } from "@/lib/growth/industries";

function fechaLarga(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default function CalendarClient({
  initial,
  dbActiva,
}: {
  initial: ContentCalendarItem[];
  dbActiva: boolean;
}) {
  const router = useRouter();
  const [fCanal, setFCanal] = useState("");
  const [fEstado, setFEstado] = useState("");
  const [fFormato, setFFormato] = useState("");
  const [fPilar, setFPilar] = useState("");
  const [showForm, setShowForm] = useState(false);

  const hoyISO = new Date().toISOString().slice(0, 10);

  const [titulo, setTitulo] = useState("");
  const [fecha, setFecha] = useState(hoyISO);
  const [canal, setCanal] = useState<Canal>("instagram");
  const [formato, setFormato] = useState<Formato>("reel");
  const [pilar, setPilar] = useState<PilarKey>("problema");
  const [rubro, setRubro] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibles = useMemo(
    () =>
      initial.filter((i) => {
        if (fCanal && i.canal !== fCanal) return false;
        if (fEstado && i.estado !== fEstado) return false;
        if (fFormato && i.formato !== fFormato) return false;
        if (fPilar && i.pilar !== fPilar) return false;
        return true;
      }),
    [initial, fCanal, fEstado, fFormato, fPilar],
  );

  const porFecha = useMemo(() => {
    const map = new Map<string, ContentCalendarItem[]>();
    for (const i of visibles) {
      const arr = map.get(i.fecha) ?? [];
      arr.push(i);
      map.set(i.fecha, arr);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [visibles]);

  const atrasadas = visibles.filter((i) => i.fecha < hoyISO && i.estado !== "publicado").length;

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/growth/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo, fecha, canal, formato, pilar, rubro: rubro || null, estado: "idea" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setTitulo("");
      setShowForm(false);
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function cambiarEstado(i: ContentCalendarItem, estado: ContentStatus) {
    if (i.seed) return;
    await fetch(`/api/growth/calendar/${i.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    router.refresh();
  }

  async function eliminar(i: ContentCalendarItem) {
    if (i.seed) return;
    if (!confirm(`¿Eliminar "${i.titulo}"?`)) return;
    await fetch(`/api/growth/calendar/${i.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button onClick={() => setShowForm((s) => !s)} className="btn-primary text-xs">
          {showForm ? "Cerrar" : "+ Agendar pieza"}
        </button>
        <select value={fCanal} onChange={(e) => setFCanal(e.target.value)} className="input w-auto py-1.5 text-xs">
          <option value="">Canal</option>
          {CANALES.map((c) => <option key={c} value={c}>{CANAL_LABEL[c]}</option>)}
        </select>
        <select value={fFormato} onChange={(e) => setFFormato(e.target.value)} className="input w-auto py-1.5 text-xs">
          <option value="">Formato</option>
          {FORMATOS.map((f) => <option key={f} value={f}>{FORMATO_LABEL[f]}</option>)}
        </select>
        <select value={fPilar} onChange={(e) => setFPilar(e.target.value)} className="input w-auto py-1.5 text-xs">
          <option value="">Pilar</option>
          {PILAR_KEYS.map((p) => <option key={p} value={p}>{PILAR_LABEL[p]}</option>)}
        </select>
        <select value={fEstado} onChange={(e) => setFEstado(e.target.value)} className="input w-auto py-1.5 text-xs">
          <option value="">Estado</option>
          {CONTENT_STATUS.map((s) => <option key={s} value={s}>{CONTENT_STATUS_LABEL[s]}</option>)}
        </select>
        {atrasadas > 0 && (
          <span className="chip border-warn/30 bg-warn/10 px-2 py-0.5 text-[10px] text-warn">
            {atrasadas} atrasada{atrasadas === 1 ? "" : "s"}
          </span>
        )}
        <span className="ml-auto font-mono text-[11px] text-ink-dim">{visibles.length} piezas</span>
      </div>

      {showForm && (
        <form onSubmit={crear} className="panel-hot mb-4 grid gap-2.5 p-4 md:grid-cols-3">
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título de la pieza" className="input md:col-span-3" />
          <label className="text-xs text-ink-mut">Fecha
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="input mt-1 text-sm" />
          </label>
          <label className="text-xs text-ink-mut">Canal
            <select value={canal} onChange={(e) => setCanal(e.target.value as Canal)} className="input mt-1 text-sm">
              {CANALES.map((c) => <option key={c} value={c}>{CANAL_LABEL[c]}</option>)}
            </select>
          </label>
          <label className="text-xs text-ink-mut">Formato
            <select value={formato} onChange={(e) => setFormato(e.target.value as Formato)} className="input mt-1 text-sm">
              {FORMATOS.map((f) => <option key={f} value={f}>{FORMATO_LABEL[f]}</option>)}
            </select>
          </label>
          <label className="text-xs text-ink-mut">Pilar
            <select value={pilar} onChange={(e) => setPilar(e.target.value as PilarKey)} className="input mt-1 text-sm">
              {PILAR_KEYS.map((p) => <option key={p} value={p}>{PILAR_LABEL[p]}</option>)}
            </select>
          </label>
          <label className="text-xs text-ink-mut">Rubro
            <select value={rubro} onChange={(e) => setRubro(e.target.value)} className="input mt-1 text-sm">
              <option value="">Transversal</option>
              {RUBROS.map((r) => <option key={r.slug} value={r.slug}>{r.nombre}</option>)}
            </select>
          </label>
          <div className="flex items-center justify-between md:col-span-3">
            <span className="text-xs text-danger">{error}</span>
            <button type="submit" disabled={!titulo.trim() || saving} className="btn-primary text-xs">
              {saving ? "Guardando…" : "Agendar"}
            </button>
          </div>
        </form>
      )}

      {porFecha.length === 0 ? (
        <div className="panel border-dashed border-line2 p-10 text-center text-sm text-ink-dim">
          Sin piezas en el calendario con estos filtros.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {porFecha.map(([fecha, items]) => {
            const pasada = fecha < hoyISO;
            return (
              <div key={fecha}>
                <div className="mb-1.5 flex items-center gap-2">
                  <span className={`font-mono text-[12px] ${pasada ? "text-ink-faint" : "text-ink-mut"}`}>
                    {fechaLarga(fecha)}
                  </span>
                  {fecha === hoyISO && <span className="chip border-brand/30 bg-brand/10 px-2 py-0 text-[9px] text-brand">hoy</span>}
                </div>
                <div className="flex flex-col gap-1.5">
                  {items.map((i) => (
                    <div key={i.id} className="group flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-[13px]">
                      <span className="chip px-2 py-0 text-[10px]">{FORMATO_LABEL[i.formato]}</span>
                      <span className="flex-1 truncate text-ink-soft">{i.titulo}</span>
                      <span className="hidden text-[10px] text-ink-dim sm:inline">{CANAL_LABEL[i.canal]} · {PILAR_LABEL[i.pilar]}</span>
                      {i.seed ? (
                        <span className="chip px-2 py-0 text-[9.5px]">{CONTENT_STATUS_LABEL[i.estado]}</span>
                      ) : (
                        <>
                          <select value={i.estado} onChange={(e) => cambiarEstado(i, e.target.value as ContentStatus)} className="input w-auto py-0.5 text-[10px]">
                            {CONTENT_STATUS.map((s) => <option key={s} value={s}>{CONTENT_STATUS_LABEL[s]}</option>)}
                          </select>
                          <button onClick={() => eliminar(i)} className="btn-ghost hidden px-2 py-0.5 hover:border-danger/40 hover:text-danger group-hover:inline-flex">×</button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!dbActiva && (
        <p className="mt-4 rounded-lg border border-dashed border-line2 bg-surface-3/50 px-4 py-3 text-[12px] text-ink-mut">
          El calendario muestra el plan sugerido (seed). Para agendar y mover piezas
          propias, ejecuta la migración <code className="rounded bg-surface-3 px-1">009_growth_studio.sql</code>.
        </p>
      )}
    </div>
  );
}
