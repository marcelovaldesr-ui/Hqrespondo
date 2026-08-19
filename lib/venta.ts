/**
 * KIT DE VENTA — material de conversación a mano dentro de HQ.
 * Fuente: estrategia-comercial/OBJECIONES_RESPONDO.md, SCRIPTS_DE_VENTA_RESPONDO.md
 * e ICP_RESPONDO.md. Alineado a los precios/oferta VIGENTES (12-ago-2026):
 * Inicial $149.990 · Crecimiento $269.990 · Empresa $449.990 — todos NETOS,
 * más IVA. Instalación GRATIS · 14 días de prueba · bot extra +$20.000.
 * Cupos 1.200 / 3.000 / 6.000 conversaciones; excedente $80 / $60 / $50 por
 * conversación, y NUNCA se corta el servicio al pasarse.
 * Sin "plan piloto" y sin "primer mes gratis" (eran de julio).
 * Objetivo: que al conversar con un prospecto tengas la respuesta correcta a
 * un clic, sin salir de HQ.
 */


// ---------------------------------------------------------------- PRODUCTO

/**
 * Qué es Respondo HOY (ago-2026). Está acá porque HQ se escribió cuando
 * Respondo era "un chatbot que contesta WhatsApp", y dejó de serlo: hoy son
 * cuatro asistentes con oficios distintos y una plataforma donde el cliente
 * ve, controla y mide lo que hacen.
 *
 * La guía interna lo dice con todas sus letras: la categoría importa más que
 * la tecnología. "Es un chatbot para WhatsApp" hace que te comparen con un bot
 * de $15.000 y con la función gratis de WhatsApp — y ahí ya perdiste.
 */
export const FRASE_CATEGORIA = {
  mal: "Es un chatbot para WhatsApp.",
  bien: "Es el turno de atención que hoy no tienes.",
};

export interface Asistente {
  nombre: string;
  oficio: string;
  hace: string;
  /** Cuál de los 4 momentos de dolor resuelve. */
  resuelve: string;
}

export const ASISTENTES: Asistente[] = [
  {
    nombre: "Tino",
    oficio: "Ventas y atención",
    hace: "Contesta al instante, cotiza con los precios reales del negocio, ofrece horas concretas de la agenda y confirma la reserva. Deja anotado nombre, necesidad y clasificación de cada interesado. Deriva cuando hay duda, molestia o venta grande.",
    resuelve: "Nadie contesta a las 22:00 del domingo y el cliente compra en otro lado.",
  },
  {
    nombre: "Beto",
    oficio: "Seguimiento y reactivación",
    hace: "Retoma las cotizaciones que quedaron sin respuesta, ofrece alternativa cuando el precio fue la traba y despierta clientes que hace meses no vuelven. Máximo dos mensajes por motivo, solo en horario hábil, y quien pide no ser contactado no recibe nada más.",
    resuelve: "La cotización muere callada: mandaste el precio y nadie volvió a escribir.",
  },
  {
    nombre: "Vera",
    oficio: "Postventa y satisfacción",
    hace: "Pregunta cómo estuvo, una sola vez, después de cada venta o atención. Si quedó contento lo invita a dejar reseña en Google; si algo salió mal avisa al tiro con el caso resumido.",
    resuelve: "El molesto se va sin decir nada y te enteras con la reseña de una estrella.",
  },
  {
    nombre: "Isabel",
    oficio: "Memoria interna (puertas adentro)",
    hace: "NO habla con clientes: responde las preguntas internas del equipo con los documentos del propio negocio, citando el documento y la versión exacta. Dice que no sabe cuando algo no está escrito. Es complemento opcional, no viene por defecto — se vende como upsell del plan Empresa.",
    resuelve: "Todo depende de preguntarle siempre a la misma persona.",
  },
];

/** Lo que trae la plataforma. Se vende junto con los asistentes, no aparte. */
export const PLATAFORMA: { modulo: string; que: string }[] = [
  { modulo: "Bandeja", que: "WhatsApp e Instagram en un solo lugar, con lo urgente arriba. El dueño entra al chat y el asistente se calla ahí; se lo devuelve cuando termina y el cliente nunca nota el cambio." },
  { modulo: "Agenda y reservas", que: "Lo más nuevo y lo que más cambia el día a día. Horas por profesional, bloqueos, sincroniza con Google Calendar, y una página de reservas propia para el Instagram o la web. Dos personas no pueden tomar la misma hora: lo impide la base de datos." },
  { modulo: "Oportunidades", que: "Embudo que avanza solo según lo que detecta el asistente (nuevo → interesado → cotizado → ganado/perdido) y ficha por cliente. Las que llevan una semana sin respuesta se cierran solas." },
  { modulo: "Resultados", que: "Cuánto ahorró en tiempo y plata (calculado con el sueldo mínimo legal, a propósito: es el piso público), qué parte contestó el asistente y un mapa de cuándo escriben — que muestra cuántos mensajes llegan con el local cerrado." },
  { modulo: "Informe semanal", que: "Cada lunes, la IA lee las conversaciones de la semana y escribe qué pidieron los clientes, dónde se perdieron ventas y qué conviene ajustar. Frases, no gráficos." },
];

