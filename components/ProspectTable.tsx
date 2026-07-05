"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ESTADO_CONFIG,
  ESTADO_OPTIONS,
  type Estado,
  type Prospect,
} from "@/lib/types";

function scoreCls(score: number) {
  if (score >= 70) return { text: "text-brand", bar: "bg-brand" };
  if (score >= 40) return { text: "text-warn", bar: "bg-warn" };
  return { text: "text-ink-dim", bar: "bg-ink-faint" };
}

const ESTADO_PILL: Record<Estado, string> = {
  nuevo: "border-accent/40 text-accent",
  contactado: "border-warn/40 text-warn",
  respondio: "border-brand/40 text-brand",
  reunion: "border-brand/40 text-brand",
  en_pipeline: "border-line2 text-ink-mut",
  descartado: "border-line text-ink-faint",
};

export default function ProspectTable({
  prospects,
}: {
  prospects: Prospect[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<Prospect[]>(prospects);
  const [filtro, setFiltro] = useState<Estado | "todos">("todos");
  const [q, setQ] = useState("");
  const [copiado, setCopiado] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [estadoError, setEstadoError] = useState<string | null>(null);

  useEffect(() => {
    setItems(prospects);
  }, [prospects]);

  const filtrados = items.filter(
    (p) =>
      (filtro === "todos" || p.estado === filtro) &&
      (q === "" ||
        `${p.nombre} ${p.rubro} ${p.comuna}`
          .toLowerCase()
          .includes(q.toLowerCase())),
  );

  async function cambiarEstado(id: string, estado: Estado) {
    const anterior = items.find((p) => p.id === id);
    setEstadoError(null);
    setItems((actuales) =>
      actuales.map((p) => (p.id === id ? { ...p, estado } : p)),
    );

    try {
      const res = await fetch(`/api/prospects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado }),
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

  async function copiarMensaje(p: Prospect) {
    if (!p.mensaje) return;
    await navigator.clipboard.writeText(p.mensaje);
    setCopiado(p.id);
    setTimeout(() => setCopiado(null), 1500);
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
          placeholder="Filtrar…"
          className="input w-56 py-2 text-xs"
        />
        <div className="flex flex-wrap gap-1">
          {[{ value: "todos" as const, label: "Todos" }, ...ESTADO_OPTIONS].map(
            (estado) => (
            <button
              key={estado.value}
              onClick={() => setFiltro(estado.value)}
              className={`chip transition ${
                filtro === estado.value
                  ? "border-brand/50 bg-brand/10 text-brand"
                  : "hover:text-ink"
              }`}
            >
              {estado.label}
            </button>
            ),
          )}
        </div>
        <span className="ml-auto font-mono text-[11px] text-ink-dim">
          {filtrados.length} Prospectos
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
                            Sin Web
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
                        <button
                          onClick={() => copiarMensaje(p)}
                          disabled={!p.mensaje}
                          className="btn-ghost"
                        >
                          {copiado === p.id ? "Copiado" : "Copiar Mensaje"}
                        </button>
                        <button
                          onClick={() => setAbierto(abierto === p.id ? null : p.id)}
                          disabled={!p.mensaje}
                          className="btn-ghost"
                        >
                          Ver
                        </button>
                        {p.estado !== ESTADO_CONFIG.en_pipeline.value && (
                          <button
                            onClick={() => aPipeline(p)}
                            className="rounded-lg border border-brand/40 bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand transition hover:bg-brand/20"
                          >
                            → Pipeline
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {abierto === p.id && p.mensaje && (
                    <tr>
                      <td colSpan={5} className="px-3 pb-3 pt-0">
                        <div className="ml-12 max-w-2xl border-l-2 border-brand bg-surface-3/80 px-5 py-4 text-sm leading-relaxed text-ink-soft shadow-glow">
                          <p className="whitespace-pre-wrap">{p.mensaje}</p>
                          <p className="mt-2 text-[10.5px] text-warn">
                            Envío manual desde tu WhatsApp Business — nunca por
                            Cloud API
                          </p>
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
                  Sin prospectos. Busca un rubro + comuna arriba para partir.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
