import type {
  CarouselDraft,
  CarouselSlide,
  ContentIdea,
  Funnel,
  NivelVenta,
  PilarKey,
  VideoScene,
  VideoScript,
} from "./types";
import { RUBROS, rubroPorSlug } from "./industries";
import { BATTLECARDS } from "./battlecards";
import { COPIES } from "./copies";

/**
 * GENERADORES basados en plantillas (deterministas, sin IA externa).
 * Ensamblan piezas a partir de la estrategia real: fórmula "sin" por rubro,
 * datos-ancla, reglas de tono y CTAs por nivel de venta. Si más adelante se
 * conecta un modelo (Gemini ya está en el proyecto para scoring/brief), estos
 * generadores pueden alimentarlo como estructura base — ver ROADMAP.
 */

const DATOS_ANCLA = [
  "El 78% le compra al primer negocio que responde",
  "Un lead respondido en menos de 1 minuto convierte hasta 8x más",
  "El promedio en LATAM para contestar un WhatsApp es de 2 a 4 horas",
  "Cada minuto de demora resta 3–5% de probabilidad de cierre",
];

const CTA_POR_NIVEL: Record<NivelVenta, string> = {
  suave: "Guarda esto y compártelo con quien le pase.",
  medio: "Pruébalo tú mismo en la demo (link en la bio).",
  directo: "Agenda una demo de 20 minutos — quedan cupos del Piloto Fundador.",
};

const HOOK_POR_PILAR: Record<PilarKey, (tema: string) => string> = {
  problema: (t) => `${t}: y no te das cuenta hasta que ya perdiste la venta`,
  confianza: (t) => `"${t}" — la duda honesta que frena a todos`,
  producto: (t) => `Así funciona ${t.toLowerCase()} en Respondo`,
  demo: (t) => `Le pedí a nuestro bot ${t.toLowerCase()}. Mira qué pasó`,
  rubros: (t) => `${t}`,
  objeciones: (t) => `"${t}" — te respondo derecho`,
  comparacion: (t) => `${t}: no es lo mismo, y se nota en la venta`,
  educacion: (t) => `${t} explicado en 6 pasos`,
  venta: (t) => `${t}: lo que necesitas saber para partir`,
  founder: (t) => `${t}: te lo contamos sin filtro`,
};

export interface CarouselInput {
  tema: string;
  pilar: PilarKey;
  rubro?: string | null;
  objetivo?: string;
  nivelVenta: NivelVenta;
  nSlides?: number; // 4–8
  cta?: string;
  funnel?: Funnel;
}

