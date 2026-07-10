import { geminiJson } from "@/lib/gemini";
import { PLAN_LABEL, PLAN_PRECIOS, type Plan } from "@/lib/types";
import { rubroPorSlug } from "./industries";
import type { CarouselDraft, Funnel, PilarKey, VideoScript } from "./types";
import type { CarouselInput, ScriptInput } from "./generators";

/**
 * GROWTH · Generación con IA (Gemini). Server-only (usa GEMINI_API_KEY vía
 * lib/gemini). El modelo redacta SOLO las partes creativas; el código rellena
 * los campos estructurales/tipados (id, pilar, funnel, etc.), así una respuesta
 * incompleta nunca produce un objeto inválido. Si la respuesta no trae lo mínimo
 * (slides/escenas), lanza y el endpoint cae a las plantillas deterministas.
 *
 * VARIEDAD: cada llamada inyecta un ángulo creativo, un estilo de hook y una
 * estructura elegidos al azar + un brief por pilar + un nonce, para que dos
 * generaciones del mismo tema/pilar salgan DISTINTAS (era el problema: convergían
 * siempre a la misma fórmula).
 */

const PLANES_ORD: Plan[] = ["esencial", "cotizador", "pro"];
const PRECIOS = PLANES_ORD.map(
  (k) => `${PLAN_LABEL[k]} $${PLAN_PRECIOS[k].mensual.toLocaleString("es-CL")}/mes`,
).join(", ") + ", Empresa a medida";

const REGLAS = `Eres el copywriter de Respondo, una startup chilena que implementa asistentes de ventas con IA para el WhatsApp de pymes.
TONO: habla del dolor y del resultado, nunca de la tecnología. Frases cortas, una idea por línea, 2ª persona, máximo 1–2 emojis funcionales. Español de Chile/LATAM neutro.
PROHIBIDO usar: "revolucionario", "disruptivo", "solución integral", "potenciar", "vende 10x", "reemplaza a tu equipo", "chatbot mágico". Nada de promesas infladas.
NO INVENTES precios ni cifras. EVITA poner listas de precios dentro de los slides: los precios van en la web y la propuesta, no en el carrusel; para hablar de valor usa la prueba 30 días. Si fuera imprescindible nombrar un precio, usa SOLO los vigentes: ${PRECIOS}.
NO menciones ningún "plan piloto" ni "Piloto Fundador": quedó descontinuado. La oferta de reversión de riesgo vigente es la prueba 30 días: si el asistente no ayuda a responder y cotizar más rápido, no se paga la mensualidad.
DATOS DE MERCADO permitidos (cítalos como dato de mercado, NO como resultado de Respondo): 78% le compra al primero que responde; responder en menos de 1 min convierte hasta 8x más; el promedio en LATAM es de 2 a 4 horas; cada minuto de demora resta 3–5% de cierre. Usa COMO MÁXIMO UNO por pieza (o NINGUNO); NO uses siempre el del 78%, varía.
DIFERENCIADORES: el asistente no inventa y deriva a un humano cuando no sabe; implementación acompañada ("no te dejamos solo"); hablas directo con los fundadores.
QUÉ HACE EL PRODUCTO: responde al instante, cotiza con la lista real del negocio, agenda y registra cada lead, 24/7.
IMPORTANTE — ORIGINALIDAD: NO repitas la fórmula típica "78% → responde al instante → no inventa → prueba 30 días". Cada pieza debe tener un ángulo fresco y distinto. Sorprende.`;

/** Config de generación: sin "thinking" (rápido, evita timeouts) + alta variación. */
const GEN_CONFIG: Record<string, unknown> = {
  temperature: 1.1,
  topP: 0.95,
  maxOutputTokens: 1600,
  thinkingConfig: { thinkingBudget: 0 },
};

const ANGULOS = [
  "una metáfora inesperada del día a día",
  "un error común que comete el negocio sin darse cuenta",
  "un mito que hay que derribar",
  "una mini-historia de un caso ilustrativo (rotúlalo como ejemplo)",
  "un contraste antes/después bien marcado",
  "una pregunta incómoda que hace pensar al dueño",
  "un cálculo simple de cuánta plata se pierde",
  "'lo que nadie te cuenta sobre responder por WhatsApp'",
  "un contraste temporal (mientras duermes / a las 2 AM / fin de semana)",
  "una checklist de señales de alerta",
  "desmontar una excusa típica del dueño",
  "el punto de vista del cliente que no recibió respuesta a tiempo",
  "una analogía con contratar a alguien vs. automatizar",
  "un 'y si…' que abre una posibilidad nueva",
];
const HOOKS = [
  "una afirmación audaz, casi polémica",
  "una pregunta directa en 2ª persona",
  "un número o dato que sorprende",
  "una escena cotidiana muy reconocible",
  "una verdad incómoda dicha sin rodeos",
  "un 'si… entonces…' que golpea",
  "una frase corta que genera curiosidad",
];
const ESTRUCTURAS = [
  "problema → por qué pasa → costo real → qué haría distinto → cómo empezar",
  "3 señales de que te está pasando → qué hacer al respecto",
  "mito vs realidad, alternando slides",
  "antes (caótico) → después (ordenado y bajo control)",
  "paso a paso de cómo se vería funcionando",
  "una objeción real → la respuesta que tranquiliza",
  "checklist de 4–5 puntos con un cierre potente",
  "una historia corta con inicio, giro y aprendizaje",
];
/** Temas semilla cuando el usuario no escribe tema y no hay rubro. */
const TEMAS_SEMILLA = [
  "el costo invisible de responder tarde por WhatsApp",
  "cuando el dueño termina atendiendo el WhatsApp a medianoche",
  "los leads que se enfrían mientras estás ocupado",
  "cotizar lo mismo 30 veces al día",
  "por qué un menú de botones frustra a tu cliente",
  "el cliente que se fue a la competencia por esperar",
  "qué se puede (y qué no) automatizar en la atención",
  "cómo se ve un WhatsApp ordenado vs. uno caótico",
  "responder al tiro sin contratar a nadie más",
  "las preguntas repetidas que te comen el día",
];

