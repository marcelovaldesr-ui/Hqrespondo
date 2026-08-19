import { db } from "@/lib/db";

/**
 * Cadencia semi-automática (Fase 2 de la auditoría).
 *
 * NO son secuencias automáticas: el sistema propone la tarea del día y el
 * humano ejecuta. Con 3 socios vendiendo directo, automatizar el envío
 * arriesga el número de WhatsApp y no ahorra tiempo real; lo que sí falta es
 * que nadie deje caer un seguimiento.
 *
 * Evidencia del espaciado: Woodpecker mide 4,1% de respuesta sin follow-up
 * contra 8,3% con 3-5 follow-ups, sobre 20M+ de envíos. El óptimo está en
 * 4-7 toques. HQ hoy corta a los 4 intentos y no propone el siguiente.
 */

/** Días hábiles a esperar antes del toque N. Índice = toques ya dados. */
export const ESPACIADO_DIAS_HABILES = [0, 3, 4, 5, 5, 7, 7];
export const MAX_TOQUES = ESPACIADO_DIAS_HABILES.length;

/** Suma días hábiles (sin sábado ni domingo) a una fecha. */
export function sumarHabiles(desde: Date, dias: number): Date {
  const d = new Date(desde);
  let restan = dias;
  while (restan > 0) {
    d.setDate(d.getDate() + 1);
    const dw = d.getDay();
    if (dw !== 0 && dw !== 6) restan--;
  }
  return d;
}

/** Cuándo toca el próximo contacto, dado cuántos toques lleva. */
export function proximoToque(ultimo: string | null, toquesDados: number): Date | null {
  if (toquesDados >= MAX_TOQUES) return null;
  const base = ultimo ? new Date(ultimo) : new Date();
  const espera = ESPACIADO_DIAS_HABILES[toquesDados] ?? 7;
  return sumarHabiles(base, espera);
}

export interface Pendiente {
  id: string;
  nombre: string;
  comuna: string;
  telefono: string | null;
  score: number;
  toques: number;
  ultimo: string | null;
  vence: string | null;
  diasVencido: number;
}

export interface EstadoCadencia {
  /** Ya pasó su fecha de próximo toque. */
  vencidos: Pendiente[];
  /** Nunca se tocaron y llevan más de 7 días en la base. Es la fuga
   *  silenciosa: prospectos calificados que nadie trabajó nunca. */
  huerfanos: Pendiente[];
  /** Agotaron la cadencia sin respuesta: hay que cerrarlos o cambiar canal. */
  agotados: number;
  totalActivos: number;
}

export async function estadoCadencia(limite = 12): Promise<EstadoCadencia> {
  const { data, error } = await db()
    .from("prospects")
    .select("id,nombre,comuna,telefono,score,intentos_llamada,ultimo_intento_llamada,created_at")
    .eq("estado", "nuevo")
    .not("telefono", "is", null)
    .order("score", { ascending: false })
    .limit(600);
  if (error) throw new Error(error.message);

  const hoy = new Date();
  const vencidos: Pendiente[] = [];
  const huerfanos: Pendiente[] = [];
  let agotados = 0;

  for (const p of (data ?? []) as any[]) {
    const toques = p.intentos_llamada ?? 0;
    if (toques >= MAX_TOQUES) {
      agotados++;
      continue;
    }
    const vence = proximoToque(p.ultimo_intento_llamada, toques);
    const diasVencido = vence
      ? Math.floor((hoy.getTime() - vence.getTime()) / 86_400_000)
      : 0;

    const fila: Pendiente = {
      id: p.id,
      nombre: p.nombre,
      comuna: p.comuna,
      telefono: p.telefono,
      score: p.score,
      toques,
      ultimo: p.ultimo_intento_llamada,
      vence: vence ? vence.toISOString().slice(0, 10) : null,
      diasVencido,
    };

    if (toques === 0) {
      const dias = Math.floor(
        (hoy.getTime() - new Date(p.created_at).getTime()) / 86_400_000,
      );
      if (dias >= 7) huerfanos.push({ ...fila, diasVencido: dias });
    } else if (diasVencido > 0) {
      vencidos.push(fila);
    }
  }

  vencidos.sort((a, b) => b.diasVencido - a.diasVencido || b.score - a.score);
  huerfanos.sort((a, b) => b.score - a.score || b.diasVencido - a.diasVencido);

  return {
    vencidos: vencidos.slice(0, limite),
    huerfanos: huerfanos.slice(0, limite),
    agotados,
    totalActivos: (data ?? []).length,
  };
}

/** Totales sin recortar, para los indicadores del dashboard. */
export async function conteosCadencia(): Promise<{
  vencidos: number;
  huerfanos: number;
  agotados: number;
}> {
  const e = await estadoCadencia(10_000);
  return {
    vencidos: e.vencidos.length,
    huerfanos: e.huerfanos.length,
    agotados: e.agotados,
  };
}
