import { geminiJson } from "./gemini";
import type { PlaceResult } from "./places";
import { REGLAS_TONO, anclaRubro } from "./prospeccionAI";
import { enriquecerBatch, type SenalesWeb } from "./enriquecimiento";
import { matchRubroSlug } from "./growth/match";
import { rubroPorSlug } from "./growth/industries";

/**
 * SCORING v2 — determinista + enriquecimiento web.
 *
 * v1 le pedía el score a Gemini (temperature 0.9): el mismo negocio podía
 * dar 60 hoy y 85 mañana, y la señal crítica (¿gestiona manual o ya está
 * automatizado?) no existía porque nunca se visitaba la web.
 *
 * v2 separa responsabilidades:
 *  - El SCORE se calcula EN CÓDIGO con reglas fijas + señales reales de la
 *    web del negocio (chatbot/reservas/e-commerce/CRM vía enriquecimiento.ts).
 *    Mismo negocio → mismo score, siempre, y auditable en score_detalle.
 *  - Gemini queda SOLO para lo que hace bien: redactar el primer mensaje.
 *    Si Gemini falla, el score sobrevive (ya no hay "50 por defecto").
 */

export interface ScoredPlace extends PlaceResult {
  score: number;
  razon_score: string;
  mensaje: string;
  senales_web: SenalesWeb;
  score_detalle: Record<string, number>;
}

interface MensajeRow {
  i: number;
  mensaje: string;
}

/** Calcula el score determinista de un negocio. Exportado para tests. */
export function calcularScore(
  p: PlaceResult,
  senales: SenalesWeb,
  rubro: string,
): { score: number; razon: string; detalle: Record<string, number> } {
  const detalle: Record<string, number> = { base: 30 };
  const razones: string[] = [];

  // Contactable
  if (p.telefono) {
    detalle.telefono = 10;
  } else {
    razones.push("sin teléfono");
  }

  // Rubro (usa la clasificación comercial de growth/industries)
  const slug = matchRubroSlug(rubro);
  const ficha = slug ? rubroPorSlug(slug) : null;
  if (ficha?.prioridad_comercial === "alta") {
    detalle.rubro = 20;
    razones.push(`rubro prioritario (${ficha.nombre})`);
  } else if (ficha) {
    detalle.rubro = 10;
  }

  // Negocio vivo (rating/reviews solo para el score, nunca para el mensaje)
  if ((p.rating ?? 0) >= 4.0 && (p.reviews ?? 0) >= 20) {
    detalle.negocio_vivo = 10;
    razones.push("negocio activo con clientes");
  }
  if ((p.reviews ?? 0) >= 100) detalle.volumen_clientes = 5;
  if ((p.reviews ?? 0) >= 800) {
    detalle.posible_cadena = -10;
    razones.push("posible cadena/gran empresa");
  }

  // Señales web — el corazón del criterio manual vs automatizado
  if (!senales.visitada) {
    detalle.sin_web_verificable = 10;
    razones.push("sin web propia verificable → probablemente gestiona manual");
  } else {
    const automatizado =
      senales.chatbot || senales.reservas || senales.ecommerce || senales.crm;
    if (!automatizado) {
      detalle.web_sin_automatizacion = 25;
      razones.push("web SIN chatbot ni reservas ni CRM → gestiona manual");
      if (senales.whatsapp_link) {
        detalle.whatsapp_manual = 5;
        razones.push("atiende por WhatsApp (link en su web)");
      }
    }
    if (senales.chatbot) {
      detalle.ya_tiene_chatbot = -30;
      razones.push(`ya tiene chatbot (${senales.chatbot})`);
    }
    if (senales.reservas) {
      detalle.ya_tiene_reservas = -25;
      razones.push(`ya agenda online (${senales.reservas})`);
    }
    if (senales.ecommerce) {
      detalle.tiene_ecommerce = -10;
      razones.push(`vende online (${senales.ecommerce})`);
    }
    if (senales.crm) {
      detalle.tiene_crm = -10;
      razones.push(`usa CRM/marketing (${senales.crm})`);
    }
  }

  const score = Math.max(
    0,
    Math.min(100, Object.values(detalle).reduce((a, b) => a + b, 0)),
  );
  return { score, razon: razones.join("; ") || "sin señales destacadas", detalle };
}

/**
 * Puntúa un batch de negocios (determinista) y genera el primer mensaje
 * de outreach con Gemini. Si Gemini falla, el score y las señales se
 * conservan y solo queda el mensaje vacío (regenerable después).
 */
export async function scoreProspects(
  places: PlaceResult[],
  rubro: string,
  comuna: string,
): Promise<ScoredPlace[]> {
  // 1) Enriquecimiento web en paralelo
  const senales = await enriquecerBatch(places.map((p) => p.web));

  // 2) Score determinista
  const scored = places.map((p, i) => {
    const { score, razon, detalle } = calcularScore(p, senales[i], rubro);
    return {
      ...p,
      score,
      razon_score: razon,
      mensaje: "",
      senales_web: senales[i],
      score_detalle: detalle,
    };
  });

  // 3) Gemini SOLO para el mensaje
  const lista = scored.map((p, i) => ({ i, nombre: p.nombre }));
  const ancla = anclaRubro(rubro);

  const prompt = `Eres Marcelo, uno de los dos fundadores de Respondo (servicio chileno que implementa asistentes de ventas en el WhatsApp de pymes: responden, cotizan y agendan). Vas a contactar negocios del rubro "${rubro}" en ${comuna}, Chile.

Para CADA negocio de la lista escribe "mensaje": el primer mensaje de WhatsApp, siguiendo al pie de la letra las reglas de abajo.

${ancla}

${REGLAS_TONO}

RECORDATORIO CLAVE: NO menciones rating ni reseñas de Google. Abre con el dolor del rubro en forma de pregunta. Máximo 55 palabras. Que suene a que lo escribiste mirando ese negocio, no a un envío masivo. No repitas la misma frase de apertura entre negocios del mismo rubro.

Negocios:
${JSON.stringify(lista, null, 2)}

Responde SOLO con un array JSON válido, sin texto adicional:
[{"i": 0, "mensaje": "..."}]`;

  try {
    const result = await geminiJson<MensajeRow[]>(prompt, undefined, {
      temperature: 0.9,
      topP: 0.95,
      thinkingConfig: { thinkingBudget: 0 },
    });
    const byIndex = new Map(result.map((r) => [r.i, r.mensaje]));
    return scored.map((p, i) => ({ ...p, mensaje: byIndex.get(i) ?? "" }));
  } catch {
    // El score determinista sobrevive; solo falta el mensaje.
    return scored;
  }
}
