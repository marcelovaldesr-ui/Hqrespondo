"use client";

import { useState } from "react";
import { CALIFICACION_ICP } from "@/lib/venta";

/**
 * Checklist de calificación ICP: en 30 segundos decide si vale la pena invertir
 * tiempo en este prospecto. No se guarda (es una ayuda de decisión durante la
 * conversación); si falla en varios, descartar sin culpa.
 */
export default function CalificacionICP() {
  const [ok, setOk] = useState<Record<string, boolean>>({});
  const total = CALIFICACION_ICP.length;
  const pasan = Object.values(ok).filter(Boolean).length;

  const verdicto =
    pasan >= 4
      ? { t: "Buen prospecto — dale prioridad", c: "text-ok" }
      : pasan >= 3
        ? { t: "Prospecto OK — vale intentarlo", c: "text-ok" }
        : pasan >= 2
          ? { t: "Dudoso — solo si sobra capacidad", c: "text-warn" }
          : { t: "Descartar — no gastes tiempo acá", c: "text-danger" };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[12px] text-ink-dim">
          Marca lo que cumple ({pasan}/{total})
        </span>
        <span className={`text-[12.5px] font-semibold ${verdicto.c}`}>{verdicto.t}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {CALIFICACION_ICP.map((c) => (
          <label
            key={c.clave}
            className="flex cursor-pointer items-start gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2"
          >
            <input
              type="checkbox"
              checked={!!ok[c.clave]}
              onChange={(e) => setOk((s) => ({ ...s, [c.clave]: e.target.checked }))}
              className="mt-0.5"
            />
            <span className="flex-1">
              <span className="text-[12.5px] text-ink">{c.pregunta}</span>
              <span className="mt-0.5 block text-[10.5px] leading-relaxed text-ink-dim">
                ✓ {c.bueno} · ✗ {c.malo}
              </span>
            </span>
          </label>
        ))}
      </div>
      <p className="mt-2 text-[10.5px] text-ink-dim">
        Regla: si recibe menos de 15 consultas/día o ya tiene un software que resuelve la
        conversación, descártalo sin insistir. El tiempo de 2 fundadores no alcanza para evangelizar.
      </p>
    </div>
  );
}
