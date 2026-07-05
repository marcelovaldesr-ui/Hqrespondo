"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clp, timeAgo } from "@/lib/format";
import {
  PLANES,
  PLAN_LABEL,
  PLAN_PRECIOS,
  type ClientStats,
  type Plan,
} from "@/lib/types";

function salud(c: ClientStats): {
  led: string;
  glow: string;
  texto: string;
  textoCls: string;
  borde: string;
} {
  if (!c.activo)
    return {
      led: "bg-ink-faint",
      glow: "",
      texto: "inactivo",
      textoCls: "text-ink-faint",
      borde: "border-line opacity-70",
    };
  if (c.errores_24h > 0)
    return {
      led: "bg-danger",
      glow: "led-glow-red",
      texto: `${c.errores_24h} error${c.errores_24h === 1 ? "" : "es"} 24h`,
      textoCls: "text-danger",
      borde: "border-danger/35 bg-danger/[0.03]",
    };
  if (!c.ultimo_evento)
    return {
      led: "bg-warn",
      glow: "led-glow-amber",
      texto: "sin eventos aún",
      textoCls: "text-warn",
      borde: "border-warn/25",
    };
  const horas = (Date.now() - new Date(c.ultimo_evento).getTime()) / 3600000;
  if (horas > 12)
    return {
      led: "bg-warn",
      glow: "led-glow-amber",
      texto: `sin actividad ${Math.floor(horas)} h`,
      textoCls: "text-warn",
      borde: "border-warn/25",
    };
  return {
    led: "bg-brand",
    glow: "led-glow-green",
    texto: "operativo",
    textoCls: "text-brand",
    borde: "border-line",
  };
}

