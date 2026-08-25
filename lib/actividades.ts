import { db } from "@/lib/db";

/**
 * Bitácora de actividad y lista de supresión (Fase 1 de la auditoría).
 *
 * La regla: TODA métrica de actividad sale de `actividades`. Si un número del
 * dashboard se calcula contando columnas de `prospects`, va a discrepar con
 * otro que cuente distinto, y nadie se entera hasta que alguien compara.
 */

export const RESULTADOS = [
  "contactado",
  "no_contesto",
  "gatekeeper",
  "numero_malo",
  "interesado",
  "seguimiento",
  "no_interesa",
  "fuera_icp",
  "enviado",
] as const;
export type Resultado = (typeof RESULTADOS)[number];

export const RESULTADO_LABEL: Record<Resultado, string> = {
  contactado: "Habló con la persona",
  no_contesto: "No contestó",
  gatekeeper: "Quedó en el portero",
  numero_malo: "Número malo",
  interesado: "Interesado",
  seguimiento: "Pidió seguimiento",
  no_interesa: "No le interesa",
  fuera_icp: "Fuera de ICP",
  enviado: "Mensaje enviado",
};

/** Resultados que significan que SÍ se habló con la persona objetivo.
 *  `gatekeeper` queda fuera a propósito: llegar al portero no es conectar,
 *  y mezclarlos infla la tasa de conexión y esconde el problema real. */
export const CONECTADOS: Resultado[] = [
  "contactado",
  "interesado",
  "seguimiento",
  "no_interesa",
];

/** Resultados que consumen un intento de marcado. */
export const INTENTOS: Resultado[] = [
  "contactado",
  "no_contesto",
  "gatekeeper",
  "numero_malo",
  "interesado",
  "seguimiento",
  "no_interesa",
];

export type Canal = "llamada" | "whatsapp" | "email" | "reunion" | "otro";

export interface NuevaActividad {
  prospect_id?: string | null;
  /**
   * A qué lead de Foco se refiere. Sin esto la bitácora guardaba el toque pero
   * no a quién, así que reconstruir la historia de UN lead obligaba a buscar
   * por texto dentro de la nota. Migración 030.
   */
  lead_foco_id?: string | null;
  contacto?: string;
  actor?: string;
  canal: Canal;
  tipo?: "primer_contacto" | "seguimiento" | "respuesta" | "reunion" | "toque";
  resultado: Resultado;
  nota?: string;
}

/**
 * Registra una actividad. NUNCA lanza: si la bitácora falla, la acción del
 * usuario (registrar una llamada) igual tiene que completarse. Perder una
 * línea de log es malo; perder el registro de la llamada es peor.
 */
export async function registrarActividad(a: NuevaActividad): Promise<void> {
  try {
    // OJO: supabase-js NO lanza cuando la base rechaza el insert — devuelve
    // { error } y sigue como si nada. Con solo try/catch, una restricción rota
    // o un permiso faltante hacía desaparecer la línea de bitácora en silencio
    // (detectado 19-ago-2026 probando Leads Foco: el lead se actualizaba y la
    // actividad no quedaba, sin un solo error en el log).
    const { error } = await db().from("actividades").insert({
      prospect_id: a.prospect_id ?? null,
      lead_foco_id: a.lead_foco_id ?? null,
      contacto: a.contacto ?? "",
      actor: a.actor ?? "",
      canal: a.canal,
      tipo: a.tipo ?? "toque",
      resultado: a.resultado,
      nota: (a.nota ?? "").slice(0, 500),
    });
    if (error) console.error("[actividades] la base rechazó el registro:", error.message, error.details ?? "");
  } catch (e) {
    console.error("[actividades] no se pudo registrar:", e);
  }
}

// ---------------------------------------------------------------- SUPRESIÓN

/** Deja el teléfono en solo dígitos, sin el 56 de país, para que
 *  "+56 9 1234 5678" y "991234567" colisionen. */
export function normalizarTelefono(t: string): string {
  const d = String(t).replace(/\D/g, "");
  return d.startsWith("56") ? d.slice(2) : d;
}

