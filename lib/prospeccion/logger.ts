/**
 * Logging estructurado del agente.
 *
 * Doble destino:
 *  - console (aparece en los logs de Vercel / de la corrida del script), y
 *  - tabla prospeccion_eventos en Supabase = fuente de verdad DURABLE. En
 *    Vercel el filesystem es de solo lectura, por eso el .log de archivo NO
 *    es la fuente confiable; la tabla sí. Si estás corriendo local, además se
 *    intenta anexar a logs/prospeccion.log (best-effort, nunca rompe).
 *
 * Regla de oro: loguear NUNCA debe tirar el pipeline. Todo va envuelto.
 */
import { db } from "../db";

export type TipoEvento =
  | "enriquecimiento"
  | "email_enviado"
  | "linkedin_redactado"
  | "respuesta"
  | "clasificacion"
  | "notificacion"
  | "error"
  | "sistema";

interface EventoInput {
  prospectId?: string | null;
  tipo: TipoEvento;
  canal?: string | null;
  toqueNum?: number | null;
  detalle?: Record<string, unknown>;
}

function aArchivo(linea: string) {
  // Best-effort: solo funciona corriendo local; en serverless se ignora.
  try {
    // require dinámico para no romper el bundle de Next si no hay fs.
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    const dir = path.join(process.cwd(), "logs");
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, "prospeccion.log"), linea + "\n");
  } catch {
    /* serverless o sin permisos: ok, la tabla es la fuente durable */
  }
}

/** Registra un evento en consola + Supabase (+ archivo si se puede). */
export async function log(ev: EventoInput): Promise<void> {
  const ts = new Date().toISOString();
  const linea = `[${ts}] ${ev.tipo}${ev.canal ? `/${ev.canal}` : ""}${
    ev.prospectId ? ` prospect=${ev.prospectId}` : ""
  } ${JSON.stringify(ev.detalle ?? {})}`;

  // Consola siempre.
  if (ev.tipo === "error") console.error(linea);
  else console.log(linea);
  aArchivo(linea);

  // Supabase (durable). Envuelto: si falla, no arrastra el pipeline.
  try {
    await db()
      .from("prospeccion_eventos")
      .insert({
        prospect_id: ev.prospectId ?? null,
        tipo: ev.tipo,
        canal: ev.canal ?? null,
        toque_num: ev.toqueNum ?? null,
        detalle: ev.detalle ?? {},
      });
  } catch (e) {
    console.error(`[${ts}] error: no se pudo persistir evento`, e);
  }
}

/** Cuenta eventos de un tipo en las últimas `horas` horas (para rate-limit). */
export async function contarRecientes(
  tipo: TipoEvento,
  horas: number,
): Promise<number> {
  const desde = new Date(Date.now() - horas * 3600_000).toISOString();
  try {
    const { count } = await db()
      .from("prospeccion_eventos")
      .select("id", { count: "exact", head: true })
      .eq("tipo", tipo)
      .gte("created_at", desde);
    return count ?? 0;
  } catch {
    // Si no podemos contar, asumimos "muchos" para no pasarnos del límite.
    return Number.MAX_SAFE_INTEGER;
  }
}
