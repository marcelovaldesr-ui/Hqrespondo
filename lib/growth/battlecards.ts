import type { Battlecard } from "./types";

/**
 * BATTLECARDS — análisis competitivo convertido en argumentos y contenido.
 * Fuente: OBJECIONES_RESPONDO.md §12 + INSTAGRAM_RESPONDO.md (research a Vambe/
 * Darwin) + analisis-competitivo (memoria). Regla de oro del equipo: NUNCA citar
 * competidores por nombre en contenido público; traducir a positivo. Precios de
 * terceros son referenciales (jul-2026) y DEBEN verificarse en su web antes de
 * escribirlos en una propuesta. Donde falta dato del workspace → requiere_investigacion.
 */
export const BATTLECARDS: Battlecard[] = [
  {
    slug: "vambe",
    nombre: "Vambe",
    tipo: "plataforma",
    que_ofrecen:
      "Plataforma de IA conversacional para ventas, apuntando a empresas medianas/grandes. Plan de entrada referencial sobre los ~$380.000/mes + implementación aparte (verificar).",
    fuertes_para:
      "Empresas más grandes, con equipo y presupuesto, que quieren una plataforma robusta.",
    donde_diferenciarnos:
      "Precio de entrada mucho menor con implementación INCLUIDA hecha por nosotros; acompañamiento real post-venta. Estamos en el 'medio justo' para una pyme chilena (desde $149.000 con todo hecho).",
    no_copiar:
      "No apuntar a enterprise ni a la amplitud de features. No competir por cantidad de integraciones.",
    angulos_contenido: [
      "'Por qué publicamos nuestros precios cuando nadie en el rubro lo hace' (transparencia = confianza).",
      "'Persona vs asistente' y 'plataforma grande vs implementación acompañada' sin nombrar a nadie.",
      "'Con nosotros hablas directo con los fundadores' (traducción positiva del dolor de soporte del mercado).",
    ],
    objecion_tipica: "'¿Qué diferencia tienen con Vambe?'",
    respuesta_comercial:
      "Buenas plataformas. Vambe apunta a empresas más grandes: su plan de entrada está sobre los $380.000 + implementación aparte. Nosotros estamos en el medio justo para una pyme: desde $149.000 con implementación completa hecha por nosotros, en español, y con acompañamiento real después de vender.",
    contenido_recomendado:
      "Carrusel de comparación honesta (categorías, no marcas) + Reel 'no te dejamos solo'.",
    riesgo:
      "Comparar precio de frente puede sonar defensivo. El punto fuerte NO es precio: es acompañamiento e implementación incluida.",
  },
  {
    slug: "respond-io",
    nombre: "respond.io",
    tipo: "plataforma",
    que_ofrecen:
      "Software self-service de gestión de conversaciones omnicanal con IA. Plan Growth referencial ~USD 159/mes; configuras todo tú (flujos, integraciones, mantención), sin implementación incluida (verificar).",
    fuertes_para:
      "Empresas con equipo técnico interno y tiempo para armar y mantener sus flujos.",
    donde_diferenciarnos:
      "Nosotros lo dejamos andando por ti — cero configuración de tu parte — y respondemos cuando necesitas un cambio. En español y pensado para pyme chilena.",
    no_copiar:
      "No prometer omnicanalidad completa ni self-service. Nuestro valor es lo contrario: acompañamiento.",
    angulos_contenido: [
      "'Software que armas tú vs asistente que dejamos andando nosotros'.",
      "'Cuánto tiempo te toma configurar y mantener un bot' (educativo).",
    ],
    objecion_tipica: "'¿Y respond.io / WATI?'",
    respuesta_comercial:
      "Son self-service: configuras todo tú, sin implementación incluida. Si tienes equipo técnico y tiempo, te pueden servir. Si quieres que funcione sin que tú lo armes y que alguien te conteste cuando necesitas un cambio, eso es lo nuestro.",
    contenido_recomendado:
      "Post educativo 'lo que nadie te cuenta de configurar un bot solo' + Reel de onboarding acompañado.",
    riesgo: "No menospreciar; son buenas herramientas para otro perfil de cliente.",
  },
  {
    slug: "wati",
    nombre: "WATI",
    tipo: "plataforma",
    que_ofrecen:
      "Plataforma self-service sobre WhatsApp Business API (broadcast, chatbots por flujos, gestión de agentes). Enfoque en autoservicio.",
    fuertes_para:
      "Negocios que quieren campañas de WhatsApp y gestión de agentes, con disposición a configurar.",
    donde_diferenciarnos:
      "Implementación acompañada + asistente conversacional entrenado con la info del negocio, no solo flujos de botones. Soporte cercano en español.",
    no_copiar: "No entrar a la guerra de broadcast masivo ni de features de campañas.",
    angulos_contenido: [
      "'Flujos de botones vs conversación real' (categoría, sin marca).",
      "'Por qué un menú de opciones frustra a tu cliente'.",
    ],
    objecion_tipica: "'¿En qué se diferencian de WATI?'",
    respuesta_comercial:
      "WATI es self-service y muy orientado a campañas. Nosotros implementamos por ti un asistente que conversa con tus datos reales y te acompañamos después. No competimos en broadcast; competimos en que funcione sin que tú lo armes.",
    contenido_recomendado: "Carrusel 'chatbot de botones vs asistente de ventas'.",
    riesgo: "Baja diferenciación percibida si el prospecto solo quiere broadcast.",
    requiere_investigacion: true,
  },
  {
    slug: "zoko",
    nombre: "Zoko",
    tipo: "plataforma",
    que_ofrecen:
      "Plataforma de WhatsApp para e-commerce (catálogo, pagos, broadcast). Foco en tiendas.",
    fuertes_para: "E-commerce con catálogo que quiere vender por WhatsApp con campañas.",
    donde_diferenciarnos:
      "Acompañamiento e implementación local; asistente entrenado con el negocio para responder y cotizar, no solo catálogo + broadcast.",
    no_copiar: "No replicar features de e-commerce/pagos como foco inicial.",
    angulos_contenido: [
      "'Responder bien vs solo mandar catálogo'.",
      "Contenido por rubro tiendas con catálogo.",
    ],
    objecion_tipica: "'Vi Zoko para tiendas'",
    respuesta_comercial:
      "Zoko es fuerte en catálogo y campañas para e-commerce. Si tu dolor es responder rápido, cotizar y agendar con tus datos — y que alguien lo deje andando por ti — eso es lo nuestro.",
    contenido_recomendado: "Reel de tienda respondiendo precio/stock/despacho 24/7.",
    riesgo: "Poco solapamiento salvo en e-commerce.",
    requiere_investigacion: true,
  },
  {
    slug: "intercom-zendesk-hubspot-drift",
    nombre: "Intercom / Zendesk AI / HubSpot / Drift",
    tipo: "plataforma",
    que_ofrecen:
      "Suites de soporte/CRM/marketing con IA, orientadas a empresas medianas-grandes, primero en inglés y con foco web/soporte más que WhatsApp pyme LATAM.",
    fuertes_para:
      "Empresas con operación grande, equipos de soporte/marketing y presupuesto en USD.",
    donde_diferenciarnos:
      "Simplicidad, foco WhatsApp pyme chilena, precio en CLP, implementación acompañada y cercanía. No necesitas un CRM completo para partir.",
    no_copiar:
      "No intentar competir en amplitud de suite. No sonar 'plataforma empresarial gigante'.",
    angulos_contenido: [
      "'Por qué no necesitas un CRM completo al inicio'.",
      "'Empezar simple por WhatsApp vs montar una suite enterprise'.",
    ],
    objecion_tipica: "'¿No es mejor una plataforma grande tipo Intercom/HubSpot?'",
    respuesta_comercial:
      "Son excelentes para empresas grandes con equipos dedicados. Para una pyme que vende por WhatsApp, montar eso es caro y lento. Nosotros partimos simple, en tu WhatsApp, en CLP, y lo dejamos andando esta semana.",
    contenido_recomendado:
      "Carrusel 'no necesitas un CRM completo para partir' + post de simplicidad.",
    riesgo: "Rara vez el prospecto pyme los evalúa en serio; no sobre-argumentar.",
  },
  {
    slug: "chatbots-baratos",
    nombre: "Chatbots baratos (menús de botones)",
    tipo: "chatbot",
    que_ofrecen:
      "Bots de menú/botones desde ~$15.000/mes que el propio dueño configura. Respuestas rígidas, sin conversación real.",
    fuertes_para: "Quien solo quiere un auto-respuesta básico y lo arma solo.",
    donde_diferenciarnos:
      "Conversación real con tus precios, implementada por nosotros, con soporte. 'No competimos con los bots de $15.000 — competimos con el costo de las ventas que pierdes.'",
    no_copiar: "No caer en la guerra de precio ni en el formato menú de botones.",
    angulos_contenido: [
      "'3 errores que arruinan un bot de WhatsApp'.",
      "'El bot que te hace apretar 3 para volver al menú' (dolor del mercado quemado).",
      "'Barato que sale caro: la venta que pierdes con un bot tonto'.",
    ],
    objecion_tipica: "'¿Por qué no un chatbot más barato?'",
    respuesta_comercial:
      "Puedes, existen desde $15.000. Esos son menús de botones que configuras tú y ahí quedan — clientes frustrados apretando '3'. Lo nuestro es otra categoría: conversación real con tus precios, implementada por nosotros. ¿Has probado alguno? ¿Cómo te fue?",
    contenido_recomendado:
      "Reel 'le intenté sacar un precio inventado' + carrusel de los 3 errores.",
    riesgo:
      "El prospecto sensible a precio puede irse igual; calificar volumen y capacidad de pago.",
  },
  {
    slug: "casero-whatsapp-business",
    nombre: "Solución casera (WhatsApp Business app)",
    tipo: "casero",
    que_ofrecen:
      "El dueño usa WhatsApp Business con respuestas rápidas y etiquetas, todo manual.",
    fuertes_para: "Negocios de muy bajo volumen que alcanzan a responder todo a mano.",
    donde_diferenciarnos:
      "Encima de eso agregamos que conteste solo, cotice solo y registre cada interesado, 24/7. 'Es la diferencia entre tener el teléfono y tener a alguien contestándolo.'",
    no_copiar: "No descalificar WhatsApp Business: es la base que el cliente necesita.",
    angulos_contenido: [
      "'Ya tengo WhatsApp Business, ¿para qué esto?' (objeción → post).",
      "'Lo que WhatsApp Business no hace por ti'.",
    ],
    objecion_tipica: "'Ya tengo WhatsApp Business'",
    respuesta_comercial:
      "Perfecto, eso es la base y lo necesitas. WhatsApp Business te da perfil y respuestas manuales; nosotros agregamos que conteste, cotice y registre solo, 24/7. ¿Hoy alcanzan a responder todo lo que llega?",
    contenido_recomendado: "Carrusel 'lo que tu WhatsApp Business no hace (todavía)'.",
    riesgo:
      "Si el volumen es bajo, la objeción es válida: descartar sin insistir (regla del ICP).",
  },
  {
    slug: "agencias-automatizacion",
    nombre: "Agencias de automatización genéricas",
    tipo: "agencia",
    que_ofrecen:
      "Proyectos a medida (n8n/Make/Zapier + bots) por encargo, a menudo caros, lentos y difíciles de mantener.",
    fuertes_para:
      "Empresas que quieren un desarrollo muy específico y tienen presupuesto de proyecto.",
    donde_diferenciarnos:
      "Producto especializado en asistentes de ventas WhatsApp, estandarizado y reutilizable, con precio claro y mantención — no un proyecto a medida irrepetible.",
    no_copiar:
      "No convertirnos en agencia genérica que hace 'de todo con IA' (regla central de Respondo).",
    angulos_contenido: [
      "'Producto especializado vs proyecto a medida'.",
      "'Por qué un asistente estandarizado te sale mejor que un desarrollo único'.",
    ],
    objecion_tipica: "'¿No es mejor mandar a hacer algo a medida?'",
    respuesta_comercial:
      "Un desarrollo a medida es caro, lento y después ¿quién lo mantiene? Nosotros nos especializamos en una cosa y la hacemos muy bien: asistentes de ventas por WhatsApp, con precio claro y soporte. Partimos esta semana, no en tres meses.",
    contenido_recomendado: "Post 'especialistas vs todólogos' + founder journey del foco.",
    riesgo: "No caer en prometer personalizaciones que no podemos mantener con 2 personas.",
  },
];

export function battlecardPorSlug(slug: string) {
  return BATTLECARDS.find((b) => b.slug === slug);
}
