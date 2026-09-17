"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import PageHeader from "./PageHeader";
import {
  Front,
  STATES,
  HEALTH,
  emptyFront,
  progress,
  staleDays,
  summary,
} from "@/lib/frentes/model";
const label = (s: string) => s.replaceAll("_", " ");
export default function Fronts({ compact = false }: { compact?: boolean }) {
  const [fronts, setFronts] = useState<Front[]>([]);
  const [error, setError] = useState("");
  const [readError, setReadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Front | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const detail = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState(0);
  useEffect(() => {
    if (selection)
      detail.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selection]);
  async function load() {
    setLoading(true);
    setReadError("");
    try {
      const res = await fetch("/api/frentes");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFronts(data);
    } catch (e) {
      setReadError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const stats = summary(fronts);
  const open = (f: Front) => {
    setEditing(structuredClone(f));
    setNote("");
    setError("");
    setSelection((n) => n + 1);
  };
  async function save(state?: Front["estado"]) {
    if (!editing) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/frentes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          front: { ...editing, estado: state ?? editing.estado },
          expected: editing.updated_at,
          note:
            note ||
            (state === "CERRADO"
              ? "Frente cerrado manualmente."
              : state
                ? "Frente reabierto manualmente."
                : ""),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEditing(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function row(f: Front) {
    const p = progress(f);
    const days = staleDays(f);
    return (
      <article key={f.id} className="panel p-4 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            className="font-semibold hover:underline"
            href={`/frentes?frente=${f.id}`}
            onClick={(e) => {
              if (!compact) {
                e.preventDefault();
                open(f);
              }
            }}
          >
            {f.nombre}
          </Link>
          <span className="font-mono text-xs">
            {f.prioridad} · {label(f.estado)}
          </span>
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          <span
            className={
              f.salud === "BLOQUEADO"
                ? "text-danger"
                : f.salud === "ATENCION"
                  ? "text-amber-700"
                  : "text-ink-dim"
            }
          >
            {label(f.salud)}
          </span>
          <span>{f.fase}</span>
        </div>
        <p className="text-sm">
          <span className="text-ink-dim">Próximo hito: </span>
          {f.proximo_hito || "Sin hito definido"}
        </p>
        {!compact && (
          <>
            <p className="text-sm">
              <span className="text-ink-dim">Próxima acción: </span>
              {f.proxima_accion || "—"}
            </p>
            {p && (
              <div className="text-xs text-ink-dim">
                {p.done}/{p.total} hitos ·{" "}
                {Math.round((p.done / p.total) * 100)}%
                <progress
                  className="block mt-1 h-1 w-full accent-indigo-600"
                  value={p.done}
                  max={p.total}
                  aria-label={`Progreso de ${f.nombre}`}
                />
              </div>
            )}
          </>
        )}
        {f.owner_action && f.estado !== "CERRADO" && (
          <p className="rounded bg-amber-50 p-2 text-xs text-amber-900">
            Requiere tu acción: {f.owner_action}
          </p>
        )}
        <p
          className={`text-xs ${days > 7 ? "text-amber-800 font-semibold" : "text-ink-mut"}`}
        >
          {days > 7
            ? `Sin actualización hace ${days} días`
            : `Actualizado: ${new Date(f.updated_at).toLocaleDateString("es-CL")}`}
        </p>
      </article>
    );
  }
  useEffect(() => {
    if (!compact && fronts.length) {
      const id = new URLSearchParams(window.location.search).get("frente");
      const f = fronts.find((item) => item.id === id);
      if (f) open(f);
    }
  }, [fronts, compact]);
  const field = (
    key:
      | "nombre"
      | "objetivo"
      | "categoria"
      | "fase"
      | "proximo_hito"
      | "proxima_accion"
      | "bloqueo"
      | "owner_action"
      | "fecha_objetivo",
    title: string,
  ) => (
    <label className="block text-sm" key={key}>
      {title}
      <input
        className="mt-1 w-full rounded border border-line p-2"
        type={key === "fecha_objetivo" ? "date" : "text"}
        value={editing?.[key] ?? ""}
        onChange={(e) =>
          setEditing(editing && { ...editing, [key]: e.target.value })
        }
      />
    </label>
  );
  return (
    <section className="space-y-4">
      {compact ? (
        <div className="flex justify-between">
          <h2 className="font-semibold">Frentes activos</h2>
          <Link className="text-sm text-brand" href="/frentes">
            Ver todos →
          </Link>
        </div>
      ) : (
        <PageHeader
          title="Frentes"
          sub="Iniciativas estratégicas"
          right={
            <button
              className="btn-primary"
              disabled={loading || !!readError}
              onClick={() => open(emptyFront())}
            >
              Nuevo frente
            </button>
          }
        />
      )}
      {loading && <p role="status">Cargando frentes…</p>}
      {readError && (
        <div
          role="alert"
          className="rounded border border-amber-200 bg-amber-50 p-3 text-sm"
        >
          {readError}{" "}
          <button className="underline" onClick={() => void load()}>
            Reintentar lectura
          </button>
        </div>
      )}
      {!loading && !readError && (
        <>
          <p className="font-mono text-xs text-ink-dim">
            {stats.active.length} activos · {stats.blocked} bloqueados ·{" "}
            {stats.owner.length} requieren tu acción · {stats.stale} sin
            actualización
          </p>
          {!compact && <h2 className="font-semibold">Activos</h2>}
          <div className="grid gap-3 lg:grid-cols-3">
            {(compact ? stats.active.slice(0, 3) : stats.active).map(row)}
          </div>
          {!stats.active.length && (
            <p className="text-sm text-ink-dim">No hay frentes activos.</p>
          )}
          {!compact && (
            <>
              {stats.owner.length > 0 && (
                <section className="panel p-4">
                  <h2 className="font-semibold mb-3">Requieren tu acción</h2>
                  {stats.owner.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => open(f)}
                      className="block text-left text-sm py-2 hover:underline"
                    >
                      <strong>{f.nombre}</strong> · {f.owner_action}
                    </button>
                  ))}
                </section>
              )}
              {fronts.some((f) => f.estado === "BACKLOG") && (
                <details className="panel p-4">
                  <summary>Backlog</summary>
                  <div className="grid gap-3 mt-3">
                    {fronts.filter((f) => f.estado === "BACKLOG").map(row)}
                  </div>
                </details>
              )}
              <details className="panel p-4">
                <summary className="cursor-pointer">
                  Cerrados ·{" "}
                  {fronts.filter((f) => f.estado === "CERRADO").length}{" "}
                  completados
                </summary>
                <div className="grid gap-3 mt-3 lg:grid-cols-2">
                  {fronts.filter((f) => f.estado === "CERRADO").map(row)}
                </div>
              </details>
            </>
          )}
        </>
      )}
      {editing && (
        <div
          ref={detail}
          className="panel p-5 space-y-4 scroll-mt-5"
          role="region"
          aria-label="Detalle de frente"
        >
          {error && (
            <p
              role="alert"
              className="rounded bg-amber-50 p-3 text-sm text-amber-900"
            >
              {error}
            </p>
          )}
          <div className="flex justify-between">
            <h2 className="font-semibold">
              {editing.nombre || "Nuevo frente"}
            </h2>
            <button
              className="btn-ghost"
              disabled={busy}
              onClick={() => setEditing(null)}
            >
              Cerrar detalle
            </button>
          </div>
          <fieldset disabled={busy} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              {field("nombre", "Nombre")}
              {field("objetivo", "Objetivo")}
              {field("categoria", "Categoría")}
              {field("fase", "Fase actual")}
              <label className="text-sm">
                Estado
                <select
                  className="block w-full border rounded p-2 mt-1"
                  value={editing.estado}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      estado: e.target.value as Front["estado"],
                    })
                  }
                >
                  {STATES.filter(
                    (s) => s !== "CERRADO" || editing.estado === "CERRADO",
                  ).map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Salud
                <select
                  className="block w-full border rounded p-2 mt-1"
                  value={editing.salud}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      salud: e.target.value as Front["salud"],
                    })
                  }
                >
                  {HEALTH.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Prioridad
                <select
                  className="block w-full border rounded p-2 mt-1"
                  value={editing.prioridad}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      prioridad: e.target.value as Front["prioridad"],
                    })
                  }
                >
                  {["P0", "P1", "P2"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              {field("proximo_hito", "Próximo hito")}
              {field("proxima_accion", "Próxima acción principal")}
              {field("bloqueo", "Bloqueo actual")}
              {field("owner_action", "Acción de Marcelo")}
              {field("fecha_objetivo", "Fecha objetivo (opcional)")}
            </div>
            <h3 className="font-semibold">Hitos</h3>
            {editing.hitos.map((h, i) => (
              <label className="flex gap-2 items-center" key={i}>
                <input
                  type="checkbox"
                  checked={!!h.completado_at}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      hitos: editing.hitos.map((v, n) =>
                        n === i
                          ? {
                              ...v,
                              completado_at: e.target.checked
                                ? new Date().toISOString()
                                : null,
                            }
                          : v,
                      ),
                    })
                  }
                />
                <input
                  aria-label={`Nombre hito ${i + 1}`}
                  className="border rounded p-1 flex-1 min-w-0"
                  value={h.nombre}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      hitos: editing.hitos.map((v, n) =>
                        n === i ? { ...v, nombre: e.target.value } : v,
                      ),
                    })
                  }
                />
                {h.completado_at && (
                  <span className="text-xs">
                    {new Date(h.completado_at).toLocaleDateString("es-CL")}
                  </span>
                )}
              </label>
            ))}
            <button
              className="btn-ghost"
              onClick={() =>
                setEditing({
                  ...editing,
                  hitos: [
                    ...editing.hitos,
                    { nombre: "", completado_at: null },
                  ],
                })
              }
            >
              Añadir hito
            </button>
            <h3 className="font-semibold">Links / documentación</h3>
            {editing.links.map((l, i) => (
              <div key={i} className="grid gap-2 md:grid-cols-2">
                <input
                  aria-label={`Etiqueta referencia ${i + 1}`}
                  className="border rounded p-2"
                  value={l.label}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      links: editing.links.map((v, n) =>
                        n === i ? { ...v, label: e.target.value } : v,
                      ),
                    })
                  }
                />
                <input
                  aria-label={`URL o referencia ${i + 1}`}
                  className="border rounded p-2"
                  value={l.reference}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      links: editing.links.map((v, n) =>
                        n === i ? { ...v, reference: e.target.value } : v,
                      ),
                    })
                  }
                />
                {/^https?:\/\//i.test(l.reference) && (
                  <a
                    className="text-brand text-sm"
                    href={l.reference}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir {l.label} ↗
                  </a>
                )}
              </div>
            ))}
            <button
              className="btn-ghost"
              onClick={() =>
                setEditing({
                  ...editing,
                  links: [...editing.links, { label: "", reference: "" }],
                })
              }
            >
              Añadir referencia
            </button>
            <label className="block text-sm">
              Actualización breve
              <textarea
                className="block w-full border rounded p-2 mt-1"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Qué cambió y cuál es el próximo paso"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" onClick={() => void save()}>
                Guardar actualización
              </button>
              {editing.id && (
                <button
                  className="btn-ghost"
                  onClick={() =>
                    void save(
                      editing.estado === "CERRADO" ? "DISCOVERY" : "CERRADO",
                    )
                  }
                >
                  {editing.estado === "CERRADO"
                    ? "Reabrir frente"
                    : "Cerrar frente"}
                </button>
              )}
            </div>
          </fieldset>
          <h3 className="font-semibold">Actualizaciones</h3>
          <div className="max-h-72 overflow-auto">
            {[...editing.updates].reverse().map((u, i) => (
              <div className="border-t py-3 text-sm" key={i}>
                <p className="text-xs text-ink-mut">
                  {new Date(u.fecha).toLocaleString("es-CL")} · {u.autor}
                </p>
                <p className="whitespace-pre-wrap">{u.texto}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