/** Canales vigentes. Instagram dejó de ser una promesa: está andando. */
export const CANALES = {
  whatsapp: "Canal principal, con el número oficial de Meta. Todo el equipo trabaja acá.",
  instagram:
    "Instagram Direct llega a la misma bandeja. Tino responde, cotiza y deriva igual. " +
    "LÍMITE REAL: Instagram no deja reabrir una conversación pasadas 24 h sin que el cliente " +
    "escriba primero, así que Beto trabaja hoy solo por WhatsApp. Es límite de Meta, no de Respondo.",
};

/** Resultados de clientes reales. Se dicen con la salvedad, siempre. */
export const CASOS_REALES: { cliente: string; rubro: string; dato: string }[] = [
  { cliente: "OdontoAndrauss", rubro: "clínica dental", dato: "-38% de horas perdidas por inasistencia" },
  { cliente: "Qanttum Sport Club", rubro: "gimnasio", dato: "34% de contactos inactivos reactivados el primer mes" },
  { cliente: "Propiver", rubro: "inmobiliaria", dato: "+45% más visitas a propiedades agendadas" },
];

export const SALVEDAD_CASOS =
  "Cifras entregadas por cada negocio, medidas después de implementar. No son promedio garantizado: " +
  "dependen del rubro, el volumen y el punto de partida.";

/** Dónde NO conviene que el asistente cotice. Es criterio, no limitación. */
export const NO_COTIZA =
  "Si los precios cambian según medidas, materiales o cantidad —imprenta, maestranza— el asistente " +
  "NO cotiza: se configura para tomar bien los datos y derivar. Prometer cotización ahí es la forma " +
  "más rápida de que el piloto salga mal.";

/** Competencia, con la respuesta lista. */
export const COMPETENCIA: { quien: string; que: string; respuesta: string }[] = [
  {
    quien: "Vambe",
    que: "Plataforma chilena para empresas grandes. Su plan comparable ronda $545.000/mes por 3.000 conversaciones, más implementación aparte.",
    respuesta: "Los mismos cupos, por menos de la mitad, con la IA incluida y sin cobrar implementación.",
  },
  {
    quien: "Wazaut y similares",
    que: "Se contrata solo y se configura solo. Sin implementación incluida.",
    respuesta: "Si tienes equipo técnico y tiempo, te sirven. Si quieres que funcione sin armarlo tú, eso es lo nuestro.",
  },
  {
    quien: "Bots de $15.000",
    que: "Menús de botones. El cliente termina apretando 3 para volver al menú.",
    respuesta: "No competimos con eso. Competimos con lo que te cuestan las ventas que hoy se pierden.",
  },
];

export interface Objecion {
  gatillo: string;
  respuesta: string;
}