export function generarCarrusel(input: CarouselInput): CarouselDraft {
  const nSlides = Math.min(8, Math.max(4, input.nSlides ?? 6));
  const rubro = input.rubro ? rubroPorSlug(input.rubro) : null;
  const cta = input.cta?.trim() || CTA_POR_NIVEL[input.nivelVenta];

  const slides: CarouselSlide[] = [];
  // Slide 1 — hook
  const hookBase = rubro
    ? rubro.formula_sin
    : HOOK_POR_PILAR[input.pilar](input.tema);
  slides.push({ rol: "hook", texto: hookBase, nota_visual: "Texto grande, 1 idea, paleta violeta/coral" });

  // Slides intermedias — mezcla dolor + dato-ancla + solución
  const cuerpo: string[] = [];
  if (rubro) {
    cuerpo.push(rubro.dolores[0] ?? input.tema);
    if (rubro.dolores[1]) cuerpo.push(rubro.dolores[1]);
    cuerpo.push(DATOS_ANCLA[0]);
    cuerpo.push(rubro.casos_uso[0] ?? "Respondo responde, cotiza y agenda con tus datos reales");
    if (rubro.casos_uso[1]) cuerpo.push(rubro.casos_uso[1]);
  } else {
    cuerpo.push(`El problema real detrás de "${input.tema}"`);
    cuerpo.push(DATOS_ANCLA[input.pilar === "problema" ? 0 : 3]);
    cuerpo.push("Respondo responde al tiro, cotiza con tus precios y agenda — 24/7");
    cuerpo.push("Y cuando no sabe algo, no inventa: deriva a un humano");
    if (input.pilar === "confianza")
      cuerpo.push("Lo probamos contigo antes de encenderlo");
    if (input.pilar === "comparacion")
      cuerpo.push("No competimos con los bots de $15.000 — competimos con las ventas que pierdes");
  }

  const intermedias = cuerpo.slice(0, nSlides - 2);
  for (const t of intermedias) {
    slides.push({ rol: "desarrollo", texto: t, nota_visual: "Una idea por slide, tipografía grande" });
  }
  // Slide final — cierre + CTA
  slides.push({ rol: "cierre", texto: cta, nota_visual: "CTA con flecha al link" });

  const hashtags = rubro
    ? [`#${rubro.slug.replace(/-/g, "")}`, "#whatsappbusiness", "#pyme", "#ventas", "#ia"]
    : ["#pymechile", "#whatsappbusiness", "#ventas", "#ia", "#emprendimiento"];

  return {
    id: `gen-carr-${Date.now()}`,
    titulo: input.tema,
    pilar: input.pilar,
    rubro: input.rubro ?? null,
    objetivo: input.objetivo?.trim() || "Generar demanda y apoyar la prospección",
    funnel: input.funnel ?? (input.nivelVenta === "directo" ? "decision" : input.pilar === "problema" ? "descubrimiento" : "consideracion"),
    nivel_venta: input.nivelVenta,
    slides,
    caption: `${hookBase}. ${rubro ? rubro.dolores[0] : DATOS_ANCLA[0]}. ${cta}`,
    hashtags,
    cta,
    notas_visuales:
      "Tono: dolor y resultado, no tecnología. Frases cortas, 2ª persona, máx 1–2 emojis. Nada de 'revolucionario/disruptivo'.",
  };
}

export interface ScriptInput {
  tema: string;
  pilar: PilarKey;
  rubro?: string | null;
  duracion?: string;
  tipo?: string;
  objetivo?: string;
  nivelVenta: NivelVenta;
  funnel?: Funnel;
}

export function generarGuion(input: ScriptInput): VideoScript {
  const rubro = input.rubro ? rubroPorSlug(input.rubro) : null;
  const cta = CTA_POR_NIVEL[input.nivelVenta];
  const hook = rubro
    ? `${rubro.formula_sin.split(" sin ")[0]}… sin ${rubro.formula_sin.split(" sin ")[1] ?? "perder la venta"}`
    : HOOK_POR_PILAR[input.pilar](input.tema);

  const escenas: VideoScene[] = [];
  escenas.push({
    escena: "Hook a cámara o mockup — pattern interrupt",
    texto_pantalla: input.tema,
    voz: hook,
  });
  if (rubro) {
    escenas.push({ escena: "Mostrar el momento de dolor", texto_pantalla: "El problema", voz: rubro.dolores[0] });
    escenas.push({ escena: "Chat / bot en acción", texto_pantalla: "La solución", voz: rubro.casos_uso[0] });
    escenas.push({ escena: "Resultado / lead capturado", texto_pantalla: "El resultado", voz: rubro.casos_uso[1] ?? "Y te deja el contacto listo para cerrar" });
  } else {
    escenas.push({ escena: "Mostrar el dolor", texto_pantalla: "El problema", voz: DATOS_ANCLA[0] });
    escenas.push({ escena: "Producto en acción", texto_pantalla: "Qué hace", voz: "Respondo responde, cotiza y agenda con tus datos reales, 24/7" });
    escenas.push({ escena: "Cierre de confianza", texto_pantalla: "No inventa", voz: "Y cuando no sabe algo, deriva a un humano en vez de inventar" });
  }

  return {
    id: `gen-vid-${Date.now()}`,
    titulo: input.tema,
    tipo: input.tipo ?? (rubro ? "rubro" : input.pilar),
    pilar: input.pilar,
    rubro: input.rubro ?? null,
    canal: "instagram",
    duracion: input.duracion?.trim() || "20-30s",
    objetivo: input.objetivo?.trim() || "Generar demanda y llevar a la demo",
    funnel: input.funnel ?? (input.nivelVenta === "directo" ? "decision" : "descubrimiento"),
    nivel_venta: input.nivelVenta,
    hook,
    escenas,
    cta,
    version_corta: `${hook} → ${cta}`,
    notas_edicion:
      "Subtítulos grandes, cortar silencios, hablar a mitad de frase en el hook. Rotular 'demo' o 'ejemplo ilustrativo' si se muestra el bot. Sin música épica.",
  };
}

