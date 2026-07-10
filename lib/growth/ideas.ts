import type {
  CarouselDraft,
  ContentCalendarItem,
  ContentIdea,
  VideoScript,
  Canal,
  Formato,
  Funnel,
  PilarKey,
  Prioridad,
} from "./types";

/* ============================================================
 * IDEAS SEED — 50 ideas de contenido derivadas de la estrategia.
 * Builder compacto con defaults sensatos.
 * ============================================================ */

let ci = 0;
function idea(
  titulo: string,
  pilar: PilarKey,
  formato: Formato,
  canal: Canal,
  funnel: Funnel,
  extra: Partial<ContentIdea> = {},
): ContentIdea {
  ci += 1;
  return {
    id: `idea-${String(ci).padStart(3, "0")}`,
    titulo,
    descripcion: extra.descripcion ?? "",
    pilar,
    rubro: extra.rubro ?? null,
    canal,
    formato,
    prioridad: (extra.prioridad as Prioridad) ?? "media",
    estado: extra.estado ?? "idea",
    responsable: extra.responsable ?? null,
    fecha_sugerida: extra.fecha_sugerida ?? null,
    fuente: extra.fuente ?? null,
    objetivo_comercial: extra.objetivo_comercial ?? null,
    funnel,
    cta: extra.cta ?? null,
    notas: extra.notas ?? null,
    seed: true,
  };
}

