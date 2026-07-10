import type { ContentPillar } from "./types";

/**
 * PILARES DE CONTENIDO — Respondo.
 * Base estratégica: INSTAGRAM_RESPONDO.md (mezcla real validada por research:
 * Dolor 30% · Acompañamiento 25% · Producto & Prueba 20% · Educación 15% · BTS 10%).
 * Se expande a 10 pilares operativos para cubrir todo el funnel comercial.
 */
export const PILARES: ContentPillar[] = [
  {
    key: "problema",
    nombre: "Problema",
    objetivo:
      "Nombrar el dolor real de responder tarde por WhatsApp para que el negocio se reconozca. Es el pilar que más genera saves y sends.",
    audiencia: "Dueños de pyme que atienden ellos mismos el WhatsApp.",
    formatos: ["reel", "carrusel", "post_educativo", "historia"],
    ejemplos: [
      "El 78% le compra al primero que responde",
      "Los leads de WhatsApp se te desordenan",
      "Cotizar a mano te come el día",
      "No hacer seguimiento mata la venta",
      "Terminas atendiendo todo tú mismo",
    ],
    cta: "Guarda esto / Etiqueta a quien le pasa",
    funnel: "descubrimiento",
    relacion_ventas:
      "Calienta al prospecto antes del primer mensaje. Un lead que ya vio el dolor responde mejor a la prospección.",
    mezcla_recomendada: "30% (pilar #1 de la mezcla semanal)",
  },
  {
    key: "confianza",
    nombre: "Confianza / Acompañamiento",
    objetivo:
      "Desarmar el miedo a la IA mostrando que no inventa, deriva a humano y que la implementación la hacemos nosotros. 'No te dejamos solo' es el diferenciador que el mercado ya validó.",
    audiencia: "Escépticos que probaron bots tontos o temen perder el trato humano.",
    formatos: ["reel", "carrusel", "post_objecion", "destacada"],
    ejemplos: [
      "La IA no inventa precios (regla de diseño)",
      "Supervisión humana y derivación",
      "Qué pasa si el bot no sabe responder",
      "Lo implementamos y acompañamos nosotros",
      "IA + humano, no IA en vez de humano",
    ],
    cta: "Escríbenos / Prueba la demo",
    funnel: "consideracion",
    relacion_ventas:
      "Responde la objeción #1 (desconfianza) antes de la reunión. Sostiene el argumento de venta 'no te dejamos solo' vs. plataformas grandes.",
    mezcla_recomendada: "25% (pilar #2 — el diferenciador)",
  },
  {
    key: "producto",
    nombre: "Producto",
    objetivo:
      "Mostrar cómo Respondo responde, cotiza, agenda, deriva y registra — con la información real del negocio.",
    audiencia: "Prospecto que ya entendió el dolor y quiere ver el 'cómo'.",
    formatos: ["reel", "carrusel", "script_demo", "post_educativo"],
    ejemplos: [
      "Cómo cotiza con tu lista real",
      "Cómo agenda una hora",
      "Cómo deriva a humano",
      "Cómo se entrena con tu información",
      "Cómo registra cada interesado",
    ],
    cta: "Pruébalo tú mismo (demo)",
    funnel: "consideracion",
    relacion_ventas:
      "Alimenta la demo, que es la respuesta a la mitad de las objeciones. Contenido que se envía en el follow-up.",
    mezcla_recomendada: "20% (junto con Demo/Prueba)",
  },
  {
    key: "demo",
    nombre: "Demo / Prueba de producto",
    objetivo:
      "Que la audiencia VIVA el producto: conversaciones reales, cotización con totales, reto de 'sácale un precio inventado'.",
    audiencia: "Prospecto en consideración; también prueba social temprana.",
    formatos: ["reel", "historia", "destacada", "script_demo"],
    ejemplos: [
      "Le intenté sacar un precio inventado (reto)",
      "Bot cotizando a las 2 AM (mockup)",
      "Cómo se ve una cotización real",
      "Cómo se agenda una visita",
      "Qué ve el negocio por dentro",
    ],
    cta: "Escríbele a la demo como si fueras cliente",
    funnel: "decision",
    relacion_ventas:
      "El link de demo es el activo comercial #1. Cada pieza de demo baja la fricción de la venta.",
    mezcla_recomendada: "Dentro del 20% de Producto & Prueba",
  },
  {
    key: "rubros",
    nombre: "Rubros",
    objetivo:
      "Hablarle específico a cada ICP con la fórmula '[beneficio] sin [dolor del sector]'. El prospecto se ve retratado.",
    audiencia: "Ferreterías, corredoras, clínicas, estética, talleres (ICP 1–5).",
    formatos: ["reel", "carrusel", "articulo_blog", "post_educativo"],
    ejemplos: [
      "Ferretería: cotiza todo el día sin frenar el mostrador",
      "Inmobiliaria: responde cada lead sin bajarte de la visita",
      "Clínica: llena tu agenda sin recargar a tu secretaria",
      "Estética: agenda horas sin soltar lo que haces",
      "Taller: captura al cliente sin soltar la herramienta",
    ],
    cta: "Demo de tu rubro / Agenda 20 min",
    funnel: "descubrimiento",
    relacion_ventas:
      "Conecta directo con la prospección por rubro y con las páginas SEO por industria. Un rubro con 3+ respuestas se duplica.",
    mezcla_recomendada: "Transversal — cruza con Problema y Producto",
  },
  {
    key: "objeciones",
    nombre: "Objeciones",
    objetivo:
      "Convertir las 18 objeciones reales en contenido que las responde antes de que aparezcan en la venta.",
    audiencia: "Prospecto con dudas concretas (precio, control, riesgo).",
    formatos: ["carrusel", "post_objecion", "reel", "destacada"],
    ejemplos: [
      "'¿Y si responde cualquier cosa?'",
      "'Ya tengo WhatsApp Business'",
      "'Está caro' (persona vs asistente)",
      "'No quiero una IA hablando con mis clientes'",
      "'¿Puede inventar precios?'",
    ],
    cta: "Resuelve tu duda en la demo",
    funnel: "consideracion",
    relacion_ventas:
      "Acorta el ciclo: el vendedor llega a la reunión con las objeciones ya desactivadas por el contenido.",
    mezcla_recomendada: "Rota dentro de Confianza + Comparación",
  },
  {
    key: "comparacion",
    nombre: "Comparación",
    objetivo:
      "Posicionar a Respondo en el 'medio justo' entre chatbots baratos y plataformas grandes, sin ensuciar a nadie.",
    audiencia: "Prospecto comparando alternativas (Vambe, respond.io, bots baratos).",
    formatos: ["carrusel", "post_comparativo", "reel", "articulo_blog"],
    ejemplos: [
      "Chatbot de botones vs asistente de ventas",
      "Por qué no necesitas un CRM completo al inicio",
      "Automatizar respuestas vs automatizar ventas",
      "Persona ($650.000+) vs asistente (desde $24.990)",
      "Por qué publicamos precios cuando nadie lo hace",
    ],
    cta: "Compara en la demo",
    funnel: "consideracion",
    relacion_ventas:
      "Alimenta las battlecards. Prepara la objeción '¿en qué se diferencian de X?'.",
    mezcla_recomendada: "Rota dentro de Educación + Objeciones",
  },
  {
    key: "educacion",
    nombre: "Educación",
    objetivo:
      "Enseñar sin vender: qué es un asistente de ventas, cómo funciona una cotización automática, qué se puede y no automatizar.",
    audiencia: "Pyme que aún no usa IA y necesita entender la categoría.",
    formatos: ["carrusel", "post_educativo", "reel", "articulo_blog"],
    ejemplos: [
      "Qué es un asistente de ventas por WhatsApp",
      "Chatbot vs asistente de ventas en 20s",
      "Cómo automatizar sin perder control humano",
      "Qué preguntas puede responder una IA",
      "Cómo funciona una cotización automática",
    ],
    cta: "Guarda / Sigue para más",
    funnel: "descubrimiento",
    relacion_ventas:
      "Construye autoridad y SEO. El artículo educativo por rubro capta búsquedas y alimenta el blog.",
    mezcla_recomendada: "15%",
  },
  {
    key: "venta",
    nombre: "Venta / Oferta",
    objetivo:
      "Mover a la acción: demo, prueba 30 días, oferta de lanzamiento, qué incluye la implementación.",
    audiencia: "Prospecto listo para decidir.",
    formatos: ["reel", "historia", "post_linkedin", "anuncio"],
    ejemplos: [
      "Pruébalo 30 días sin riesgo (si no ayuda, no pagas)",
      "Qué incluye la implementación",
      "Agenda una demo en 20 min",
      "Precios claros, sin cotizar a ciegas",
      "Cómo empezamos contigo",
    ],
    cta: "Agenda demo / Pruébalo 30 días",
    funnel: "decision",
    relacion_ventas:
      "CTA directo a WhatsApp/demo. Sostiene la reversión de riesgo (prueba 30 días).",
    mezcla_recomendada: "Bottom of funnel — 1 pieza fuerte por semana",
  },
  {
    key: "founder",
    nombre: "Founder journey / Construcción",
    objetivo:
      "Mostrar a las dos personas detrás de Respondo construyendo desde Chile. El formato de mayor engagement (historia fundacional).",
    audiencia: "Comunidad, futuros clientes, otros founders, referidos.",
    formatos: ["reel", "historia", "post_linkedin"],
    ejemplos: [
      "Construyendo una startup SaaS desde Chile",
      "Aprendizajes vendiendo IA a pymes",
      "Cómo estamos validando Respondo",
      "Lo que aprendimos de negocios reales",
      "Cómo priorizamos producto vs ventas",
    ],
    cta: "Síguenos el proceso / Conversemos",
    funnel: "descubrimiento",
    relacion_ventas:
      "Cercanía y confianza: 'con nosotros hablas directo con los fundadores'. Motor de referidos y prueba social honesta.",
    mezcla_recomendada: "10% (BTS/Origen)",
  },
];

export function pilarPorKey(key: string) {
  return PILARES.find((p) => p.key === key);
}