export default function Clients({ clients }: { clients: ClientStats[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [nombre, setNombre] = useState("");
  const [rubro, setRubro] = useState("");
  const [plan, setPlan] = useState<Plan>("cotizador");
  const [workflowId, setWorkflowId] = useState("");
  const [saving, setSaving] = useState(false);

  const activos = clients.filter((c) => c.activo);
  const mrr = activos.reduce((a, c) => a + c.mensualidad, 0);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre || saving) return;
    setSaving(true);
    await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre,
        rubro: rubro || null,
        plan,
        workflow_id: workflowId || null,
      }),
    });
    setNombre("");
    setRubro("");
    setWorkflowId("");
    setShowForm(false);
    setSaving(false);
    router.refresh();
  }

  async function toggleActivo(c: ClientStats) {
    await fetch(`/api/clients/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !c.activo }),
    });
    router.refresh();
  }

  const maxUp = Math.max(
    1,
    ...clients.flatMap((c) => c.uptime.map((b) => b.n)),
  );

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="metric-card px-5 py-4">
          <span className="lbl">mrr actual </span>
          <span className="ml-3 font-mono text-2xl text-brand">{clp(mrr)}</span>
        </div>
        <div className="metric-card px-5 py-4">
          <span className="lbl">activos </span>
          <span className="ml-3 font-mono text-2xl">{activos.length}</span>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary ml-auto text-xs"
        >
          + cliente
        </button>
      </div>

      {showForm && (
        <form onSubmit={crear} className="panel-hot mb-5 flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-44 flex-1">
            <label className="lbl mb-1.5 block">nombre</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Imprenta Familiar"
              className="input"
            />
          </div>
          <div className="min-w-36">
            <label className="lbl mb-1.5 block">rubro</label>
            <input
              value={rubro}
              onChange={(e) => setRubro(e.target.value)}
              placeholder="imprenta"
              className="input"
            />
          </div>
          <div>
            <label className="lbl mb-1.5 block">plan</label>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value as Plan)}
              className="input"
            >
              {PLANES.map((p) => (
                <option key={p} value={p}>
                  {PLAN_LABEL[p]} — {clp(PLAN_PRECIOS[p].mensual)}/mes
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-40">
            <label className="lbl mb-1.5 block">workflow id (n8n)</label>
            <input
              value={workflowId}
              onChange={(e) => setWorkflowId(e.target.value)}
              placeholder="id del workflow del bot"
              className="input font-mono text-xs"
            />
          </div>
          <button type="submit" disabled={!nombre || saving} className="btn-primary text-xs">
            crear
          </button>
        </form>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {clients.map((c) => {
          const st = salud(c);
          const margen =
            c.mensualidad > 0
              ? Math.max(0, Math.round((1 - c.costo_mes / c.mensualidad) * 100))
              : null;
          return (
            <div key={c.id} className={`panel-hot border p-4 transition hover:-translate-y-0.5 ${st.borde}`}>
              <div className="flex items-center gap-2">
                <span className={`led ${st.led} ${st.glow}`} />
                <span className="flex-1 truncate text-[15px] font-semibold">
                  {c.nombre}
                </span>
                <span className="chip px-2 py-0 text-[10px]">{PLAN_LABEL[c.plan].toLowerCase()}</span>
              </div>

              <div className="relative mb-2 mt-4 flex items-center justify-between">
                <span className="lbl">actividad 24h</span>
                <span className={`font-mono text-[10px] ${st.textoCls}`}>
                  {st.texto}
                </span>
              </div>
              <div className="relative flex h-5 items-end gap-[3px]" aria-hidden="true">
                {c.uptime.map((b, i) => {
                  const cls = b.err
                    ? "bg-danger"
                    : b.n > 0
                      ? "bg-brand"
                      : "bg-surface-3";
                  const h = b.err
                    ? 20
                    : b.n > 0
                      ? 7 + Math.round((b.n / maxUp) * 13)
                      : 4;
                  return (
                    <span
                      key={i}
                      className={`w-[7px] rounded-[2px] ${cls}`}
                      style={{ height: h }}
                    />
                  );
                })}
              </div>

              <div className="relative mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="subpanel px-1 py-2">
                  <div className="font-mono text-sm">{c.mensajes_hoy}</div>
                  <div className="text-[9.5px] text-ink-dim">msjs hoy</div>
                </div>
                <div className="subpanel px-1 py-2">
                  <div className={`font-mono text-sm ${st.textoCls === "text-brand" ? "" : st.textoCls}`}>
                    {c.ultimo_evento ? timeAgo(c.ultimo_evento) : "—"}
                  </div>
                  <div className="text-[9.5px] text-ink-dim">últ. evento</div>
                </div>
                <div className="subpanel px-1 py-2">
                  <div className="font-mono text-sm">{clp(c.costo_mes)}</div>
                  <div className="text-[9.5px] text-ink-dim">costo mes</div>
                </div>
              </div>

              <div className="relative mt-4 flex items-center justify-between text-[11px]">
                <span className="text-ink-mut">
                  mensualidad{" "}
                  <span className="font-mono text-brand">{clp(c.mensualidad)}</span>
                </span>
                <span className="flex items-center gap-2">
                  {margen != null && (
                    <span className="font-mono text-[10px] text-ink-dim">
                      margen {margen}%
                    </span>
                  )}
                  <button onClick={() => toggleActivo(c)} className="btn-ghost px-2 py-0.5">
                    {c.activo ? "pausar" : "reactivar"}
                  </button>
                </span>
              </div>
            </div>
          );
        })}

        <button
          onClick={() => setShowForm(true)}
          className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-line2 bg-surface-3/30 text-xs text-ink-faint transition hover:border-brand/40 hover:bg-brand/10 hover:text-brand"
        >
          + nuevo cliente
        </button>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-ink-dim">
        El estado se alimenta de los eventos que envía n8n a{" "}
        <code className="rounded bg-surface-3 px-1">/api/hooks/bot-events</code>.
        Importa los workflows de la carpeta{" "}
        <code className="rounded bg-surface-3 px-1">n8n/</code> y asigna el
        workflow id a cada cliente.
      </p>
    </div>
  );
}
