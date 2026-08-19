"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ESTADO_OBJETIVO_LABEL,
  SOCIOS,
  rangoSemana,
  resumirSocio,
  semanaOffset,
  lunesDe,
  type EstadoObjetivo,
  type ObjetivoSemana,
} from "@/lib/equipo";

type Serie = { semana: string; porSocio: Record<string, number | null> }[];

/** Colores de ESTADO (reservados, no son serie de gráfico). */
const ESTADO_CLS: Record<EstadoObjetivo, string> = {
  pendiente: "border-line2 bg-surface-4 text-ink-mut",
  cumplido: "border-ok/45 bg-ok/12 text-ok",
  parcial: "border-warn/45 bg-warn/12 text-warn",
  no_cumplido: "border-danger/45 bg-danger/12 text-danger",
};
const ORDEN: EstadoObjetivo[] = ["cumplido", "parcial", "no_cumplido"];

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

export default function EquipoSemanal({
  semana,
  objetivosIniciales,
  serie,
}: {
  semana: string;
  objetivosIniciales: ObjetivoSemana[];
  serie: Serie;
}) {
  const router = useRouter();
  const [objetivos, setObjetivos] = useState(objetivosIniciales);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState<Record<string, { objetivo: string; medida: string }>>({});

  const esSemanaActual = semana === lunesDe();
  const resumenes = useMemo(
    () => SOCIOS.map((s) => resumirSocio(s, objetivos)),
    [objetivos],
  );
  /**
   * Promedio propio de las 4 semanas ANTERIORES (excluida la actual).
   * La comparación es contra uno mismo, nunca entre socios: hay evidencia
   * experimental de que el feedback relativo entre pares sube el esfuerzo del
   * que va arriba y lo baja en el que va abajo, ampliando la brecha. Con 3
   * personas, un ranking garantiza que alguien sea siempre último.
   */
  const promedioPropio = useMemo(() => {
    const out: Record<string, number | null> = {};
    for (const soc of SOCIOS) {
      const previas = serie
        .filter((s) => s.semana < semana)
        .slice(-4)
        .map((s) => s.porSocio[soc.nombre])
        .filter((v): v is number => v !== null && v !== undefined);
      out[soc.nombre] = previas.length
        ? previas.reduce((a, b) => a + b, 0) / previas.length
        : null;
    }
    return out;
  }, [serie, semana]);

  const mudosTotal = resumenes.reduce((a, r) => a + r.mudos, 0);
  const totalObj = resumenes.reduce((a, r) => a + r.total, 0);
  const evaluados = resumenes.reduce((a, r) => a + (r.total - r.pendientes), 0);
  const cumplimientoEquipo =
    evaluados > 0
      ? resumenes.reduce(
          (a, r) => a + (r.cumplidos + 0.5 * r.parciales),
          0,
        ) / evaluados
      : 0;

  async function api(metodo: string, body: unknown, id?: string) {
    setError(null);
    const url = metodo === "DELETE" ? `/api/equipo?id=${id}` : "/api/equipo";
    const res = await fetch(url, {
      method: metodo,
      headers: { "Content-Type": "application/json" },
      body: metodo === "DELETE" ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d?.error ?? `HTTP ${res.status}`);
    }
  }

  async function crear(socio: string) {
    const draft = nuevo[socio];
    if (!draft?.objetivo?.trim() || guardando) return;
    setGuardando(socio);
    try {
      await api("POST", {
        semana,
        socio,
        objetivo: draft.objetivo,
        como_se_mide: draft.medida ?? "",
      });
      setNuevo((n) => ({ ...n, [socio]: { objetivo: "", medida: "" } }));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(null);
    }
  }

  async function actualizar(o: ObjetivoSemana, cambio: Partial<ObjetivoSemana>) {
    setGuardando(o.id);
    // Optimista: la reunión es en vivo, esperar al servidor se siente lento.
    setObjetivos((prev) =>
      prev.map((x) => (x.id === o.id ? { ...x, ...cambio } : x)),
    );
    try {
      await api("PATCH", { id: o.id, ...cambio });
    } catch (e) {
      setObjetivos((prev) => prev.map((x) => (x.id === o.id ? o : x)));
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(null);
    }
  }

  async function borrar(o: ObjetivoSemana) {
    setGuardando(o.id);
    const antes = objetivos;
    setObjetivos((prev) => prev.filter((x) => x.id !== o.id));
    try {
      await api("DELETE", null, o.id);
    } catch (e) {
      setObjetivos(antes);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(null);
    }
  }

  return (
    <div>
      {/* ---- Barra de semana ---- */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <Link href={`/equipo?semana=${semanaOffset(semana, -1)}`} className="btn-ghost px-2.5 py-1.5" aria-label="Semana anterior">←</Link>
          <span className="rounded-lg border border-line bg-surface-1 px-3 py-1.5 font-mono text-[12px] text-ink-soft">
            {rangoSemana(semana)}
            {esSemanaActual && (
              <span className="ml-2 text-[10px] uppercase tracking-wider text-brand">
                esta semana
              </span>
            )}
          </span>
          <Link href={`/equipo?semana=${semanaOffset(semana, 1)}`} className="btn-ghost px-2.5 py-1.5" aria-label="Semana siguiente">→</Link>
          {!esSemanaActual && (
            <Link href="/equipo" className="btn-ghost px-2.5 py-1.5">Hoy</Link>
          )}
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-ink-mut">
          <span>{totalObj} objetivos</span>
          <span className="text-ink-faint">·</span>
          <span>
            equipo{" "}
            <b className="num text-ink">{evaluados ? pct(cumplimientoEquipo) : "—"}</b>
          </span>
        </div>
      </div>

      {error && (
        <p className="mb-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}

      {/* ---- El semáforo que importa ---- */}
      {mudosTotal > 0 && (
        <div className="panel mb-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-danger/30 bg-danger/[0.07] px-4 py-3">
          <span className="led led-glow-red bg-danger" aria-hidden="true" />
          <span className="text-[13px] text-ink">
            <b className="num">{mudosTotal}</b>{" "}
            {mudosTotal === 1 ? "objetivo cayó" : "objetivos cayeron"} y todavía no se
            conversaron en la reunión.
          </span>
          <span className="text-[12px] text-ink-mut">
            Un objetivo que se cae y se habla es información. Uno que se cae en silencio
            es el problema.
          </span>
        </div>
      )}

      {/* ---- Resumen por socio ---- */}
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {resumenes.map((r) => (
          <div key={r.socio} className="metric-card">
            <div className="flex items-baseline justify-between">
              <span className="ttl text-[14px]">{r.socio}</span>
              <span className="num text-2xl font-semibold text-ink">
                {r.total - r.pendientes > 0 ? pct(r.cumplimiento) : "—"}
              </span>
            </div>
            <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wider text-ink-dim">
              {r.rol}
            </p>
            {(() => {
              const base = promedioPropio[r.socio];
              if (base === null || r.total - r.pendientes === 0) return null;
              const d = r.cumplimiento - base;
              const signo = d > 0 ? "+" : "";
              return (
                <p className="mt-1 font-mono text-[10.5px] text-ink-dim">
                  {signo}
                  {Math.round(d * 100)} pts vs tu promedio de 4 semanas (
                  {Math.round(base * 100)}%)
                </p>
              );
            })()}
            <span className="meter mt-2.5">
              <span className="meter-fill" style={{ width: pct(r.cumplimiento) }} />
            </span>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10.5px] text-ink-mut">
              <span>{r.cumplidos} ok</span>
              <span>{r.parciales} parcial</span>
              <span>{r.no_cumplidos} no</span>
              {r.pendientes > 0 && (
                <span className="text-ink-faint">{r.pendientes} sin evaluar</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ---- Columnas por socio ---- */}
      <div className="grid gap-3 lg:grid-cols-3">
        {SOCIOS.map((soc) => {
          const suyos = objetivos.filter((o) => o.socio === soc.nombre);
          const draft = nuevo[soc.nombre] ?? { objetivo: "", medida: "" };
          return (
            <section key={soc.nombre} className="panel flex flex-col p-3.5">
              <div className="mb-3 flex items-center justify-between">
                <span className="ttl text-[13.5px]">{soc.nombre}</span>
                <span className="chip">{suyos.length}</span>
              </div>

              <div className="flex flex-col gap-2">
                {suyos.map((o) => {
                  const necesitaMotivo =
                    o.estado === "no_cumplido" || o.estado === "parcial";
                  return (
                    <article
                      key={o.id}
                      className={`subpanel group p-3 transition ${
                        guardando === o.id ? "opacity-60" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13px] font-medium leading-snug text-ink">
                          {o.objetivo}
                        </p>
                        <button
                          onClick={() => borrar(o)}
                          className="btn-ghost shrink-0 px-1.5 py-0 text-[11px] opacity-0 transition group-hover:opacity-100 hover:border-danger/40 hover:text-danger"
                          aria-label={`Eliminar ${o.objetivo}`}
                        >
                          ×
                        </button>
                      </div>
                      {o.como_se_mide && (
                        <p className="mt-1 text-[11px] italic text-ink-dim">
                          {o.como_se_mide}
                        </p>
                      )}

                      <div className="mt-2.5 flex flex-wrap gap-1">
                        {ORDEN.map((e) => (
                          <button
                            key={e}
                            onClick={() =>
                              actualizar(o, { estado: o.estado === e ? "pendiente" : e })
                            }
                            className={`rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition ${
                              o.estado === e
                                ? ESTADO_CLS[e]
                                : "border-line2 bg-surface-4/60 text-ink-dim hover:text-ink"
                            }`}
                          >
                            {ESTADO_OBJETIVO_LABEL[e]}
                          </button>
                        ))}
                      </div>

                      {necesitaMotivo && (
                        <div className="mt-2.5 space-y-2">
                          <input
                            defaultValue={o.motivo}
                            onBlur={(ev) => {
                              if (ev.target.value !== o.motivo)
                                actualizar(o, { motivo: ev.target.value });
                            }}
                            placeholder="¿Por qué no salió?"
                            className="input px-2 py-1 text-[12px]"
                          />
                          <label className="flex cursor-pointer items-center gap-2 text-[11.5px] text-ink-mut">
                            <input
                              type="checkbox"
                              checked={o.hablado_reunion}
                              onChange={(ev) =>
                                actualizar(o, { hablado_reunion: ev.target.checked })
                              }
                              className="h-3.5 w-3.5 accent-[#8B6BFF]"
                            />
                            Se habló en la reunión
                          </label>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>

              {/* Alta rápida: 2 campos, sin modal. El lunes se cargan 2-3 y hay
                  que poder hacerlo en 15 segundos. */}
              <div className="mt-2.5 rounded-lg border border-dashed border-line2 p-2.5">
                <input
                  value={draft.objetivo}
                  onChange={(e) =>
                    setNuevo((n) => ({ ...n, [soc.nombre]: { ...draft, objetivo: e.target.value } }))
                  }
                  onKeyDown={(e) => e.key === "Enter" && crear(soc.nombre)}
                  placeholder="Objetivo de la semana…"
                  className="input px-2 py-1 text-[12.5px]"
                />
                <input
                  value={draft.medida}
                  onChange={(e) =>
                    setNuevo((n) => ({ ...n, [soc.nombre]: { ...draft, medida: e.target.value } }))
                  }
                  onKeyDown={(e) => e.key === "Enter" && crear(soc.nombre)}
                  placeholder="¿Cómo se mide?"
                  className="input mt-1.5 px-2 py-1 text-[12.5px]"
                />
                <button
                  onClick={() => crear(soc.nombre)}
                  disabled={!draft.objetivo.trim() || guardando === soc.nombre}
                  className="btn-ghost mt-1.5 w-full py-1"
                >
                  {guardando === soc.nombre ? "Agregando…" : "+ Agregar"}
                </button>
              </div>
            </section>
          );
        })}
      </div>

      {/* ---- Tendencia: small multiples, una fila por socio ----
           Tres filas separadas en vez de tres series en un mismo gráfico:
           así la identidad la da la etiqueta de la fila y no el color. */}
      <section className="panel mt-3 p-4">
        <p className="lbl mb-3">Cumplimiento · últimas {serie.length} semanas</p>
        <div className="space-y-2.5">
          {SOCIOS.map((soc) => (
            <div key={soc.nombre} className="flex items-center gap-3">
              <span className="w-16 shrink-0 truncate text-[12px] text-ink-soft">
                {soc.nombre}
              </span>
              {/* Barras angostas con extremo redondeado y 2px de aire entre
                  ellas: a lo ancho se leían como bloques, no como serie. */}
              <div className="flex flex-1 items-end gap-[2px]" style={{ height: 34 }}>
                {serie.map((s) => {
                  const v = s.porSocio[soc.nombre];
                  const esActual = s.semana === semana;
                  return (
                    <span
                      key={s.semana}
                      title={`${rangoSemana(s.semana)} — ${v === null ? "sin datos" : pct(v)}`}
                      className="flex items-end"
                      style={{ width: 16, height: "100%" }}
                    >
                      <span
                        className="block w-full"
                        style={{
                          height: v === null ? 2 : Math.max(3, Math.round(v * 34)),
                          borderRadius: "3px 3px 1px 1px",
                          background:
                            v === null
                              ? "#1E1E2A"
                              : esActual
                                ? "#9174FF"
                                : "rgba(145,116,255,0.4)",
                        }}
                      />
                    </span>
                  );
                })}
              </div>
              <span className="num w-9 shrink-0 text-right text-[11.5px] text-ink-soft">
                {(() => {
                  const v = serie[serie.length - 1]?.porSocio[soc.nombre];
                  return v === null || v === undefined ? "—" : pct(v);
                })()}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
