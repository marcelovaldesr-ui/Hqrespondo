"use client";

import { useState } from "react";
import {
  PASOS,
  VIAS,
  VIA_LABEL,
  asuntoRespaldo,
  recordatorios,
  type Via,
} from "@/lib/agendamiento";

/**
 * Protocolo de reunión agendada — la Guía de Agendamiento, viva.
 *
 * Se abre desde la tarjeta del deal cuando está en "Reunión agendada". Pide lo
 * mínimo (fecha, hora, link) y devuelve los 4 recordatorios con el texto ya
 * armado y listo para copiar.
 */
export default function ProtocoloReunion({
  empresa,
  contacto,
  onCerrar,
}: {
  empresa: string;
  contacto?: string;
  onCerrar: () => void;
}) {
  const [via, setVia] = useState<Via>("tibio");
  const [nombre, setNombre] = useState(contacto ?? "");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [link, setLink] = useState("");
  const [hechos, setHechos] = useState<Record<string, boolean>>({});
  const [copiado, setCopiado] = useState<string | null>(null);

  const recs = recordatorios({ nombre, fecha, hora, link, via });

  async function copiar(clave: string, texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(clave);
      setTimeout(() => setCopiado(null), 1200);
    } catch { /* sin portapapeles: el texto igual está a la vista para seleccionarlo */ }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
      onClick={onCerrar}
    >
      <div className="glass my-6 w-full max-w-2xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="lbl">Protocolo de reunión agendada</div>
            <div className="ttl mt-1 text-[15px]">{empresa}</div>
          </div>
          <button className="btn-ghost" onClick={onCerrar}>
            Cerrar
          </button>
        </div>

        {/* Vía: cambia los pasos, no solo el texto */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {VIAS.map((v) => (
            <button
              key={v}
              onClick={() => setVia(v)}
              className={`rounded-lg border px-3 py-1.5 text-[12px] transition ${
                via === v
                  ? "border-brand/50 bg-brand/10 text-ink"
                  : "border-line2 bg-surface-3 text-ink-mut hover:text-ink"
              }`}
            >
              {VIA_LABEL[v]}
            </button>
          ))}
        </div>

        {/* Datos mínimos */}
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <input
            className="input !py-1.5 text-xs"
            placeholder="Nombre del contacto"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
          <input
            className="input !py-1.5 text-xs"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
          <input
            className="input !py-1.5 text-xs"
            placeholder="Hora (ej. 15:30)"
            value={hora}
            onChange={(e) => setHora(e.target.value)}
          />
          <input
            className="input !py-1.5 text-xs"
            placeholder="Link de la reunión"
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
        </div>

        {/* Pasos únicos */}
        <div className="mt-4">
          <div className="lbl mb-2">Al agendar — una sola vez</div>
          <ul className="space-y-1">
            {PASOS[via].map((paso, i) => (
              <li key={i}>
                <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-line bg-surface-3/60 px-3 py-2">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={!!hechos[`${via}-${i}`]}
                    onChange={(e) =>
                      setHechos((h) => ({ ...h, [`${via}-${i}`]: e.target.checked }))
                    }
                  />
                  <span
                    className={`text-[12.5px] leading-relaxed ${
                      hechos[`${via}-${i}`] ? "text-ink-faint line-through" : "text-ink-soft"
                    }`}
                  >
                    {paso}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {via === "frio" && (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-line bg-surface-4/60 px-3 py-2">
              <span className="lbl shrink-0">Asunto</span>
              <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-ink-soft">
                {asuntoRespaldo(empresa, nombre)}
              </span>
              <button
                className="btn-ghost"
                onClick={() => copiar("asunto", asuntoRespaldo(empresa, nombre))}
              >
                {copiado === "asunto" ? "✓" : "Copiar"}
              </button>
            </div>
          )}
        </div>

        {/* Recordatorios */}
        <div className="mt-4">
          <div className="lbl mb-2">Los 4 recordatorios — programarlos todos ahora</div>
          <div className="space-y-2">
            {recs.map((r) => (
              <div key={r.clave} className="rounded-lg border border-line bg-surface-3/60 p-3">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!hechos[r.clave]}
                      onChange={(e) => setHechos((h) => ({ ...h, [r.clave]: e.target.checked }))}
                    />
                    <span className="text-[12.5px] font-medium text-ink">{r.cuando}</span>
                    {r.llevaLink && !link.trim() && (
                      <span className="chip border-warn/40 text-warn">falta el link</span>
                    )}
                  </span>
                  <button className="btn-ghost" onClick={() => copiar(r.clave, r.texto)}>
                    {copiado === r.clave ? "Copiado ✓" : "Copiar"}
                  </button>
                </div>
                {r.ojo && (
                  <p className="mb-1.5 text-[11px] leading-relaxed text-warn">⚠ {r.ojo}</p>
                )}
                <pre className="whitespace-pre-wrap font-sans text-[12px] leading-relaxed text-ink-mut">
                  {r.texto}
                </pre>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-3 text-[10.5px] leading-relaxed text-ink-faint">
          Los recordatorios se copian y se programan en el canal donde vive la conversación.
          La casilla marcada es solo tu ayuda-memoria de esta sesión: no se guarda.
        </p>
      </div>
    </div>
  );
}