export const OBJECIONES: Objecion[] = [
  {
    gatillo: "Está caro",
    respuesta:
      "Te entiendo. ¿Cuánto vale una venta promedio tuya? Si se te escapan 2–3 al mes por contestar tarde, esto ya se pagó solo — el 78% le compra al primero que responde. Y si hoy no da para el plan completo, partimos con el Inicial ($149.990 neto) y subes cuando el volumen lo pida. ¿Cuál te acomoda más? (Regla interna: nunca bajar el precio del plan; ofrecer bajar de plan.)",
  },
  {
    gatillo: "Ya respondo yo",
    respuesta:
      "Y seguro mejor que nadie, nadie conoce tu negocio como tú. La pregunta es: ¿a qué hora dejas de responder? No te reemplaza, te cubre las horas en que estás durmiendo, atendiendo o en terreno. ¿Qué pasa hoy con los mensajes de las 10 de la noche?",
  },
  {
    gatillo: "No recibo tantos mensajes",
    respuesta:
      "Puede que tengas razón y todavía no te convenga — prefiero decírtelo derecho antes que venderte algo que no vas a aprovechar. ¿Cuántas consultas diarias reciben más o menos? Si son menos de 15, esperaría a que el volumen crezca. ¿Te dejo la demo por mientras?",
  },
  {
    gatillo: "No quiero que una IA hable con mis clientes",
    respuesta:
      "Sano escepticismo, hay bots por ahí que dan vergüenza ajena. Por eso pruébalo tú mismo antes de decidir: escríbele a la demo como si fueras cliente. Responde con la info de tu negocio, con buen tono, y cuando algo se sale de libreto deriva a un humano en vez de inventar. ¿Le escribes ahora y me dices qué te parece?",
  },
  {
    gatillo: "¿Y si responde mal?",
    respuesta:
      "Es LA pregunta. Tres capas de protección: solo responde con la información que tú nos das; lo probamos contigo antes de encenderlo, hasta que digas 'así hablaría yo'; y durante los 14 días de prueba lo ajustamos sin costo todas las veces que haga falta. ¿Qué tipo de respuesta te daría más susto que diera mal?",
  },
  {
    gatillo: "¿Puede inventar precios?",
    respuesta:
      "No, y es una regla de diseño, no una promesa: cotiza únicamente con tu lista de precios cargada. Si le preguntan por algo que no está, no improvisa — dice que lo confirma con el equipo y te pasa el dato. Pruébalo en la demo: trata de sacarle un precio que no tenga.",
  },
  {
    gatillo: "Ya tengo WhatsApp Business",
    respuesta:
      "Perfecto, eso es la base y de hecho lo necesitas. WhatsApp Business te da el perfil y las respuestas rápidas manuales; lo que agregamos encima es que conteste solo, cotice solo y registre cada interesado, 24/7. Es la diferencia entre tener el teléfono y tener a alguien contestándolo. ¿Hoy alcanzan a responder todo lo que les llega?",
  },
  {
    gatillo: "Lo vemos más adelante",
    respuesta:
      "Va. Solo una pregunta antes de agendar eso: ¿qué cambia de aquí a entonces? Cada mes que pasa son consultas sin responder que no vuelven. Y tienes 14 días de prueba: lo ves funcionando con tus propios mensajes antes de pagar nada. ¿Te escribo el [fecha] y lo retomamos?",
  },
  {
    gatillo: "Tengo que hablarlo con mi socio",
    respuesta:
      "Lógico, así funcionan las buenas sociedades. Para que la conversación con tu socio sea fácil, te mando un resumen de una página con lo que vimos y el link de la demo para que la pruebe él mismo. ¿Y si agendamos 15 minutos los tres el [día]? Respondo las dudas directo y no te toca hacer de intermediario.",
  },
  {
    gatillo: "No entiendo bien cómo funciona",
    respuesta:
      "Culpa nuestra si sonó técnico. Versión simple: tu WhatsApp de siempre, tu número de siempre — solo que cuando alguien escribe, un asistente entrenado con TU información contesta al tiro. Tú nos pasas tus precios y respuestas típicas, nosotros lo dejamos funcionando, y tú ves todo lo que conversa. ¿Qué parte te gustaría que te muestre en vivo?",
  },
  {
    gatillo: "¿Por qué no un chatbot más barato?",
    respuesta:
      "Puedes, existen desde $15.000 al mes. Esos son menús de botones que tú mismo configuras y ahí quedan — respuestas rígidas y clientes apretando '3' para volver al menú. Lo nuestro es otra categoría: conversación real con tus precios, implementada por nosotros, con soporte. No competimos con los bots de $15.000, competimos con el costo de las ventas que pierdes. ¿Probaste alguno? ¿Cómo te fue?",
  },
  {
    gatillo: "¿Diferencia con Vambe / respond.io / WATI?",
    respuesta:
      "Buenas plataformas, las conocemos. respond.io y WATI son software self-service: configuras todo tú, sin implementación incluida. Vambe apunta a empresas más grandes. Nosotros estamos en el medio justo para una pyme chilena: implementación completa hecha por nosotros, en español, y acompañamiento real después de vender. Si tienes equipo técnico y tiempo, respond.io te sirve; si quieres que funcione sin armarlo tú, eso es lo nuestro. (Verificar precios de terceros antes de citarlos por escrito.)",
  },
  {
    gatillo: "¿Necesito cambiar mi número?",
    respuesta:
      "No. Funciona con tu número de siempre, el que ya conocen tus clientes. Lo conectamos a la plataforma oficial de WhatsApp para empresas y listo — tus clientes no notan ningún cambio, salvo que ahora les contestan al tiro.",
  },
  {
    gatillo: "¿Me pueden bloquear WhatsApp?",
    respuesta:
      "Al revés, esto te protege. Trabajamos por la API oficial de WhatsApp Business, la vía que Meta diseñó para empresas. Los bloqueos les pasan a los que usan apps no oficiales o mandan spam masivo. El asistente responde a gente que TE escribió primero, que es justo el uso que WhatsApp promueve.",
  },
  {
    gatillo: "Vi otros precios en su página",
    respuesta:
      "Buen ojo. Esos eran precios de pre-lanzamiento y estamos actualizando la web. Los vigentes son los que te compartí: Inicial $149.990, Crecimiento $269.990 y Empresa $449.990 al mes, netos más IVA, con la instalación incluida y 14 días de prueba.",
  },
  {
    gatillo: "Soy malo para la tecnología",
    respuesta:
      "Perfecto, porque no tienes que usar nada. De eso nos encargamos nosotros: lo configuramos, lo probamos y lo dejamos andando. Tú sigues usando tu WhatsApp como siempre; el asistente trabaja por detrás. Lo único que te pedimos es tu lista de precios y tus respuestas típicas, en el formato que tengas.",
  },
  {
    gatillo: "¿Reemplaza a mis vendedores?",
    respuesta:
      "No, y no queremos que lo haga. Responde lo repetitivo — precios, horarios, disponibilidad — y filtra. Tu equipo recibe a los que ya vienen calientes, con los datos tomados. Es la diferencia entre que tu vendedor pierda el día contestando '¿cuánto vale?' o lo use cerrando ventas.",
  },
  {
    gatillo: "¿Qué pasa con los datos de mis clientes?",
    respuesta:
      "Tus datos y los de tus clientes son tuyos. Trabajamos por la conexión oficial de Meta, los leads quedan registrados en una planilla que es tuya y puedes ver cuando quieras, y no usamos tu información para nada más. Si algún día te vas, te llevas todo.",
  },
];