export const IDEAS_SEED: ContentIdea[] = [
  // Problema
  idea("La venta que se enfrió", "problema", "reel", "instagram", "descubrimiento", { prioridad: "alta", fuente: "backlog IG Semana 1", objetivo_comercial: "Calentar prospección" }),
  idea("78% le compra al primero que responde", "problema", "carrusel", "instagram", "descubrimiento", { prioridad: "alta", fuente: "dato-ancla" }),
  idea("Mientras tú duermes, tus clientes escriben", "problema", "reel", "instagram", "descubrimiento", { fuente: "hook contraste temporal" }),
  idea("Cuánto te cuesta NO responder (calculadora CLP)", "problema", "carrusel", "instagram", "descubrimiento", { notas: "Lead magnet Mes 2", fuente: "backlog IG" }),
  idea("Los leads de WhatsApp se te desordenan", "problema", "carrusel", "instagram", "descubrimiento", {}),
  idea("Terminas atendiendo todo tú mismo, a las 11pm", "problema", "reel", "instagram", "descubrimiento", {}),
  idea("Cada minuto de demora te resta 3–5% del cierre", "problema", "post_educativo", "linkedin", "descubrimiento", { fuente: "dato-ancla" }),
  idea("El costo invisible de cotizar a mano", "problema", "carrusel", "instagram", "descubrimiento", {}),

  // Confianza / Acompañamiento
  idea("¿Y cuando tengas un problema, quién te responde?", "confianza", "reel", "instagram", "consideracion", { prioridad: "alta", fuente: "backlog IG — no te dejamos solo" }),
  idea("La IA no inventa precios (regla de diseño)", "confianza", "carrusel", "instagram", "consideracion", { prioridad: "alta", fuente: "OBJECIONES §6" }),
  idea("¿Y si el bot responde cualquier cosa?", "confianza", "carrusel", "instagram", "consideracion", { prioridad: "alta", fuente: "backlog IG Semana 1", objetivo_comercial: "Desarmar objeción #1" }),
  idea("Qué pasa cuando el bot no sabe algo", "confianza", "reel", "instagram", "consideracion", {}),
  idea("Lo probamos contigo antes de encenderlo", "confianza", "post_educativo", "instagram", "consideracion", {}),
  idea("Con nosotros hablas directo con los fundadores", "confianza", "reel", "instagram", "consideracion", { fuente: "diferenciador soporte" }),

  // Producto
  idea("Cómo cotiza con tu lista real", "producto", "reel", "instagram", "consideracion", { prioridad: "alta" }),
  idea("Cómo agenda una hora sola", "producto", "reel", "instagram", "consideracion", {}),
  idea("Cómo deriva a un humano", "producto", "reel", "instagram", "consideracion", {}),
  idea("Cómo se entrena con tu información", "producto", "carrusel", "instagram", "consideracion", {}),
  idea("Qué ve el negocio por dentro (registro de leads)", "producto", "reel", "instagram", "consideracion", {}),

  // Demo / Prueba
  idea("Le intenté sacar un precio inventado (reto)", "demo", "reel", "instagram", "decision", { prioridad: "alta", fuente: "backlog IG" }),
  idea("Bot cotizando a las 2 AM (mockup)", "demo", "reel", "instagram", "decision", { prioridad: "alta", fuente: "backlog IG Semana 1", rubro: "ferreterias" }),
  idea("Antes/después: 3 horas → 9 segundos", "demo", "reel", "instagram", "decision", { fuente: "backlog IG" }),
  idea("Escríbele tú mismo a la demo", "demo", "historia", "instagram", "decision", {}),

  // Rubros (fórmula sin)
  idea("Ferretería: cotiza sin frenar el mostrador", "rubros", "reel", "instagram", "descubrimiento", { rubro: "ferreterias", prioridad: "alta", fuente: "ICP 1" }),
  idea("Inmobiliaria: responde cada lead sin bajarte de la visita", "rubros", "reel", "instagram", "descubrimiento", { rubro: "inmobiliarias", prioridad: "alta", fuente: "ICP 2" }),
  idea("Clínica: llena tu agenda sin recargar a tu secretaria", "rubros", "reel", "instagram", "descubrimiento", { rubro: "clinicas", prioridad: "alta", fuente: "ICP 3" }),
  idea("Estética: agenda sin soltar lo que haces", "rubros", "reel", "instagram", "descubrimiento", { rubro: "estetica", fuente: "ICP 4" }),
  idea("Taller: captura al cliente sin soltar la herramienta", "rubros", "reel", "instagram", "descubrimiento", { rubro: "talleres", fuente: "ICP 5" }),
  idea("Tienda: tu catálogo responde solo 24/7", "rubros", "carrusel", "instagram", "descubrimiento", { rubro: "tiendas-catalogo" }),

  // Objeciones
  idea("'Ya tengo WhatsApp Business' — lo que le falta", "objeciones", "carrusel", "instagram", "consideracion", { fuente: "OBJECIONES §7" }),
  idea("'Está caro': persona vs asistente", "objeciones", "carrusel", "instagram", "consideracion", { fuente: "OBJECIONES §1", objetivo_comercial: "Anclaje de precio" }),
  idea("'No quiero una IA hablando con mis clientes'", "objeciones", "reel", "instagram", "consideracion", { fuente: "OBJECIONES §4" }),
  idea("'¿Reemplaza a mis vendedores?' — no", "objeciones", "post_objecion", "instagram", "consideracion", { fuente: "OBJECIONES §17" }),
  idea("'¿Me pueden bloquear WhatsApp?' — al revés", "objeciones", "post_objecion", "instagram", "consideracion", { fuente: "OBJECIONES §14" }),

  // Comparación
  idea("Chatbot de botones vs asistente de ventas", "comparacion", "carrusel", "instagram", "consideracion", { prioridad: "alta" }),
  idea("Por qué no necesitas un CRM completo al inicio", "comparacion", "carrusel", "linkedin", "consideracion", {}),
  idea("Automatizar respuestas vs automatizar ventas", "comparacion", "post_educativo", "linkedin", "consideracion", {}),
  idea("Por qué publicamos precios cuando nadie lo hace", "comparacion", "carrusel", "instagram", "consideracion", { fuente: "transparencia / research Darwin" }),

  // Educación
  idea("Qué es un asistente de ventas por WhatsApp", "educacion", "carrusel", "instagram", "descubrimiento", {}),
  idea("Chatbot vs asistente IA en 20 segundos", "educacion", "reel", "instagram", "descubrimiento", { fuente: "backlog IG" }),
  idea("Cómo funciona una cotización automática", "educacion", "carrusel", "instagram", "descubrimiento", {}),
  idea("Qué SÍ y qué NO automatizar legalmente en IG", "educacion", "carrusel", "instagram", "descubrimiento", { fuente: "backlog IG — regla Meta" }),
  idea("3 errores que arruinan un bot de WhatsApp", "educacion", "carrusel", "instagram", "consideracion", { fuente: "backlog IG" }),

  // Venta / Oferta
  idea("Pruébalo 30 días: si no te ayuda, no pagas", "venta", "reel", "instagram", "decision", { prioridad: "alta", fuente: "Oferta 30 días" }),
  idea("Qué incluye la implementación", "venta", "carrusel", "instagram", "decision", {}),
  idea("Precios claros, sin cotizar a ciegas", "venta", "post_linkedin", "linkedin", "decision", {}),
  idea("Cómo empezamos contigo (3 pasos)", "venta", "carrusel", "instagram", "decision", {}),

  // Founder journey
  idea("Construyendo una startup SaaS desde Chile", "founder", "reel", "instagram", "descubrimiento", { fuente: "formato #1 en engagement" }),
  idea("Aprendizajes vendiendo IA a pymes", "founder", "post_linkedin", "linkedin", "descubrimiento", {}),
  idea("Cómo estamos validando Respondo", "founder", "reel", "instagram", "descubrimiento", {}),
  idea("Por qué elegimos foco en vez de hacer de todo", "founder", "post_linkedin", "linkedin", "descubrimiento", {}),
];