const PILAR_BRIEF: Record<PilarKey, string> = {
  problema: "Golpea el dolor de responder tarde/desordenado. Que el dueño se sienta identificado. NO vendas todavía; el CTA es guardar o etiquetar.",
  confianza: "Desarma el miedo a la IA: no inventa, deriva a humano, la implementación la hacemos nosotros. Genera tranquilidad.",
  producto: "Muestra CÓMO funciona de forma concreta y visual (responde / cotiza con lista real / agenda / deriva / registra el lead).",
  demo: "Invita a VIVIR el producto o muestra un caso ilustrativo rotulado (mockup, reto, conversación real).",
  rubros: "Habla específico al rubro, con su dolor puntual y su promesa; usa la fórmula 'beneficio sin dolor'.",
  objeciones: "Toma UNA objeción real del dueño y respóndela para que deje de frenar la compra.",
  comparacion: "Posiciona sin nombrar competidores: bots de botones vs asistente real, no necesitas un CRM completo, automatizar respuestas vs ventas.",
  educacion: "Enseña un concepto sin vender: qué es, cómo funciona, qué se puede automatizar. Aporta valor puro.",
  venta: "Mueve a la acción: prueba 30 días sin riesgo, qué incluye la implementación, cómo empezar.",
  founder: "Historia de los 2 fundadores construyendo Respondo desde Chile: cercano, honesto, sin humo.",
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function contextoRubro(slug: string | null | undefined): string {
  if (!slug) return "Contenido transversal (sin rubro específico).";
  const r = rubroPorSlug(slug);
  if (!r) return "Contenido transversal.";
  return `RUBRO: ${r.nombre}. Fórmula/hook base: "${r.formula_sin}". Dolores: ${r.dolores.join(" ")} Casos de uso: ${r.casos_uso.join(" ")}`;
}

function funnelPorDefecto(nivel: string, pilar: string): Funnel {
  if (nivel === "directo") return "decision";
  return pilar === "problema" ? "descubrimiento" : "consideracion";
}

/** Bloque de variedad que se inyecta en cada prompt (distinto cada vez). */
function bloqueVariedad(pilar: PilarKey): string {
  const nonce = Math.random().toString(36).slice(2, 8);
  return `BRIEF DE ESTE PILAR (${pilar}): ${PILAR_BRIEF[pilar] ?? ""}
PARA QUE SEA ÚNICO (variación ${nonce}, respétalo):
- Ángulo creativo: ${pick(ANGULOS)}.
- Estilo del hook (slide 1): ${pick(HOOKS)}.
- Estructura del carrusel/guion: ${pick(ESTRUCTURAS)}.
- Es la variación ${nonce}: NO repitas ideas ni frases de otras piezas; toma un camino diferente.`;
}

type CarouselAI = {
  titulo?: string;
  slides?: { rol?: string; texto?: string; nota_visual?: string }[];
  caption?: string;
  hashtags?: string[];
  cta?: string;
};

export async function aiCarrusel(input: CarouselInput): Promise<CarouselDraft> {
  const n = Math.min(8, Math.max(4, input.nSlides ?? 6));
  const rc = input.rubro ? rubroPorSlug(input.rubro) : null;
  const tema =
    input.tema?.trim() || (rc ? rc.formula_sin : pick(TEMAS_SEMILLA));

  const extras = [
    input.objetivo?.trim()
      ? `Objetivo comercial de esta pieza: ${input.objetivo.trim()} — oriénta el contenido a eso.`
      : "",
    input.cta?.trim()
      ? `CTA deseado para el cierre: "${input.cta.trim()}" — úsalo tal cual o mejóralo levemente.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `${REGLAS}

${bloqueVariedad(input.pilar)}

TAREA: Crea un carrusel de Instagram de exactamente ${n} slides.
Tema/ángulo de partida: ${tema}
${contextoRubro(input.rubro)}
${extras}
El último slide (cierre) refleja el NIVEL DE VENTA = ${input.nivelVenta}: suave → invita a guardar o compartir; medio → invita a probar la demo; directo → pide agendar una demo o escribir por DM. Nunca dibujes un botón que redirija dentro del post; usa "link en la bio" o "escríbenos por DM".
El primer slide es el hook (rol "hook"), los del medio "desarrollo" y el último el cierre (rol "cierre").

Devuelve SOLO un JSON válido, sin markdown ni explicación, con esta forma exacta:
{"titulo":"","slides":[{"rol":"hook|desarrollo|cierre","texto":"","nota_visual":""}],"caption":"","hashtags":["",""],"cta":""}`;

  const out = await geminiJson<CarouselAI>(prompt, undefined, GEN_CONFIG);
  const slides = (out?.slides ?? [])
    .map((s) => {
      const rolRaw = String(s?.rol);
      const rol: "hook" | "desarrollo" | "cierre" =
        rolRaw === "hook" || rolRaw === "cierre" ? rolRaw : "desarrollo";
      return {
        rol,
        texto: String(s?.texto ?? "").trim(),
        nota_visual: s?.nota_visual ? String(s.nota_visual) : undefined,
      };
    })
    .filter((s) => s.texto);
  if (slides.length === 0) throw new Error("La IA no devolvió slides válidas");

  return {
    id: `ai-carr-${Date.now()}`,
    titulo: out.titulo?.trim() || tema,
    pilar: input.pilar,
    rubro: input.rubro ?? null,
    objetivo: input.objetivo?.trim() || "Generar demanda y apoyar la prospección",
    funnel: input.funnel ?? funnelPorDefecto(input.nivelVenta, input.pilar),
    nivel_venta: input.nivelVenta,
    slides,
    caption: out.caption?.trim() || "",
    hashtags: Array.isArray(out.hashtags) ? out.hashtags.slice(0, 8).map((h) => String(h)) : [],
    cta: out.cta?.trim() || input.cta?.trim() || "Prueba la demo",
    notas_visuales:
      "Generado con IA — revisa tono, precios y datos antes de publicar. Una idea por slide, paleta índigo/coral.",
  };
}

type ScriptAI = {
  titulo?: string;
  hook?: string;
  escenas?: { escena?: string; texto_pantalla?: string; voz?: string }[];
  cta?: string;
  version_corta?: string;
  notas_edicion?: string;
};

export async function aiGuion(input: ScriptInput): Promise<VideoScript> {
  const dur = input.duracion?.trim() || "20-30s";
  const rc = input.rubro ? rubroPorSlug(input.rubro) : null;
  const tema = input.tema?.trim() || (rc ? rc.formula_sin : pick(TEMAS_SEMILLA));

  const extras = input.objetivo?.trim()
    ? `Objetivo comercial: ${input.objetivo.trim()} — oriénta el guion a eso.`
    : "";

  const prompt = `${REGLAS}

${bloqueVariedad(input.pilar)}

TAREA: Crea un guion para un video corto (Reel) de ${dur} para Instagram.
Tema/ángulo de partida: ${tema}
${contextoRubro(input.rubro)}
${extras}
El cierre refleja el nivel de venta = ${input.nivelVenta} (suave → guardar/seguir; medio → probar la demo; directo → agendar o escribir por DM).
El hook debe enganchar en los primeros 3 segundos (pattern interrupt). Cada escena tiene qué se ve, texto en pantalla y voz en off.

Devuelve SOLO un JSON válido, sin markdown ni explicación, con esta forma exacta:
{"titulo":"","hook":"","escenas":[{"escena":"","texto_pantalla":"","voz":""}],"cta":"","version_corta":"","notas_edicion":""}`;

  const out = await geminiJson<ScriptAI>(prompt, undefined, GEN_CONFIG);
  const escenas = (out?.escenas ?? [])
    .map((e) => ({
      escena: String(e?.escena ?? "").trim(),
      texto_pantalla: e?.texto_pantalla ? String(e.texto_pantalla) : undefined,
      voz: e?.voz ? String(e.voz) : undefined,
    }))
    .filter((e) => e.escena || e.voz);
  if (escenas.length === 0) throw new Error("La IA no devolvió escenas válidas");

  return {
    id: `ai-vid-${Date.now()}`,
    titulo: out.titulo?.trim() || tema,
    tipo: input.tipo ?? (input.rubro ? "rubro" : input.pilar),
    pilar: input.pilar,
    rubro: input.rubro ?? null,
    canal: "instagram",
    duracion: dur,
    objetivo: input.objetivo?.trim() || "Generar demanda y llevar a la demo",
    funnel: input.funnel ?? funnelPorDefecto(input.nivelVenta, input.pilar),
    nivel_venta: input.nivelVenta,
    hook: out.hook?.trim() || "",
    escenas,
    cta: out.cta?.trim() || "Pruébalo en la demo",
    version_corta: out.version_corta ? String(out.version_corta) : undefined,
    notas_edicion:
      out.notas_edicion?.trim() ||
      "Generado con IA — revisa antes de publicar. Subtítulos grandes, corta silencios.",
  };
}
