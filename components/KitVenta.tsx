"use client";

import { useMemo, useState } from "react";
import { OBJECIONES, PREGUNTAS_DIAGNOSTICO } from "@/lib/venta";
import CalificacionICP from "./CalificacionICP";

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setOk(true);
          setTimeout(() => setOk(false), 1200);
        } catch {}
      }}
      className="btn-ghost shrink-0 px-2 py-0.5 text-[10px]"
    >
      {ok ? "Copiado ✓" : "Copiar"}
    </button>
  );
}

type Tab = "objeciones" | "diagnostico" | "calificar";

/** Kit de venta a mano: objeciones (buscables), diagnóstico y calificación ICP. */
export default function KitVenta() {
  const [tab, setTab] = useState<Tab>("objeciones");
  const [q, setQ] = useState("");

  const objs = useMemo(
    () =>
      q.trim()
        ? OBJECIONES.filter((o) =>
            `${o.gatillo} ${o.respuesta}`.toLowerCase().includes(q.toLowerCase()),
          )
        : OBJECIONES,
    [q],
  );

  const tabBtn = (id: Tab, label: string) => (
    <button
      onClick={() => setTab(id)}
      className={`chip ${tab === id ? "border-brand/40 bg-brand/10 text-brand" : ""}`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {tabBtn("objeciones", `Objeciones (${OBJECIONES.length})`)}
          {tabBtn("diagnostico", "Diagnóstico")}
          {tabBtn("calificar", "Calificar (ICP)")}
        </div>
        {tab === "objeciones" && (
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar — caro, socio, número, datos…"
            className="input max-w-xs py-1 text-xs"
          />
        )}
      </div>

      {tab === "objeciones" && (
        <div className="flex flex-col gap-1.5">
          {objs.map((o, i) => (
            <div key={i} className="rounded-lg border border-line bg-surface-2 px-3 py-2">
              <div className="flex items-start gap-2">
                <span className="flex-1 text-[12.5px] font-semibold text-ink">
                  “{o.gatillo}”
                </span>
                <CopyBtn text={o.respuesta} />
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-mut">{o.respuesta}</p>
            </div>
          ))}
          {objs.length === 0 && (
            <p className="text-[12px] text-ink-dim">Nada calza con “{q}”.</p>
          )}
        </div>
      )}

      {tab === "diagnostico" && (
        <div className="flex flex-col gap-1.5">
          <p className="mb-1 text-[11px] text-ink-dim">
            Preguntas para abrir y calificar la conversación (una a la vez).
          </p>
          {PREGUNTAS_DIAGNOSTICO.map((p, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2">
              <span className="flex-1 text-[12.5px] text-ink-soft">{p}</span>
              <CopyBtn text={p} />
            </div>
          ))}
        </div>
      )}

      {tab === "calificar" && <CalificacionICP />}
    </div>
  );
}
