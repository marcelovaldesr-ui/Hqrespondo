import { db } from "./db";
import { ESTADO_CONFIG } from "./types";

/**
 * Objetivos comerciales del mes — versión simple para founders.
 *
 * Las METAS vienen del ROADMAP_COMERCIAL_30_DIAS (estrategia-comercial/,
 * jul-2026): 100 prospectos contactados, 10+ respuestas, 5+ demos,
 * 4+ propuestas, 2–3 clientes cerrados, con salida a vender el lunes 13-jul.
 * Son constantes de código a propósito: cero migraciones, y se ajustan
 * editando este archivo al cambiar de mes (documentado en GUIA_USO).
 *
 * El AVANCE se calcula desde datos reales:
 * - contactados: prospectos cuyo estado ya no es "nuevo" ni "descartado".
 * - respuestas: prospectos en respondió / reunión / en_pipeline.
 * - demos: deals que llegaron a demo, propuesta o cliente.
 * - propuestas: deals en propuesta o cliente.
 * - clientes: deals cerrados como cliente.
 * Nota: son fotos del estado actual (no histórico por mes). Suficiente para
 * el primer mes de venta; si se necesita histórico real → tabla objetivos.
 */

export interface Objetivo {
  clave: string;
  label: string;
  meta: number;
  avance: number;
  /** al_dia | atrasado | logrado */
  estado: "al_dia" | "atrasado" | "logrado";
  accion: string;
}

export const METAS_MES = {
  contactados: 100,
  respuestas: 10,
  demos: 5,
  propuestas: 4,
  clientes: 2,
} as const;

/** Meta diaria de contactos nuevos (ritmo mínimo del kit: 15/día hábil entre los 2). */
export const META_DIARIA_CONTACTOS = 15;

/** Día 1–31 → fracción esperada del mes transcurrido (lineal, simple). */
function fraccionMes(): number {
  const hoy = new Date();
  const dias = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
  return Math.min(1, hoy.getDate() / dias);
}

function estadoDe(avance: number, meta: number): Objetivo["estado"] {
  if (avance >= meta) return "logrado";
  return avance >= meta * fraccionMes() * 0.7 ? "al_dia" : "atrasado";
}

export async function calcularObjetivos(): Promise<Objetivo[]> {
  const s = db();

  const [prosRes, dealsRes, clientesRes] = await Promise.all([
    s.from("prospects").select("estado"),
    s.from("deals").select("etapa"),
    s.from("clients").select("id,activo"),
  ]);

  const pros = (prosRes.data ?? []) as { estado: string }[];
  const deals = (dealsRes.data ?? []) as { etapa: string }[];
  const clientesActivos = ((clientesRes.data ?? []) as { activo: boolean }[]).filter(
    (c) => c.activo,
  ).length;

  const contactados = pros.filter(
    (p) =>
      p.estado !== ESTADO_CONFIG.nuevo.value &&
      p.estado !== ESTADO_CONFIG.descartado.value,
  ).length;
  const respuestas = pros.filter((p) =>
    ["respondio", "reunion", "en_pipeline"].includes(p.estado),
  ).length;
  const demos = deals.filter((d) =>
    ["demo", "propuesta", "cliente"].includes(d.etapa),
  ).length;
  const propuestas = deals.filter((d) =>
    ["propuesta", "cliente"].includes(d.etapa),
  ).length;
  const clientes = Math.max(
    deals.filter((d) => d.etapa === "cliente").length,
    clientesActivos,
  );

  const filas: [string, string, number, number, (falta: number) => string][] = [
    [
      "contactados",
      "Prospectos contactados",
      METAS_MES.contactados,
      contactados,
      (f) => `Contactar ${Math.min(15, f)} prospectos hoy (los de mayor score primero)`,
    ],
    [
      "respuestas",
      "Respuestas obtenidas",
      METAS_MES.respuestas,
      respuestas,
      () => "Enviar follow-up 1 a los contactados sin respuesta",
    ],
    [
      "demos",
      "Demos agendadas",
      METAS_MES.demos,
      demos,
      () => "Proponer demo a quienes respondieron (link demo pública)",
    ],
    [
      "propuestas",
      "Propuestas enviadas",
      METAS_MES.propuestas,
      propuestas,
      () => "Enviar propuesta de 1 página el mismo día de cada demo",
    ],
    [
      "clientes",
      "Clientes cerrados",
      METAS_MES.clientes,
      clientes,
      () => "Empujar cierre: ofrecer la prueba 30 días (si no ayuda, no paga la mensualidad)",
    ],
  ];

  return filas.map(([clave, label, meta, avance, accionFn]) => ({
    clave,
    label,
    meta,
    avance,
    estado: estadoDe(avance, meta),
    accion: avance >= meta ? "Meta lograda — mantener el ritmo" : accionFn(meta - avance),
  }));
}