/** Preguntas de diagnóstico para abrir/calificar la conversación (kit de venta). */
export const PREGUNTAS_DIAGNOSTICO: string[] = [
  "¿Cuántas consultas les llegan al día por WhatsApp, más o menos?",
  "¿Quién contesta hoy los mensajes, y en qué momentos del día?",
  "¿Qué pasa con los mensajes que llegan de noche o el fin de semana?",
  "¿Qué es lo que más les preguntan? (precios, stock, horas, disponibilidad…)",
  "Cuando responden tarde, ¿han notado que el cliente ya compró en otra parte?",
];

/**
 * Calificación rápida del ICP (para la tarea #3): úsalas para decidir en 30
 * segundos si vale la pena invertir tiempo. Si falla en varias, descartar sin
 * culpa — el tiempo de 2 fundadores no alcanza para evangelizar.
 */
export interface CriterioICP {
  clave: string;
  pregunta: string;
  bueno: string;
  malo: string;
}

export const CALIFICACION_ICP: CriterioICP[] = [
  {
    clave: "volumen",
    pregunta: "¿Recibe 15+ consultas al día por WhatsApp o Instagram?",
    bueno: "Sí — hay dolor real y volumen que justifica el servicio.",
    malo: "Menos de 15/día → todavía no le conviene. Anotar y seguir.",
  },
  {
    clave: "software",
    pregunta: "¿Ya usa un software que resuelve la conversación Y está contento? (AgendaPro, Reservo, Dentalink, MasterCar…)",
    bueno: "No, o lo tiene pero igual contesta los mensajes a mano → hay espacio: Respondo trae bandeja, agenda y embudo propios.",
    malo: "Sí y contento, con el WhatsApp atendido → el dolor ya está resuelto. Descartar.",
  },
  {
    clave: "repetitivo",
    pregunta: "¿Cotiza o agenda seguido, con preguntas repetidas?",
    bueno: "Sí — y si además AGENDA HORAS, mejor todavía: la agenda es lo más nuevo y lo que más cambia el día a día.",
    malo: "Cada consulta es única, o el precio depende de medidas/materiales (imprenta, maestranza) → ahí el asistente no cotiza, solo toma datos.",
  },
  {
    clave: "pago",
    pregunta: "¿Tiene capacidad de pagar una mensualidad y ticket que lo justifique?",
    bueno: "Sí — una venta recuperada paga el mes.",
    malo: "Micro-negocio sin margen → riesgo de churn y soporte.",
  },
  {
    clave: "contacto",
    pregunta: "¿Es contactable por WhatsApp y responde el dueño/decisor?",
    bueno: "Sí — se puede avanzar rápido.",
    malo: "Solo call center / cadena grande → ciclo largo, baja prioridad.",
  },
];
