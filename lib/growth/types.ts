/**
 * GROWTH STUDIO — Tipos y taxonomía de contenido de Respondo.
 *
 * Este módulo convierte la estrategia comercial (estrategia-comercial/, Prompt 3)
 * y las páginas por rubro / SEO (web-respondo/, Prompt 2) en un sistema operativo
 * de contenido dentro de RespondHQ. Casi todo el contenido vive como SEED de
 * código (cero migraciones, funciona en Vercel al instante). La persistencia de
 * ideas y calendario creados por el equipo es opcional y additiva (migración 009).
 *
 * Fuente de verdad de tono, precios y datos-ancla:
 *  - estrategia-comercial/INSTAGRAM_RESPONDO.md   (pilares, hooks, destacadas)
 *  - estrategia-comercial/OBJECIONES_RESPONDO.md  (18 objeciones)
 *  - estrategia-comercial/ICP_RESPONDO.md         (5 rubros prioritarios)
 *  - estrategia-comercial/MENSAJES_PROSPECCION_RESPONDO.md
 *  - lib/types.ts (PLAN_PRECIOS)                  (precios finales jul-2026)
 */

/* ---------------- Pilares ---------------- */

export const PILAR_KEYS = [
  "educacion",
  "problema",
  "rubros",
  "producto",
  "confianza",
  "comparacion",
  "venta",
  "objeciones",
  "demo",
  "founder",
] as const;
export type PilarKey = (typeof PILAR_KEYS)[number];

export const PILAR_LABEL: Record<PilarKey, string> = {
  educacion: "Educación",
  problema: "Problema",
  rubros: "Rubros",
  producto: "Producto",
  confianza: "Confianza",
  comparacion: "Comparación",
  venta: "Venta",
  objeciones: "Objeciones",
  demo: "Demo / Prueba",
  founder: "Founder journey",
};

/** Color de acento por pilar (tokens de tailwind.config existentes). */
export const PILAR_COLOR: Record<PilarKey, string> = {
  educacion: "accent",
  problema: "coral",
  rubros: "brand",
  producto: "violet",
  confianza: "ok",
  comparacion: "accent",
  venta: "coral",
  objeciones: "warn",
  demo: "brand",
  founder: "ink-mut",
};

/* ---------------- Estados ---------------- */

export const CONTENT_STATUS = [
  "idea",
  "borrador",
  "en_revision",
  "listo",
  "publicado",
  "descartado",
] as const;
export type ContentStatus = (typeof CONTENT_STATUS)[number];

export const CONTENT_STATUS_LABEL: Record<ContentStatus, string> = {
  idea: "Idea",
  borrador: "Borrador",
  en_revision: "En revisión",
  listo: "Listo",
  publicado: "Publicado",
  descartado: "Descartado",
};

export const CONTENT_STATUS_COLOR: Record<ContentStatus, string> = {
  idea: "ink-faint",
  borrador: "warn",
  en_revision: "accent",
  listo: "ok",
  publicado: "brand",
  descartado: "ink-faint",
};

/* ---------------- Canales y formatos ---------------- */

export const CANALES = [
  "instagram",
  "linkedin",
  "blog",
  "web",
  "email",
  "whatsapp",
  "propuesta",
  "demo",
] as const;
export type Canal = (typeof CANALES)[number];

export const CANAL_LABEL: Record<Canal, string> = {
  instagram: "Instagram",
  linkedin: "LinkedIn",
  blog: "Blog",
  web: "Web",
  email: "Email",
  whatsapp: "WhatsApp prospección",
  propuesta: "Propuesta comercial",
  demo: "Demo",
};

export const FORMATOS = [
  "carrusel",
  "reel",
  "historia",
  "post_linkedin",
  "articulo_blog",
  "email",
  "script_demo",
  "destacada",
  "anuncio",
  "post_educativo",
  "post_comparativo",
  "post_objecion",
] as const;
export type Formato = (typeof FORMATOS)[number];

export const FORMATO_LABEL: Record<Formato, string> = {
  carrusel: "Carrusel",
  reel: "Reel",
  historia: "Historia",
  post_linkedin: "Post LinkedIn",
  articulo_blog: "Artículo blog",
  email: "Email",
  script_demo: "Script de demo",
  destacada: "Pieza para destacada",
  anuncio: "Anuncio simple",
  post_educativo: "Post educativo",
  post_comparativo: "Post comparativo",
  post_objecion: "Post por objeción",
};

/* ---------------- Funnel y niveles ---------------- */

export const FUNNEL = ["descubrimiento", "consideracion", "decision"] as const;
export type Funnel = (typeof FUNNEL)[number];

export const FUNNEL_LABEL: Record<Funnel, string> = {
  descubrimiento: "Descubrimiento (TOFU)",
  consideracion: "Consideración (MOFU)",
  decision: "Decisión (BOFU)",
};

export const NIVEL_VENTA = ["suave", "medio", "directo"] as const;
export type NivelVenta = (typeof NIVEL_VENTA)[number];

export const PRIORIDAD = ["alta", "media", "baja"] as const;
export type Prioridad = (typeof PRIORIDAD)[number];

/* ---------------- Entidades ---------------- */

