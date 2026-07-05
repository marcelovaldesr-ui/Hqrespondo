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
  cliente: "text-ok",
  perdido: "text-ink-faint",
};

const COL_CARD: Record<Etapa, string> = {
  contactado: "border-line",
  demo: "border-accent/25",
  propuesta: "border-warn/25",
  cliente: "border-ok/40 bg-ok/[0.03]",
  perdido: "border-line opacity-60",
};

const SEGMENTOS: { etapa: Etapa; cls: string }[] = [
  { etapa: "contactado", cls: "bg-ink-faint" },
  { etapa: "demo", cls: "bg-accent" },
  { etapa: "propuesta", cls: "bg-warn" },
  { etapa: "cliente", cls: "bg-ok" },
];

interface DealDraft {
  nombre_negocio: string;
  plan: Plan;
  valor_setup: string;
  valor_mensual: string;
  proxima_accion: string;
  notas: string;
}

export default function Kanban({ deals }: { deals: Deal[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [nombre, setNombre] = useState("");
  const [plan, setPlan] = useState<Plan>("cotizador");
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DealDraft | null>(null);

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

  function empezarEdicion(d: Deal) {
    setEditId(d.id);
    setDraft({
      nombre_negocio: d.nombre_negocio,
      plan: d.plan,
      valor_setup: String(d.valor_setup),
      valor_mensual: String(d.valor_mensual),
      proxima_accion: d.proxima_accion ?? "",
      notas: d.notas ?? "",
    });
  }

  async function guardarEdicion(id: string) {
    if (!draft || saving) return;
    setSaving(true);
    await fetch(`/api/deals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre_negocio: draft.nombre_negocio,
        plan: draft.plan,
        valor_setup: Number(draft.valor_setup) || 0,
        valor_mensual: Number(draft.valor_mensual) || 0,
        proxima_accion: draft.proxima_accion || null,
        notas: draft.notas || null,
      }),
    });
    setSaving(false);
    setEditId(null);
    router.refresh();
  }

  async function eliminar(d: Deal) {
    if (!confirm(`¿Eliminar la oportunidad "${d.nombre_negocio}"?`)) return;
    await fetch(`/api/deals/${d.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div>
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.3fr_auto]">
        <div className="metric-card px-5 py-4">
          <div className="lbl">MRR proyectado</div>
          <div className="mt-2 font-mono text-3xl leading-none text-ok">
            {clp(mrrProyectado)}
          </div>
        </div>
        <div className="metric-card px-5 py-4">
          <div className="lbl">MRR cerrado</div>
          <div className="mt-2 font-mono text-3xl leading-none">{clp(mrrCerrado)}</div>
        </div>
        <div className="metric-card px-5 py-4">
          <div className="lbl mb-2.5">Avance por etapa</div>
          {totalSegm === 0 ? (
            <div className="h-[8px] rounded-full bg-surface-3" />
          ) : (
            <div className="flex h-[8px] gap-[3px] overflow-hidden rounded-full" aria-hidden="true">
              {SEGMENTOS.map((s) => {
                const n = deals.filter((d) => d.etapa === s.etapa).length;
                if (n === 0) return null;
                return <span key={s.etapa} className={s.cls} style={{ flex: n }} />;
              })}
            </div>
          )}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary self-center text-xs"
        >
          + Oportunidad
        </button>
      </div>

      {showForm && (
        <form onSubmit={crear} className="panel-hot mb-5 flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-48 flex-1">
            <label className="lbl mb-1.5 block">Negocio</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre del negocio"
              className="input"
            />
          </div>
          <div>
            <label className="lbl mb-1.5 block">Plan</label>
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
            Crear
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
                  {ETAPA_LABEL[etapa]}
                </span>
                <span className="font-mono text-[10px] text-ink-faint">
                  {cards.length}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {cards.map((d) => {
                  if (editId === d.id && draft) {
                    return (
                      <div key={d.id} className="rounded-xl border border-accent/40 bg-surface-2 p-3 shadow-card">
                        <div className="flex flex-col gap-2">
                          <input
                            value={draft.nombre_negocio}
                            onChange={(e) => setDraft({ ...draft, nombre_negocio: e.target.value })}
                            placeholder="Nombre del negocio"
                            className="input text-xs"
                          />
                          <select
                            value={draft.plan}
                            onChange={(e) => setDraft({ ...draft, plan: e.target.value as Plan })}
                            className="input px-2 text-xs"
                          >
                            {PLANES.map((p) => (
                              <option key={p} value={p}>{PLAN_LABEL[p]}</option>
                            ))}
                          </select>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="number"
                              value={draft.valor_setup}
                              onChange={(e) => setDraft({ ...draft, valor_setup: e.target.value })}
                              placeholder="Setup CLP"
                              className="input px-2 text-xs"
                              aria-label="Valor setup"
                            />
                            <input
                              type="number"
                              value={draft.valor_mensual}
                              onChange={(e) => setDraft({ ...draft, valor_mensual: e.target.value })}
                              placeholder="Mensual CLP"
                              className="input px-2 text-xs"
                              aria-label="Valor mensual"
                            />
                          </div>
                          <input
                            value={draft.proxima_accion}
                            onChange={(e) => setDraft({ ...draft, proxima_accion: e.target.value })}
                            placeholder="Próxima acción"
                            className="input px-2 text-xs"
                          />
                          <input
                            value={draft.notas}
                            onChange={(e) => setDraft({ ...draft, notas: e.target.value })}
                            placeholder="Notas"
                            className="input px-2 text-xs"
                          />
                        </div>
                        <div className="mt-2.5 flex justify-between gap-2">
                          <button
                            onClick={() => eliminar(d)}
                            className="btn-ghost px-2.5 py-1 hover:border-danger/40 hover:bg-danger/10 hover:text-danger"
                          >
                            Eliminar
                          </button>
                          <span className="flex gap-2">
                            <button onClick={() => setEditId(null)} className="btn-ghost px-2.5 py-1">
                              Cancelar
                            </button>
                            <button
                              onClick={() => guardarEdicion(d.id)}
                              disabled={saving || !draft.nombre_negocio.trim()}
                              className="btn-primary px-3 py-1 text-xs"
                            >
                              Guardar
                            </button>
                          </span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={d.id}
                      className={`group rounded-xl border bg-surface-2 p-3.5 shadow-card transition hover:border-line2 ${COL_CARD[etapa]}`}
                    >
                      <div className="truncate text-[14px] font-semibold leading-tight text-ink">
                        {d.nombre_negocio}
                      </div>
                      <span
                        className={`chip mt-2 px-2 py-0.5 text-[10px] ${
                          etapa === "cliente" ? "border-ok/30 text-ok" : ""
                        }`}
                      >
                        {PLAN_LABEL[d.plan]}
                      </span>
                      <div className="mt-3 font-mono text-[15px] text-ok">
                        {clp(d.valor_mensual)}
                        <span className="text-ink-dim">/m</span>
                      </div>
                      <div className="font-mono text-[9.5px] text-ink-faint">
                        Setup {clp(d.valor_setup)}
                      </div>
                      {d.proxima_accion && (
                        <div className="mt-2.5 rounded-lg bg-surface-3/70 px-2 py-1.5 text-[11px] text-ink-mut">
                          → {d.proxima_accion}
                        </div>
                      )}
                      <div className="mt-3 hidden items-center justify-between gap-1.5 group-hover:flex">
                        <button
                          onClick={() => mover(d, -1)}
                          disabled={etapa === ETAPAS[0]}
                          className="btn-ghost px-2 py-0.5"
                          aria-label="Mover a la etapa anterior"
                        >
                          ←
                        </button>
                        <button
                          onClick={() => empezarEdicion(d)}
                          className="btn-ghost px-2 py-0.5"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => mover(d, 1)}
                          disabled={etapa === ETAPAS[ETAPAS.length - 1]}
                          className="btn-ghost px-2 py-0.5"
                          aria-label="Mover a la etapa siguiente"
                        >
                          →
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
        Cuando un deal llegue a <span className="text-ok">Cliente</span>,
        créalo también en{" "}
        <a href="/clientes" className="text-brand underline">
          Clientes & Bots
        </a>{" "}
        para monitorear su bot y su mensualidad.
      </p>
    </div>
  );
}
