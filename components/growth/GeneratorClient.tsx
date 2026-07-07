"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  NIVEL_VENTA,
  PILAR_KEYS,
  PILAR_LABEL,
  type CarouselDraft,
  type NivelVenta,
  type PilarKey,
  type VideoScript,
} from "@/lib/growth/types";
import { RUBROS } from "@/lib/growth/industries";
import {
  generarCarrusel,
  generarGuion,
  generarIdeasDesdeEstrategia,
  type FuenteIdeas,
} from "@/lib/growth/generators";

type Modo = "carrusel" | "guion" | "ideas";

function CopyBtn({ text, label = "Copiar" }: { text: string; label?: string }) {
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
      className="btn-ghost px-2 py-0.5 text-[11px]"
    >
      {ok ? "¡Copiado!" : label}
    </button>
  );
}

const NIVEL_LABEL: Record<NivelVenta, string> = {
  suave: "Suave (guardar/compartir)",
  medio: "Medio (probar demo)",
  directo: "Directo (agendar/piloto)",
};

export default function GeneratorClient() {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>("carrusel");

  // inputs comunes
  const [tema, setTema] = useState("");
  const [pilar, setPilar] = useState<PilarKey>("problema");
  const [rubro, setRubro] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [nivel, setNivel] = useState<NivelVenta>("medio");
  const [nSlides, setNSlides] = useState(6);
  const [cta, setCta] = useState("");
  const [duracion, setDuracion] = useState("20-30s");

  const [carrusel, setCarrusel] = useState<CarouselDraft | null>(null);
  const [guion, setGuion] = useState<VideoScript | null>(null);

  // Generación con IA (Gemini) — opcional, con fallback a plantillas
  const [usarIA, setUsarIA] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [origen, setOrigen] = useState<"ia" | "plantilla" | null>(null);
  const [avisoGen, setAvisoGen] = useState<string | null>(null);

  // ideas desde estrategia
  const [fuente, setFuente] = useState<FuenteIdeas>("objeciones");
  const [ideas, setIdeas] = useState<Partial<import("@/lib/growth/types").ContentIdea>[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  async function generar() {
    setAvisoGen(null);
    if (modo === "ideas") {
      setIdeas(generarIdeasDesdeEstrategia(fuente));
      return;
    }

    const carrInput = {
      tema: tema || (rubro ? "" : "Pierdes ventas por responder tarde"),
      pilar,
      rubro: rubro || null,
      objetivo,
      nivelVenta: nivel,
      nSlides,
      cta,
    };
    const guionInput = {
      tema: tema || "Pierdes ventas por responder tarde",
      pilar,
      rubro: rubro || null,
      objetivo,
      nivelVenta: nivel,
      duracion,
    };

    if (usarIA) {
      setCargando(true);
      try {
        const res = await fetch("/api/growth/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            modo === "carrusel"
              ? { tipo: "carrusel", ...carrInput }
              : { tipo: "guion", ...guionInput },
          ),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
        if (modo === "carrusel") setCarrusel(data.item);
        else setGuion(data.item);
        setOrigen(data.fuente);
        if (data.fuente === "plantilla") {
          setAvisoGen(
            "La IA no estaba disponible; se usó una plantilla. Verifica GEMINI_API_KEY.",
          );
        }
      } catch (e: any) {
        if (modo === "carrusel") setCarrusel(generarCarrusel(carrInput));
        else setGuion(generarGuion(guionInput));
        setOrigen("plantilla");
        setAvisoGen("No se pudo generar con IA; se usó una plantilla.");
      } finally {
        setCargando(false);
      }
    } else {
      if (modo === "carrusel") setCarrusel(generarCarrusel(carrInput));
      else setGuion(generarGuion(guionInput));
      setOrigen(null);
    }
  }

  async function guardarIdea(i: Partial<import("@/lib/growth/types").ContentIdea>) {
    setMsg(null);
    const res = await fetch("/api/growth/ideas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...i, estado: "idea" }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data.error ?? "No se pudo guardar");
      return;
    }
    setMsg("Idea guardada en la biblioteca ✓");
    router.refresh();
  }

  function carruselTexto(c: CarouselDraft) {
    return [
      `# ${c.titulo}`,
      ...c.slides.map((s, n) => `Slide ${n + 1} (${s.rol}): ${s.texto}`),
      "",
      `Caption: ${c.caption}`,
      `CTA: ${c.cta}`,
      `Hashtags: ${c.hashtags.join(" ")}`,
    ].join("\n");
  }
  function guionTexto(g: VideoScript) {
    return [
      `# ${g.titulo} (${g.duracion})`,
      `Hook: ${g.hook}`,
      ...g.escenas.map((e, n) => `Escena ${n + 1}: ${e.escena}\n  Pantalla: ${e.texto_pantalla ?? ""}\n  Voz: ${e.voz ?? ""}`),
      `CTA: ${g.cta}`,
      g.version_corta ? `Versión corta: ${g.version_corta}` : "",
    ].join("\n");
  }

  return (
    <div>
      {/* Modo */}
      <div className="mb-4 flex gap-1.5">
        {(["carrusel", "guion", "ideas"] as Modo[]).map((m) => (
          <button
            key={m}
            onClick={() => setModo(m)}
            className={`rounded-lg border px-3 py-1.5 text-[12.5px] transition ${
              modo === m
                ? "border-brand/30 bg-brand/[0.07] text-brand"
                : "border-line text-ink-mut hover:bg-surface-3"
            }`}
          >
            {m === "carrusel" ? "Carrusel" : m === "guion" ? "Guion de video" : "Ideas desde estrategia"}
          </button>
        ))}
      </div>

      {/* Inputs */}
      <div className="panel-hot mb-4 p-4">
        {modo === "ideas" ? (
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-ink-mut">Fuente estratégica
              <select value={fuente} onChange={(e) => setFuente(e.target.value as FuenteIdeas)} className="input mt-1 w-56 text-sm">
                <option value="objeciones">Objeciones (18)</option>
                <option value="rubros">Rubros (fórmula "sin")</option>
                <option value="competencia">Competencia (battlecards)</option>
                <option value="diferenciadores">Diferenciadores</option>
                <option value="faq">Preguntas frecuentes por rubro</option>
              </select>
            </label>
            <button onClick={generar} className="btn-primary text-xs">Generar ideas</button>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs text-ink-mut md:col-span-2">Tema / ángulo
              <input value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Ej: Pierdes ventas por responder tarde" className="input mt-1" />
            </label>
            <label className="text-xs text-ink-mut">Pilar
              <select value={pilar} onChange={(e) => setPilar(e.target.value as PilarKey)} className="input mt-1 text-sm">
                {PILAR_KEYS.map((p) => <option key={p} value={p}>{PILAR_LABEL[p]}</option>)}
              </select>
            </label>
            <label className="text-xs text-ink-mut">Rubro (opcional)
              <select value={rubro} onChange={(e) => setRubro(e.target.value)} className="input mt-1 text-sm">
                <option value="">Transversal</option>
                {RUBROS.map((r) => <option key={r.slug} value={r.slug}>{r.nombre}</option>)}
              </select>
            </label>
            <label className="text-xs text-ink-mut">Nivel de venta
              <select value={nivel} onChange={(e) => setNivel(e.target.value as NivelVenta)} className="input mt-1 text-sm">
                {NIVEL_VENTA.map((n) => <option key={n} value={n}>{NIVEL_LABEL[n]}</option>)}
              </select>
            </label>
            {modo === "carrusel" ? (
              <label className="text-xs text-ink-mut">N° de slides
                <input type="number" min={4} max={8} value={nSlides} onChange={(e) => setNSlides(Number(e.target.value))} className="input mt-1 text-sm" />
              </label>
            ) : (
              <label className="text-xs text-ink-mut">Duración
                <input value={duracion} onChange={(e) => setDuracion(e.target.value)} className="input mt-1 text-sm" />
              </label>
            )}
            <label className="text-xs text-ink-mut md:col-span-2">Objetivo comercial (opcional)
              <input value={objetivo} onChange={(e) => setObjetivo(e.target.value)} placeholder="Ej: apoyar la prospección de ferreterías" className="input mt-1" />
            </label>
            {modo === "carrusel" && (
              <label className="text-xs text-ink-mut md:col-span-2">CTA (opcional — si lo dejas vacío se elige según el nivel de venta)
                <input value={cta} onChange={(e) => setCta(e.target.value)} className="input mt-1" />
              </label>
            )}
            <div className="md:col-span-2 flex flex-wrap items-center gap-3">
              <button onClick={generar} disabled={cargando} className="btn-primary text-xs">
                {cargando
                  ? "Generando…"
                  : usarIA
                    ? "Redactar con IA"
                    : modo === "carrusel"
                      ? "Generar carrusel"
                      : "Generar guion"}
              </button>
              <label className="flex items-center gap-1.5 text-[11px] text-ink-mut">
                <input
                  type="checkbox"
                  checked={usarIA}
                  onChange={(e) => setUsarIA(e.target.checked)}
                />
                ✨ Redactar con IA (Gemini) — revisa antes de publicar
              </label>
              {avisoGen && <span className="text-[11px] text-warn">{avisoGen}</span>}
            </div>
          </div>
        )}
      </div>

      {/* Output carrusel */}
      {modo === "carrusel" && carrusel && (
        <div className="panel p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="lbl">Carrusel generado</span>
              {origen === "ia" && (
                <span className="chip border-brand/30 bg-brand/[0.07] px-1.5 py-0 text-[9px] text-brand">IA</span>
              )}
              {origen === "plantilla" && (
                <span className="chip px-1.5 py-0 text-[9px]">plantilla</span>
              )}
            </span>
            <div className="flex gap-2">
              <CopyBtn text={carruselTexto(carrusel)} label="Copiar todo" />
              <button onClick={() => guardarIdea({ titulo: carrusel.titulo, descripcion: carrusel.objetivo, pilar: carrusel.pilar, rubro: carrusel.rubro, canal: "instagram", formato: "carrusel", funnel: carrusel.funnel, cta: carrusel.cta })} className="btn-ghost px-2 py-0.5 text-[11px]">
                Guardar como idea
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {carrusel.slides.map((s, n) => (
              <div key={n} className="flex items-start gap-3 rounded-lg border border-line bg-surface-3/50 px-3 py-2">
                <span className="mt-0.5 font-mono text-[11px] text-ink-faint">{n + 1}</span>
                <div className="flex-1">
                  <span className="chip mr-2 px-1.5 py-0 text-[9px]">{s.rol}</span>
                  <span className="text-[13.5px] text-ink">{s.texto}</span>
                  {s.nota_visual && <p className="mt-0.5 text-[10.5px] text-ink-dim">🎨 {s.nota_visual}</p>}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 border-t border-line pt-3 text-[12.5px] text-ink-mut">
            <p><strong>Caption:</strong> {carrusel.caption}</p>
            <p className="mt-1"><strong>Hashtags:</strong> {carrusel.hashtags.join(" ")}</p>
            <p className="mt-1 text-[11px] text-ink-dim">{carrusel.notas_visuales}</p>
          </div>
        </div>
      )}

      {/* Output guion */}
      {modo === "guion" && guion && (
        <div className="panel p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="lbl">Guion generado · {guion.duracion}</span>
              {origen === "ia" && (
                <span className="chip border-brand/30 bg-brand/[0.07] px-1.5 py-0 text-[9px] text-brand">IA</span>
              )}
              {origen === "plantilla" && (
                <span className="chip px-1.5 py-0 text-[9px]">plantilla</span>
              )}
            </span>
            <div className="flex gap-2">
              <CopyBtn text={guionTexto(guion)} label="Copiar todo" />
              <button onClick={() => guardarIdea({ titulo: guion.titulo, descripcion: guion.objetivo, pilar: guion.pilar, rubro: guion.rubro, canal: "instagram", formato: "reel", funnel: guion.funnel, cta: guion.cta })} className="btn-ghost px-2 py-0.5 text-[11px]">
                Guardar como idea
              </button>
            </div>
          </div>
          <p className="mb-3 rounded-lg border border-brand/20 bg-brand/[0.05] px-3 py-2 text-[13px] text-ink"><strong>Hook:</strong> {guion.hook}</p>
          <div className="flex flex-col gap-2">
            {guion.escenas.map((e, n) => (
              <div key={n} className="rounded-lg border border-line bg-surface-3/50 px-3 py-2 text-[12.5px]">
                <div className="font-medium text-ink">Escena {n + 1}: {e.escena}</div>
                {e.texto_pantalla && <div className="text-ink-mut">📱 Pantalla: {e.texto_pantalla}</div>}
                {e.voz && <div className="text-ink-mut">🎙️ Voz: {e.voz}</div>}
              </div>
            ))}
          </div>
          <div className="mt-3 border-t border-line pt-3 text-[12.5px] text-ink-mut">
            <p><strong>CTA:</strong> {guion.cta}</p>
            {guion.version_corta && <p className="mt-1"><strong>Versión corta:</strong> {guion.version_corta}</p>}
            <p className="mt-1 text-[11px] text-ink-dim">{guion.notas_edicion}</p>
          </div>
        </div>
      )}

      {/* Output ideas */}
      {modo === "ideas" && ideas.length > 0 && (
        <div className="panel p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="lbl">{ideas.length} ideas generadas</span>
            {msg && <span className="text-[11px] text-ok">{msg}</span>}
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {ideas.map((i, n) => (
              <div key={n} className="rounded-lg border border-line bg-surface-3/50 px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <span className="flex-1 text-[13px] font-medium text-ink">{i.titulo}</span>
                  <button onClick={() => guardarIdea(i)} className="btn-ghost px-2 py-0.5 text-[10px]">Guardar</button>
                </div>
                {i.descripcion && <p className="mt-1 text-[11px] text-ink-mut">{i.descripcion}</p>}
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {i.pilar && <span className="chip px-1.5 py-0 text-[9px]">{PILAR_LABEL[i.pilar]}</span>}
                  {i.formato && <span className="chip px-1.5 py-0 text-[9px]">{i.formato}</span>}
                  {i.rubro && <span className="chip px-1.5 py-0 text-[9px]">{i.rubro}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
