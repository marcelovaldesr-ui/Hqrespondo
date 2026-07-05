"use client";

import { useCallback, useMemo, useState } from "react";
import { fechaCorta } from "@/lib/format";
import { ROADMAP_ESTADOS_BASE, type RoadmapItem } from "@/lib/types";

const COL_HEAD: Record<string, string> = {
  "Esta semana": "text-warn",
  "En curso": "text-accent",
  Backlog: "text-ink-dim",
  Hecho: "text-ok",
};

const COL_CARD: Record<string, string> = {
  "Esta semana": "border-warn/25",
  "En curso": "border-accent/25",
  Backlog: "border-line",
  Hecho: "border-ok/30 opacity-70",
};

const AREA_COLOR: Record<string, string> = {
  marca: "border-violet/30 text-violet",
  instagram: "border-accent/30 text-accent",
  comercial: "border-warn/30 text-warn",
  ventas: "border-warn/30 text-warn",
  web: "border-line2 text-ink-mut",
  producto: "border-violet/30 text-violet",
  decisión: "border-danger/30 text-danger",
};

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

interface Draft {
  tarea: string;
  estado: string;
  area: string;
  fecha_limite: string;
  notas: string;
}

const DRAFT_VACIO: Draft = {
  tarea: "",
  estado: "Esta semana",
  area: "",
  fecha_limite: "",
  notas: "",
};

