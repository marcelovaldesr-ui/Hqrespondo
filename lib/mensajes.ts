import type { Prospect } from "./types";

/**
 * Plantillas de mensajes comerciales — vienen del paquete
 * estrategia-comercial/MENSAJES_PROSPECCION_RESPONDO.md (jul-2026).
 * Reglas vigentes: el primer mensaje NO vende, máximo 3–4 toques,
 * nunca "¿viste mi mensaje?", y NO se ofrece piloto gratis (se ofrece
 * la demo pública y el primer mes de servicio gratis: el cliente prueba el mes 1
 * sin pagar la mensualidad; el setup se cobra normal).
 *
 * El link de la demo se toma de NEXT_PUBLIC_DEMO_LINK (Vercel). Si no
 * está configurado queda el marcador [link demo] para reemplazar a mano.
 */

const DEMO = process.env.NEXT_PUBLIC_DEMO_LINK || "[link demo]";

export interface PlantillaMensaje {
  id: string;
  label: string;
  /** Estados del prospecto donde esta plantilla es la sugerida */
  sugeridaEn: string[];
  genera: (p: Prospect) => string;
}

export const PLANTILLAS: PlantillaMensaje[] = [
  {
    id: "follow1",
    label: "Follow-up 1 (2–3 días, sin respuesta)",
    sugeridaEn: ["contactado"],
    genera: (p) =>
      `${p.nombre}, te dejo esto por si te sirve verlo en 30 segundos: nuestro asistente funcionando de verdad. Escríbele "hola" y pregúntale precios como si fueras cliente → ${DEMO}. Así lo ves antes de decidir si vale la pena conversar.`,
  },
  {
    id: "follow2",
    label: "Follow-up 2 (4–5 días, cierre suave)",
    sugeridaEn: ["contactado"],
    genera: (p) =>
      `Hola 👋 Último mensaje, prometido. Un dato y me voy: el 78% de la gente le compra al primer negocio que le responde — y el promedio en Chile es de 2 a 4 horas para contestar un WhatsApp. Si algún día quieres ver cuántas ventas se te van por ahí al mes, me escribes y lo miramos juntos. ¡Éxito con ${p.nombre}!`,
  },
  {
    id: "respondio",
    label: "Respondió → presentar demo",
    sugeridaEn: ["respondio"],
    genera: () =>
      `Te pregunto porque a eso nos dedicamos: implementamos asistentes de ventas con IA en el WhatsApp del negocio — responde al instante, cotiza con tus precios reales y te guarda el contacto de cada interesado. Míralo funcionando tú mismo: escríbele "hola" y pídele precios como si fueras cliente → ${DEMO}. ¿Me cuentas qué te pareció?`,
  },
  {
    id: "postdemo",
    label: "Post-demo / reunión (mismo día)",
    sugeridaEn: ["reunion"],
    genera: () =>
      `Gracias por el tiempo de hoy. Te resumo lo que vimos: el asistente respondería tus consultas 24/7, cotizaría con tu lista de precios y te dejaría registrado cada interesado. Plan recomendado: [plan] — implementación $[Y] (única vez) y el primer mes de servicio va sin costo: lo pruebas funcionando y desde el mes 2 pagas $[X]/mes, solo si te sirve. Si me mandas tu lista de precios y preguntas frecuentes esta semana, lo tienes andando antes de [fecha]. ¿Partimos?`,
  },
  {
    id: "reactivacion",
    label: "Reactivación (2–4 semanas frío)",
    sugeridaEn: ["contactado", "respondio"],
    genera: () =>
      `Hola 👋 Hace unas semanas conversamos sobre responder al tiro los WhatsApp de tu negocio. Te cuento que ahora el primer mes de servicio va gratis: lo dejamos funcionando y solo sigues si te sirve. Si todavía está en tu radar, retomamos donde quedamos — y si ya no, dime y no te molesto más 🙂`,
  },
];

/** Plantillas sugeridas según el estado comercial del prospecto. */
export function plantillasPara(p: Prospect): PlantillaMensaje[] {
  const sugeridas = PLANTILLAS.filter((t) => t.sugeridaEn.includes(p.estado));
  return sugeridas.length > 0 ? sugeridas : PLANTILLAS;
}
