"use client";

import { useMemo, useState } from "react";
import type { FilaLlamada } from "@/lib/llamadas";

/**
 * Lista de llamadas del día — flujo de UNA mano:
 *  · "No contestó" y "Recado" = 1 clic, la fila se cierra y vuelve MAÑANA.
 *  · "Contestó" abre el mini-formulario (resultado + dueño + contacto + nota).
 *  · Todo queda en la base al instante; nada que descargar ni traspasar.
 */

type Resultado =
  | "no_contesto"
  | "recado"
  | "numero_malo"
  | "interesado"
  | "seguimiento"
  | "no_interesa";

const ETIQUETA: Record<Resultado, string> = {
  no_contesto: "No contestó — mañana de nuevo",
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
  filasIniciales,
  llamadasHoy,
}: {
  filasIniciales: FilaLlamada[];
  llamadasHoy: number;
}) {
  const [filas, setFilas] = useState(filasIniciales);
  const [hechas, setHechas] = useState<Record<string, Resultado>>({});
  const [abierta, setAbierta] = useState<string | null>(null);
  const [form, setForm] = useState({ resultado: "interesado" as Resultado, dueno: "", contacto: "", nota: "" });
  const [guardando, setGuardando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          dueno: extra?.dueno ?? "",
          contacto: extra?.contacto ?? "",
          nota: extra?.nota ?? "",
        }),
      });
      if (!res.ok) throw new Error((await res.json())?.error ?? `HTTP ${res.status}`);
      setHechas((h) => ({ ...h, [f.id]: resultado }));
      setAbierta(null);
      setForm({ resultado: "interesado", dueno: "", contacto: "", nota: "" });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(null);
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">📞 Llamadas del día</h1>
          <p className="mt-1 text-[13px] text-ink-mut">
            Mejores primero. &quot;No contestó&quot; vuelve mañana solo · 4 intentos sin contacto y sale de la lista.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-lg border border-line bg-surface-1 px-3 py-1.5 font-mono text-[12px]">
            Hoy: <b>{contadorHoy}</b> llamadas · quedan <b>{pendientes}</b>
          </span>
          <a
            href="/api/prospects/csv-llamadas?preview=1"
            className="btn-ghost px-3 py-1.5 text-[12px]"
            title="La misma lista, en Excel (respaldo para llamar sin conexión)"
          >
            ⬇ Excel
          </a>
        </div>
      </div>

      {error && (
        <p className="mb-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
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
                <span
                  className={`w-10 shrink-0 text-center font-mono text-lg font-bold ${
                    f.score >= 85 ? "text-ok" : "text-ink-soft"
                  }`}
                >
                  {f.score}
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
                    <button
                      onClick={() => registrar(f, "no_contesto")}
                      disabled={guardando === f.id}
                      className="btn-ghost px-2.5 py-1.5 text-[12px]"
                      title="Se registra y vuelve a la lista mañana"
                    >
                      ☎ No contestó
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