/* ============================================================
 * CARRUSELES COMPLETOS (8)
 * ============================================================ */

export const CARRUSELES: CarouselDraft[] = [
  {
    id: "carr-001",
    titulo: "Tu negocio pierde ventas por WhatsApp",
    pilar: "problema",
    rubro: null,
    objetivo: "Que el dueño reconozca el dolor y guarde el post.",
    funnel: "descubrimiento",
    nivel_venta: "suave",
    slides: [
      { rol: "hook", texto: "Tu negocio puede estar perdiendo ventas por WhatsApp", nota_visual: "Texto grande sobre fondo limpio de marca" },
      { rol: "desarrollo", texto: "Y no es por recibir pocos mensajes", nota_visual: "Contraste" },
      { rol: "desarrollo", texto: "Es por responder tarde: el promedio en LATAM es de 2 a 4 horas", nota_visual: "Dato destacado" },
      { rol: "desarrollo", texto: "El 78% le compra al primer negocio que le responde", nota_visual: "Número gigante" },
      { rol: "desarrollo", texto: "Cada minuto de demora resta 3–5% de probabilidad de cierre", nota_visual: "Gráfico simple descendente" },
      { rol: "cierre", texto: "Respondo responde al tiro, cotiza con tus precios y agenda — 24/7", nota_visual: "Producto en 1 frase" },
      { rol: "cierre", texto: "Pruébalo tú mismo → link en la bio", nota_visual: "CTA con flecha" },
    ],
    caption:
      "No pierdes ventas por malas, las pierdes por lentas. El 78% le compra al primero que responde y el promedio en LATAM es de 2 a 4 horas. Un asistente responde al tiro, con tus datos reales. Pruébalo 👇",
    hashtags: ["#pymechile", "#whatsappbusiness", "#ventas", "#emprendimiento", "#ia"],
    cta: "Prueba la demo (link en bio)",
    notas_visuales: "Paleta violeta/coral, tipografía grande, 1 idea por slide.",
    seed: true,
  },
  {
    id: "carr-002",
    titulo: "¿Y si el bot responde cualquier cosa?",
    pilar: "confianza",
    rubro: null,
    objetivo: "Desarmar la objeción #1 (desconfianza) y generar saves.",
    funnel: "consideracion",
    nivel_venta: "medio",
    slides: [
      { rol: "hook", texto: "\"¿Y si el bot responde cualquier cosa?\"", nota_visual: "Pregunta entre comillas" },
      { rol: "desarrollo", texto: "Es LA pregunta. Y tiene tres respuestas.", nota_visual: "Anticipación" },
      { rol: "desarrollo", texto: "1. Solo responde con la información que TÚ nos das", nota_visual: "Ícono candado" },
      { rol: "desarrollo", texto: "2. Si no la tiene, no inventa: deriva a tu equipo", nota_visual: "Ícono derivación" },
      { rol: "desarrollo", texto: "3. Lo probamos contigo hasta que digas 'así hablaría yo'", nota_visual: "Ícono check" },
      { rol: "cierre", texto: "Trata de sacarle un precio inventado en la demo. No vas a poder 😉", nota_visual: "Reto" },
    ],
    caption:
      "El mercado está quemado de bots tontos. Por eso el nuestro no inventa: responde con tu info y deriva a un humano cuando no sabe. Pruébalo 👇",
    hashtags: ["#ia", "#whatsapp", "#pyme", "#atencionalcliente", "#chile"],
    cta: "Escríbele a la demo",
    seed: true,
  },
  {
    id: "carr-003",
    titulo: "Chatbot de botones vs asistente de ventas",
    pilar: "comparacion",
    rubro: null,
    objetivo: "Diferenciar categoría sin nombrar competidores.",
    funnel: "consideracion",
    nivel_venta: "medio",
    slides: [
      { rol: "hook", texto: "No todos los 'bots' son lo mismo", nota_visual: "Split screen" },
      { rol: "desarrollo", texto: "Chatbot de botones: 'elige una opción' → 1, 2, 3…", nota_visual: "Menú rígido" },
      { rol: "desarrollo", texto: "Cliente frustrado apretando 3 para volver al menú", nota_visual: "Cara de frustración" },
      { rol: "desarrollo", texto: "Asistente de ventas: conversa con tus precios reales", nota_visual: "Chat natural" },
      { rol: "desarrollo", texto: "Cotiza, agenda y deriva a humano cuando hace falta", nota_visual: "Capacidades" },
      { rol: "cierre", texto: "No competimos con los bots de $15.000. Competimos con las ventas que pierdes.", nota_visual: "Frase ancla" },
    ],
    caption:
      "Un menú de botones no es un asistente. La diferencia se nota en la venta que ganas o pierdes. Pruébalo tú mismo 👇",
    hashtags: ["#chatbot", "#ia", "#ventas", "#pyme", "#whatsappbusiness"],
    cta: "Compara en la demo",
    seed: true,
  },
  {
    id: "carr-004",
    titulo: "'Está caro': persona vs asistente",
    pilar: "objeciones",
    rubro: null,
    objetivo: "Anclar el precio contra el costo real de un vendedor.",
    funnel: "consideracion",
    nivel_venta: "medio",
    slides: [
      { rol: "hook", texto: "\"Está caro\"", nota_visual: "Objeción grande" },
      { rol: "desarrollo", texto: "¿Comparado con qué?", nota_visual: "Pregunta" },
      { rol: "desarrollo", texto: "Una persona atendiendo el WhatsApp: $650.000+ al mes", nota_visual: "Cifra" },
      { rol: "desarrollo", texto: "Un asistente que no duerme ni pide vacaciones: desde $24.990", nota_visual: "Cifra contraste" },
      { rol: "desarrollo", texto: "Y si se te escapan 2–3 ventas al mes por contestar tarde, ya se pagó", nota_visual: "ROI simple" },
      { rol: "cierre", texto: "Partamos por el plan que te acomode. Conversemos.", nota_visual: "CTA suave" },
    ],
    caption:
      "Caro es perder ventas por contestar a las 3 horas. Anclaje honesto, sin promesas infladas. ¿Cuánto vale una venta promedio tuya?",
    hashtags: ["#pyme", "#ventas", "#roi", "#whatsapp", "#emprendimiento"],
    cta: "Conversemos 15 min",
    seed: true,
  },
  {
    id: "carr-005",
    titulo: "Ferretería: la cotización que llega tarde",
    pilar: "rubros",
    rubro: "ferreterias",
    objetivo: "Que la ferretería se reconozca y pida la demo.",
    funnel: "descubrimiento",
    nivel_venta: "suave",
    slides: [
      { rol: "hook", texto: "En ferretería, la cotización que llega tarde es venta del competidor", nota_visual: "Foto mostrador" },
      { rol: "desarrollo", texto: "El contratista pide precio y stock un sábado a las 8pm", nota_visual: "Chat" },
      { rol: "desarrollo", texto: "El vendedor de mesón no puede soltar la fila para contestar", nota_visual: "Local lleno" },
      { rol: "desarrollo", texto: "Para cuando responden, ya compró en otra parte", nota_visual: "Venta perdida" },
      { rol: "desarrollo", texto: "El asistente cotiza al instante con tu lista real y te avisa quién la pidió", nota_visual: "Solución" },
      { rol: "cierre", texto: "Pídele cotizar cemento en la demo 👇", nota_visual: "CTA" },
    ],
    caption:
      "Cotiza todo el día sin frenar el mostrador. En ferretería cada cotización lenta es venta perdida medible. Pruébalo pidiéndole cotizar cemento 👇",
    hashtags: ["#ferreteria", "#construccion", "#cotizacion", "#whatsapp", "#pyme"],
    cta: "Demo: pídele cotizar cemento",
    seed: true,
  },
  {
    id: "carr-006",
    titulo: "Ya tengo WhatsApp Business, ¿para qué esto?",
    pilar: "objeciones",
    rubro: null,
    objetivo: "Convertir la objeción §7 en educación y deseo.",
    funnel: "consideracion",
    nivel_venta: "medio",
    slides: [
      { rol: "hook", texto: "\"Ya tengo WhatsApp Business\"", nota_visual: "Objeción" },
      { rol: "desarrollo", texto: "Perfecto — de hecho lo necesitas. Es la base.", nota_visual: "Validación" },
      { rol: "desarrollo", texto: "WhatsApp Business: perfil + respuestas rápidas manuales", nota_visual: "Lista" },
      { rol: "desarrollo", texto: "Lo que agregamos: que conteste, cotice y registre solo, 24/7", nota_visual: "Lista +" },
      { rol: "cierre", texto: "Es la diferencia entre tener el teléfono y tener a alguien contestándolo", nota_visual: "Frase ancla" },
    ],
    caption:
      "WhatsApp Business es el teléfono. Nosotros somos quien lo contesta, cotiza y registra por ti, 24/7. ¿Hoy alcanzan a responder todo lo que llega?",
    hashtags: ["#whatsappbusiness", "#pyme", "#automatizacion", "#ventas", "#ia"],
    cta: "Prueba la demo",
    seed: true,
  },
  {
    id: "carr-007",
    titulo: "Cómo empezamos contigo (3 pasos)",
    pilar: "venta",
    rubro: null,
    objetivo: "Reducir fricción mostrando lo simple del onboarding.",
    funnel: "decision",
    nivel_venta: "directo",
    slides: [
      { rol: "hook", texto: "Empezar con Respondo es más simple de lo que crees", nota_visual: "3 pasos" },
      { rol: "desarrollo", texto: "1. Nos pasas tu lista de precios y tus respuestas típicas", nota_visual: "Ícono 1" },
      { rol: "desarrollo", texto: "2. Lo configuramos, lo probamos contigo y lo dejamos andando", nota_visual: "Ícono 2" },
      { rol: "desarrollo", texto: "3. Tú sigues usando tu WhatsApp de siempre. Ves todo lo que conversa", nota_visual: "Ícono 3" },
      { rol: "cierre", texto: "Pruébalo 30 días: si no te ayuda, no pagas. Agenda 20 minutos 👇", nota_visual: "CTA + garantía" },
    ],
    caption:
      "No configuras nada. Tú nos pasas tu info, nosotros lo dejamos andando esta semana. Y lo pruebas 30 días: si no te sirve, no pagas la mensualidad. Agenda 👇",
    hashtags: ["#pyme", "#onboarding", "#ia", "#whatsapp", "#emprendimiento"],
    cta: "Agenda tu demo",
    seed: true,
  },
  {
    id: "carr-008",
    titulo: "Por qué publicamos nuestros precios",
    pilar: "comparacion",
    rubro: null,
    objetivo: "Diferenciar por transparencia (hueco del benchmark).",
    funnel: "consideracion",
    nivel_venta: "medio",
    slides: [
      { rol: "hook", texto: "Publicamos nuestros precios. Casi nadie en el rubro lo hace.", nota_visual: "Statement" },
      { rol: "desarrollo", texto: "¿Por qué el resto los esconde?", nota_visual: "Pregunta" },
      { rol: "desarrollo", texto: "Porque 'depende' es más fácil que comprometerse", nota_visual: "Contraste" },
      { rol: "desarrollo", texto: "Básico desde $24.990 · Pro desde $39.990 · Empresa desde $69.990", nota_visual: "Tabla clara" },
      { rol: "desarrollo", texto: "Implementación incluida. La hacemos nosotros.", nota_visual: "Refuerzo" },
      { rol: "cierre", texto: "Precios claros = confianza. Conversemos con las cartas sobre la mesa.", nota_visual: "CTA" },
    ],
    caption:
      "Transparencia = confianza. Por eso publicamos precios cuando el rubro los esconde. Sin cotizaciones a ciegas. ¿Te cuento cuál te calza?",
    hashtags: ["#transparencia", "#precios", "#pyme", "#ia", "#confianza"],
    cta: "Cotiza con nosotros",
    seed: true,
  },
];

