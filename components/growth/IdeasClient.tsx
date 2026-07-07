"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CANALES,
  CANAL_LABEL,
  CONTENT_STATUS,
  CONTENT_STATUS_LABEL,
  FORMATOS,
  FORMATO_LABEL,
  FUNNEL,
  FUNNEL_LABEL,
  PILAR_KEYS,
  PILAR_LABEL,
  type Canal,
  type ContentIdea,
  type ContentStatus,
  type Formato,
  type Funnel,
  type PilarKey,
} from "@/lib/growth/types";
import { RUBROS } from "@/lib/growth/industries";

export default function IdeasClient({
  initial,
  dbActiva,
  filtroPilar,
  filtroRubro,
}: {
  initial: ContentIdea[];
  dbActiva: boolean;
  filtroPilar: string;
  filtroRubro: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [fPilar, setFPilar] = useState(filtroPilar);
  const [fRubro, setFRubro] = useState(filtroRubro);
  const [fEstado, setFEstado] = useState("");
  const [fCanal, setFCanal] = useState("");
  const [showForm, setShowForm] = useState(false);

  // formulario nueva idea
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [pilar, setPilar] = useState<PilarKey>("problema");
  const [rubro, setRubro] = useState("");
  const [canal, setCanal] = useState<Canal>("instagram");
  const [formato, setFormato] = useState<Formato>("carrusel");
  const [funnel, setFunnel] = useState<Funnel>("descubrimiento");
  const [cta, setCta] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibles = useMemo(() => {
    return initial.filter((i) => {
      if (fPilar && i.pilar !== fPilar) return false;
      if (fRubro && i.rubro !== fRubro) return false;
      if (fEstado && i.estado !== fEstado) return false;
      if (fCanal && i.canal !== fCanal) return false;
      if (q.trim()) {
        const hay = `${i.titulo} ${i.descripcion} ${i.fuente ?? ""} ${i.objetivo_comercial ?? ""}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [initial, fPilar, fRubro, fEstado, fCanal, q]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/growth/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo,
          descripcion: descripcion || null,
          pilar,
          rubro: rubro || null,
          canal,
          formato,
          funnel,
          cta: cta || null,
          estado: "idea",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setTitulo("");
      setDescripcion("");
      setCta("");
      setShowForm(false);
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function cambiarEstado(i: ContentIdea, estado: ContentStatus) {
    if (i.seed) return;
    await fetch(`/api/growth/ideas/${i.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    router.refresh();
  }

  async function eliminar(i: ContentIdea) {
    if (i.seed) return;
    if (!confirm(`¿Eliminar "${i.titulo}"?`)) return;
    await fetch(`/api/growth/ideas/${i.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div>
      {/* Barra de acciones */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button onClick={() => setShowForm((s) => !s)} className="btn-primary text-xs">
          {showForm ? "Cerrar" : "+ Nueva idea"}
        </button>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar ideas…"
          className="input max-w-xs py-1.5 text-sm"
        />
        <select value={fPilar} onChange={(e) => setFPilar(e.target.value)} className="input w-auto py-1.5 text-xs">
          <option value="">Todos los pilares</option>
          {PILAR_KEYS.map((p) => (
            <option key={p} value={p}>{PILAR_LABEL[p]}</option>
          ))}
        </select>
        <select value={fRubro} onChange={(e) => setFRubro(e.target.value)} className="input w-auto py-1.5 text-xs">
          <option value="">Todos los rubros</option>
          {RUBROS.map((r) => (
            <option key={r.slug} value={r.slug}>{r.nombre}</option>
          ))}
        </select>
        <select value={fEstado} onChange={(e) => setFEstado(e.target.value)} className="input w-auto py-1.5 text-xs">
          <option value="">Todos los estados</option>
          {CONTENT_STATUS.map((s) => (
            <option key={s} value={s}>{CONTENT_STATUS_LABEL[s]}</option>
          ))}
        </select>
        <select value={fCanal} onChange={(e) => setFCanal(e.target.value)} className="input w-auto py-1.5 text-xs">
          <option value="">Todos los canales</option>
          {CANALES.map((c) => (
            <option key={c} value={c}>{CANAL_LABEL[c]}</option>
          ))}
        </select>
        <span className="ml-auto font-mono text-[11px] text-ink-dim">{visibles.length} ideas</span>
      </div>

      {/* Formulario */}
      {showForm && (
        <form onSubmit={crear} className="panel-hot mb-4 grid gap-2.5 p-4 md:grid-cols-2">
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título de la idea" className="input md:col-span-2" />
          <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripción / ángulo (opcional)" rows={2} className="input resize-y text-sm md:col-span-2" />
          <label className="text-xs text-ink-mut">Pilar
            <select value={pilar} onChange={(e) => setPilar(e.target.value as PilarKey)} className="input mt-1 text-sm">
              {PILAR_KEYS.map((p) => <option key={p} value={p}>{PILAR_LABEL[p]}</option>)}
            </select>
          </label>
          <label className="text-xs text-ink-mut">Rubro
            <select value={rubro} onChange={(e) => setRubro(e.target.value)} className="input mt-1 text-sm">
              <option value="">Transversal</option>
              {RUBROS.map((r) => <option key={r.slug} value={r.slug}>{r.nombre}</option>)}
            </select>
          </label>
          <label className="text-xs text-ink-mut">Canal
            <select value={canal} onChange={(e) => setCanal(e.target.value as Canal)} className="input mt-1 text-sm">
              {CANALES.map((c) => <option key={c} value={c}>{CANAL_LABEL[c]}</option>)}
            </select>
          </label>
          <label className="text-xs text-ink-mut">Formato
            <select value={formato} onChange={(e) => setFormato(e.target.value as Formato)} className="input mt-1 text-sm">
              {FORMATOS.map((f) => <option key={f} value={f}>{FORMATO_LABEL[f]}</option>)}
            </select>
          </label>
          <label className="text-xs text-ink-mut">Etapa del funnel
            <select value={funnel} onChange={(e) => setFunnel(e.target.value as Funnel)} className="input mt-1 text-sm">
              {FUNNEL.map((f) => <option key={f} value={f}>{FUNNEL_LABEL[f]}</option>)}
            </select>
          </label>
          <input value={cta} onChange={(e) => setCta(e.target.value)} placeholder="CTA sugerido (opcional)" className="input md:col-span-2" />
          <div className="flex items-center justify-between md:col-span-2">
            <span className="text-xs text-danger">{error}</span>
            <button type="submit" disabled={!titulo.trim() || saving} className="btn-primary text-xs">
              {saving ? "Guardando…" : "Guardar idea"}
            </button>
          </div>
          {!dbActiva && (
            <p className="text-[11px] text-ink-dim md:col-span-2">
              Nota: para guardar ideas propias ejecuta la migración 009 en Supabase.
            </p>
          )}
        </form>
      )}

      {/* Lista */}
      {visibles.length === 0 ? (
        <div className="panel border-dashed border-line2 p-10 text-center text-sm text-ink-dim">
          Nada calza con los filtros. Prueba{" "}
          <button onClick={() => { setQ(""); setFPilar(""); setFRubro(""); setFEstado(""); setFCanal(""); }} className="text-brand underline">
            limpiar filtros
          </button>{" "}
          o genera ideas desde la estrategia en el Generador.
        </div>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {visibles.map((i) => (
            <div key={i.id} className="group panel px-4 py-3">
              <div className="flex items-start gap-2">
                <span className="flex-1 text-[14px] font-medium leading-snug text-ink">{i.titulo}</span>
                {i.seed ? (
                  <span className="chip px-2 py-0 text-[9.5px]">seed</span>
                ) : (
                  <button onClick={() => eliminar(i)} className="btn-ghost hidden px-2 py-0.5 hover:border-danger/40 hover:text-danger group-hover:inline-flex">×</button>
                )}
              </div>
              {i.descripcion && <p className="mt-1 text-[12px] leading-relaxed text-ink-mut">{i.descripcion}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="chip px-2 py-0 text-[10px]">{PILAR_LABEL[i.pilar]}</span>
                <span className="chip px-2 py-0 text-[10px]">{FORMATO_LABEL[i.formato]}</span>
                <span className="chip px-2 py-0 text-[10px]">{CANAL_LABEL[i.canal]}</span>
                {i.rubro && <span className="chip px-2 py-0 text-[10px]">{RUBROS.find((r) => r.slug === i.rubro)?.emoji} {i.rubro}</span>}
                <span className="chip px-2 py-0 text-[10px]">{FUNNEL_LABEL[i.funnel]}</span>
                {i.seed ? (
                  <span className="chip px-2 py-0 text-[10px]">
                    {CONTENT_STATUS_LABEL[i.estado]}
                  </span>
                ) : (
                  <select
                    value={i.estado}
                    onChange={(e) => cambiarEstado(i, e.target.value as ContentStatus)}
                    className="input w-auto py-0.5 text-[10px]"
                  >
                    {CONTENT_STATUS.map((s) => <option key={s} value={s}>{CONTENT_STATUS_LABEL[s]}</option>)}
                  </select>
                )}
              </div>
              {(i.fuente || i.objetivo_comercial) && (
                <p className="mt-2 border-t border-line pt-2 text-[11px] text-ink-dim">
                  {i.objetivo_comercial && <span>🎯 {i.objetivo_comercial} · </span>}
                  {i.fuente && <span>fuente: {i.fuente}</span>}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
