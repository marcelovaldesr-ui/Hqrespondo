"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Isabel — chat de la 4ª empleada.
 *
 * DECISIONES
 * · La conversación persiste en localStorage: cerrar la pestaña no mata el
 *   hilo, pero cada socio tiene el suyo (es SU colega, no un canal público).
 * · Los accesos rápidos no son adorno: son las 4 preguntas que el equipo se
 *   hace todos los días, para que el primer uso no parta de una caja vacía.
 * · Mientras Isabel responde, el input queda deshabilitado: dos preguntas en
 *   vuelo llegarían desordenadas y la conversación quedaría incoherente.
 */

interface Msg {
  de: "yo" | "isabel";
  texto: string;
}

const LLAVE = "hq_isabel_chat";

const RAPIDAS = [
  "¿Cómo vamos esta semana? Dame el resumen con números.",
  "Prepárame la próxima llamada: gancho de apertura y objeciones probables.",
  "Redáctame un WhatsApp de seguimiento para un lead que quedó de responder.",
  "¿Qué debería priorizar hoy según la base?",
];

const BIENVENIDA: Msg = {
  de: "isabel",
  texto:
    "Hola, soy Isabel — la cuarta del equipo. Tengo a la vista los precios, el ICP, las objeciones aprobadas y la foto viva de la base: leads, marcador, pipeline y objetivos de la semana. Pregúntame lo que sea del negocio, pídeme redactar mensajes o preparar una llamada. ¿En qué estamos hoy?",
};

