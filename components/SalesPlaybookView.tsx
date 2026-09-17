"use client";

import { useState, useMemo } from "react";
import PageHeader from "@/components/PageHeader";
import {
  PLAYBOOK_COMPETITORS,
  PLAYBOOK_OBJECTIONS,
  PLAYBOOK_PITCHES,
} from "@/lib/revenue/playbookData";

export default function SalesPlaybookView() {
  const [tab, setTab] = useState<"pitches" | "objeciones" | "competidores" | "discovery">("pitches");
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const filteredPitches = useMemo(() => {
    if (!search.trim()) return PLAYBOOK_PITCHES;
    const q = search.toLowerCase();
    return PLAYBOOK_PITCHES.filter(
      (p) => p.title.toLowerCase().includes(q) || p.text.toLowerCase().includes(q) || p.targetAudience.toLowerCase().includes(q)
    );
  }, [search]);

  const filteredObjections = useMemo(() => {
    if (!search.trim()) return PLAYBOOK_OBJECTIONS;
    const q = search.toLowerCase();
    return PLAYBOOK_OBJECTIONS.filter(
      (o) =>
        o.objection.toLowerCase().includes(q) ||
        o.context.toLowerCase().includes(q) ||
        o.responseScript.toLowerCase().includes(q) ||
        o.recommendedCTA.toLowerCase().includes(q)
    );
  }, [search]);

  const filteredCompetitors = useMemo(() => {
    if (!search.trim()) return PLAYBOOK_COMPETITORS;
    const q = search.toLowerCase();
    return PLAYBOOK_COMPETITORS.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.tagline.toLowerCase().includes(q) ||
        c.killerQuestion.toLowerCase().includes(q) ||
        c.whereRespondoDiffers.some((d) => d.toLowerCase().includes(q))
    );
  }, [search]);

  return (
    <div className="mx-auto max-w-7xl pb-16">
      <PageHeader
        title="Sales Playbook & Battlecards"
        sub="Enablement Comercial Respondo HQ"
        right={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-surface-3 border border-line text-ink-dim">
              <span className="w-1.5 h-1.5 rounded-full bg-ok animate-pulse" />
              Guía Táctica En Vivo
            </span>
          </div>
        }
      />

      {/* Banner de Ayuda Rápida */}
      <div className="mb-6 rounded-xl border border-line bg-surface p-4 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand/10 text-brand flex items-center justify-center font-mono font-bold text-sm shrink-0">
            ⚡
          </div>
          <div>
            <div className="text-xs font-semibold text-ink">Battlecards Tácticas para Llamadas en Vivo</div>
            <div className="text-[11px] text-ink-dim">
              Consulte argumentos, manejo de objeciones y comparativas en tiempo real durante llamadas de Discovery y Demo.
            </div>
          </div>
        </div>

        {/* Buscador Rápido */}
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            placeholder="Buscar argumento, competidor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input w-full pl-8 pr-3 py-1.5 text-xs"
          />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-mut text-xs">
            🔍
          </span>
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-mut hover:text-ink text-[11px]"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Tabs de Navegación Segmentados V2 */}
      <div className="mb-6 flex flex-wrap gap-1 p-1 bg-surface-3 border border-line rounded-lg w-fit">
        <button
          onClick={() => setTab("pitches")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            tab === "pitches"
              ? "bg-surface text-ink font-semibold shadow-2xs border border-line"
              : "text-ink-dim hover:text-ink"
          }`}
        >
          <span>🎙️</span>
          <span>Discursos & Pitches</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-surface-3 border border-line font-mono text-ink-mut">
            {PLAYBOOK_PITCHES.length}
          </span>
        </button>

        <button
          onClick={() => setTab("objeciones")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            tab === "objeciones"
              ? "bg-surface text-ink font-semibold shadow-2xs border border-line"
              : "text-ink-dim hover:text-ink"
          }`}
        >
          <span>🛡️</span>
          <span>Manejo de Objeciones</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-surface-3 border border-line font-mono text-ink-mut">
            {PLAYBOOK_OBJECTIONS.length}
          </span>
        </button>

        <button
          onClick={() => setTab("competidores")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            tab === "competidores"
              ? "bg-surface text-ink font-semibold shadow-2xs border border-line"
              : "text-ink-dim hover:text-ink"
          }`}
        >
          <span>⚔️</span>
          <span>Fichas de Competidores</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-surface-3 border border-line font-mono text-ink-mut">
            {PLAYBOOK_COMPETITORS.length}
          </span>
        </button>

        <button
          onClick={() => setTab("discovery")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            tab === "discovery"
              ? "bg-surface text-ink font-semibold shadow-2xs border border-line"
              : "text-ink-dim hover:text-ink"
          }`}
        >
          <span>🔍</span>
          <span>Estructura Discovery & Demo</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-brand/10 text-brand font-mono font-semibold">
            5 Fases
          </span>
        </button>
      </div>

      {/* TAB 1: PITCHES */}
      {tab === "pitches" && (
        <div className="space-y-4">
          {filteredPitches.length === 0 ? (
            <div className="panel p-8 text-center text-xs text-ink-dim">
              No se encontraron discursos que coincidan con "{search}".
            </div>
          ) : (
            filteredPitches.map((pitch, idx) => (
              <div key={idx} className="panel p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded bg-brand/10 text-brand flex items-center justify-center font-mono font-bold text-xs">
                      #{idx + 1}
                    </span>
                    <h3 className="font-semibold text-sm text-ink">{pitch.title}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-surface-3 border border-line px-2.5 py-0.5 text-[10px] font-mono text-ink-dim">
                      Audiencia: {pitch.targetAudience}
                    </span>
                    <button
                      onClick={() => copyToClipboard(pitch.text, `pitch-${idx}`)}
                      className="btn-ghost py-1 px-2.5 text-[11px] font-medium"
                    >
                      {copiedId === `pitch-${idx}` ? "✓ Copiado" : "📋 Copiar Texto"}
                    </button>
                  </div>
                </div>
                <div className="rounded-lg bg-surface-3 p-4 border border-line/80 font-mono text-xs leading-relaxed text-ink whitespace-pre-line select-all">
                  {pitch.text}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 2: OBJECIONES */}
      {tab === "objeciones" && (
        <div className="space-y-4">
          {filteredObjections.length === 0 ? (
            <div className="panel p-8 text-center text-xs text-ink-dim">
              No se encontraron objeciones que coincidan con "{search}".
            </div>
          ) : (
            filteredObjections.map((obj) => (
              <div key={obj.id} className="panel p-5 space-y-3.5">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-danger/10 text-danger font-mono font-bold text-[10px]">
                        OBJECIÓN
                      </span>
                      <h3 className="font-bold text-sm text-danger">"{obj.objection}"</h3>
                    </div>
                    <p className="text-[11px] text-ink-dim mt-1">{obj.context}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-brand/10 border border-brand/20 px-2.5 py-0.5 text-[11px] font-mono font-medium text-brand">
                      CTA: {obj.recommendedCTA}
                    </span>
                    <button
                      onClick={() => copyToClipboard(obj.responseScript, `obj-${obj.id}`)}
                      className="btn-ghost py-1 px-2 text-[11px] font-medium"
                    >
                      {copiedId === `obj-${obj.id}` ? "✓ Copiado" : "📋 Copiar Script"}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-lg border border-line bg-surface-3 p-3 space-y-1">
                    <p className="font-semibold text-ink text-xs flex items-center gap-1.5">
                      <span>🧠</span> Mentalidad del Vendedor
                    </p>
                    <p className="text-ink-dim text-[11px] leading-relaxed">{obj.mindset}</p>
                  </div>

                  <div className="md:col-span-2 rounded-lg border border-accent/30 bg-accent/[0.03] p-3 space-y-1.5">
                    <p className="font-semibold text-accent text-xs flex items-center gap-1.5">
                      <span>🗣️</span> Script de Respuesta Sugerido
                    </p>
                    <p className="font-mono text-xs leading-relaxed text-ink bg-surface p-2.5 rounded border border-line select-all">
                      {obj.responseScript}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 3: COMPETIDORES */}
      {tab === "competidores" && (
        <div className="space-y-4">
          {filteredCompetitors.length === 0 ? (
            <div className="panel p-8 text-center text-xs text-ink-dim">
              No se encontraron competidores que coincidan con "{search}".
            </div>
          ) : (
            filteredCompetitors.map((comp, idx) => (
              <div key={idx} className="panel p-5 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base text-ink">{comp.name}</h3>
                      <span className="rounded-full bg-surface-3 border border-line px-2 py-0.5 text-[10px] font-mono text-ink-dim">
                        {comp.category}
                      </span>
                    </div>
                    <p className="text-ink-dim text-xs mt-0.5">{comp.tagline}</p>
                  </div>
                  <div className="text-[11px] text-ink-dim bg-surface-3 px-2.5 py-1 rounded-md border border-line">
                    <span className="font-semibold text-ink">Cuándo surge:</span> {comp.whenMentioned}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-lg border border-line bg-surface-3 p-3.5 space-y-2">
                    <p className="font-semibold text-ink text-xs flex items-center gap-1.5">
                      <span className="text-ink-dim">✓</span> Lo que hacen bien (Reconocer con respeto)
                    </p>
                    <ul className="space-y-1.5 text-[11px] text-ink-dim">
                      {comp.whatTheyDoWell.map((w, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-ink-mut">•</span>
                          <span>{w}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-lg border border-brand/20 bg-brand/[0.03] p-3.5 space-y-2">
                    <p className="font-semibold text-brand text-xs flex items-center gap-1.5">
                      <span>⚡</span> En qué se diferencia Respondo
                    </p>
                    <ul className="space-y-1.5 text-[11px] text-ink">
                      {comp.whereRespondoDiffers.map((d, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-brand font-bold">•</span>
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-lg border border-danger/25 bg-danger/[0.03] p-3 space-y-1">
                    <p className="text-danger font-semibold text-xs flex items-center gap-1.5">
                      <span>⛔</span> Qué NO afirmar
                    </p>
                    <p className="text-danger/90 text-[11px] leading-relaxed">{comp.whatNOTToClaim}</p>
                  </div>

                  <div className="rounded-lg border border-ok/25 bg-ok/[0.03] p-3 space-y-1">
                    <p className="text-ok font-semibold text-xs flex items-center gap-1.5">
                      <span>🎯</span> Killer Question (Pregunta reveladora)
                    </p>
                    <p className="font-mono text-ink text-[11px] leading-relaxed font-medium">
                      "{comp.killerQuestion}"
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 4: DISCOVERY */}
      {tab === "discovery" && (
        <div className="panel p-6 space-y-6">
          <div className="border-b border-line pb-4">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-brand/10 text-brand font-mono font-bold text-xs">
                FRAMEWORK V2
              </span>
              <h3 className="font-bold text-base text-ink">Estructura de Reunión de Discovery Consultivo (20–30 min)</h3>
            </div>
            <p className="text-xs text-ink-dim mt-1.5 max-w-3xl">
              Regla de oro: una reunión de discovery <b>NO es un product tour</b>. Es un diagnóstico consultivo donde el cliente habla el <b>70% del tiempo</b> para revelar cuellos de botella y pérdidas económicas.
            </p>
          </div>

          <div className="space-y-3">
            <div className="p-4 rounded-lg border border-line bg-surface-3 flex flex-col md:flex-row gap-3">
              <div className="md:w-56 shrink-0">
                <span className="font-mono text-[10px] font-bold text-brand uppercase tracking-wider">Fase 1 · 0–5 min</span>
                <h4 className="font-semibold text-xs text-ink">Contexto & Operación</h4>
              </div>
              <div className="text-xs text-ink-dim">
                <p className="font-medium text-ink mb-1">Confirmar cómo operan hoy sus ventas:</p>
                <p className="font-mono text-[11px] text-ink-soft bg-surface p-2 rounded border border-line">
                  "¿Cómo llegan hoy los prospectos a su WhatsApp? ¿Publicidad en Meta, referidos, sitio web?"
                </p>
              </div>
            </div>

            <div className="p-4 rounded-lg border border-line bg-surface flex flex-col md:flex-row gap-3">
              <div className="md:w-56 shrink-0">
                <span className="font-mono text-[10px] font-bold text-brand uppercase tracking-wider">Fase 2 · 5–12 min</span>
                <h4 className="font-semibold text-xs text-ink">Diagnóstico del Dolor</h4>
              </div>
              <div className="text-xs text-ink-dim">
                <p className="font-medium text-ink mb-1">Identificar cuellos de botella y tiempos de respuesta:</p>
                <p className="font-mono text-[11px] text-ink-soft bg-surface-3 p-2 rounded border border-line">
                  "¿Quién contesta hoy? ¿Desde qué celular? Si alguien escribe un domingo a las 10 de la noche, ¿cuándo se le responde?"
                </p>
              </div>
            </div>

            <div className="p-4 rounded-lg border border-line bg-surface-3 flex flex-col md:flex-row gap-3">
              <div className="md:w-56 shrink-0">
                <span className="font-mono text-[10px] font-bold text-brand uppercase tracking-wider">Fase 3 · 12–18 min</span>
                <h4 className="font-semibold text-xs text-ink">Cuantificación del Impacto</h4>
              </div>
              <div className="text-xs text-ink-dim">
                <p className="font-medium text-ink mb-1">Calcular el costo real del abandono o lentitud:</p>
                <p className="font-mono text-[11px] text-ink-soft bg-surface p-2 rounded border border-line">
                  "De cada 10 personas que cotizan, ¿a cuántas logran volver a contactar? ¿Cuál es el ticket promedio?"
                </p>
              </div>
            </div>

            <div className="p-4 rounded-lg border border-line bg-surface flex flex-col md:flex-row gap-3">
              <div className="md:w-56 shrink-0">
                <span className="font-mono text-[10px] font-bold text-brand uppercase tracking-wider">Fase 4 · 18–24 min</span>
                <h4 className="font-semibold text-xs text-ink">Demostración Quirúrgica</h4>
              </div>
              <div className="text-xs text-ink-dim">
                <p className="font-medium text-ink mb-1">Mostrar ÚNICAMENTE la solución a su dolor diagnosticado:</p>
                <p className="font-mono text-[11px] text-ink-soft bg-surface-3 p-2 rounded border border-line">
                  Tino respondiendo con catálogo, derivando con contexto precalificado y Beto reactivando cotizaciones frías. Cero pantallas innecesarias.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-lg border border-brand/30 bg-brand/[0.04] flex flex-col md:flex-row gap-3">
              <div className="md:w-56 shrink-0">
                <span className="font-mono text-[10px] font-bold text-brand uppercase tracking-wider">Fase 5 · 24–30 min</span>
                <h4 className="font-bold text-xs text-brand">Cierre con Compromiso Firme</h4>
              </div>
              <div className="text-xs text-ink-dim">
                <p className="font-bold text-ink mb-1">NUNCA terminar con un "ustedes lo revisan":</p>
                <p className="font-mono text-[11px] text-brand bg-surface p-2 rounded border border-brand/20 font-medium">
                  "Partamos con 14 días de prueba con un número piloto. Agendemos la llamada de levantamiento de 45 minutos para este jueves a las 11:00 hrs."
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