/* ============================================================
 * GUIONES DE VIDEO COMPLETOS (8)
 * ============================================================ */

export const GUIONES: VideoScript[] = [
  {
    id: "vid-001",
    titulo: "Qué es Respondo (presentación 30s)",
    tipo: "presentacion",
    pilar: "producto",
    rubro: null,
    canal: "instagram",
    duracion: "25-30s",
    objetivo: "Explicar la categoría y mandar a la demo.",
    funnel: "descubrimiento",
    nivel_venta: "suave",
    hook: "Si vendes por WhatsApp, esto te va a servir.",
    escenas: [
      { escena: "Founder a cámara, casual", texto_pantalla: "¿Vendes por WhatsApp?", voz: "Si vendes por WhatsApp, seguro ahora mismo tienes mensajes sin responder." },
      { escena: "Mockup de chat respondiendo", texto_pantalla: "Responde 24/7", voz: "Respondo es un asistente que responde al tiro, con la información real de tu negocio." },
      { escena: "Cotización con totales", texto_pantalla: "Cotiza con tus precios", voz: "Cotiza con tu lista, agenda horas y te guarda el contacto de cada interesado." },
      { escena: "Ícono de derivación", texto_pantalla: "No inventa", voz: "Y cuando no sabe algo, no inventa: te deriva la conversación." },
    ],
    cta: "Pruébalo tú mismo, link en la bio.",
    version_corta: "Asistente que responde, cotiza y agenda por tu WhatsApp, 24/7, con tus datos. Pruébalo → bio.",
    notas_edicion: "Subtítulos grandes, ritmo rápido, cortar silencios. Sin música épica.",
    seed: true,
  },
  {
    id: "vid-002",
    titulo: "La venta que se enfrió (problema)",
    tipo: "problema",
    pilar: "problema",
    rubro: null,
    canal: "instagram",
    duracion: "20-25s",
    objetivo: "Provocar el reconocimiento del dolor.",
    funnel: "descubrimiento",
    nivel_venta: "suave",
    hook: "Un cliente te escribió a las 9. Le respondiste a las 12.",
    escenas: [
      { escena: "Teléfono con notificación", texto_pantalla: "9:03 PM", voz: "Un cliente te escribe pidiendo precio a las nueve de la noche." },
      { escena: "Negocio cerrado / dueño ocupado", texto_pantalla: "Nadie contesta", voz: "Nadie contesta. Tú estás cerrando, cocinando o durmiendo." },
      { escena: "Cliente escribiendo a otro", texto_pantalla: "Va donde el que responde", voz: "Para cuando respondes, ya le compró al que contestó primero." },
      { escena: "Dato en pantalla", texto_pantalla: "78% compra al primero", voz: "El 78% le compra al primer negocio que responde. No pierdas por lento." },
    ],
    cta: "Que tu WhatsApp responda por ti. Link en la bio.",
    version_corta: "Le escribiste a las 12, te escribió a las 9. Ya compró en otra parte. Soluciónalo → bio.",
    notas_edicion: "Hook hablando a mitad de frase. Texto grande. Pattern interrupt al inicio.",
    seed: true,
  },
  {
    id: "vid-003",
    titulo: "Le intenté sacar un precio inventado (demo/reto)",
    tipo: "demo",
    pilar: "demo",
    rubro: null,
    canal: "instagram",
    duracion: "25-35s",
    objetivo: "Demostrar que no alucina; empujar a probar la demo.",
    funnel: "decision",
    nivel_venta: "medio",
    hook: "Le pedí a nuestro bot un precio que no existe. Mira qué hizo.",
    escenas: [
      { escena: "Pantalla del chat en vivo", texto_pantalla: "Le pido algo imposible", voz: "Le pregunté por un producto que no está en la lista." },
      { escena: "Respuesta del bot", texto_pantalla: "No inventa", voz: "No se inventó un precio. Dijo que lo confirmaba con el equipo." },
      { escena: "Repite con otro dato", texto_pantalla: "De nuevo", voz: "Lo intenté otra vez con un descuento falso. Nada." },
      { escena: "Founder sonriendo", texto_pantalla: "Pruébalo tú", voz: "Así de aburrido de confiable. Trata de sacarle un precio inventado tú mismo." },
    ],
    cta: "Escríbele a la demo. Link en la bio.",
    version_corta: "Intenté que inventara un precio. No pudo. Inténtalo tú → bio.",
    notas_edicion: "Screen recording real del chat. Cero edición falsa. Rotular 'demo'.",
    seed: true,
  },
  {
    id: "vid-004",
    titulo: "Ferretería: cotiza sin frenar el mostrador (rubro)",
    tipo: "rubro",
    pilar: "rubros",
    rubro: "ferreterias",
    canal: "instagram",
    duracion: "20-30s",
    objetivo: "Que la ferretería pida la demo de cotización.",
    funnel: "descubrimiento",
    nivel_venta: "medio",
    hook: "Sábado a las 8. Un contratista te pide precio de cemento.",
    escenas: [
      { escena: "Mostrador con fila", texto_pantalla: "Local lleno", voz: "Tienes el mostrador lleno y no puedes soltar la fila." },
      { escena: "Chat entrando", texto_pantalla: "Cotización pendiente", voz: "Entra un WhatsApp: precio y stock de una lista de materiales." },
      { escena: "Bot cotizando con totales", texto_pantalla: "Cotización en 40s", voz: "El asistente cotiza al instante con tu lista real y suma los totales." },
      { escena: "Aviso al vendedor", texto_pantalla: "Lead capturado", voz: "Y te avisa quién la pidió para que cierres la venta." },
    ],
    cta: "Pídele cotizar cemento en la demo. Bio.",
    version_corta: "El mostrador lleno, la cotización llegando sola. Pruébalo → bio.",
    notas_edicion: "Mostrar el ejemplo real del cemento (el de la landing). Rotular 'ejemplo ilustrativo'.",
    seed: true,
  },
  {
    id: "vid-005",
    titulo: "¿Y si responde mal? (objeción/confianza)",
    tipo: "objecion",
    pilar: "confianza",
    rubro: null,
    canal: "instagram",
    duracion: "25-30s",
    objetivo: "Desarmar el miedo antes de la reunión.",
    funnel: "consideracion",
    nivel_venta: "medio",
    hook: "\"¿Y si el bot le dice cualquier cosa a mis clientes?\"",
    escenas: [
      { escena: "Founder a cámara", texto_pantalla: "LA pregunta", voz: "Es la pregunta que todos hacen. Y está buena." },
      { escena: "Ícono candado", texto_pantalla: "1. Solo tu info", voz: "Uno: responde solo con la información que tú nos das." },
      { escena: "Ícono derivación", texto_pantalla: "2. Deriva, no inventa", voz: "Dos: si no la tiene, deriva a un humano. No improvisa." },
      { escena: "Ícono check", texto_pantalla: "3. Lo probamos contigo", voz: "Tres: lo ajustamos contigo hasta que digas 'así hablaría yo'." },
    ],
    cta: "Trata de romperlo en la demo. Bio.",
    version_corta: "Tres capas para que no responda mal: tu info, deriva a humano, y lo probamos contigo.",
    notas_edicion: "Tono tranquilo, cercano. Nada defensivo.",
    seed: true,
  },
  {
    id: "vid-006",
    titulo: "Chatbot vs asistente en 20 segundos (comparación)",
    tipo: "comparacion",
    pilar: "comparacion",
    rubro: null,
    canal: "instagram",
    duracion: "20s",
    objetivo: "Diferenciar categoría, generar saves.",
    funnel: "consideracion",
    nivel_venta: "suave",
    hook: "No todos los 'bots' son lo mismo. En 20 segundos:",
    escenas: [
      { escena: "Menú de botones", texto_pantalla: "Chatbot: elige 1, 2, 3", voz: "El chatbot de botones te hace elegir opciones. Rígido." },
      { escena: "Cliente apretando 3", texto_pantalla: "Cliente frustrado", voz: "El cliente termina apretando 3 para volver al menú." },
      { escena: "Chat natural", texto_pantalla: "Asistente: conversa", voz: "El asistente conversa con tus precios reales, cotiza y agenda." },
      { escena: "Frase final", texto_pantalla: "Otra categoría", voz: "No es lo mismo. Es otra categoría." },
    ],
    cta: "Pruébalo y nota la diferencia. Bio.",
    version_corta: "Botones vs conversación real. Nota la diferencia → bio.",
    notas_edicion: "Split screen o cortes rápidos. Texto grande.",
    seed: true,
  },
  {
    id: "vid-007",
    titulo: "Pruébalo 30 días sin riesgo (oferta)",
    tipo: "oferta",
    pilar: "venta",
    rubro: null,
    canal: "instagram",
    duracion: "20-25s",
    objetivo: "Comunicar la garantía de 30 días y bajar el riesgo de partir.",
    funnel: "decision",
    nivel_venta: "directo",
    hook: "¿Y si lo pruebas antes de pagar un peso de mensualidad?",
    escenas: [
      { escena: "Founders a cámara", texto_pantalla: "Prueba 30 días", voz: "Somos dos personas construyendo Respondo, y queremos que lo pruebes sin riesgo." },
      { escena: "Garantía en pantalla", texto_pantalla: "Si no te ayuda, no pagas", voz: "Lo dejamos andando en tu WhatsApp y lo usas 30 días." },
      { escena: "La promesa", texto_pantalla: "No pagas la mensualidad", voz: "Si no te ayuda a responder y cotizar más rápido, no pagas la mensualidad de ese mes." },
      { escena: "Cierre", texto_pantalla: "Escríbenos y partimos", voz: "Si vendes por WhatsApp, escríbenos y lo dejamos funcionando." },
    ],
    cta: "Escríbenos 'quiero probarlo'. Bio.",
    version_corta: "Pruébalo 30 días: si no te ayuda a responder y cotizar más rápido, no pagas. Escríbenos → bio.",
    notas_edicion: "Los dos founders juntos. Cercano y honesto, sin humo.",
    seed: true,
  },
  {
    id: "vid-008",
    titulo: "Construyendo Respondo desde Chile (founder journey)",
    tipo: "founder",
    pilar: "founder",
    rubro: null,
    canal: "instagram",
    duracion: "30-45s",
    objetivo: "Cercanía, comunidad y confianza (formato #1 engagement).",
    funnel: "descubrimiento",
    nivel_venta: "suave",
    hook: "Estamos construyendo una empresa de IA desde Chile, entre dos personas.",
    escenas: [
      { escena: "Founders trabajando", texto_pantalla: "2 personas", voz: "Sin inversión externa, sin equipo grande. Dos personas y muchas ganas." },
      { escena: "Pantalla con prospección", texto_pantalla: "Vendiendo de verdad", voz: "Hablamos con negocios reales todos los días para entender su dolor." },
      { escena: "Aprendizaje", texto_pantalla: "Lo que aprendimos", voz: "Aprendimos que la gente no desconfía de la IA: desconfía de los bots tontos." },
      { escena: "A cámara", texto_pantalla: "Síguenos el proceso", voz: "Te vamos contando el camino. Si construyes algo parecido, conversemos." },
    ],
    cta: "Síguenos y conversemos.",
    version_corta: "2 personas, desde Chile, vendiéndole IA a pymes reales. Te contamos el proceso.",
    notas_edicion: "Formato historia, auténtico > producción. Es el que más engancha.",
    seed: true,
  },
];

