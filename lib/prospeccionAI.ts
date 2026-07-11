import { geminiJson } from "./gemini";
import { rubroPorSlug } from "./growth/industries";
import { matchRubroSlug } from "./growth/match";

/**
 * Motor de mensajes de prospección con VOZ REAL de fundador.
 *
 * El problema que resuelve: el generador anterior sonaba a plantilla masiva
 * (abría citando el rating de Google, usaba jerga como "solución/automatizar/IA"
 * y cerraba con "¿te gustaría saber más?"). Aquí centralizamos:
 *  - las reglas de tono (de estrategia-comercial/MENSAJES_PROSPECCION_RESPONDO.md),
 *  - el ANCLA por rubro: el mensaje_prospeccion ya bien escrito de lib/growth/
 *    industries.ts, que se le pasa a Gemini como ejemplo de tono a IMITAR,
 *  - y los generadores de variantes por tipo de toque.
 * Lo usan tanto scoring.ts (batch, primer mensaje) como la ruta on-demand.
 */

const DEMO = process.env.NEXT_PUBLIC_DEMO_LINK || "[link demo]";

export const PROHIBIDO =
  '"revolucionario", "disruptivo", "solución", "solución integral", "potenciar", "optimizar", "automatizar", "inteligencia artificial" / "IA" como muletilla, "¿te gustaría saber más?", "¿quieres conocer más?", "negocios como el tuyo", "aprovecha", frases motivacionales vacías';

export const REGLAS_TONO = `REGLAS DE TONO (obligatorias):
- Eres Marcelo, uno de los dos fundadores de Respondo, escribiendo TÚ MISMO a un negocio real por WhatsApp. Tiene que sonar a persona, no a plantilla ni a bot.
- ABRE con el DOLOR ESPECÍFICO del rubro, en forma de PREGUNTA que el dueño se pueda contestar solo sobre su día a día. Prohibido abrir citando el rating o las reseñas de Google: un dato de Google NO es una observación personal, delata el copiar y pegar.
- Habla del dolor y del resultado, NUNCA de la tecnología. Frases cortas, una idea por línea, 2ª persona, español de Chile/LATAM neutro. Máximo 1–2 emojis funcionales.
- El primer toque NO vende: abre conversación. El cierre es una acción concreta ("pruébalo como cliente en la demo", "¿alcanzan a responder los mensajes de la noche?"), nunca un "¿te gustaría saber más?".
- PROHIBIDO usar: ${PROHIBIDO}.
- Nada de promesas de cifras de ventas ni "duplicar" nada.`;

/** Ancla de estilo: el mensaje real del rubro (de industries.ts) para imitar el tono. */
export function anclaRubro(rubroTexto: string | null | undefined): string {
  const slug = matchRubroSlug(rubroTexto ?? null);
  const r = slug ? rubroPorSlug(slug) : null;
  if (r) {
    return `RUBRO: ${r.nombre}.
Dolor principal del rubro (úsalo para abrir): ${r.dolores[0]}
Ejemplo escrito CON EL TONO CORRECTO (imítalo, NO lo copies textual, cambia las palabras): "${r.mensaje_prospeccion}"`;
  }
  // Sin rubro reconocido → ancla genérica (mensajes 1–4 de MENSAJES_PROSPECCION).
  return `Rubro sin ficha específica. Tono de referencia (imítalo, no lo copies): "Hola, soy Marcelo de Respondo 👋 Una consulta corta: cuando les escriben por WhatsApp fuera de horario, ¿alcanzan a responder o se quedan consultas en el camino?"`;
}

const GEN: Record<string, unknown> = {
  temperature: 1.0,
  topP: 0.95,
  maxOutputTokens: 600,
  thinkingConfig: { thinkingBudget: 0 },
};

export type TipoMensaje = "primero" | "follow1" | "reactivacion";

export interface ProspectoMin {
  nombre: string;
  rubro: string | null;
  comuna?: string | null;
  notas?: string | null;
}

function tarea(tipo: TipoMensaje, p: ProspectoMin): string {
  if (tipo === "follow1")
    return `Escribe un FOLLOW-UP para ${p.nombre} (2–3 días sin respuesta al primer mensaje). Corto (3–4 líneas), aporta algo de valor e invita a ver la demo funcionando → ${DEMO}. NUNCA escribas "¿viste mi mensaje?".`;
  if (tipo === "reactivacion")
    return `Escribe un mensaje de REACTIVACIÓN para ${p.nombre} (2–4 semanas sin respuesta). Menciona la novedad real: ahora el PRIMER MES de servicio va gratis (el setup se cobra normal). Cierra dando una salida honesta si ya no le interesa.`;
  return `Escribe el PRIMER mensaje de WhatsApp frío para ${p.nombre}. Abre con el dolor del rubro en forma de pregunta. Si invitas a probar, usa el link de la demo → ${DEMO}. Máximo 55 palabras.`;
}

/** Genera 2 variantes (ángulos distintos) del mensaje pedido para un prospecto. */
export async function generarVariantes(
  tipo: TipoMensaje,
  p: ProspectoMin,
): Promise<string[]> {
  const notas = p.notas?.trim()
    ? `Notas del fundador tras hablar con este prospecto (úsalas para personalizar de verdad): ${p.notas.trim()}`
    : "";

  const prompt = `${anclaRubro(p.rubro)}
Negocio: ${p.nombre}${p.comuna ? ` (${p.comuna})` : ""}.
${notas}

${REGLAS_TONO}

TAREA: ${tarea(tipo, p)}
Dame DOS variantes con ÁNGULOS DISTINTOS de la misma idea (no dos veces casi lo mismo). Usa el nombre real del negocio ("${p.nombre}"), no dejes "[nombre]".

Responde SOLO con JSON válido, sin markdown: {"variantes":["variante 1","variante 2"]}`;

  const out = await geminiJson<{ variantes?: unknown[] }>(prompt, undefined, GEN);
  const vs = (out?.variantes ?? [])
    .map((v) => String(v).trim())
    .filter(Boolean)
    .slice(0, 2);
  if (vs.length === 0) throw new Error("La IA no devolvió variantes");
  return vs;
}
