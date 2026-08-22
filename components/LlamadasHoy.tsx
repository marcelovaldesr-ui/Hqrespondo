"use client";

import { useEffect, useMemo, useState } from "react";
import type { FilaLlamada } from "@/lib/llamadas";
import { EQUIPO } from "@/lib/equipo";

/**
 * Lista de llamadas del día — flujo de UNA mano:
 *  · "No contestó", "Portero" y "Recado" = 1 clic, la fila se cierra y vuelve MAÑANA.
 *  · "Portero" se registra aparte de "no contestó" a propósito: llegar al
 *    filtro no es conectar, y mezclarlos infla la tasa de conexión.
 *  · "Contestó" abre el mini-formulario (resultado + dueño + contacto + nota).
 *  · Todo queda en la base al instante; nada que descargar ni traspasar.
 */

type Resultado =
  | "no_contesto"
  | "gatekeeper"
  | "recado"
  | "numero_malo"
  | "interesado"
  | "seguimiento"
  | "no_interesa";

const ETIQUETA: Record<Resultado, string> = {
  no_contesto: "No contestó — mañana de nuevo",
  gatekeeper: "Quedó en el portero — mañana de nuevo",
  recado: "Recado dejado — mañana de nuevo",
  numero_malo: "Número malo — descartado",
  interesado: "🔥 Interesado — al pipeline",
  seguimiento: "Seguimiento en 2 días",
  no_interesa: "No le interesa — descartado",
};

function chipSenal(f: FilaLlamada): { texto: string; verde: boolean } | null {
  const s = f.senales_web;
  if (!s) return null;
  if (s.potencial === "alto") {
    const texto = s.solo_redes
      ? "SOLO REDES"
      : s.celular_whatsapp
        ? "SOLO WHATSAPP"
        : s.formulario_hora
          ? "FORMULARIO"
          : "MANUAL";
    return { texto, verde: true };
  }
  return null;
}

function telLink(t: string): string {
  const d = t.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) return d;
  if (d.startsWith("56")) return `+${d}`;
  return `+56${d}`;
}