/** Fuente estratégica para generar ideas. */
export type FuenteIdeas =
  | "objeciones"
  | "rubros"
  | "competencia"
  | "diferenciadores"
  | "faq";

/**
 * Genera ideas de contenido a partir de la estrategia existente.
 * Determinista: transforma objeciones, rubros y battlecards en ángulos de post.
 */
export function generarIdeasDesdeEstrategia(fuente: FuenteIdeas): Partial<ContentIdea>[] {
  const out: Partial<ContentIdea>[] = [];
  if (fuente === "objeciones") {
    for (const o of COPIES.filter((c) => c.tipo === "objecion")) {
      const titulo = o.texto.split("→")[0].replace(/["]/g, "").trim();
      out.push({
        titulo: `Post: ${titulo}`,
        descripcion: o.texto,
        pilar: "objeciones",
        formato: "carrusel",
        canal: "instagram",
        funnel: "consideracion",
        fuente: o.fuente ?? "OBJECIONES_RESPONDO.md",
        objetivo_comercial: "Desarmar la objeción antes de la venta",
      });
    }
  }
  if (fuente === "rubros") {
    for (const r of rubrosParaIdeas()) {
      out.push({
        titulo: `Reel: ${r.formula}`,
        descripcion: r.dolor,
        pilar: "rubros",
        rubro: r.slug,
        formato: "reel",
        canal: "instagram",
        funnel: "descubrimiento",
        fuente: "ICP_RESPONDO.md",
        objetivo_comercial: "Conectar con la prospección del rubro",
      });
    }
  }
  if (fuente === "competencia") {
    for (const b of BATTLECARDS) {
      for (const ang of b.angulos_contenido) {
        out.push({
          titulo: ang,
          descripcion: `Ángulo desde battlecard: ${b.nombre}. ${b.donde_diferenciarnos}`,
          pilar: "comparacion",
          formato: "carrusel",
          canal: "instagram",
          funnel: "consideracion",
          fuente: `Battlecard ${b.nombre}`,
          objetivo_comercial: "Posicionar la diferenciación sin nombrar competidores",
        });
      }
    }
  }
  if (fuente === "diferenciadores") {
    const difs = [
      ["No te dejamos solo: implementación y acompañamiento incluidos", "confianza"],
      ["La IA no inventa precios (regla de diseño)", "confianza"],
      ["Con nosotros hablas directo con los fundadores", "founder"],
      ["Publicamos precios cuando el rubro los esconde", "comparacion"],
      ["Especialistas en WhatsApp, no todólogos de IA", "comparacion"],
    ] as const;
    for (const [t, p] of difs) {
      out.push({
        titulo: `Contenido: ${t}`,
        descripcion: "Convertir un diferenciador en pieza publicable.",
        pilar: p as PilarKey,
        formato: "reel",
        canal: "instagram",
        funnel: "consideracion",
        fuente: "Diferenciadores Respondo",
        objetivo_comercial: "Reforzar la ventaja competitiva",
      });
    }
  }
  if (fuente === "faq") {
    for (const r of rubrosParaIdeas()) {
      out.push({
        titulo: `FAQ ${r.slug}: responder la duda #1 del cliente final`,
        descripcion: r.pregunta,
        pilar: "educacion",
        rubro: r.slug,
        formato: "post_educativo",
        canal: "instagram",
        funnel: "descubrimiento",
        fuente: "ICP_RESPONDO.md (preguntas del cliente)",
        objetivo_comercial: "SEO + educación por rubro",
      });
    }
  }
  return out;
}

function rubrosParaIdeas() {
  return RUBROS.map((r) => ({
    slug: r.slug,
    formula: r.formula_sin,
    dolor: r.dolores[0] ?? "",
    pregunta: r.preguntas_cliente[0] ?? "",
  }));
}
