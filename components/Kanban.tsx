"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clp } from "@/lib/format";
import {
  ETAPAS,
  ETAPA_LABEL,
  PLANES,
  PLAN_LABEL,
  PLAN_PRECIOS,
  type Deal,
  type Etapa,
  type Plan,
} from "@/lib/types";

const COL_HEAD: Record<Etapa, string> = {
  contactado: "text-ink-dim",
  demo: "text-accent",
  propuesta: "text-warn",
  cliente: "text-brand",
  perdido: "text-ink-faint",
};

const COL_CARD: Record<Etapa, string> = {
  contactado: "border-line",
  demo: "border-accent/25",
  propuesta: "border-warn/25",
  cliente: "border-brand/40 bg-brand/[0.04]",
  perdido: "border-line opacity-60",
};

const SEGMENTOS: { etapa: Etapa; cls: string }[] = [
  { etapa: "contactado", cls: "bg-[#2C3540]" },
  { etapa: "demo", cls: "bg-accent" },
  { etapa: "propuesta", cls: "bg-warn" },
  { etapa: "cliente", cls: "bg-brand" },
];

export default function Kanban({ deals }: { deals: Deal[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [nombre, setNombre] = useState("");
  const [plan, setPlan] = useState<Plan>("cotizador");
  const [saving, setSaving] = useState(false);

  const activos = deals.filter((d) =>
    ["contactado", "demo", "propuesta"].includes(d.etapa),
  );
  const mrrProyectado = activos.reduce((a, d) => a + d.valor_mensual, 0);
  const mrrCerrado = deals
    .filter((d) => d.etapa === "cliente")
    .reduce((a, d) => a + d.valor_mensual, 0);
  const totalSegm = SEGMENTOS.reduce(
    (a, s) => a + deals.filter((d) => d.etapa === s.etapa).length,
    0,
  );

  async function mover(deal: Deal, dir: -1 | 1) {
    const idx = ETAPAS.indexOf(deal.etapa);
    const destino = ETAPAS[idx + dir];
    if (!destino) return;
    await fetch(`/api/deals/${deal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ etapa: destino }),
    });
    router.refresh();
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre || saving) return;
    setSaving(true);
    await fetch("/api/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre_negocio: nombre, plan }),
    });
    setNombre("");
    setShowForm(false);
    setSaving(false);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.3fr_auto]">
        <div className="metric-card px-5 py-4">
          <div className="lbl">mrr proyectado</div>
          <div className="mt-2 font-mono text-3xl leading-none text-brand">
            {clp(mrrProyectado)}
          </div>
        </div>
        <div className="metric-card px-5 py-4">
          <div className="lbl">mrr cerrado</div>
          <div className="mt-2 font-mono text-3xl leading-none">{clp(mrrCerrado)}</div>
        </div>
        <div className="metric-card px-5 py-4">
          <div className="lbl mb-2.5">avance por etapa</div>
          {totalSegm === 0 ? (
            <div className="h-[8px] rounded-full bg-surface-3" />
          ) : (
            <div className="flex h-[8px] gap-[3px] overflow-hidden rounded-full" aria-hidden="true">
              {SEGMENTOS.map((s) => {
                const n = deals.filter((d) => d.etapa === s.etapa).length;
                if (n === 0) return null;
                return <span key={s.etapa} className={`${s.cls} shadow-cyan`} style={{ flex: n }} />;
              })}
            </div>
          )}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary self-center text-xs"
        >
          + oportunidad
        </button>
      </div>

      {showForm && (
        <form onSubmit={crear} className="panel-hot mb-5 flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-48 flex-1">
            <label className="lbl mb-1.5 block">negocio</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre del negocio"
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
                  {PLAN_LABEL[p]} — {clp(PLAN_PRECIOS[p].setup)} +{" "}
                  {clp(PLAN_PRECIOS[p].mensual)}/mes
                </option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={!nombre || saving} className="btn-primary text-xs">
            crear
          </button>
        </form>
      )}

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        {ETAPAS.map((etapa) => {
          const cards = deals.filter((d) => d.etapa === etapa);
          return (
            <div key={etapa}>
              <div className="mb-2 flex items-baseline justify-between rounded-lg border border-line bg-surface-3/45 px-3 py-2">
                <span className={`lbl ${COL_HEAD[etapa]}`}>
                  {ETAPA_LABEL[etapa].toLowerCase()}
                </span>
                <span className="font-mono text-[10px] text-ink-faint">
                  {cards.length}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {cards.map((d) => (
                  <div
                    key={d.id}
                    className={`group rounded-xl border bg-surface-3/75 p-3.5 shadow-card transition hover:-translate-y-0.5 hover:border-accent/35 ${COL_CARD[etapa]}`}
                  >
                    <div className="truncate text-[14px] font-semibold leading-tight text-ink">
                      {d.nombre_negocio}
                    </div>
                    <span
                      className={`chip mt-2 px-2 py-0.5 text-[10px] ${
                        etapa === "cliente" ? "border-brand/30 text-brand" : ""
                      }`}
                    >
                      {PLAN_LABEL[d.plan].toLowerCase()}
                    </span>
                    <div className="mt-3 font-mono text-[15px] text-brand">
                      {clp(d.valor_mensual)}
                      <span className="text-ink-dim">/m</span>
                    </div>
                    <div className="font-mono text-[9.5px] text-ink-faint">
                      setup {clp(d.valor_setup)}
                    </div>
                    {d.proxima_accion && (
                      <div className="mt-2.5 rounded-lg border border-line bg-surface-2/80 px-2 py-1.5 text-[11px] text-ink-mut">
                        → {d.proxima_accion}
                      </div>
                    )}
                    <div className="mt-3 flex justify-between opacity-80 transition group-hover:opacity-100">
                      <button
                        onClick={() => mover(d, -1)}
                        disabled={etapa === ETAPAS[0]}
                        className="btn-ghost px-2 py-0.5"
                        aria-label="mover a la etapa anterior"
                      >
                        ←
                      </button>
                      <button
                        onClick={() => mover(d, 1)}
                        disabled={etapa === ETAPAS[ETAPAS.length - 1]}
                        className="btn-ghost px-2 py-0.5"
                        aria-label="mover a la etapa siguiente"
                      >
                        →
                      </button>
                    </div>
                  </div>
                ))}
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
        Cuando un deal llegue a <span className="text-brand">cliente</span>,
        créalo también en{" "}
        <a href="/clientes" className="text-brand underline">
          clientes & bots
        </a>{" "}
        para monitorear su bot y su mensualidad.
      </p>
    </div>
  );
}
