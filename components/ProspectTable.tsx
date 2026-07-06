"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { plantillasPara } from "@/lib/mensajes";
import {
  ESTADO_CONFIG,
  ESTADO_LABEL,
  ESTADO_OPTIONS,
  type Estado,
  type Prospect,
} from "@/lib/types";

function scoreCls(score: number) {
  if (score >= 70) return { text: "text-ok", bar: "bg-ok" };
  if (score >= 40) return { text: "text-warn", bar: "bg-warn" };
  return { text: "text-ink-dim", bar: "bg-ink-faint" };
}

/** Acción recomendada por reglas simples (score + estado). */
function accionRecomendada(p: Prospect): string {
  if (p.estado === "nuevo")
    return p.score >= 70
      ? "Contactar hoy con el mensaje personalizado"
      : p.score >= 40
        ? "Contactar esta semana (prioriza los de score más alto primero)"
        : "Baja prioridad — contactar solo si sobra capacidad, o descartar";
  if (p.estado === "contactado")
    return "Sin respuesta aún: enviar follow-up 1 a los 2–3 días (máx. 3–4 toques)";
  if (p.estado === "respondio")
    return "Responder hoy mismo, calificar (volumen, quién responde, horario ciego) y mandar la demo";
  if (p.estado === "reunion")
    return "Hacer la demo guiada y enviar propuesta de 1 página el MISMO día";
  if (p.estado === "en_pipeline") return "Gestionar desde Pipeline";
  return "Descartado — sin acción";
}

/** Fecha hoy+n en formato YYYY-MM-DD. */
function enDias(n: number): string {
  return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
}

const ESTADO_PILL: Record<Estado, string> = {
  nuevo: "border-accent/40 text-accent",
  contactado: "border-warn/40 text-warn",
  respondio: "border-ok/40 text-ok",
  reunion: "border-ok/40 text-ok",
  en_pipeline: "border-line2 text-ink-mut",
  descartado: "border-line text-ink-faint",
};

type Orden = "score" | "nombre" | "rubro" | "comuna" | "recientes";

const ORDEN_OPTIONS: { value: Orden; label: string }[] = [
  { value: "score", label: "Mayor score" },
  { value: "recientes", label: "Más recientes" },
  { value: "nombre", label: "Nombre A-Z" },
  { value: "rubro", label: "Rubro A-Z" },
  { value: "comuna", label: "Comuna A-Z" },
];

/** Genera un CSV compatible con Excel es-CL (BOM UTF-8 + separador ;) */
function descargarCSV(rows: Prospect[]) {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const cab = [
    "Nombre", "Rubro", "Comuna", "Teléfono", "Web", "Dirección",
    "Rating", "Reviews", "Score", "Estado", "Próxima acción", "Mensaje", "Notas",
  ];
  const lineas = rows.map((p) =>
    [
      p.nombre, p.rubro, p.comuna, p.telefono, p.web, p.direccion,
      p.rating, p.reviews, p.score, ESTADO_LABEL[p.estado],
      p.proxima_accion, p.mensaje, p.notas,
    ].map(esc).join(";"),
  );
  const csv = "﻿" + [cab.map(esc).join(";"), ...lineas].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `prospectos-respondo-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Link wa.me con el mensaje pre-cargado (envío manual, 1 clic) */
function linkWhatsApp(p: Prospect): string | null {
  if (!p.telefono) return null;
  let digits = p.telefono.replace(/\D/g, "");
  if (digits.length === 9 && digits.startsWith("9")) digits = "56" + digits;
  return `https://wa.me/${digits}${p.mensaje ? `?text=${encodeURIComponent(p.mensaje)}` : ""}`;
}

