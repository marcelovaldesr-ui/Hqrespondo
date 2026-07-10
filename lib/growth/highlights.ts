import type { HighlightPlan } from "./types";

/**
 * DESTACADAS DE INSTAGRAM.
 * Estructura definitiva de INSTAGRAM_RESPONDO.md §4 (orden en el perfil:
 * Respon-Do → Demo → Industrias → Planes → Dudas → Garantía → Equipo → Clientes)
 * + destacadas complementarias pedidas (Casos de uso, IA + Humano).
 * Sin testimonios inventados: "Clientes" se llena con el primer cliente real.
 */
export const DESTACADAS: HighlightPlan[] = [
  {
    slug: "respon-do",
    nombre: "Respon-Do (Qué hacemos)",
    objetivo: "Explicar qué es Respondo y que NO es un chatbot tonto.",
    estado: "listo",
    prioridad: "alta",
    cta: "Prueba la demo 👇",
    historias: [
      { texto: "Qué es Respondo: IA para tu WhatsApp que responde, cotiza y agenda", visual: "Portada de marca (violeta/coral)" },
      { texto: "No es un chatbot de botones: conversa con tus datos reales", visual: "Comparación botones vs conversación" },
      { texto: "El problema: el 78% le compra al primero que responde", visual: "Dato grande sobre fondo limpio" },
      { texto: "Cómo funciona: tu número de siempre, entrenado con tu info", visual: "Diagrama simple 3 pasos" },
      { texto: "Qué hace: responde, cotiza, agenda, deriva a humano y registra", visual: "Íconos de capacidades" },
      { texto: "Pruébalo tú mismo → link demo", visual: "CTA con flecha al link" },
    ],
  },
  {
    slug: "demo",
    nombre: "Demo ⭐",
    objetivo: "Que vivan el producto: conversación real y reto del precio inventado.",
    estado: "idea",
    prioridad: "alta",
    cta: "Escríbele tú mismo → link wa.me",
    historias: [
      { texto: "No te lo contamos, pruébalo 👇", visual: "Texto grande, pattern interrupt" },
      { texto: "Video 20s: pregunta precio → cotización con totales", visual: "Screen recording del bot" },
      { texto: "Escríbele tú mismo, como si fueras cliente", visual: "Mockup chat + link" },
      { texto: "Trata de sacarle un precio inventado. No vas a poder 😉", visual: "Reto en pantalla" },
    ],
  },
  {
    slug: "industrias",
    nombre: "Industrias (Rubros)",
    objetivo: "Fórmula '[beneficio] sin [dolor]' por rubro para que se reconozcan.",
    estado: "listo",
    prioridad: "alta",
    cta: "¿Tu rubro? Escríbenos",
    historias: [
      { texto: "Ferretería: cotiza todo el día sin frenar el mostrador", visual: "Foto rubro + frase sin" },
      { texto: "Inmobiliaria: responde cada lead sin bajarte de la visita", visual: "Foto rubro + frase sin" },
      { texto: "Clínica: llena tu agenda sin recargar a tu secretaria", visual: "Foto rubro + frase sin" },
      { texto: "Estética: agenda horas sin soltar lo que haces", visual: "Foto rubro + frase sin" },
      { texto: "Taller: captura al cliente sin soltar la herramienta", visual: "Foto rubro + frase sin" },
    ],
  },
  {
    slug: "planes",
    nombre: "Planes ⭐",
    objetivo: "Precios claros 'desde', con implementación incluida.",
    estado: "idea",
    prioridad: "alta",
    cta: "Cotiza con nosotros",
    historias: [
      { texto: "Precios claros, sin cotizaciones a ciegas", visual: "Portada limpia" },
      { texto: "Básico desde $24.990/mes", visual: "Card de plan" },
      { texto: "Pro desde $39.990/mes — el más elegido", visual: "Card destacada" },
      { texto: "Empresa desde $69.990/mes", visual: "Card de plan" },
      { texto: "Implementación única + mensualidad fija. La hacemos nosotros", visual: "CTA" },
    ],
  },
  {
    slug: "dudas",
    nombre: "Dudas (FAQ + Seguridad)",
    objetivo: "Desarmar las objeciones más comunes.",
    estado: "listo",
    prioridad: "alta",
    cta: "¿Otra duda? Escríbenos",
    historias: [
      { texto: "¿Responde cualquier cosa? No: solo con tu información", visual: "Objeción → respuesta" },
      { texto: "¿Y si no sabe? Deriva a un humano, no inventa", visual: "Objeción → respuesta" },
      { texto: "¿Me pueden bloquear WhatsApp? No: API oficial de Meta", visual: "Sello seguridad" },
      { texto: "¿Cuánto cuesta? Planes desde $24.990/mes", visual: "Precio ancla" },
      { texto: "¿Cuánto tarda? Lo dejamos andando esta semana", visual: "Tiempo de implementación" },
    ],
  },
  {
    slug: "garantia",
    nombre: "Prueba 30 días ⭐",
    objetivo: "Bajar el riesgo percibido: pruébalo 30 días, si no ayuda no paga.",
    estado: "idea",
    prioridad: "alta",
    cta: "Empieza tu prueba → escríbenos",
    historias: [
      { texto: "Pruébalo 30 días en tu propio WhatsApp", visual: "Portada" },
      { texto: "Si no te ayuda a responder y cotizar más rápido, no pagas la mensualidad", visual: "Garantía clara" },
      { texto: "Implementación acompañada: lo dejamos andando nosotros", visual: "Acompañamiento" },
      { texto: "Escríbenos y partimos + CTA WhatsApp", visual: "CTA" },
    ],
  },
  {
    slug: "equipo",
    nombre: "Equipo (Contacto)",
    objetivo: "Cercanía: mostrar a las 2 personas y cómo agendar.",
    estado: "listo",
    prioridad: "media",
    cta: "Agenda 20 min con nosotros",
    historias: [
      { texto: "Somos 2 personas construyendo Respondo desde Chile", visual: "Foto fundadores" },
      { texto: "Con nosotros hablas directo con los fundadores", visual: "BTS" },
      { texto: "Agenda una demo de 20 min → link", visual: "CTA final" },
    ],
  },
  {
    slug: "clientes",
    nombre: "Clientes (prueba social — futura)",
    objetivo: "Prueba social. Se llena con el primer cliente real (número duro + video).",
    estado: "idea",
    prioridad: "baja",
    cta: "¿Quieres ser el próximo caso?",
    historias: [
      { texto: "Plantilla: número duro del reporte día 7 (ej: X consultas fuera de horario respondidas)", visual: "Dato + logo cliente (con permiso)" },
      { texto: "Frase del cliente + video testimonio 30s", visual: "Video vertical" },
    ],
  },
  {
    slug: "casos-de-uso",
    nombre: "Casos de uso",
    objetivo: "Mostrar situaciones concretas donde Respondo salva una venta.",
    estado: "idea",
    prioridad: "media",
    cta: "¿Tu caso? Escríbenos",
    historias: [
      { texto: "Cotización a las 2 AM que se convirtió en venta", visual: "Mockup chat nocturno" },
      { texto: "Lead de portal respondido en 30s → visita agendada", visual: "Mockup inmobiliaria" },
      { texto: "Hora agendada sin que la secretaria moviera un dedo", visual: "Mockup clínica" },
      { texto: "El cliente que no se fue a otro taller por esperar", visual: "Mockup taller" },
    ],
  },
  {
    slug: "ia-humano",
    nombre: "IA + Humano",
    objetivo: "Aclarar que la IA no reemplaza al equipo: lo potencia y deriva.",
    estado: "idea",
    prioridad: "media",
    cta: "Prueba cómo deriva → demo",
    historias: [
      { texto: "La IA responde lo repetitivo; tu equipo cierra", visual: "Reparto de roles" },
      { texto: "Cuando algo se sale de libreto, deriva a un humano", visual: "Flujo de derivación" },
      { texto: "Tú ves todo lo que conversa", visual: "Vista interna / registro" },
      { texto: "IA + humano, no IA en vez de humano", visual: "Frase de cierre" },
    ],
  },
];

export function destacadaPorSlug(slug: string) {
  return DESTACADAS.find((d) => d.slug === slug);
}
