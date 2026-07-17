/**
 * LLAMADAS DEL DÍA — selección compartida entre la página /llamadas y el
 * export a Excel. Una sola fuente de verdad para "a quién llamar hoy".
 *
 * Reglas:
 *  - Candidatos: estado 'nuevo', con teléfono, score >= 70, < 4 intentos.
 *  - "No contestó" HOY → vuelve MAÑANA (no en 7 días: un no-contesto es
 *    cosa de horario, no de rechazo). Al 4º intento sin contacto sale de la
 *    lista (queda para el agente de email / descarte manual).
 *  - Cadenas multi-sucursal (misma web) salen UNA vez, con el grupo de ids
 *    para registrar el resultado en todas.
 *  - El registro del resultado lo hace /api/prospects/llamada — la lista
 *    NO se marca al mirarla ni al exportarla.
 */
import { db } from "./db";
import type { SenalesWeb } from "./enriquecimiento";

export interface FilaLlamada {
  id: string;
  nombre: string;
  rubro: string | null;
  comuna: string | null;
  telefono: string;
  web: string | null;
  score: number;
  razon_score: string | null;
  senales_web: SenalesWeb | null;
  notas: string | null;
  contacto_nombre: string | null;
  contacto_celular: string | null;
  intentos_llamada: number;
  ultimo_intento_llamada: string | null;
  /** ids de las sucursales agrupadas (incluye el propio) */
  ids_grupo: string[];
  sucursales: number;
}

/** Medianoche de HOY en Chile, como instante UTC (para comparar timestamps). */
export function hoyChile(): Date {
  const ahora = new Date();
  const fecha = ahora.toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
  const enChile = new Date(ahora.toLocaleString("en-US", { timeZone: "America/Santiago" }));
  const offset = ahora.getTime() - enChile.getTime();
  return new Date(new Date(`${fecha}T00:00:00`).getTime() + offset);
}

const SELECT =
  "id,nombre,rubro,comuna,telefono,web,score,razon_score,senales_web,notas,contacto_nombre,contacto_celular,intentos_llamada,ultimo_intento_llamada";

/** Lista del día: elegibles hoy, dedupe por dominio, mejores primero. */
export async function listaLlamadasDelDia(opts?: {
  scoreMin?: number;
  limit?: number;
}): Promise<FilaLlamada[]> {
  const scoreMin = opts?.scoreMin ?? 70;
  const limit = opts?.limit ?? 40;
  const hoy = hoyChile().toISOString();

  const { data, error } = await db()
    .from("prospects")
    .select(SELECT)
    .eq("estado", "nuevo")
    .gte("score", scoreMin)
    .not("telefono", "is", null)
    .lt("intentos_llamada", 4)
    .or(`ultimo_intento_llamada.is.null,ultimo_intento_llamada.lt.${hoy}`)
    .order("score", { ascending: false })
    .limit(limit * 2); // holgura para el dedupe
  if (error) throw new Error(error.message);

  // Dedupe por dominio (cadenas → una llamada cubre todas las sucursales).
  const porDominio = new Map<string, FilaLlamada>();
  const sinWeb: FilaLlamada[] = [];
  for (const p of (data ?? []) as any[]) {
    const fila: FilaLlamada = { ...p, ids_grupo: [p.id], sucursales: 1 };
    let host: string | null = null;
    try {
      host = p.web
        ? new URL(/^https?:\/\//i.test(p.web) ? p.web : `https://${p.web}`).hostname.replace(/^www\./, "")
        : null;
    } catch {
      host = null;
    }
    if (!host) {
      sinWeb.push(fila);
      continue;
    }
    const previo = porDominio.get(host);
    if (!previo) porDominio.set(host, fila);
    else {
      previo.sucursales += 1;
      previo.ids_grupo.push(p.id);
    }
  }

  return [...porDominio.values(), ...sinWeb]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit);
}

/** Resumen del avance de HOY (para el encabezado de la página). */
export async function resumenHoy(): Promise<{ llamadas_hoy: number }> {
  const hoy = hoyChile().toISOString();
  const { count } = await db()
    .from("prospects")
    .select("id", { count: "exact", head: true })
    .gte("ultimo_intento_llamada", hoy);
  return { llamadas_hoy: count ?? 0 };
}