export default function ProspectTable({
  prospects,
}: {
  prospects: Prospect[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<Prospect[]>(prospects);
  const [filtro, setFiltro] = useState<Estado | "todos">("todos");
  const [quick, setQuick] = useState<"" | "hot" | "sin_respuesta">("");
  const [rubro, setRubro] = useState<string>("todos");
  const [orden, setOrden] = useState<Orden>("score");
  const [q, setQ] = useState("");
  const [copiado, setCopiado] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [estadoError, setEstadoError] = useState<string | null>(null);
  // Borradores de la fila expandida (una a la vez)
  const [proxDraft, setProxDraft] = useState("");
  const [notasDraft, setNotasDraft] = useState("");
  const [guardandoDetalle, setGuardandoDetalle] = useState(false);

  useEffect(() => {
    setItems(prospects);
  }, [prospects]);

  const rubros = useMemo(
    () => Array.from(new Set(items.map((p) => p.rubro).filter(Boolean))).sort(),
    [items],
  );

  const filtrados = useMemo(() => {
    const base = items.filter(
      (p) =>
        (filtro === "todos" || p.estado === filtro) &&
        (quick === "" ||
          (quick === "hot" && p.estado === "nuevo" && p.score >= 70) ||
          (quick === "sin_respuesta" && p.estado === "contactado")) &&
        (rubro === "todos" || p.rubro === rubro) &&
        (q === "" ||
          `${p.nombre} ${p.rubro} ${p.comuna}`
            .toLowerCase()
            .includes(q.toLowerCase())),
    );
    const s = [...base];
    switch (orden) {
      case "score":
        s.sort((a, b) => b.score - a.score);
        break;
      case "recientes":
        s.sort((a, b) => b.created_at.localeCompare(a.created_at));
        break;
      case "nombre":
        s.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
        break;
      case "rubro":
        s.sort((a, b) => a.rubro.localeCompare(b.rubro, "es") || b.score - a.score);
        break;
      case "comuna":
        s.sort((a, b) => a.comuna.localeCompare(b.comuna, "es") || b.score - a.score);
        break;
    }
    return s;
  }, [items, filtro, quick, rubro, q, orden]);

  async function cambiarEstado(id: string, estado: Estado) {
    const anterior = items.find((p) => p.id === id);
    setEstadoError(null);

    // Al marcar "contactado" sin próxima acción, se agenda el follow-up 1
    // automáticamente a +3 días (regla del kit de prospección).
    const autoProxima =
      estado === "contactado" && anterior && !anterior.proxima_accion
        ? enDias(3)
        : undefined;

    setItems((actuales) =>
      actuales.map((p) =>
        p.id === id
          ? { ...p, estado, proxima_accion: autoProxima ?? p.proxima_accion }
          : p,
      ),
    );

    try {
      const res = await fetch(`/api/prospects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado,
          ...(autoProxima ? { proxima_accion: autoProxima } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo actualizar");
      if (data.prospect?.estado) {
        setItems((actuales) =>
          actuales.map((p) =>
            p.id === id ? { ...p, estado: data.prospect.estado } : p,
          ),
        );
      }
    } catch (err: any) {
      if (anterior) {
        setItems((actuales) =>
          actuales.map((p) => (p.id === id ? anterior : p)),
        );
      }
      setEstadoError(err.message ?? "No se pudo actualizar el estado");
    }
  }

  async function borrarTodos() {
    if (items.length === 0) return;
    if (
      !confirm(
        `Vas a borrar TODOS los prospectos (${items.length}). Esto no se puede deshacer. ¿Continuar?`,
      )
    )
      return;
    if (!confirm("Última confirmación: ¿borrar absolutamente todo y partir de cero?")) return;
    setEstadoError(null);
    try {
      const res = await fetch("/api/prospects", {
        method: "DELETE",
        headers: { "x-confirm": "BORRAR-TODO" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setItems([]);
      router.refresh();
    } catch (err: any) {
      setEstadoError(`No se pudo borrar todo: ${err.message}`);
    }
  }

  async function eliminar(p: Prospect) {
    if (!confirm(`¿Eliminar el prospecto "${p.nombre}"? Esto no se puede deshacer.`)) return;
    setEstadoError(null);
    const previos = items;
    setItems((actuales) => actuales.filter((x) => x.id !== p.id));
    try {
      const res = await fetch(`/api/prospects/${p.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Error ${res.status}`);
      }
      router.refresh();
    } catch (err: any) {
      setItems(previos);
      setEstadoError(`No se pudo eliminar: ${err.message}`);
    }
  }

  async function copiarMensaje(p: Prospect) {
    if (!p.mensaje) return;
    await navigator.clipboard.writeText(p.mensaje);
    setCopiado(p.id);
    setTimeout(() => setCopiado(null), 1500);
  }

  async function copiarTexto(id: string, texto: string) {
    await navigator.clipboard.writeText(texto);
    setCopiado(id);
    setTimeout(() => setCopiado(null), 1500);
  }

  function toggleDetalle(p: Prospect) {
    if (abierto === p.id) {
      setAbierto(null);
      return;
    }
    setAbierto(p.id);
    setProxDraft(p.proxima_accion ?? "");
    setNotasDraft(p.notas ?? "");
  }

  /** Guarda próxima acción + notas de la fila expandida. */
  async function guardarDetalle(p: Prospect) {
    if (guardandoDetalle) return;
    setGuardandoDetalle(true);
    setEstadoError(null);
    try {
      const res = await fetch(`/api/prospects/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proxima_accion: proxDraft || null,
          notas: notasDraft || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Error ${res.status}`);
      }
      setItems((actuales) =>
        actuales.map((x) =>
          x.id === p.id
            ? { ...x, proxima_accion: proxDraft || null, notas: notasDraft || null }
            : x,
        ),
      );
    } catch (err: any) {
      setEstadoError(`No se pudo guardar: ${err.message}`);
    } finally {
      setGuardandoDetalle(false);
    }
  }

  async function aPipeline(p: Prospect) {
    await fetch("/api/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prospect_id: p.id }),
    });
    router.push("/pipeline");
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar…"
          className="input w-48 py-2 text-xs"
        />
        <select
          value={rubro}
          onChange={(e) => setRubro(e.target.value)}
          className="input w-auto py-2 text-xs"
          aria-label="Filtrar por rubro"
        >
          <option value="todos">Todos los rubros</option>
          {rubros.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select
          value={orden}
          onChange={(e) => setOrden(e.target.value as Orden)}
          className="input w-auto py-2 text-xs"
          aria-label="Ordenar por"
        >
          {ORDEN_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>Ordenar: {o.label}</option>
          ))}
        </select>
        <div className="flex flex-wrap gap-1">
          {[{ value: "todos" as const, label: "Todos" }, ...ESTADO_OPTIONS].map(
            (estado) => (
            <button
              key={estado.value}
              onClick={() => {
                setFiltro(estado.value);
                setQuick("");
              }}
              className={`chip transition ${
                filtro === estado.value && quick === ""
                  ? "border-brand/50 bg-brand/10 text-brand"
                  : "hover:text-ink"
              }`}
            >
              {estado.label}
            </button>
            ),
          )}
          <button
            onClick={() => {
              setQuick(quick === "hot" ? "" : "hot");
              setFiltro("todos");
            }}
            className={`chip transition ${
              quick === "hot"
                ? "border-ok/50 bg-ok/10 text-ok"
                : "hover:text-ink"
            }`}
            title="Prospectos nuevos con score ≥ 70 — contactar primero"
          >
            ⚡ Calientes s/contactar
          </button>
          <button
            onClick={() => {
              setQuick(quick === "sin_respuesta" ? "" : "sin_respuesta");
              setFiltro("todos");
            }}
            className={`chip transition ${
              quick === "sin_respuesta"
                ? "border-warn/50 bg-warn/10 text-warn"
                : "hover:text-ink"
            }`}
            title="Contactados que aún no responden — candidatos a follow-up"
          >
            ⏳ Sin respuesta
          </button>
        </div>
        <span className="ml-auto flex items-center gap-2.5">
          <span className="font-mono text-[11px] text-ink-dim">
            {filtrados.length} prospectos
          </span>
          <button
            onClick={() => descargarCSV(filtrados)}
            disabled={filtrados.length === 0}
            className="btn-ghost px-3 py-1.5"
            title="Descarga lo filtrado como CSV (se abre en Excel)"
          >
            ⬇ Exportar a Excel
          </button>
          <button
            onClick={borrarTodos}
            disabled={items.length === 0}
            className="btn-ghost px-3 py-1.5 hover:border-danger/40 hover:bg-danger/10 hover:text-danger"
            title="Borra todos los prospectos para partir de cero (pide doble confirmación)"
          >
            🗑 Borrar todos
          </button>
        </span>
      </div>
      {estadoError && (
        <p className="mb-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {estadoError}
        </p>
      )}

      <div className="panel overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-3/60">
              <th className="lbl px-5 py-3 font-normal">Score</th>
              <th className="lbl px-5 py-3 font-normal">Negocio</th>
              <th className="lbl px-5 py-3 font-normal">Señales</th>
              <th className="lbl px-5 py-3 font-normal">Estado</th>
              <th className="lbl px-5 py-3 font-normal">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtrados.map((p) => {
              const sc = scoreCls(p.score);
              const wa = linkWhatsApp(p);
              return (
                <Fragment key={p.id}>
                  <tr className="data-row">
                    <td className="px-5 py-4 align-top">
                      <span className={`font-mono text-xl ${sc.text}`}>
                        {p.score}
                      </span>
                      <span
                        className="mt-2 block h-[3px] w-16 overflow-hidden rounded-full bg-surface-3"
                        title={p.razon_score ?? undefined}
                      >
                        <span
                          className={`block h-full ${sc.bar}`}
                          style={{ width: `${p.score}%` }}
                        />
                      </span>
                    </td>
                    <td className="max-w-60 px-5 py-4 align-top">
                      <div className="truncate text-[15px] font-semibold">
                        {p.nombre}
                      </div>
                      <div className="mt-1 text-[11px] text-ink-dim">
                        {p.rubro} · {p.comuna}
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="flex flex-wrap gap-1">
                        {!p.web && (
                          <span className="chip border-warn/30 px-1.5 py-0 text-[10px] text-warn">
                            Sin web
                          </span>
                        )}
                        {p.rating != null && (
                          <span className="chip px-1.5 py-0 text-[10px]">
                            ★ {p.rating} ·{" "}
                            <span className="font-mono">{p.reviews ?? 0}</span>
                          </span>
                        )}
                        {p.telefono && (
                          <span className="chip px-1.5 py-0 font-mono text-[10px]">
                            {p.telefono}
                          </span>
                        )}
                        {p.web && (
                          <a
                            href={p.web}
                            target="_blank"
                            rel="noreferrer"
                            className="chip px-1.5 py-0 text-[10px] underline hover:text-ink"
                          >
                            Web
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <select
                        value={p.estado}
                        onChange={(e) =>
                          cambiarEstado(p.id, e.target.value as Estado)
                        }
                        className={`rounded-full border bg-surface-3 px-2 py-1 text-[11px] outline-none transition focus:border-brand ${ESTADO_PILL[p.estado]}`}
                      >
                        {ESTADO_OPTIONS.map((estado) => (
                          <option key={estado.value} value={estado.value}>
                            {estado.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="flex flex-wrap gap-1.5">
                        {wa && (
                          <a
                            href={wa}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-ok/40 bg-ok/10 px-2.5 py-1 text-xs font-medium text-ok transition hover:bg-ok/20"
                            title="Abre WhatsApp con el mensaje listo (envío manual)"
                          >
                            WhatsApp
                          </a>
                        )}
                        <button
                          onClick={() => copiarMensaje(p)}
                          disabled={!p.mensaje}
                          className="btn-ghost"
                        >
                          {copiado === p.id ? "Copiado ✓" : "Copiar"}
                        </button>
                        <button
                          onClick={() => toggleDetalle(p)}
                          className={`btn-ghost ${abierto === p.id ? "border-brand/40 text-brand" : ""}`}
                          title="Razón del score, mensaje, follow-ups, próxima acción y notas"
                        >
                          {abierto === p.id ? "Cerrar" : "Detalle"}
                        </button>
                        {p.estado !== ESTADO_CONFIG.en_pipeline.value && (
                          <button
                            onClick={() => aPipeline(p)}
                            className="btn-ghost"
                          >
                            → Pipeline
                          </button>
                        )}
                        <button
                          onClick={() => eliminar(p)}
                          className="btn-ghost hover:border-danger/40 hover:bg-danger/10 hover:text-danger"
                          aria-label={`Eliminar ${p.nombre}`}
                          title="Eliminar prospecto"
                        >
                          ×
                        </button>
                      </div>
                    </td>
                  </tr>
                  {abierto === p.id && (
                    <tr>
                      <td colSpan={5} className="px-3 pb-4 pt-0">
                        <div className="ml-0 grid gap-3 rounded-lg border border-line bg-surface-3/45 p-4 sm:ml-12 lg:grid-cols-[1.2fr_1fr]">
                          {/* Columna izquierda: score explicado + mensaje */}
                          <div className="flex flex-col gap-3">
                            <div>
                              <div className="lbl mb-1.5">Por qué score {p.score}</div>
                              <p className="text-[12.5px] leading-relaxed text-ink-soft">
                                {p.razon_score || "Sin razón registrada (score por defecto)."}
                              </p>
                              <p className="mt-1.5 text-[12px] text-ink-mut">
                                <span className="font-medium text-brand">Acción recomendada:</span>{" "}
                                {accionRecomendada(p)}
                              </p>
                            </div>
                            {p.mensaje && (
                              <div>
                                <div className="lbl mb-1.5">Primer mensaje</div>
                                <div className="rounded-lg border-l-2 border-ok bg-surface-2 px-4 py-3 text-[13px] leading-relaxed text-ink-soft">
                                  <p className="whitespace-pre-wrap">{p.mensaje}</p>
                                </div>
                              </div>
                            )}
                            <div>
                              <div className="lbl mb-1.5">Follow-ups sugeridos (copiar)</div>
                              <div className="flex flex-wrap gap-1.5">
                                {plantillasPara(p).map((t) => (
                                  <button
                                    key={t.id}
                                    onClick={() => copiarTexto(`${p.id}-${t.id}`, t.genera(p))}
                                    className="btn-ghost px-2.5 py-1"
                                    title={t.genera(p).slice(0, 140) + "…"}
                                  >
                                    {copiado === `${p.id}-${t.id}` ? "Copiado ✓" : t.label}
                                  </button>
                                ))}
                              </div>
                              <p className="mt-1.5 text-[10.5px] text-warn">
                                Envío manual desde tu WhatsApp Business — nunca por Cloud API.
                                Revisa los [corchetes] antes de enviar.
                              </p>
                            </div>
                          </div>
                          {/* Columna derecha: próxima acción + notas */}
                          <div className="flex flex-col gap-2.5">
                            <div>
                              <label className="lbl mb-1.5 block">Próxima acción (fecha)</label>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <input
                                  type="date"
                                  value={proxDraft}
                                  onChange={(e) => setProxDraft(e.target.value)}
                                  className="input w-auto py-1.5 text-xs"
                                />
                                <button onClick={() => setProxDraft(enDias(0))} className="btn-ghost px-2 py-1">Hoy</button>
                                <button onClick={() => setProxDraft(enDias(3))} className="btn-ghost px-2 py-1">+3d</button>
                                <button onClick={() => setProxDraft(enDias(7))} className="btn-ghost px-2 py-1">+7d</button>
                              </div>
                            </div>
                            <div className="flex flex-1 flex-col">
                              <label className="lbl mb-1.5 block">Notas</label>
                              <textarea
                                value={notasDraft}
                                onChange={(e) => setNotasDraft(e.target.value)}
                                placeholder="Quién contesta, qué preguntaron, objeciones…"
                                rows={4}
                                className="input flex-1 resize-y text-xs"
                              />
                            </div>
                            <button
                              onClick={() => guardarDetalle(p)}
                              disabled={guardandoDetalle}
                              className="btn-primary self-end px-4 py-1.5 text-xs"
                            >
                              {guardandoDetalle ? "Guardando…" : "Guardar"}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-sm text-ink-dim">
                  {items.length === 0
                    ? "Todavía no hay prospectos guardados. Busca un rubro + comuna arriba — el próximo cliente está en esa lista."
                    : "Nada calza con los filtros actuales. Límpialos o busca un rubro nuevo arriba."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
