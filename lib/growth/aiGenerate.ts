import { geminiJson } from "@/lib/gemini";
import { PLAN_LABEL, PLAN_PRECIOS, type Plan } from "@/lib/types";
import { rubroPorSlug } from "./industries";
import type { CarouselDraft, Funnel, VideoScript } from "./types";
import type { CarouselInput, ScriptInput } from "./generators";

/**
 * GROWTH · Generación con IA (Gemini). Server-only (usa GEMINI_API_KEY vía
 * lib/gemini). El modelo redacta SOLO las partes creativas; el código rellena
 * los campos estructurales/tipados (id, pilar, funnel, etc.), así una respuesta
 * incompleta nunca produce un objeto inválido. Si la respuesta no trae lo mínimo
 * (slides/escenas), lanza y el endpoint cae a las plantillas deterministas.
 */

const PLANES_ORD: Plan[] = ["esencial", "cotizador", "pro"];
const PRECIOS = PLANES_ORD.map(
  (k) => `${PLAN_LABEL[k]} $${PLAN_PRECIOS[k].mensual.toLocaleString("es-CL")}/mes`,
).join(", ") + ", Empresa a medida";

const REGLAS = `Eres el copywriter de Respondo, una startup chilena que implementa asistentes de ventas con IA para el WhatsApp de pymes.
TONO: habla del dolor y del resultado, nunca de la tecnología. Frases cortas, una idea por línea, 2ª persona, máximo 1–2 emojis funcionales. Español de Chile/LATAM neutro.
PROHIBIDO usar: "revolucionario", "disruptivo", "solución integral", "potenciar", "vende 10x", "reemplaza a tu equipo", "chatbot mágico". Nada de promesas infladas.
NO INVENTES precios ni cifras. Si mencionas precios usa exactamente: ${PRECIOS}.
ÚNICOS datos de mercado permitidos (cítalos como datos de mercado, NO como resultados de Respondo): el 78% le compra al primer negocio que responde; responder en menos de 1 minuto convierte hasta 8x más; el promedio en LATAM es de 2 a 4 horas; cada minuto de demora resta 3–5% de probabilidad de cierre.
DIFERENCIADORES: el asistente no inventa y deriva a un humano cuando no sabe; implementación acompañada ("no te dejamos solo"); hablas directo con los fundadores.
QUÉ HACE EL PRODUCTO: responde al instante, cotiza con la lista real del negocio, agenda y registra cada lead, 24/7.`;

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

type CarouselAI = {
  titulo?: string;
  slides?: { rol?: string; texto?: string; nota_visual?: string }[];
  caption?: string;
  hashtags?: string[];
  cta?: string;
};

export async function aiCarrusel(input: CarouselInput): Promise<CarouselDraft> {
  const n = Math.min(8, Math.max(4, input.nSlides ?? 6));
  const prompt = `${REGLAS}

TAREA: Crea un carrusel de Instagram de exactamente ${n} slides.
Tema/ángulo: ${input.tema}
Pilar de contenido: ${input.pilar}
Nivel de venta: ${input.nivelVenta} (suave = guardar/compartir; medio = probar la demo; directo = agendar/piloto).
${contextoRubro(input.rubro)}
El primer slide debe ser el hook (rol "hook"), los del medio "desarrollo" y el último un cierre con CTA (rol "cierre").

Devuelve SOLO un JSON válido, sin markdown ni explicación, con esta forma exacta:
{"titulo":"","slides":[{"rol":"hook|desarrollo|cierre","texto":"","nota_visual":""}],"caption":"","hashtags":["",""],"cta":""}`;

  const out = await geminiJson<CarouselAI>(prompt);
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
    titulo: out.titulo?.trim() || input.tema,
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
      "Generado con IA — revisa tono, precios y datos antes de publicar. Una idea por slide, paleta violeta/coral.",
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
  const prompt = `${REGLAS}

TAREA: Crea un guion para un video corto (Reel) de ${dur} para Instagram.
Tema/ángulo: ${input.tema}
Pilar de contenido: ${input.pilar}
Nivel de venta: ${input.nivelVenta}.
${contextoRubro(input.rubro)}
El hook debe enganchar en los primeros 3 segundos (pattern interrupt). Cada escena tiene qué se ve, texto en pantalla y voz en off.

Devuelve SOLO un JSON válido, sin markdown ni explicación, con esta forma exacta:
{"titulo":"","hook":"","escenas":[{"escena":"","texto_pantalla":"","voz":""}],"cta":"","version_corta":"","notas_edicion":""}`;

  const out = await geminiJson<ScriptAI>(prompt);
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
    titulo: out.titulo?.trim() || input.tema,
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
