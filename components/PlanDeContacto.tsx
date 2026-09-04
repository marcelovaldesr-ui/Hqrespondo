"use client";

/**
 * EL PLAN — qué hacer con este lead, en orden, con la frase lista para leer.
 *
 * POR QUÉ EXISTE — 4-sep-2026
 * Hasta hoy la ficha mostraba "Teléfono: +56 9 ...". Eso obliga al vendedor a
 * decidir tres cosas en el momento de marcar: si ese número sirve, por quién
 * preguntar, y qué hacer si no contesta. Tres decisiones × cuarenta llamadas
 * al día es donde se va la energía.
 *
 * Acá esas tres decisiones ya están tomadas y escritas. Tomás lee y marca.
 */

import { armarPlan, estadoDelLead, ESTADO_LEAD_LABEL, ESTADO_LEAD_TONO, type Paso } from "@/lib/contactabilidad";
import { corroborado, metodosDistintos, type ContactoConEvidencia } from "@/lib/contactos";

const TONO_CLASE: Record<string, string> = {
  ok: "border-ok/40 bg-ok/10 text-ok",
  warn: "border-warn/40 bg-warn/10 text-warn",
  mut: "border-line2 bg-surface-4 text-ink-mut",
  danger: "border-danger/40 bg-danger/10 text-danger",
};

const VIA_ETIQUETA: Record<Paso["via"], string> = {
  whatsapp: "su WhatsApp",
  movil: "móvil",
  fijo_con_nombre: "central, pidiendo por la persona",
  fijo_con_cargo: "central, pidiendo por el cargo",
  email: "correo",
  linkedin: "LinkedIn",
  formulario: "formulario web",
};

export default function PlanDeContacto({
  contactos, decisor, empresa, rubro, web, linkedin, suprimido,
}: {
  contactos: ContactoConEvidencia[];
  decisor?: { nombre?: string | null; cargo?: string | null } | null;
  empresa: string;
  rubro?: string | null;
  web?: string | null;
  linkedin?: string | null;
  suprimido?: boolean;
}) {
  // Sin useMemo a propósito: son cuatro contactos y unas comparaciones de
  // texto. Memorizar eso cuesta más en complejidad de lo que ahorra en CPU, y
  // además impedía renderizar el componente fuera de Next para revisarlo.
  const pasos = armarPlan(
    { contactos: contactos ?? [], decisor, empresa, web: web ?? undefined, linkedin },
    rubro,
  );
  const estado = estadoDelLead(pasos, suprimido);

  if (!contactos?.length) {
    return (
      <div className="subpanel mt-3 p-3">
        <div className="lbl mb-1">Plan de contacto</div>
        <p className="text-[12px] text-ink-mut">
          Este lead todavía no pasa por el enriquecimiento. Córrelo desde
          <span className="mono"> /api/foco/enriquecer</span> y acá va a aparecer el camino.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="lbl">Plan de contacto</span>
        <span className={`inline-flex items-center rounded border px-2 py-0.5 font-mono text-[9.5px] tracking-wider ${TONO_CLASE[ESTADO_LEAD_TONO[estado]]}`}>
          {ESTADO_LEAD_LABEL[estado].toUpperCase()}
        </span>
      </div>

      {pasos.length === 0 && (
        <p className="text-[12px] text-ink-mut">
          No queda ningún camino: los números que teníamos ya se comprobaron malos. Hay que volver a investigar este lead.
        </p>
      )}

      <ol className="flex flex-col gap-2">
        {pasos.slice(0, 4).map((p, i) => (
          <li key={`${p.via}-${p.valor}-${i}`} className="subpanel p-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[13px] font-semibold text-ink">{p.valor}</span>
              <span className="font-mono text-[9.5px] tracking-wider text-ink-dim">
                {VIA_ETIQUETA[p.via]} · {p.puntos} pts
              </span>
            </div>
            <p className="mt-1 text-[12.5px] leading-snug text-ink-soft">{p.guion}</p>
            {p.advertencia && (
              <p className="mt-1 text-[11.5px] leading-snug text-warn">{p.advertencia}</p>
            )}
            <p className="mt-1 text-[10.5px] leading-snug text-ink-faint">{p.porQue.join(" · ")}</p>
          </li>
        ))}
      </ol>

      {/* La evidencia. No se muestra por transparencia decorativa: es lo que
          permite al vendedor decidir si le cree al dato, e ir a comprobarlo. */}
      <details className="mt-2">
        <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.15em] text-ink-dim hover:text-ink-mut">
          De dónde salió cada número
        </summary>
        <div className="mt-2 flex flex-col gap-1.5">
          {contactos.map((c) => (
            <div key={c.clave} className="text-[11px] leading-snug text-ink-mut">
              <span className="font-semibold text-ink-soft">{c.valor}</span>
              {corroborado(c) && (
                <span className="ml-1.5 text-ok">confirmado por {metodosDistintos(c)} fuentes</span>
              )}
              <ul className="ml-3 mt-0.5 list-disc text-[10.5px] text-ink-faint marker:text-ink-faint">
                {c.evidencias.slice(0, 4).map((e, j) => (
                  <li key={j}>
                    {DONDE[e.metodo] ?? e.metodo}
                    {e.donde && !e.donde.startsWith("Ficha") ? ` — ${acortar(e.donde)}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

const DONDE: Record<string, string> = {
  enlace_wa: "enlace de WhatsApp en su sitio",
  enlace_tel: "enlace para llamar en su sitio",
  enlace_mail: "enlace de correo en su sitio",
  schema_org: "datos estructurados de su sitio",
  texto_del_sitio: "escrito en su sitio",
  google_places: "su Ficha de Empresa de Google",
  base_externa: "base externa (sin dónde comprobarlo)",
  a_mano: "lo escribió alguien del equipo",
};

function acortar(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname === "/" ? "" : u.pathname}`.slice(0, 46);
  } catch {
    return url.slice(0, 46);
  }
}