export default function Isabel() {
  const [msgs, setMsgs] = useState<Msg[]>([BIENVENIDA]);
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fondo = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    try {
      const g = window.localStorage.getItem(LLAVE);
      if (g) {
        const p = JSON.parse(g) as Msg[];
        if (Array.isArray(p) && p.length) setMsgs(p);
      }
    } catch { /* hilo nuevo */ }
  }, []);

  useEffect(() => {
    // El estado "solo la bienvenida" NUNCA se guarda. No es una optimización:
    // React StrictMode ejecuta los efectos dos veces en desarrollo, y guardar
    // ese estado inicial pisaba el hilo real en localStorage antes de que la
    // segunda pasada del efecto de carga alcanzara a leerlo — chat amnésico
    // tras cada recarga. (Borrar la conversación limpia la llave aparte.)
    const soloBienvenida = msgs.length === 1 && msgs[0] === BIENVENIDA;
    if (!soloBienvenida) {
      try {
        window.localStorage.setItem(LLAVE, JSON.stringify(msgs.slice(-40)));
      } catch { /* sin persistencia, el chat igual funciona */ }
    }
    fondo.current?.scrollTo({ top: fondo.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  /**
   * Pide la respuesta para una historia dada. Separado de `enviar` a propósito:
   * el botón Reintentar de la primera versión volvía a llamar a enviar() con
   * el texto fallido, y como el estado de React es asíncrono, la pregunta
   * quedaba DOS veces en el hilo. Reintentar ahora re-consulta con la historia
   * tal como está — la pregunta ya vive ahí.
   */
  async function pedir(historia: Msg[]) {
    setPensando(true);
    setError(null);
    try {
      // El filtro de la bienvenida compara por TEXTO, no por identidad: tras
      // recargar, el mensaje viene parseado de localStorage y es otro objeto.
      const paraApi = historia.filter((m) => m.texto !== BIENVENIDA.texto);
      const actor = window.localStorage.getItem("hq_quien_llama") ?? "";
      const r = await fetch("/api/isabel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensajes: paraApi, actor }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ?? `HTTP ${r.status}`);
      setMsgs((m) => [...m, { de: "isabel", texto: j.texto }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      // La pregunta NO se pierde: queda en el hilo, Reintentar re-consulta.
    } finally {
      setPensando(false);
      inputRef.current?.focus();
    }
  }

  async function enviar(txt?: string) {
    const t = (txt ?? texto).trim();
    if (!t || pensando) return;
    setTexto("");
    const historia: Msg[] = [...msgs, { de: "yo", texto: t }];
    setMsgs(historia);
    await pedir(historia);
  }

  function borrar() {
    setMsgs([BIENVENIDA]);
    setError(null);
    try { window.localStorage.removeItem(LLAVE); } catch { /* da igual */ }
  }

  return (
    <div>
      {/* ---------- Encabezado ---------- */}
      <div className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex shrink-0 flex-col gap-[3px]" aria-hidden="true">
              <span className="block h-[3px] w-4 rounded-full bg-brand" />
              <span className="block h-[3px] w-2.5 rounded-full bg-coral/70" />
            </span>
            <h1 className="ttl truncate text-[17px] leading-tight">Isabel</h1>
            <span className="hidden border-l border-line2 pl-3 font-mono text-[11px] uppercase tracking-[0.13em] text-ink-mut sm:inline">
              La 4ª del equipo · sabe todo el negocio
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="chip">
              <span className={`led ${pensando ? "bg-warn led-pulse led-glow-amber" : "bg-ok led-glow-green"}`} />
              {pensando ? "pensando" : "en línea"}
            </span>
            <button className="btn-ghost" onClick={borrar}>
              Conversación nueva
            </button>
          </div>
        </div>
        <div className="hairline" />
      </div>

      {/* ---------- Hilo ---------- */}
      <div className="panel-hot brackets flex h-[68vh] flex-col overflow-hidden">
        <div ref={fondo} className="flex-1 space-y-3 overflow-y-auto p-4">
          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.de === "yo" ? "justify-end" : "justify-start"}`}>
              <div
                className={
                  m.de === "yo"
                    ? "max-w-[80%] rounded-2xl rounded-br-md border border-brand/30 bg-brand/15 px-3.5 py-2.5 text-[13px] leading-relaxed text-ink"
                    : "max-w-[85%] rounded-2xl rounded-bl-md border border-line bg-surface-3 px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-soft"
                }
              >
                {m.de === "isabel" && (
                  <div className="lbl mb-1 flex items-center gap-1.5 !text-[9px]">
                    <span className="led bg-coral led-glow-cyan !h-[5px] !w-[5px]" /> Isabel
                  </div>
                )}
                <div className="whitespace-pre-wrap">{m.texto}</div>
              </div>
            </div>
          ))}
          {pensando && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-md border border-line bg-surface-3 px-3.5 py-2.5 text-[13px] text-ink-faint">
                Isabel está mirando los números…
              </div>
            </div>
          )}
          {error && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-[12.5px] text-danger">
                {error}{" "}
                <button className="underline" onClick={() => pedir(msgs)}>
                  Reintentar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ---------- Accesos rápidos ---------- */}
        {msgs.length <= 1 && (
          <div className="flex flex-wrap gap-1.5 border-t border-line px-4 py-2.5">
            {RAPIDAS.map((r) => (
              <button
                key={r}
                className="btn-ghost !whitespace-normal text-left !text-[11.5px]"
                onClick={() => enviar(r)}
              >
                {r}
              </button>
            ))}
          </div>
        )}

        {/* ---------- Entrada ---------- */}
        <div className="flex items-end gap-2 border-t border-line p-3">
          <textarea
            ref={inputRef}
            className="input min-h-[44px] max-h-40 flex-1 resize-y text-[13px]"
            placeholder="Pregúntale a Isabel… (Enter envía, Shift+Enter salto de línea)"
            value={texto}
            disabled={pensando}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviar();
              }
            }}
          />
          <button className="btn-primary" disabled={pensando || !texto.trim()} onClick={() => enviar()}>
            Enviar
          </button>
        </div>
      </div>

      <p className="mt-2 text-center text-[10.5px] text-ink-faint">
        Isabel aconseja y redacta; no registra llamadas ni mueve deals. La conversación
        queda solo en este navegador.
      </p>
    </div>
  );
}