/** ContentIdea — unidad base. Sirve para seed (id string) y para BD (uuid). */
export interface ContentIdea {
  id: string;
  titulo: string;
  descripcion: string;
  pilar: PilarKey;
  rubro: string | null; // slug de RUBROS o null (transversal)
  canal: Canal;
  formato: Formato;
  prioridad: Prioridad;
  estado: ContentStatus;
  responsable: string | null;
  fecha_sugerida: string | null; // YYYY-MM-DD
  fuente: string | null; // de dónde nace (objeción, ICP, competencia…)
  objetivo_comercial: string | null;
  funnel: Funnel;
  cta: string | null;
  notas: string | null;
  /** true = viene del seed de código (no editable en BD). */
  seed?: boolean;
  created_at?: string;
}

/** Slide de carrusel. */
export interface CarouselSlide {
  rol: "hook" | "desarrollo" | "cierre";
  texto: string;
  nota_visual?: string;
}

export interface CarouselDraft {
  id: string;
  titulo: string;
  pilar: PilarKey;
  rubro: string | null;
  objetivo: string;
  funnel: Funnel;
  nivel_venta: NivelVenta;
  slides: CarouselSlide[];
  caption: string;
  hashtags: string[];
  cta: string;
  notas_visuales?: string;
  seed?: boolean;
}

export interface VideoScene {
  escena: string;
  texto_pantalla?: string;
  voz?: string;
}

export interface VideoScript {
  id: string;
  titulo: string;
  tipo: string; // presentacion | problema | demo | rubro | objecion | comparacion | educativo | founder | oferta
  pilar: PilarKey;
  rubro: string | null;
  canal: Canal;
  duracion: string; // "20-30s"
  objetivo: string;
  funnel: Funnel;
  nivel_venta: NivelVenta;
  hook: string;
  escenas: VideoScene[];
  cta: string;
  version_corta?: string;
  notas_edicion?: string;
  seed?: boolean;
}

/** Ítem de calendario. Puede referenciar una idea del seed o ser propio. */
export interface ContentCalendarItem {
  id: string;
  titulo: string;
  fecha: string; // YYYY-MM-DD
  canal: Canal;
  formato: Formato;
  pilar: PilarKey;
  rubro: string | null;
  estado: ContentStatus;
  responsable: string | null;
  idea_id?: string | null;
  notas?: string | null;
  seed?: boolean;
  created_at?: string;
}

/** Contenido específico por rubro (seed, derivado de ICP + páginas web). */
export interface IndustryContent {
  slug: string;
  nombre: string;
  emoji: string;
  prioridad_comercial: Prioridad;
  orden_ataque: number;
  dolores: string[];
  preguntas_cliente: string[];
  casos_uso: string[];
  ideas_post: string[];
  ideas_carrusel: string[];
  ideas_reel: string[];
  mensaje_prospeccion: string;
  objeciones: string[];
  cta: string;
  formula_sin: string; // "[beneficio] sin [dolor]"
  pagina_seo: string | null; // ruta futura / existente
}

/** Battlecard de competidor / alternativa. */
export interface Battlecard {
  slug: string;
  nombre: string;
  tipo: "plataforma" | "agencia" | "chatbot" | "casero";
  que_ofrecen: string;
  fuertes_para: string;
  donde_diferenciarnos: string;
  no_copiar: string;
  angulos_contenido: string[];
  objecion_tipica: string;
  respuesta_comercial: string;
  contenido_recomendado: string;
  riesgo: string;
  requiere_investigacion?: boolean;
}

/** Plan de destacada de Instagram. */
export interface HighlightPlan {
  slug: string;
  nombre: string;
  objetivo: string;
  estado: ContentStatus;
  prioridad: Prioridad;
  cta: string;
  historias: { texto: string; visual: string }[];
}

/** Snippet reutilizable de la biblioteca de copies. */
export type CopyTipo =
  | "cta"
  | "hook"
  | "posicionamiento"
  | "objecion"
  | "prospeccion"
  | "caption"
  | "intro_video"
  | "cierre_video"
  | "landing"
  | "anuncio"
  | "propuesta";

export const COPY_TIPO_LABEL: Record<CopyTipo, string> = {
  cta: "CTA",
  hook: "Hook",
  posicionamiento: "Posicionamiento",
  objecion: "Respuesta a objeción",
  prospeccion: "Mensaje de prospección",
  caption: "Caption",
  intro_video: "Intro de video",
  cierre_video: "Cierre de video",
  landing: "Frase para landing",
  anuncio: "Frase para anuncio",
  propuesta: "Frase para propuesta",
};

export interface CopySnippet {
  id: string;
  tipo: CopyTipo;
  texto: string;
  canal: Canal | null;
  rubro: string | null;
  funnel: Funnel | null;
  objetivo: string | null;
  fuente?: string;
}

/** Pilar de contenido (definición estratégica). */
export interface ContentPillar {
  key: PilarKey;
  nombre: string;
  objetivo: string;
  audiencia: string;
  formatos: Formato[];
  ejemplos: string[];
  cta: string;
  funnel: Funnel;
  relacion_ventas: string;
  mezcla_recomendada: string; // % sugerido según INSTAGRAM_RESPONDO.md
}
