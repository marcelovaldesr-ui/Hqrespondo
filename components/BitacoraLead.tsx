"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * La historia de un lead: cuántas veces se le llamó, qué contestaron, y qué
 * quedó pendiente.
 *
 * Por qué existe separado de las Notas: la nota es un párrafo que crece y se
 * vuelve ilegible a la quinta llamada. Esto son eventos con fecha, autor y
 * desenlace — se puede leer en diez segundos antes de marcar, que es cuando
 * realmente se necesita.
 *
 * El "próximo paso" está aparte del recordatorio a propósito: el recordatorio
 * dice CUÁNDO volver, esto dice QUÉ hacer. Un compromiso sin las dos cosas se
 * pierde igual.
 */

type Evento = {
  id: string;
  canal: string;
  tipo: string;
  resultado: string;
  nota: string;
  actor: string;
  created_at: string;
};

type Resumen = {
  intentos: number;
  registrados: number;
  contestaron: number;
  sin_contestar: number;
  ultimo_intento: string | null;
  ultimo_resultado: string | null;
  proximo_paso: string | null;
  proximo_paso_at: string | null;
  creado: string | null;
  creado_por: string | null;
};

const RESULTADO_LABEL: Record<string, string> = {
  contactado: "Habló",
  no_contesto: "No contestó",
  gatekeeper: "Filtró la recepción",
  numero_malo: "Número malo",
  interesado: "Interesado",
  seguimiento: "Seguimiento",
  no_interesa: "No le interesa",
  fuera_icp: "Fuera de perfil",
  enviado: "Enviado",
};

const TONO: Record<string, string> = {
  interesado: "text-ok",
  contactado: "text-ok",
  no_interesa: "text-danger",
  numero_malo: "text-danger",
  fuera_icp: "text-ink-mut",
  no_contesto: "text-ink-mut",
  gatekeeper: "text-warn",
  seguimiento: "text-warn",
};

const CANAL_ICONO: Record<string, string> = {
  llamada: "📞",
  whatsapp: "💬",
  email: "✉️",
  reunion: "🤝",
  otro: "•",
};

function cuando(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-CL", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export default function BitacoraLead({ leadId }: { leadId: string }) {
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paso, setPaso] = useState("");
  const [guardandoPaso, setGuardandoPaso] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const r = await fetch(`/api/foco/bitacora?id=${encodeURIComponent(leadId)}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "no se pudo leer la bitácora");
      setResumen(j.resumen);
      setEventos(j.eventos ?? []);
      setPaso(j.resumen?.proximo_paso ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  }, [leadId]);

  useEffect(() => { void cargar(); }, [cargar]);

  async function guardarPaso() {
    if (guardandoPaso || paso === (resumen?.proximo_paso ?? "")) return;
    setGuardandoPaso(true);
    try {
      await fetch("/api/foco", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: leadId,
          proximo_paso: paso,
          proximo_paso_at: paso ? new Date().toISOString() : null,
        }),
      });
      setResumen((r) => (r ? { ...r, proximo_paso: paso } : r));
    } catch {
      /* queda en pantalla; el próximo blur reintenta */
    } finally {
      setGuardandoPaso(false);
    }
  }

  return (
    <div className="mt-3">
      <div className="hairline my-3" />
      <div className="flex items-center justify-between">
        <div className="lbl">Historial</div>
        <button
          className="text-[10.5px] text-ink-faint underline hover:text-ink-mut"
          onClick={() => void cargar()}
        >
          actualizar
        </button>
      </div>

      {/* ---------- Resumen de un vistazo ---------- */}
      {resumen && (
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          <div className="rounded-md border border-line2 px-2 py-1.5 text-center">
            <div className="font-mono text-[15px] leading-none text-ink">{resumen.intentos}</div>
            <div className="mt-1 text-[9.5px] uppercase tracking-wider text-ink-faint">llamadas</div>
          </div>
          <div className="rounded-md border border-line2 px-2 py-1.5 text-center">
            <div className="font-mono text-[15px] leading-none text-ok">{resumen.contestaron}</div>
            <div className="mt-1 text-[9.5px] uppercase tracking-wider text-ink-faint">contestaron</div>
          </div>
          <div className="rounded-md border border-line2 px-2 py-1.5 text-center">
            <div
              className={`font-mono text-[15px] leading-none ${resumen.sin_contestar >= 2 ? "text-warn" : "text-ink"}`}
            >
              {resumen.sin_contestar}
            </div>
            <div className="mt-1 text-[9.5px] uppercase tracking-wider text-ink-faint">seguidas sin</div>
          </div>
        </div>
      )}

      {/* ---------- Quién lo agregó ---------- */}
      {resumen && (
        <div className="mt-1.5 text-[10.5px] text-ink-faint">
          {resumen.creado_por
            ? <>Agregado por <b className="text-ink-mut">{resumen.creado_por}</b></>
            : <>Origen desconocido (anterior al registro de autor)</>}
          {resumen.creado ? ` · ${new Date(resumen.creado).toLocaleDateString("es-CL")}` : ""}
        </div>
      )}

      {/* ---------- Próximo paso ---------- */}
      <label className="mt-2.5 block">
        <span className="lbl mb-1 block">Próximo paso</span>
        <input
          className="input text-[12px]"
          placeholder="Volver a llamar el lunes y preguntar por la dueña…"
          value={paso}
          onChange={(e) => setPaso(e.target.value)}
          onBlur={guardarPaso}
        />
      </label>

      {/* ---------- Línea de tiempo ---------- */}
      <div className="mt-3 space-y-1.5">
        {cargando && <div className="text-[11.5px] text-ink-faint">Cargando…</div>}
        {error && <div className="text-[11.5px] text-danger">{error}</div>}

        {!cargando && !error && eventos.length === 0 && (
          <div className="rounded-md border border-dashed border-line2 px-2.5 py-2 text-[11px] leading-relaxed text-ink-faint">
            Todavía no hay eventos registrados para este lead.
            {resumen && resumen.intentos > 0 && (
              <>
                {" "}Ojo: figura con <b className="text-ink-mut">{resumen.intentos} intento(s)</b> de
                antes. El historial detallado empieza a guardarse desde ahora — lo anterior quedó
                registrado sin apuntar a qué lead y no se puede atribuir sin adivinar.
              </>
            )}
          </div>
        )}

        {eventos.map((ev) => (
          <div key={ev.id} className="rounded-md border border-line2 px-2.5 py-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className={`text-[11.5px] font-medium ${TONO[ev.resultado] ?? "text-ink-soft"}`}>
                {CANAL_ICONO[ev.canal] ?? "•"} {RESULTADO_LABEL[ev.resultado] ?? ev.resultado}
              </span>
              <span className="shrink-0 font-mono text-[10px] text-ink-faint">
                {cuando(ev.created_at)}
              </span>
            </div>
            {ev.nota && (
              <div className="mt-0.5 text-[11.5px] leading-snug text-ink-mut">{ev.nota}</div>
            )}
            {ev.actor && (
              <div className="mt-0.5 text-[10px] text-ink-faint">— {ev.actor}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