export default function LlamadasHoy({
  yo,
  filasIniciales,
  llamadasHoy,
  elegiblesHoy,
  limite,
}: {
  /** Quién está conectado, resuelto del login en el servidor. */
  yo: string;
  filasIniciales: FilaLlamada[];
  llamadasHoy: number;
  /** Total de elegibles hoy, sin el tope de la tanda. */
  elegiblesHoy: number;
  /** Tamaño de la tanda que se está mostrando. */
  limite: number;
}) {
  const [filas, setFilas] = useState(filasIniciales);
  const [hechas, setHechas] = useState<Record<string, Resultado>>({});
  const [notasRapidas, setNotasRapidas] = useState<Record<string, string>>({});
  const [abierta, setAbierta] = useState<string | null>(null);
  const [form, setForm] = useState({ resultado: "interesado" as Resultado, quien_contesto: "" as "" | "dueno" | "recepcion", dueno: "", contacto: "", nota: "" });
  const [guardando, setGuardando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [avisoRefresco, setAvisoRefresco] = useState(false);
  // Quién está marcando. Se recuerda por navegador (cada uno trabaja desde su
  // sesión), y alimenta el marcador por persona de /metricas. Sin esto todas
  // las llamadas de este motor quedaban huérfanas de autor en la bitácora.
  // Por defecto, quien inició sesión. La elección manual solo existe para el
  // caso de un login compartido, o para registrar en nombre de otro.
  const [quien, setQuien] = useState(
    EQUIPO.some((e) => e.nombre === yo) ? yo : EQUIPO[0].nombre,
  );
  useEffect(() => {
    const g = window.localStorage.getItem("hq_quien_llama");
    if (g && EQUIPO.some((e) => e.nombre === g)) setQuien(g);
  }, []);
  function cambiarQuien(n: string) {
    setQuien(n);
    window.localStorage.setItem("hq_quien_llama", n);
  }

  const pendientes = useMemo(
    () => filas.filter((f) => !hechas[f.id]).length,
    [filas, hechas],
  );
  const contadorHoy = llamadasHoy + Object.keys(hechas).length;

  async function registrar(f: FilaLlamada, resultado: Resultado, extra?: Partial<typeof form>) {
    setGuardando(f.id);
    setError(null);
    try {
      const res = await fetch("/api/prospects/llamada", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: f.id,
          ids_grupo: f.ids_grupo,
          resultado,
          actor: quien,
          quien_contesto: extra?.quien_contesto ?? "",
          dueno: extra?.dueno ?? "",
          contacto: extra?.contacto ?? "",
          nota: extra?.nota || notasRapidas[f.id] || "",
        }),
      });
      if (!res.ok) throw new Error((await res.json())?.error ?? `HTTP ${res.status}`);
      setHechas((h) => ({ ...h, [f.id]: resultado }));
      setAbierta(null);
      setForm({ resultado: "interesado", quien_contesto: "", dueno: "", contacto: "", nota: "" });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            {/* Mismo ancla visual que PageHeader en el resto de la app */}
            <span className="flex shrink-0 flex-col gap-[3px]" aria-hidden="true">
              <span className="block h-[3px] w-4 rounded-full bg-brand" />
              <span className="block h-[3px] w-2.5 rounded-full bg-coral/70" />
            </span>
            <h1 className="ttl text-[17px] leading-tight">Llamadas del día</h1>
            <span className="hidden border-l border-line2 pl-3 font-mono text-[11px] uppercase tracking-[0.13em] text-ink-mut sm:inline">
              Cola de hoy
            </span>
          </div>
          <p className="mt-1.5 pl-7 text-[12.5px] text-ink-mut">
            Mejores primero. &quot;No contestó&quot; vuelve mañana solo · 4 intentos sin contacto y sale de la lista.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label
            className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-wider text-ink-dim"
            title={
              yo
                ? `Sale de tu sesión (${yo}). Cámbialo solo si estás registrando por otra persona.`
                : "Elige tu nombre para que las llamadas queden a tu nombre en el marcador."
            }
          >
            ¿Quién llama?
            <select
              className="input !w-auto !py-1 text-xs normal-case tracking-normal"
              value={quien}
              onChange={(e) => cambiarQuien(e.target.value)}
            >
              {EQUIPO.map((e) => (
                <option key={e.nombre} value={e.nombre}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </label>
          <span className="rounded-lg border border-line bg-surface-1 px-3 py-1.5 font-mono text-[12px] text-ink-soft">
            Hoy: <b className="text-ink">{contadorHoy}</b> llamadas · quedan{" "}
            <b className="text-ink">{pendientes}</b>
            <span className="text-ink-dim">
              {" "}
              · viendo {filas.length} de {elegiblesHoy}
            </span>
          </span>
          <button
            onClick={() => {
              // La lista solo cambia si algo salió de ella: es decir, si se
              // registró un resultado. Recargar sin haber registrado nada
              // devuelve exactamente los mismos 40 y parece que el botón
              // está roto — así que lo decimos en vez de recargar en vano.
              if (Object.keys(hechas).length === 0) {
                setAvisoRefresco(true);
                return;
              }
              window.location.reload();
            }}
            className={`px-3 py-1.5 text-[12px] ${
              Object.keys(hechas).length > 0
                ? "rounded-lg bg-brand font-medium text-white hover:opacity-90"
                : "btn-ghost"
            }`}
            title="Saca de la lista los que ya registraste y sube los siguientes"
          >
            ↻ Actualizar lista
          </button>
          <a
            href="/api/prospects/csv-llamadas?preview=1"
            className="btn-ghost px-3 py-1.5 text-[12px]"
            title="La misma lista, en Excel (respaldo para llamar sin conexión)"
          >
            ⬇ Excel
          </a>
        </div>
      </div>

      {pendientes === 0 && filas.length > 0 && (
        <p className="mb-3 rounded-lg border border-ok/30 bg-ok/10 px-3 py-2 text-[12.5px] text-ok">
          ✓ Tanda completa. Dale a <b>Actualizar lista</b> para traer los siguientes elegibles.
        </p>
      )}

      {error && (
        <p className="mb-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}

      {avisoRefresco && (
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">
          <span>
            La lista es la misma porque todavía no registraste ningún resultado.
            Un prospecto sale de aquí recién cuando marcas cómo te fue.
          </span>
          {elegiblesHoy > filas.length && (
            <a
              href={`/llamadas?n=${Math.min(elegiblesHoy, 150)}`}
              className="btn-ghost border-warn/40 text-warn hover:border-warn hover:text-warn"
            >
              Ver los {Math.min(elegiblesHoy, 150)} elegibles
            </a>
          )}
          <button
            onClick={() => setAvisoRefresco(false)}
            className="btn-ghost border-warn/40 text-warn hover:border-warn hover:text-warn"
          >
            Entendido
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {filas.map((f, i) => {
          const hecha = hechas[f.id];
          const chip = chipSenal(f);
          const esta = abierta === f.id;
          return (
            <div
              key={f.id}
              className={`panel rounded-xl border border-line bg-surface-1 px-4 py-3 transition ${
                hecha ? "opacity-45" : ""
              }`}
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="w-6 shrink-0 text-right font-mono text-[12px] text-ink-faint">
                  {i + 1}
                </span>
                {/* El score va en tinta: es magnitud, no estado. La severidad
                    la carga el medidor de abajo, igual que en Prospección. */}
                <span className="w-10 shrink-0 text-center">
                  <span className="num text-lg font-semibold text-ink">{f.score}</span>
                  <span className="meter mt-1">
                    <span
                      className="meter-fill"
                      style={{
                        width: `${f.score}%`,
                        backgroundImage:
                          f.score >= 85
                            ? "linear-gradient(90deg,#8B6BFF,#C3AEFF)"
                            : "linear-gradient(90deg,#4C5163,#70768B)",
                      }}
                    />
                  </span>
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {f.web ? (
                      <a
                        href={f.web}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-[14px] font-semibold hover:underline"
                        title={f.web}
                      >
                        {f.nombre}
                      </a>
                    ) : (
                      <span className="truncate text-[14px] font-semibold">{f.nombre}</span>
                    )}
                    {f.sucursales > 1 && (
                      <span className="chip px-1.5 py-0 text-[10px]">
                        {f.sucursales} sucursales
                      </span>
                    )}
                    {chip && (
                      <span className="chip border-ok/40 bg-ok/10 px-1.5 py-0 text-[10px] font-semibold text-ok">
                        {chip.texto}
                      </span>
                    )}
                    {f.intentos_llamada > 0 && (
                      <span className="chip border-warn/30 px-1.5 py-0 text-[10px] text-warn">
                        intento {f.intentos_llamada + 1}
                      </span>
                    )}
                  </div>
                  <div
                    className="mt-0.5 truncate text-[11.5px] text-ink-dim"
                    title={f.razon_score ?? undefined}
                  >
                    {f.rubro} · {f.comuna} — {f.razon_score}
                  </div>
                </div>

                <a
                  href={`tel:${telLink(f.telefono)}`}
                  className="chip shrink-0 px-2 py-1 font-mono text-[12.5px] hover:border-brand hover:text-brand"
                  title="Llamar"
                >
                  {f.telefono}
                </a>

                {hecha ? (
                  <span className="shrink-0 text-[12px] font-medium text-ink-mut">
                    ✓ {ETIQUETA[hecha]}
                  </span>
                ) : (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <input
                      value={notasRapidas[f.id] ?? ""}
                      onChange={(e) =>
                        setNotasRapidas((n) => ({ ...n, [f.id]: e.target.value }))
                      }
                      placeholder="nota: buzón, apagado…"
                      className="w-36 rounded-lg border border-line bg-surface-3 px-2 py-1.5 text-[11.5px] outline-none focus:border-brand"
                      title="Se guarda junto con el botón que aprietes (opcional)"
                    />
                    <button
                      onClick={() => registrar(f, "no_contesto")}
                      disabled={guardando === f.id}
                      className="btn-ghost px-2.5 py-1.5 text-[12px]"
                      title="Se registra y vuelve a la lista mañana"
                    >
                      ☎ No contestó
                    </button>
                    <button
                      onClick={() => registrar(f, "gatekeeper")}
                      disabled={guardando === f.id}
                      className="btn-ghost px-2.5 py-1.5 text-[12px]"
                      title="Contestaron, pero no te pasaron con quien decide. Se cuenta aparte de 'no contestó' para poder medir la tasa de conexión real"
                    >
                      🚧 Portero
                    </button>
                    <button
                      onClick={() => registrar(f, "recado")}
                      disabled={guardando === f.id}
                      className="btn-ghost px-2.5 py-1.5 text-[12px]"
                      title="Dejaste recado con alguien — vuelve mañana"
                    >
                      💬 Recado
                    </button>
                    <button
                      onClick={() => setAbierta(esta ? null : f.id)}
                      className={`rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition ${
                        esta
                          ? "border-brand bg-brand/10 text-brand"
                          : "border-ok/40 bg-ok/10 text-ok hover:bg-ok/20"
                      }`}
                    >
                      ✓ Contestó…
                    </button>
                  </div>
                )}
              </div>

              {esta && !hecha && (
                <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-line pt-3">
                  <label className="flex flex-col gap-1 text-[11px] text-ink-mut">
                    Resultado
                    <select
                      value={form.resultado}
                      onChange={(e) => setForm({ ...form, resultado: e.target.value as Resultado })}
                      className="rounded-lg border border-line bg-surface-3 px-2 py-1.5 text-[12.5px] outline-none focus:border-brand"
                    >
                      <option value="interesado">🔥 Interesado (agendar demo)</option>
                      <option value="seguimiento">Pidió que lo llame después</option>
                      <option value="no_interesa">No le interesa</option>
                      <option value="numero_malo">Número equivocado / malo</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] text-ink-mut">
                    ¿Quién contestó?
                    {/* Es el único dato que dice de verdad de quién es este
                        número. El sistema puede deducir muchas cosas, pero
                        esto solo lo sabe quien llamó. */}
                    <select
                      value={form.quien_contesto}
                      onChange={(e) =>
                        setForm({ ...form, quien_contesto: e.target.value as typeof form.quien_contesto })
                      }
                      className="w-36 rounded-lg border border-line bg-surface-3 px-2 py-1.5 text-[12.5px] outline-none focus:border-brand"
                    >
                      <option value="">No sé / no aplica</option>
                      <option value="dueno">El dueño o quien decide</option>
                      <option value="recepcion">Recepción o secretaria</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] text-ink-mut">
                    Dueño
                    <input
                      value={form.dueno}
                      onChange={(e) => setForm({ ...form, dueno: e.target.value })}
                      placeholder="nombre"
                      className="w-32 rounded-lg border border-line bg-surface-3 px-2 py-1.5 text-[12.5px] outline-none focus:border-brand"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] text-ink-mut">
                    Celular / correo
                    <input
                      value={form.contacto}
                      onChange={(e) => setForm({ ...form, contacto: e.target.value })}
                      placeholder="+569… o correo"
                      className="w-40 rounded-lg border border-line bg-surface-3 px-2 py-1.5 text-[12.5px] outline-none focus:border-brand"
                    />
                  </label>
                  <label className="flex min-w-40 flex-1 flex-col gap-1 text-[11px] text-ink-mut">
                    Nota
                    <input
                      value={form.nota}
                      onChange={(e) => setForm({ ...form, nota: e.target.value })}
                      placeholder="qué dijeron, objeciones…"
                      className="rounded-lg border border-line bg-surface-3 px-2 py-1.5 text-[12.5px] outline-none focus:border-brand"
                    />
                  </label>
                  <button
                    onClick={() => registrar(f, form.resultado, form)}
                    disabled={guardando === f.id}
                    className="rounded-lg bg-brand px-4 py-2 text-[12.5px] font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    {guardando === f.id ? "Guardando…" : "Guardar"}
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {filas.length === 0 && (
          <div className="panel rounded-xl border border-line bg-surface-1 px-6 py-10 text-center text-[13px] text-ink-mut">
            🎉 No quedan llamadas elegibles por hoy. Los &quot;no contestó&quot; vuelven mañana;
            busca más prospectos en Prospección si quieres seguir.
          </div>
        )}
      </div>
    </div>
  );
}