export function normalizarValor(valor: string, tipo: "telefono" | "email"): string {
  return tipo === "email"
    ? String(valor).trim().toLowerCase()
    : normalizarTelefono(valor);
}

/** Conjunto de teléfonos suprimidos, normalizados. Una sola consulta:
 *  la lista es chica y se usa para filtrar en memoria. */
export async function telefonosSuprimidos(): Promise<Set<string>> {
  // Tolerante a que la migración 020 todavía no esté aplicada: si la tabla
  // no existe se devuelve un conjunto vacío en vez de tumbar la lista de
  // llamadas. Filtrar de menos es molesto; caerse es peor.
  try {
    const { data, error } = await db()
      .from("supresiones")
      .select("valor")
      .eq("tipo", "telefono");
    if (error) throw new Error(error.message);
    return new Set((data ?? []).map((r: { valor: string }) => r.valor));
  } catch (e) {
    console.error("[supresiones] no disponible:", e);
    return new Set();
  }
}

// ---------------------------------------------------------------- COHORTES

export interface Cohorte {
  semana: string;
  entraron: number;
  tocados: number;
  conectados: number;
  interesados: number;
  en_pipeline: number;
  descartados: number;
}

/**
 * Dónde está HOY cada camada de prospectos que entró en una semana.
 *
 * Es lo que un total acumulado no puede responder: si la conversión se cayó
 * a la mitad en julio, el acumulado sigue subiendo y la caída queda tapada
 * meses. Acá se ve la fila de julio peor que la de junio.
 */
export async function cohortesSemanales(semanas = 6): Promise<Cohorte[]> {
  const desde = new Date();
  desde.setDate(desde.getDate() - semanas * 7);
  const desdeIso = desde.toISOString();

  const { data: pros, error: e1 } = await db()
    .from("prospects")
    .select("id,created_at,estado,intentos_llamada")
    .gte("created_at", desdeIso);
  if (e1) throw new Error(e1.message);

  // Tolerante a que la migración 020 no esté aplicada todavía: sin bitácora
  // las cohortes se calculan igual, apoyándose en intentos_llamada y estado.
  let acts: { prospect_id: string | null; resultado: string }[] = [];
  try {
    const { data, error } = await db()
      .from("actividades")
      .select("prospect_id,resultado")
      .gte("created_at", desdeIso);
    if (error) throw new Error(error.message);
    acts = (data ?? []) as typeof acts;
  } catch (e) {
    console.error("[cohortes] bitácora no disponible:", e);
  }

  const porProspecto = new Map<string, string[]>();
  for (const a of acts) {
    if (!a.prospect_id) continue;
    const lista = porProspecto.get(a.prospect_id) ?? [];
    lista.push(a.resultado);
    porProspecto.set(a.prospect_id, lista);
  }

  const lunes = (iso: string) => {
    const d = new Date(iso);
    const dia = d.getUTCDay();
    d.setUTCDate(d.getUTCDate() + (dia === 0 ? -6 : 1 - dia));
    return d.toISOString().slice(0, 10);
  };

  const mapa = new Map<string, Cohorte>();
  for (const p of (pros ?? []) as any[]) {
    const k = lunes(p.created_at);
    const c =
      mapa.get(k) ??
      ({ semana: k, entraron: 0, tocados: 0, conectados: 0, interesados: 0, en_pipeline: 0, descartados: 0 } as Cohorte);
    c.entraron++;

    const res = porProspecto.get(p.id) ?? [];
    // Fallback a intentos_llamada: las llamadas anteriores a la migración 020
    // no dejaron actividad, y sin esto las cohortes viejas saldrían en cero.
    if (res.length > 0 || (p.intentos_llamada ?? 0) > 0) c.tocados++;
    if (res.some((r) => CONECTADOS.includes(r as Resultado))) c.conectados++;
    if (res.includes("interesado") || p.estado === "respondio") c.interesados++;
    if (p.estado === "en_pipeline") c.en_pipeline++;
    if (p.estado === "descartado") c.descartados++;
    mapa.set(k, c);
  }

  return [...mapa.values()].sort((a, b) => b.semana.localeCompare(a.semana)).slice(0, semanas);
}
