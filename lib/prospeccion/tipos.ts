/**
 * Tipos y configuración compartida del agente de prospección.
 *
 * Un solo lugar para la SECUENCIA de toques y los límites de tasa, para que
 * cambiar la cadencia sea editar datos, no lógica. Todo lo ajustable vive en
 * variables de entorno con defaults sensatos.
 */

/** Fila mínima de prospects que el agente necesita leer/escribir. */
export interface ProspectoAgente {
  id: string;
  nombre: string;
  rubro: string | null;
  comuna: string | null;
  telefono: string | null;
  web: string | null;
  notas: string | null;
  contacto_nombre: string | null;
  contacto_email: string | null;
  contacto_linkedin: string | null;
  contacto_celular: string | null;
  contacto_confianza: string | null;
  prospeccion_estado: string;
  enriquecer_intentos: number;
  toque_num: number;
  proximo_toque_at: string | null;
  gmail_thread_id: string | null;
}

export type Canal = "email" | "linkedin";

/** Un paso de la secuencia. dia = días desde el primer toque (día 1 = arranque). */
export interface Toque {
  num: number;
  dia: number;
  canal: Canal;
  /** Tipo semántico para elegir el ángulo del mensaje. */
  angulo:
    | "apertura"          // día 1 email: dolor del rubro + demo
    | "conexion_linkedin" // día 1 LinkedIn: connection request <300 chars
    | "caso_exito"        // email 2: prueba social de rubro similar
    | "pregunta_abierta"  // email 3: una sola pregunta fácil de responder
    | "mensaje_linkedin"  // LinkedIn message (si aceptó la conexión)
    | "cierre";           // email 4: última llamada honesta
}

/**
 * SECUENCIA (editable). email = se envía solo. linkedin = el agente REDACTA
 * y lo deja listo para que el humano lo envíe a mano (cero riesgo de baneo).
 */
export const SECUENCIA: Toque[] = [
  { num: 1, dia: 1, canal: "email", angulo: "apertura" },
  { num: 2, dia: 1, canal: "linkedin", angulo: "conexion_linkedin" },
  { num: 3, dia: 3, canal: "email", angulo: "caso_exito" },
  { num: 4, dia: 5, canal: "email", angulo: "pregunta_abierta" },
  { num: 5, dia: 7, canal: "linkedin", angulo: "mensaje_linkedin" },
  { num: 6, dia: 10, canal: "email", angulo: "cierre" },
];

/** Configuración de tasa/lotes leída de entorno (con defaults conservadores). */
export function config() {
  const n = (k: string, def: number) => {
    const v = Number(process.env[k]);
    return Number.isFinite(v) && v > 0 ? v : def;
  };
  return {
    // Cuántos prospectos enriquece / cuántos emails manda POR CORRIDA del cron.
    // Chico a propósito: mantiene cada invocación bajo el límite de tiempo de
    // Vercel y reparte la carga entre varias corridas del día.
    enriquecerPorCorrida: n("PROS_ENRIQUECER_LOTE", 6),
    emailsPorCorrida: n("PROS_EMAILS_LOTE", 6),
    // Rate limits duros (se cuentan contra prospeccion_eventos).
    emailsPorHora: n("PROS_EMAILS_HORA", 30),
    linkedinPorDia: n("PROS_LINKEDIN_DIA", 20),
    // Reintentos de enriquecimiento antes de rendirse.
    maxIntentosEnriquecer: n("PROS_MAX_INTENTOS", 3),
    // Umbral de lista de oro.
    scoreMinimo: n("PROS_SCORE_MIN", 70),
    // Ventana horaria de envío (hora local Chile, 24h). Fuera de esto no manda.
    horaInicio: n("PROS_HORA_INICIO", 9),
    horaFin: n("PROS_HORA_FIN", 19),
  };
}

/** Remitente configurado (nombre + email de la cuenta de outreach). */
export function remitente() {
  return {
    nombre: process.env.PROS_FROM_NOMBRE || "Marcelo · Respondo",
    email: process.env.GMAIL_FROM || "",
  };
}