/* ============================================================
 * CALENDARIO 30 DÍAS (sugerido, desde 2026-07-07)
 * Cadencia base: 3 reels + 2 carruseles/semana + stories.
 * ============================================================ */

let cal = 0;
function cItem(
  fecha: string,
  titulo: string,
  formato: Formato,
  pilar: PilarKey,
  extra: Partial<ContentCalendarItem> = {},
): ContentCalendarItem {
  cal += 1;
  return {
    id: `cal-${String(cal).padStart(3, "0")}`,
    titulo,
    fecha,
    canal: extra.canal ?? "instagram",
    formato,
    pilar,
    rubro: extra.rubro ?? null,
    estado: extra.estado ?? "idea",
    responsable: extra.responsable ?? null,
    idea_id: extra.idea_id ?? null,
    notas: extra.notas ?? null,
    seed: true,
  };
}

export const CALENDARIO: ContentCalendarItem[] = [
  // Semana 1 (7–13 jul) — calza con roadmap comercial
  cItem("2026-07-07", "Reel: La venta que se enfrió", "reel", "problema", { idea_id: "idea-001", estado: "listo" }),
  cItem("2026-07-08", "Carrusel: ¿Y si responde cualquier cosa?", "carrusel", "confianza", { idea_id: "idea-011" }),
  cItem("2026-07-10", "Reel: No te dejamos solo", "reel", "confianza", { idea_id: "idea-009" }),
  cItem("2026-07-11", "Carrusel: 78% compra al primero", "carrusel", "problema", { idea_id: "idea-002" }),
  cItem("2026-07-12", "Reel/mockup: Bot cotizando a las 2 AM", "reel", "demo", { idea_id: "idea-021", rubro: "ferreterias" }),
  // Semana 2 (14–20 jul)
  cItem("2026-07-14", "Reel: Ferretería sin frenar el mostrador", "reel", "rubros", { idea_id: "idea-024", rubro: "ferreterias" }),
  cItem("2026-07-15", "Carrusel: Chatbot de botones vs asistente", "carrusel", "comparacion", { idea_id: "idea-035" }),
  cItem("2026-07-17", "Reel: Le intenté sacar un precio inventado", "reel", "demo", { idea_id: "idea-020" }),
  cItem("2026-07-18", "Carrusel: 'Está caro' persona vs asistente", "carrusel", "objeciones", { idea_id: "idea-031" }),
  cItem("2026-07-19", "Reel: Inmobiliaria sin bajarte de la visita", "reel", "rubros", { idea_id: "idea-025", rubro: "inmobiliarias" }),
  // Semana 3 (21–27 jul)
  cItem("2026-07-21", "Reel: Cómo cotiza con tu lista real", "reel", "producto", { idea_id: "idea-015" }),
  cItem("2026-07-22", "Carrusel: Por qué publicamos precios", "carrusel", "comparacion", { idea_id: "idea-038" }),
  cItem("2026-07-24", "Reel: Construyendo Respondo desde Chile", "reel", "founder", { idea_id: "idea-047" }),
  cItem("2026-07-25", "Carrusel: 3 errores que arruinan un bot", "carrusel", "educacion", { idea_id: "idea-043" }),
  cItem("2026-07-26", "Reel: Clínica sin recargar a tu secretaria", "reel", "rubros", { idea_id: "idea-026", rubro: "clinicas" }),
  // Semana 4 (28 jul–3 ago)
  cItem("2026-07-28", "Reel: Qué pasa cuando el bot no sabe algo", "reel", "confianza", { idea_id: "idea-012" }),
  cItem("2026-07-29", "Carrusel: Cómo empezamos contigo (3 pasos)", "carrusel", "venta", { idea_id: "idea-046" }),
  cItem("2026-07-31", "Reel: Pruébalo 30 días sin riesgo", "reel", "venta", { idea_id: "idea-044" }),
  cItem("2026-08-01", "Carrusel: Ya tengo WhatsApp Business", "carrusel", "objeciones", { idea_id: "idea-030" }),
  cItem("2026-08-02", "Post LinkedIn: Aprendizajes vendiendo IA a pymes", "post_linkedin", "founder", { canal: "linkedin", idea_id: "idea-048" }),
];
