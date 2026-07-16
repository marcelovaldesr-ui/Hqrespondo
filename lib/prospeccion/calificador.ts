/**
 * CALIFICADOR de respuestas.
 *
 * Cada corrida (cada ~2 h): lee respuestas recientes de Gmail, las casa con el
 * prospecto (por gmail_thread_id o por email del remitente), las clasifica con
 * Gemini en positivo/neutral/negativo y actúa:
 *   - positivo → notifica al equipo por Telegram EN TIEMPO REAL + estado
 *     'demo_agendada' (lead caliente, sale del automático: lo cierra un humano).
 *   - negativo → estado 'descartado_agente', se detiene la secuencia.
 *   - neutral  → 'respondio', se pausa el automático (que lo vea un humano).
 *
 * En todos los casos deja de mandarle toques automáticos: quien respondió ya
 * no recibe la secuencia fría.
 */
import { db } from "../db";
import { geminiJson } from "../gemini";
import { leerRespuestas, type RespuestaGmail } from "./email";
import { alertaLeadCaliente } from "./telegram";
import { log } from "./logger";

type Clasificacion = "positivo" | "neutral" | "negativo";

const ESTADO_POR_CLASE: Record<Clasificacion, string> = {
  positivo: "demo_agendada",
  neutral: "respondio",
  negativo: "descartado_agente",
};

/** Extrae el email "puro" de un header From tipo "Nombre <x@y.cl>". */
function emailDeFrom(from: string): string | null {
  const m = from.match(/<([^>]+)>/) ?? from.match(/([^\s<>]+@[^\s<>]+)/);
  return m ? m[1].toLowerCase() : null;
}

/** Clasifica un extracto de respuesta. Default seguro: 'neutral'. */
async function clasificar(extracto: string, negocio: string): Promise<Clasificacion> {
  try {
    const prompt = `Clasifica esta respuesta de email a un mensaje de prospección comercial de Respondo (asistente de WhatsApp para pymes). Negocio: "${negocio}".

Respuesta recibida:
"""
${extracto}
"""

Devuelve SOLO JSON: {"clase":"positivo|neutral|negativo"}
- positivo = muestra interés, pide info, quiere reunión/demo, pregunta precio.
- neutral = interés tibio, "más adelante", pide que escriba en otra fecha, fuera de oficina/autoresponder.
- negativo = no le interesa, pide no ser contactado, molesto.`;
    const out = await geminiJson<{ clase?: string }>(prompt, undefined, {
      temperature: 0,
      maxOutputTokens: 40,
      thinkingConfig: { thinkingBudget: 0 },
    });
    const c = String(out?.clase ?? "").toLowerCase();
    return c === "positivo" || c === "negativo" ? c : "neutral";
  } catch {
    return "neutral";
  }
}

interface Prospecto {
  id: string;
  nombre: string;
  rubro: string | null;
  comuna: string | null;
  telefono: string | null;
  contacto_nombre: string | null;
  contacto_email: string | null;
  contacto_celular: string | null;
  contacto_linkedin: string | null;
}

/** Busca el prospecto de una respuesta: primero por hilo, luego por email. */
async function casarProspecto(r: RespuestaGmail): Promise<Prospecto | null> {
  const sel =
    "id,nombre,rubro,comuna,telefono,contacto_nombre,contacto_email,contacto_celular,contacto_linkedin";
  // 1) Por threadId (lo guardamos al enviar el primer email).
  const porHilo = await db()
    .from("prospects")
    .select(sel)
    .eq("gmail_thread_id", r.threadId)
    .limit(1)
    .maybeSingle();
  if (porHilo.data) return porHilo.data as Prospecto;

  // 2) Por email del remitente.
  const email = emailDeFrom(r.from);
  if (!email) return null;
  const porEmail = await db()
    .from("prospects")
    .select(sel)
    .eq("contacto_email", email)
    .limit(1)
    .maybeSingle();
  return (porEmail.data as Prospecto) ?? null;
}

export interface ResultadoRevision {
  revisadas: number;
  casadas: number;
  positivos: number;
  neutrales: number;
  negativos: number;
}

/** Corrida completa del calificador. */
export async function revisarRespuestas(horas = 3): Promise<ResultadoRevision> {
  const respuestas = await leerRespuestas(horas);
  const res: ResultadoRevision = {
    revisadas: respuestas.length,
    casadas: 0,
    positivos: 0,
    neutrales: 0,
    negativos: 0,
  };

  for (const r of respuestas) {
    const p = await casarProspecto(r);
    if (!p) continue; // respuesta no ligada a un prospecto nuestro
    res.casadas++;

    const clase = await clasificar(r.extracto, p.nombre);
    res[
      clase === "positivo" ? "positivos" : clase === "negativo" ? "negativos" : "neutrales"
    ]++;

    // Idempotencia mínima: no re-notificar si ya está cerrado como demo.
    await db()
      .from("prospects")
      .update({
        prospeccion_estado: ESTADO_POR_CLASE[clase],
        ultima_clasificacion: clase,
        proximo_toque_at: null, // detiene la secuencia automática
        updated_at: new Date().toISOString(),
      })
      .eq("id", p.id)
      .neq("prospeccion_estado", "demo_agendada");

    await log({
      prospectId: p.id,
      tipo: "clasificacion",
      canal: "email",
      detalle: { clase, from: r.from, extracto: r.extracto.slice(0, 200) },
    });

    if (clase === "positivo") {
      const notificado = await alertaLeadCaliente({
        nombre: p.nombre,
        rubro: p.rubro,
        comuna: p.comuna,
        contacto_nombre: p.contacto_nombre,
        contacto_email: p.contacto_email,
        contacto_celular: p.contacto_celular,
        contacto_linkedin: p.contacto_linkedin,
        telefono: p.telefono,
        extracto: r.extracto,
      });
      await log({
        prospectId: p.id,
        tipo: "notificacion",
        canal: "telegram",
        detalle: { enviado: notificado },
      });
    }
  }

  return res;
}