function CampoTarea({
  draft,
  setDraft,
  estados,
  areas,
  idPrefix,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  estados: string[];
  areas: string[];
  idPrefix: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <input
        value={draft.tarea}
        onChange={(e) => setDraft({ ...draft, tarea: e.target.value })}
        placeholder="Tarea…"
        className="input text-sm"
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <span>
          <input
            value={draft.estado}
            onChange={(e) => setDraft({ ...draft, estado: e.target.value })}
            placeholder="Estado"
            list={`${idPrefix}-estados`}
            className="input px-2 text-xs"
            aria-label="estado"
          />
          <datalist id={`${idPrefix}-estados`}>
            {estados.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </span>
        <span>
          <input
            value={draft.area}
            onChange={(e) => setDraft({ ...draft, area: e.target.value })}
            placeholder="Área"
            list={`${idPrefix}-areas`}
            className="input px-2 text-xs"
            aria-label="área"
          />
          <datalist id={`${idPrefix}-areas`}>
            {areas.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </span>
        <input
          type="date"
          value={draft.fecha_limite}
          onChange={(e) => setDraft({ ...draft, fecha_limite: e.target.value })}
          className="input px-2 text-xs"
          aria-label="fecha límite"
        />
        <input
          value={draft.notas}
          onChange={(e) => setDraft({ ...draft, notas: e.target.value })}
          placeholder="Notas"
          className="input px-2 text-xs"
          aria-label="notas"
        />
      </div>
    </div>
  );
}

export default function RoadmapBoard({
  initialItems,
}: {
  initialItems: RoadmapItem[];
}) {
  const [items, setItems] = useState<RoadmapItem[]>(initialItems);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<Draft>(DRAFT_VACIO);
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(DRAFT_VACIO);
  const [busy, setBusy] = useState(false);

  const recargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/roadmap", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo cargar el roadmap");
      setItems(data.items ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const estados = useMemo(() => {
    const extra = Array.from(new Set(items.map((i) => i.estado))).filter(
      (s) => !(ROADMAP_ESTADOS_BASE as readonly string[]).includes(s),
    );
    return [...ROADMAP_ESTADOS_BASE, ...extra.sort()];
  }, [items]);

  const areas = useMemo(
    () =>
      Array.from(new Set(items.map((i) => i.area).filter(Boolean) as string[])).sort(),
    [items],
  );

  async function llamar(url: string, init: RequestInit) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        ...init,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Error");
      await recargar();
      return true;
    } catch (e: any) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.tarea.trim() || busy) return;
    const ok = await llamar("/api/roadmap", {
      method: "POST",
      body: JSON.stringify(draft),
    });
    if (ok) {
      setDraft(DRAFT_VACIO);
      setShowForm(false);
    }
  }

  function empezarEdicion(it: RoadmapItem) {
    setEditId(it.id);
    setEditDraft({
      tarea: it.tarea,
      estado: it.estado,
      area: it.area ?? "",
      fecha_limite: it.fecha_limite ?? "",
      notas: it.notas ?? "",
    });
  }

  async function guardarEdicion(id: string) {
    if (!editDraft.tarea.trim() || busy) return;
    const ok = await llamar(`/api/roadmap/${id}`, {
      method: "PATCH",
      body: JSON.stringify(editDraft),
    });
    if (ok) setEditId(null);
  }

  async function moverEstado(it: RoadmapItem, estado: string) {
    if (estado === it.estado) return;
    await llamar(`/api/roadmap/${it.id}`, {
      method: "PATCH",
      body: JSON.stringify({ estado }),
    });
  }

  async function eliminar(it: RoadmapItem) {
    if (!confirm(`¿Eliminar "${it.tarea}"?`)) return;
    await llamar(`/api/roadmap/${it.id}`, { method: "DELETE" });
  }

  const hoy = hoyISO();
  const pendientes = items.filter((i) => i.estado !== "Hecho").length;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="metric-card px-5 py-3.5">
          <span className="lbl">Pendientes </span>
          <span className="ml-3 font-mono text-2xl text-warn">{pendientes}</span>
        </div>
        <div className="metric-card px-5 py-3.5">
          <span className="lbl">Hechas </span>
          <span className="ml-3 font-mono text-2xl text-ok">
            {items.length - pendientes}
          </span>
        </div>
        <span className="ml-auto flex items-center gap-2">
          {error && <span className="text-xs text-danger">{error}</span>}
          <button onClick={recargar} disabled={loading} className="btn-ghost px-3 py-1.5">
            {loading ? "Actualizando…" : "↻ Refrescar"}
          </button>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary text-xs">
            + Tarea
          </button>
        </span>
      </div>

      {showForm && (
        <form onSubmit={crear} className="panel-hot mb-5 p-4">
          <CampoTarea
            draft={draft}
            setDraft={setDraft}
            estados={estados}
            areas={areas}
            idPrefix="nueva"
          />
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="btn-ghost px-3 py-1.5"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!draft.tarea.trim() || busy}
              className="btn-primary text-xs"
            >
              Crear tarea
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {estados.map((estado) => {
          const cards = items.filter((i) => i.estado === estado);
          if (
            cards.length === 0 &&
            !(ROADMAP_ESTADOS_BASE as readonly string[]).includes(estado)
          ) {
            return null;
          }
          return (
            <div key={estado}>
              <div className="mb-2 flex items-baseline justify-between rounded-lg border border-line bg-surface-3/45 px-3 py-2">
                <span className={`lbl ${COL_HEAD[estado] ?? "text-ink-mut"}`}>
                  {estado}
                </span>
                <span className="font-mono text-[10px] text-ink-faint">
                  {cards.length}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {cards.map((it) => {
                  const vencida =
                    it.fecha_limite && it.fecha_limite <= hoy && it.estado !== "Hecho";
                  const areaCls =
                    AREA_COLOR[(it.area ?? "").toLowerCase()] ?? "border-line2 text-ink-mut";

                  if (editId === it.id) {
                    return (
                      <div key={it.id} className="rounded-xl border border-accent/40 bg-surface-2 p-3 shadow-card">
                        <CampoTarea
                          draft={editDraft}
                          setDraft={setEditDraft}
                          estados={estados}
                          areas={areas}
                          idPrefix={`edit-${it.id}`}
                        />
                        <div className="mt-2.5 flex justify-end gap-2">
                          <button onClick={() => setEditId(null)} className="btn-ghost px-2.5 py-1">
                            Cancelar
                          </button>
                          <button
                            onClick={() => guardarEdicion(it.id)}
                            disabled={busy || !editDraft.tarea.trim()}
                            className="btn-primary px-3 py-1 text-xs"
                          >
                            Guardar
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={it.id}
                      title={
                        it.actualizado_por || it.creado_por
                          ? `creado por ${it.creado_por ?? "?"} · últ. cambio ${it.actualizado_por ?? it.creado_por}`
                          : undefined
                      }
                      className={`group rounded-xl border bg-surface-2 p-3.5 shadow-card transition hover:border-line2 ${COL_CARD[estado] ?? "border-line"}`}
                    >
                      <div className="text-[13.5px] font-medium leading-snug text-ink">
                        {it.tarea}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {it.area && (
                          <span className={`chip px-2 py-0 text-[10px] ${areaCls}`}>
                            {it.area}
                          </span>
                        )}
                        {it.fecha_limite && (
                          <span
                            className={`font-mono text-[10px] ${vencida ? "text-danger" : "text-ink-dim"}`}
                          >
                            {vencida ? "⚠ " : ""}
                            {fechaCorta(`${it.fecha_limite}T12:00:00`)}
                          </span>
                        )}
                      </div>

                      {it.notas && (
                        <div className="mt-2 rounded-lg bg-surface-3/70 px-2 py-1.5 text-[11px] leading-relaxed text-ink-mut">
                          {it.notas}
                        </div>
                      )}

                      <div className="mt-3 hidden items-center gap-1.5 group-hover:flex">
                        <select
                          value={it.estado}
                          onChange={(e) => moverEstado(it, e.target.value)}
                          disabled={busy}
                          className="input w-auto flex-1 px-2 py-1 text-[11px]"
                          aria-label={`estado de ${it.tarea}`}
                        >
                          {estados.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => empezarEdicion(it)}
                          className="btn-ghost px-2 py-1"
                          aria-label={`editar ${it.tarea}`}
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => eliminar(it)}
                          disabled={busy}
                          className="btn-ghost px-2 py-1 hover:border-danger/40 hover:bg-danger/10 hover:text-danger"
                          aria-label={`eliminar ${it.tarea}`}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}
                {cards.length === 0 && (
                  <div className="rounded-xl border border-dashed border-line2 bg-surface-3/30 p-6 text-center text-[10.5px] text-ink-faint">
                    —
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-5 text-xs text-ink-dim">
        Roadmap compartido del equipo — los cambios quedan en Supabase al
        instante; usa <span className="text-brand">↻ Refrescar</span> para ver
        lo que editó el otro. Estado y Área son texto libre: escribe uno nuevo
        y se crea la columna sola.
      </p>
    </div>
  );
}
