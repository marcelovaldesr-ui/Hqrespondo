import { geminiJson } from "./gemini";
import type { PlaceResult } from "./places";

export interface ScoredPlace extends PlaceResult {
  score: number;
  razon_score: string;
  mensaje: string;
}

interface ScoreRow {
  i: number;
  score: number;
  razon: string;
  mensaje: string;
}

/**
 * Puntúa un batch de negocios (0-100) y genera el primer mensaje
 * de outreach personalizado. Si Gemini falla, devuelve score 50
 * para no perder los datos del scraping.
 */
export async function scoreProspects(
  places: PlaceResult[],
  rubro: string,
  comuna: string,
): Promise<ScoredPlace[]> {
  const lista = places.map((p, i) => ({
    i,
    nombre: p.nombre,
    telefono: p.telefono,
    web: p.web,
    rating: p.rating,
    reviews: p.reviews,
  }));

  const prompt = `Eres el asistente de prospección de Respondo, un servicio chileno que instala bots de WhatsApp con IA para pymes (responden, cotizan y agendan automáticamente). Marcelo, su fundador, va a contactar negocios del rubro "${rubro}" en ${comuna}, Chile.

Para CADA negocio de la lista, entrega:
1. "score" (0-100): qué tan buen prospecto es para Respondo.
   - +20 si tiene teléfono (contactable por WhatsApp).
   - +20 si NO tiene sitio web o parece tener presencia digital débil (más necesidad).
   - +20 si el rubro cotiza o agenda frecuentemente (dental, taller, ferretería, estética, servicios).
   - +20 si tiene rating >= 4.0 con 20+ reviews (negocio vivo, con clientes).
   - +20 base si nada lo descarta. Resta si parece cadena grande o institución pública.
2. "razon": una frase corta con el porqué del score.
3. "mensaje": primer mensaje de WhatsApp para ese negocio. Español de Chile, cercano pero profesional, máximo 55 palabras. Estructura: saludo con nombre del negocio → un dato concreto del negocio (rating, rubro, etc.) → qué hace Respondo en una frase → pregunta simple para abrir conversación. SIN promesas exageradas, SIN emojis excesivos (máximo 1), SIN sonar a spam masivo.

Negocios:
${JSON.stringify(lista, null, 2)}

Responde SOLO con un array JSON válido, sin texto adicional:
[{"i": 0, "score": 85, "razon": "...", "mensaje": "..."}]`;

  // EXPERIMENTAL: grounding con Google Maps (datos frescos del negocio).
  // Actívalo con GEMINI_MAPS_GROUNDING=1 — requiere modelo Gemini 3.x para
  // la cuota gratis (5.000 prompts/mes); en 2.x se cobra aparte.
  const tools =
    process.env.GEMINI_MAPS_GROUNDING === "1" ? [{ google_maps: {} }] : undefined;

  try {
    const result = await geminiJson<ScoreRow[]>(prompt, tools);
    const byIndex = new Map(result.map((r) => [r.i, r]));
    return places.map((p, i) => {
      const r = byIndex.get(i);
      return {
        ...p,
        score: Math.max(0, Math.min(100, r?.score ?? 50)),
        razon_score: r?.razon ?? "",
        mensaje: r?.mensaje ?? "",
      };
    });
  } catch {
    return places.map((p) => ({
      ...p,
      score: 50,
      razon_score: "Score por defecto (falló la IA, reintentar)",
      mensaje: "",
    }));
  }
}
