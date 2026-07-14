/**
 * KIT DE VENTA — material de conversación a mano dentro de HQ.
 * Fuente: estrategia-comercial/OBJECIONES_RESPONDO.md, SCRIPTS_DE_VENTA_RESPONDO.md
 * e ICP_RESPONDO.md. Alineado a los precios/oferta VIGENTES (jul-2026):
 * Básico $24.990 · Pro $39.990 · Empresa $69.990 · primer mes de servicio gratis,
 * setup normal. Sin "plan piloto". Objetivo: que al conversar con un prospecto
 * tengas la respuesta correcta a un clic, sin salir de HQ.
 */

export interface Objecion {
  gatillo: string;
  respuesta: string;
}

export const OBJECIONES: Objecion[] = [
  {
    gatillo: "Está caro",
    respuesta:
      "Te entiendo. ¿Cuánto vale una venta promedio tuya? Si se te escapan 2–3 al mes por contestar tarde, esto ya se pagó solo — el 78% le compra al primero que responde. Y si hoy no da para el plan completo, partimos con el Básico ($24.990) y subes cuando el volumen lo pida. ¿Cuál te acomoda más? (Regla interna: nunca bajar el precio del plan; ofrecer bajar de plan.)",
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
      "Es LA pregunta. Tres capas de protección: solo responde con la información que tú nos das; lo probamos contigo antes de encenderlo, hasta que digas 'así hablaría yo'; y el primer mes lo ajustamos sin costo todas las veces que haga falta. ¿Qué tipo de respuesta te daría más susto que diera mal?",
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
      "Va. Solo una pregunta antes de agendar eso: ¿qué cambia de aquí a entonces? Cada mes que pasa son consultas sin responder que no vuelven. Y ahora el primer mes de servicio va gratis: lo pruebas funcionando sin pagar la mensualidad. ¿Te escribo el [fecha] y lo retomamos?",
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
      "Buen ojo. Esos eran precios de pre-lanzamiento y estamos actualizando la web. Los vigentes son los que te compartí: Básico $24.990, Pro $39.990, Empresa $69.990 al mes (desde el mes 2; el primer mes de servicio va gratis) + la implementación una vez.",
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
    pregunta: "¿Recibe 15+ consultas al día por WhatsApp?",
    bueno: "Sí — hay dolor real y volumen que justifica el servicio.",
    malo: "Menos de 15/día → todavía no le conviene. Anotar y seguir.",
  },
  {
    clave: "software",
    pregunta: "¿Ya usa un software que resuelve la conversación? (AgendaPro, Reservo, Dentalink, MasterCar…)",
    bueno: "No / lo usa mal → hay espacio para entrar.",
    malo: "Sí y contento → el dolor ya está resuelto. Descartar.",
  },
  {
    clave: "repetitivo",
    pregunta: "¿Cotiza o agenda seguido, con preguntas repetidas?",
    bueno: "Sí — es exactamente lo que el asistente automatiza mejor.",
    malo: "Cada consulta es única y compleja → encaja menos.",
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
