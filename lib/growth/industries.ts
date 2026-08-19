import type { IndustryContent } from "./types";

/**
 * CONTENIDO POR RUBRO.
 * Los 5 primeros salen de ICP_RESPONDO.md (perfiles priorizados, con dolores,
 * casos de uso, promesa y objeciones reales). Los demás son rubros de la lista
 * pedida, en prioridad menor. La fórmula "sin" viene de INSTAGRAM_RESPONDO.md.
 * mensaje_prospeccion resume MENSAJES_PROSPECCION_RESPONDO.md por rubro.
 */
export const RUBROS: IndustryContent[] = [
  {
    slug: "ferreterias",
    nombre: "Ferreterías y distribuidoras",
    emoji: "🔩",
    prioridad_comercial: "alta",
    orden_ataque: 1,
    dolores: [
      "Cotizan el mismo precio + stock + despacho 30 veces al día por WhatsApp.",
      "El vendedor de mesón deja de atender la fila para contestar el teléfono.",
      "La cotización que llega tarde = el contratista ya compró en otra parte.",
    ],
    preguntas_cliente: [
      "¿Tienen stock de [material] y a cuánto sale?",
      "¿Hacen despacho a [comuna] y qué día?",
      "¿Me cotizan esta lista para una obra?",
    ],
    casos_uso: [
      "Cotizador automático: responde precio/stock de lista y arma cotización con totales.",
      "Captura datos del contratista y avisa al vendedor para cerrar.",
      "Responde despacho, horarios y disponibilidad 24/7.",
    ],
    ideas_post: [
      "La cotización que llega tarde es venta del competidor",
      "Cuánto vende tu mesón mientras contesta el teléfono",
    ],
    ideas_carrusel: [
      "3 cotizaciones que se te escapan cada sábado",
      "Cómo cotizar 30 veces sin frenar el mostrador",
    ],
    ideas_reel: [
      "Bot cotizando cemento a las 2 AM (mockup)",
      "Contratista pide precio un domingo → cotización en 40s",
    ],
    mensaje_prospeccion:
      "Cuando un contratista les pide precio y stock un sábado o después de las 7, ¿quién le responde? Armamos asistentes que cotizan al instante con la lista real del negocio — pídele cotizar cemento en la demo → [link]",
    objeciones: [
      "'Mis precios cambian todos los días' → tú actualizas tu planilla, el bot lee de ahí (Kit de Cotización).",
      "'Mis clientes quieren hablar con el Pato de siempre' → el bot cotiza lo repetitivo, el Pato cierra.",
    ],
    cta: "Pídele cotizar en la demo → [link]",
    formula_sin: "Cotiza todo el día sin frenar el mostrador",
    pagina_seo: "/rubros/ferreterias",
  },
  {
    slug: "inmobiliarias",
    nombre: "Corredoras e inmobiliarias",
    emoji: "🏠",
    prioridad_comercial: "alta",
    orden_ataque: 2,
    dolores: [
      "El lead de portal escribe y si no contestas en minutos, ya habla con otro corredor.",
      "Responder <5 min multiplica ~100x la probabilidad de contacto; el corredor está en visitas medio día.",
      "Cada lead frío es comisión perdida ($500.000–$3M+ por operación).",
    ],
    preguntas_cliente: [
      "¿Acepta mascotas / cuánto es el gasto común?",
      "¿Sigue disponible? ¿Se puede ver el sábado?",
      "¿Cuál es el precio y los requisitos?",
    ],
    casos_uso: [
      "Califica el lead (presupuesto, comuna, arriendo o compra).",
      "Responde dudas de la propiedad leyendo tu ficha.",
      "Agenda la visita en el calendario.",
    ],
    ideas_post: [
      "El lead que espera 15 min ya está con otro corredor",
      "Un lead contactado en <5 min convierte ~100x más",
    ],
    ideas_carrusel: [
      "Por qué pierdes leads mientras estás en una visita",
      "Cómo calificar un lead sin bajarte del auto",
    ],
    ideas_reel: [
      "Lead pregunta por una propiedad a medianoche → agendado para el sábado",
      "El corredor en visita, el bot cerrando la próxima visita",
    ],
    mensaje_prospeccion:
      "Un lead contactado en <5 min tiene ~100x más probabilidad de convertir — y llegan justo cuando estás en visita. El asistente responde, califica y agenda la visita en tu calendario. ¿Lo pruebas como un lead? → [link]",
    objeciones: [
      "'Prefiero hablarles en persona' → el bot filtra y agenda, tú encantas en la visita.",
      "'Cada propiedad es distinta' → el bot lee tu ficha de cada propiedad.",
    ],
    cta: "Pruébalo como un lead → [link]",
    formula_sin: "Responde cada lead sin bajarte de la visita",
    pagina_seo: "/rubros/inmobiliarias",
  },
  {
    slug: "clinicas",
    nombre: "Clínicas y centros médicos",
    emoji: "🩺",
    prioridad_comercial: "alta",
    orden_ataque: 3,
    dolores: [
      "La secretaria no da abasto: valores, previsión, horarios y agendamiento manual.",
      "Fuera de horario no contesta nadie y el paciente reserva en otro centro.",
      "Inasistencias sin recordatorio dejan huecos en la agenda.",
    ],
    preguntas_cliente: [
      "¿Atienden [previsión] y cuánto sale la consulta?",
      "¿Tienen hora para esta semana?",
      "¿Dónde están y en qué horario?",
    ],
    casos_uso: [
      "Recepcionista virtual: responde valores/previsión/FAQ.",
      "Agenda la hora y envía recordatorio (menos inasistencias).",
      "Deriva a la secretaria lo delicado.",
    ],
    ideas_post: [
      "Tu agenda se llena incluso con la consulta cerrada",
      "Cuántas horas pierde tu secretaria repitiendo lo mismo",
    ],
    ideas_carrusel: [
      "Las 5 preguntas que tu secretaria contesta 40 veces al día",
      "Menos inasistencias con recordatorio automático",
    ],
    ideas_reel: [
      "Paciente pregunta a las 22:00 → hora agendada",
      "La secretaria atendiendo bien a los presentes, el bot con el WhatsApp",
    ],
    mensaje_prospeccion:
      "Las preguntas de valores, previsión y horas que llegan por WhatsApp, ¿las responde la secretaria entre paciente y paciente? Implementamos un asistente que responde, agenda y manda el recordatorio — y deriva lo delicado. Pruébala como paciente → [link]",
    objeciones: [
      "'Los pacientes quieren trato humano' → el bot informa y agenda; lo delicado pasa a tu equipo.",
      "'Manejamos datos sensibles' → el bot no pide diagnósticos ni fichas; solo contacto y hora, por vías oficiales.",
    ],
    cta: "Pruébala como paciente → [link]",
    formula_sin: "Llena tu agenda sin recargar a tu secretaria",
    pagina_seo: "/rubros/clinicas",
  },
  {
    slug: "estetica",
    nombre: "Centros de estética y belleza",
    emoji: "💅",
    prioridad_comercial: "media",
    orden_ataque: 4,
    dolores: [
      "Responden DMs e historias entre cliente y cliente, con las manos ocupadas.",
      "Preguntas repetidas de precios, promos y horas disponibles.",
      "No-shows que dejan huecos caros en la agenda.",
    ],
    preguntas_cliente: [
      "¿Cuánto vale [servicio] y tienen promo?",
      "¿Tienen hora para el sábado?",
      "¿Dónde están y cómo pago?",
    ],
    casos_uso: [
      "Lista de servicios con valores y horas libres.",
      "Agenda y recordatorio automático anti no-show.",
      "Responde promos y packs sin frenar la atención.",
    ],
    ideas_post: [
      "Contestar DMs con las manos ocupadas",
      "Cuánto cuesta un no-show al mes",
    ],
    ideas_carrusel: [
      "Cómo llenar los huecos de tu agenda automáticamente",
      "Las preguntas que respondes 20 veces entre clienta y clienta",
    ],
    ideas_reel: [
      "Clienta pregunta precio mientras atiendes → agendada",
      "Recordatorio automático que baja los planchazos",
    ],
    mensaje_prospeccion:
      "Los mensajes de '¿precio de X?' y '¿hora para el sábado?' que llegan mientras atiendes, ¿quién los contesta? Asistentes que responden precios, dan horas y agendan solos, con recordatorio. Pruébalo como clienta → [link]",
    objeciones: [
      "'Mis clientas me escriben a mí por confianza' → el bot responde lo operativo; lo personal te llega igual.",
      "'Está caro para mi negocio' → ¿cuántas horas pierdes contestando lo mismo? ¿cuántos no-shows tuviste?",
    ],
    cta: "Pruébalo como clienta → [link]",
    formula_sin: "Agenda horas sin soltar lo que estás haciendo",
    pagina_seo: "/rubros/estetica",
  },
  {
    slug: "talleres",
    nombre: "Talleres y servicios técnicos",
    emoji: "🔧",
    prioridad_comercial: "media",
    orden_ataque: 5,
    dolores: [
      "Cotizan con las manos con grasa: el cliente manda foto/audio y contestan horas después.",
      "El cliente ya fue a otro taller mientras esperaba respuesta.",
      "Preguntas repetidas de horarios, dirección y plazos.",
    ],
    preguntas_cliente: [
      "¿Cuánto sale arreglar [problema]?",
      "¿Atienden [marca/modelo] y en cuánto tiempo?",
      "¿Dónde están y hasta qué hora?",
    ],
    casos_uso: [
      "Pre-cotizador: toma marca, modelo, problema y comuna.",
      "Entrega info base y deja al maestro con el dato listo para cotizar fino.",
      "Recibe fotos y audios ordenados con los datos del cliente.",
    ],
    ideas_post: [
      "El cliente no espera: se va al taller que contesta",
      "Cotizar con las manos con grasa",
    ],
    ideas_carrusel: [
      "Cómo capturar al cliente sin soltar la herramienta",
      "Lo que el bot pregunta para que tú cotices más rápido",
    ],
    ideas_reel: [
      "Cliente manda audio → datos ordenados para el maestro",
      "Mientras trabajas, el asistente toma el próximo trabajo",
    ],
    mensaje_prospeccion:
      "En el taller nadie suelta las herramientas para contestar. Los '¿cuánto sale arreglar…?' que llegan mientras trabajan, ¿los alcanzan a responder el mismo día? El asistente toma los datos y te deja todo listo para cotizar. → [link]",
    objeciones: [
      "'Cada trabajo es distinto, no se cotiza automático' → exacto: el bot junta los datos para que TÚ cotices más rápido.",
      "'No tengo plata para eso' → si no hay volumen, no es cliente ahora (descartar sin insistir).",
    ],
    cta: "Mira cómo funciona → [link]",
    formula_sin: "Captura al cliente sin soltar la herramienta",
    pagina_seo: "/rubros/talleres",
  },
  {
    slug: "constructoras",
    nombre: "Constructoras pequeñas",
    emoji: "🏗️",
    prioridad_comercial: "media",
    orden_ataque: 6,
    dolores: [
      "Consultas de presupuesto y disponibilidad que llegan y se pierden entre obras.",
      "Seguimiento comercial manual e inconsistente.",
      "El equipo en terreno no alcanza a responder cotizaciones.",
    ],
    preguntas_cliente: [
      "¿Hacen [tipo de obra] y en qué comunas?",
      "¿Me pueden dar un presupuesto referencial?",
      "¿Con quién coordino una visita?",
    ],
    casos_uso: [
      "Captura la consulta, califica el proyecto y agenda una visita técnica.",
      "Responde alcance de servicios y zonas de cobertura.",
      "Deja el lead ordenado para el equipo comercial.",
    ],
    ideas_post: [
      "El presupuesto que no contestaste a tiempo",
      "Ordenar los leads de obra sin un CRM caro",
    ],
    ideas_carrusel: [
      "Cómo no perder cotizaciones de obra por estar en terreno",
      "De consulta suelta a visita técnica agendada",
    ],
    ideas_reel: [
      "Consulta de presupuesto → visita técnica coordinada",
      "El equipo en terreno, el asistente ordenando los leads",
    ],
    mensaje_prospeccion:
      "Las consultas de presupuesto que llegan por WhatsApp mientras están en obra, ¿alcanzan a responderlas? El asistente califica el proyecto, agenda la visita técnica y te deja el lead ordenado. → [link]",
    objeciones: [
      "'Cada proyecto es único' → el bot no presupuesta la obra, ordena la consulta para que ustedes coticen.",
      "'Ya tenemos poca gente' → justo por eso: el bot filtra lo que no vale una llamada.",
    ],
    cta: "Agenda 20 min → [link]",
    formula_sin: "Ordena tus leads de obra sin sumar un sistema pesado",
    pagina_seo: "/rubros/constructoras",
  },
  {
    slug: "servicios-tecnicos",
    nombre: "Servicios técnicos",
    emoji: "🛠️",
    prioridad_comercial: "media",
    orden_ataque: 7,
    dolores: [
      "Consultas de '¿reparan X?' y '¿cuánto sale?' que llegan a toda hora.",
      "Diagnóstico y presupuesto requieren datos que el cliente no da de entrada.",
      "Se pierden trabajos por no contestar a tiempo.",
    ],
    preguntas_cliente: [
      "¿Reparan [equipo/marca]?",
      "¿Cuánto cuesta la revisión y cuánto demora?",
      "¿Van a domicilio o llevo el equipo?",
    ],
    casos_uso: [
      "Toma equipo, marca, falla y comuna antes de derivar.",
      "Entrega rango referencial si el negocio lo define.",
      "Agenda visita o recepción del equipo.",
    ],
    ideas_post: [
      "El trabajo que se te fue por contestar tarde",
      "Las 3 preguntas que hacen que puedas cotizar",
    ],
    ideas_carrusel: [
      "Cómo pre-diagnosticar por WhatsApp sin adivinar",
      "De '¿reparan X?' a visita agendada",
    ],
    ideas_reel: [
      "Cliente describe la falla → datos listos para el técnico",
      "Asistente tomando el caso mientras reparas",
    ],
    mensaje_prospeccion:
      "Las consultas de '¿reparan X y cuánto sale?' que llegan a toda hora, ¿las contestan al tiro? El asistente toma equipo, marca y falla, y te deja el caso listo. → [link]",
    objeciones: [
      "'Sin ver el equipo no se cotiza' → el bot no cotiza, junta los datos para diagnosticar rápido.",
      "'Recibo pocas consultas' → si es bajo volumen, esperemos a que crezca (honestidad).",
    ],
    cta: "Mira la demo → [link]",
    formula_sin: "Toma cada caso sin dejar la reparación a medias",
    pagina_seo: "/rubros/servicios-tecnicos",
  },
  {
    slug: "veterinarias",
    nombre: "Veterinarias",
    emoji: "🐾",
    prioridad_comercial: "media",
    orden_ataque: 8,
    dolores: [
      "Consultas de horas, vacunas, precios y urgencias mezcladas en el WhatsApp.",
      "Fuera de horario el tutor angustiado no recibe respuesta.",
      "Agenda de controles y vacunas que se maneja a mano.",
    ],
    preguntas_cliente: [
      "¿Tienen hora para vacuna/control?",
      "¿Cuánto sale la consulta y atienden [especie]?",
      "Mi mascota está mal, ¿qué hago?",
    ],
    casos_uso: [
      "Responde valores, servicios y horarios.",
      "Agenda controles y vacunas con recordatorio.",
      "Deriva urgencias al equipo con prioridad clara.",
    ],
    ideas_post: [
      "El tutor angustiado que escribe a medianoche",
      "Recordatorios de vacuna que llenan tu agenda",
    ],
    ideas_carrusel: [
      "Cómo separar urgencias de consultas de rutina",
      "Menos inasistencias en controles con recordatorio",
    ],
    ideas_reel: [
      "Tutor pregunta por vacuna → hora agendada + recordatorio",
      "El bot ordenando la agenda de la vet",
    ],
    mensaje_prospeccion:
      "Las consultas de horas, vacunas y precios que llegan por WhatsApp, ¿alcanzan a responderlas entre atención y atención? El asistente responde, agenda y recuerda controles — y prioriza las urgencias. → [link]",
    objeciones: [
      "'Las urgencias necesitan humano' → el bot las detecta y deriva de inmediato con contexto.",
      "'Ya usamos una agenda' → el bot puede dejar la hora en tu calendario actual.",
    ],
    cta: "Pruébala como tutor → [link]",
    formula_sin: "Responde cada consulta sin dejar de atender a los pacientes",
    pagina_seo: "/rubros/veterinarias",
  },
  {
    slug: "tiendas-catalogo",
    nombre: "Tiendas con catálogo",
    emoji: "🛍️",
    prioridad_comercial: "media",
    orden_ataque: 9,
    dolores: [
      "'¿Precio? ¿Talla? ¿Stock? ¿Despacho?' repetido cientos de veces.",
      "Ventas que se enfrían por no responder el DM a tiempo.",
      "El catálogo vive en la cabeza del dueño o en mil fotos.",
    ],
    preguntas_cliente: [
      "¿Tienen [producto] en [talla/color]?",
      "¿Cuánto sale y hacen despacho a [comuna]?",
      "¿Cómo pago y cuándo llega?",
    ],
    casos_uso: [
      "Responde precio, stock, tallas y despacho desde tu catálogo.",
      "Guía la compra y captura el pedido.",
      "Deriva al humano para cerrar o casos especiales.",
    ],
    ideas_post: [
      "La venta que se enfría en el DM sin responder",
      "Tu catálogo respondiendo solo, 24/7",
    ],
    ideas_carrusel: [
      "Las 4 preguntas que responde tu tienda 100 veces al día",
      "De DM sin respuesta a pedido tomado",
    ],
    ideas_reel: [
      "Cliente pregunta talla y stock → pedido tomado a las 23:00",
      "El catálogo que contesta mientras duermes",
    ],
    mensaje_prospeccion:
      "Vi que les preguntan harto por precios y stock en los comentarios. ¿Eso lo responden a mano? Un asistente que responde precio, talla, stock y despacho desde tu catálogo, 24/7. Pruébalo como cliente → [link]",
    objeciones: [
      "'Mi stock cambia' → tú actualizas tu planilla/catálogo, el bot lee de ahí.",
      "'Prefiero atender yo' → el bot responde lo repetitivo; los pedidos grandes te llegan.",
    ],
    cta: "Pruébalo como cliente → [link]",
    formula_sin: "Responde precio y stock sin vivir pegado al DM",
    pagina_seo: "/rubros/tiendas",
  },
  {
    slug: "agenda-reservas",
    nombre: "Negocios con agenda o reservas",
    emoji: "📅",
    prioridad_comercial: "media",
    orden_ataque: 10,
    dolores: [
      "Reservar una hora es un ping-pong de mensajes que consume el día.",
      "Fuera de horario nadie confirma y la reserva se pierde.",
      "No-shows por falta de recordatorio.",
    ],
    preguntas_cliente: [
      "¿Tienen disponibilidad para [día/hora]?",
      "¿Cuánto sale y cómo reservo?",
      "¿Puedo cambiar mi reserva?",
    ],
    casos_uso: [
      "Ofrece horas libres y agenda directo.",
      "Confirma y manda recordatorio anti no-show.",
      "Reprograma sin intervención humana.",
    ],
    ideas_post: [
      "El ping-pong de mensajes para agendar una hora",
      "Reservas que se pierden fuera de horario",
    ],
    ideas_carrusel: [
      "Cómo agendar sin un ida y vuelta de 8 mensajes",
      "Recordatorios que bajan los no-shows",
    ],
    ideas_reel: [
      "Cliente reserva a las 2 AM → confirmado + recordatorio",
      "La agenda llenándose sola",
    ],
    mensaje_prospeccion:
      "Agendar una hora por WhatsApp es un ping-pong que come el día. El asistente ofrece horas libres, agenda, confirma y recuerda — solo. Pruébalo como cliente → [link]",
    objeciones: [
      "'Uso agenda de papel' → te dejamos Google Calendar configurado, incluido.",
      "'Prefiero coordinar yo' → el bot toma lo simple; los casos especiales te llegan.",
    ],
    cta: "Pruébalo como cliente → [link]",
    formula_sin: "Llena tu agenda sin el ping-pong de mensajes",
    pagina_seo: "/rubros/reservas",
  },
  {
    slug: "educacion-cursos",
    nombre: "Educación y cursos",
    emoji: "🎓",
    prioridad_comercial: "baja",
    orden_ataque: 11,
    dolores: [
      "Consultas de fechas, precios, cupos y modalidad que se repiten sin fin.",
      "Interesados que preguntan y se enfrían antes de matricularse.",
      "Seguimiento de inscripciones manual.",
    ],
    preguntas_cliente: [
      "¿Cuándo parte el curso y cuánto vale?",
      "¿Es online o presencial? ¿Dan certificado?",
      "¿Cómo me inscribo y hay descuentos?",
    ],
    casos_uso: [
      "Responde fechas, valores, modalidad y requisitos.",
      "Captura al interesado y lo guía a la matrícula.",
      "Envía recordatorios de inicio y pago.",
    ],
    ideas_post: [
      "El interesado que se enfría antes de matricularse",
      "Responder las mismas 5 dudas de cada postulante",
    ],
    ideas_carrusel: [
      "Cómo no perder matrículas por responder tarde",
      "De consulta a inscrito sin perseguir a nadie",
    ],
    ideas_reel: [
      "Consulta por un curso a medianoche → guiado a matrícula",
      "El asistente respondiendo dudas de admisión",
    ],
    mensaje_prospeccion:
      "Las dudas de fechas, precios y cupos que llegan por WhatsApp, ¿las responden una por una? El asistente responde, captura al interesado y lo guía a la matrícula. → [link]",
    objeciones: [
      "'Cada postulante es distinto' → el bot responde lo común y deriva lo específico.",
      "'Tenemos temporadas bajas' → se paga en la temporada de admisión con las matrículas que no pierdes.",
    ],
    cta: "Mira la demo → [link]",
    formula_sin: "Responde cada postulante sin frenar tus clases",
    pagina_seo: "/rubros/educacion",
  },
  {
    slug: "distribuidoras",
    nombre: "Distribuidoras B2B",
    emoji: "📦",
    prioridad_comercial: "media",
    orden_ataque: 12,
    dolores: [
      "Pedidos y cotizaciones B2B que llegan por WhatsApp y se traspapelan.",
      "Clientes recurrentes que piden lo mismo y esperan precio al tiro.",
      "El vendedor no alcanza a cotizar todo el volumen.",
    ],
    preguntas_cliente: [
      "¿Precio por volumen de [producto]?",
      "¿Tienen stock y despacho a [zona]?",
      "¿Me repiten el pedido de siempre?",
    ],
    casos_uso: [
      "Cotiza por lista con precios por volumen.",
      "Toma pedidos recurrentes y captura al comprador.",
      "Avisa al vendedor para cerrar el pedido grande.",
    ],
    ideas_post: [
      "El pedido B2B que se traspapela en el WhatsApp",
      "Cotizar por volumen sin saturar al vendedor",
    ],
    ideas_carrusel: [
      "Cómo responder cotizaciones B2B al instante",
      "De consulta de precio a pedido tomado",
    ],
    ideas_reel: [
      "Comprador pide precio por volumen → cotización con totales",
      "El asistente tomando el pedido recurrente",
    ],
    mensaje_prospeccion:
      "Trabajamos con negocios que cotizan mucho por WhatsApp. Cuando un cliente pide precio por volumen fuera de horario, ¿quién responde? El asistente cotiza con tu lista y te deja el pedido listo. → [link]",
    objeciones: [
      "'Mis precios son negociados' → el bot cotiza lista base y deriva las negociaciones al vendedor.",
      "'Mis clientes son de años' → el bot les responde al tiro lo repetitivo, tú cuidas la relación.",
    ],
    cta: "Pídele cotizar en la demo → [link]",
    formula_sin: "Cotiza cada pedido sin saturar a tu vendedor",
    pagina_seo: "/rubros/distribuidoras",
  },
];

export function rubroPorSlug(slug: string) {
  return RUBROS.find((r) => r.slug === slug);
}

/** Rubros prioritarios (orden de ataque comercial). */
export const RUBROS_PRIORITARIOS = RUBROS.filter(
  (r) => r.prioridad_comercial === "alta",
).sort((a, b) => a.orden_ataque - b.orden_ataque);
