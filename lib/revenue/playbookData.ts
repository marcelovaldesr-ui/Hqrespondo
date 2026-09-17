/**
 * RESPONDO HQ — REVENUE OPERATING SYSTEM V1
 * Base de Conocimiento Comercial y Sales Enablement
 * Fichas de Competidores, Objeciones, Pitches y Guías de Discovery
 */

export interface CompetitorCard {
  name: string;
  category: string;
  tagline: string;
  whenMentioned: string;
  whatTheyDoWell: string[];
  whereRespondoDiffers: string[];
  whatNOTToClaim: string;
  killerQuestion: string;
}

export interface ObjectionScript {
  id: string;
  objection: string;
  context: string;
  mindset: string;
  responseScript: string;
  recommendedCTA: string;
}

export interface PitchDefinition {
  type: "one_liner" | "30_seconds" | "2_minutes";
  title: string;
  text: string;
  targetAudience: string;
}

export const PLAYBOOK_PITCHES: PitchDefinition[] = [
  {
    type: "one_liner",
    title: "One-Liner Maestro",
    text: "Respondo es el asistente comercial inteligente para WhatsApp que atiende al instante, cotiza con tus reglas, agenda citas y recupera a clientes que no respondieron.",
    targetAudience: "General / Primer contacto",
  },
  {
    type: "30_seconds",
    title: "Elevator Pitch (30 segundos)",
    text: "La mayoría de las pymes pierden entre el 30% y el 50% de sus ventas en WhatsApp porque contestan tarde, las cotizaciones quedan en el olvido de los vendedores y los clientes compran en otro lado. En Respondo implementamos tres empleados digitales —Tino, Beto y Vera— que atienden 24/7 sin inventar datos, reactivan a quien cotizó y no cerró, y cuidan la postventa, todo mientras tu equipo ve las conversaciones en un portal unificado.",
    targetAudience: "Dueños de pyme y gerentes comerciales",
  },
  {
    type: "2_minutes",
    title: "Explicación Comercial Completa (2 minutos)",
    text: "Hoy tus clientes te escriben por WhatsApp esperando respuesta inmediata. Si tardas 15 minutos, ya cotizaron con tu competencia. Pero contratar más personas para responder mensajes es costoso y los chatbots tradicionales de botones desesperan a los clientes.\n\nRespondo resuelve esto con empleados digitales entrenados con las reglas reales de tu empresa:\n1. Tino atiende de inmediato, responde dudas frecuentes, da precios estándar y, cuando la venta requiere negociación, te pasa el contacto con nombre, comuna y necesidad ya recopilada.\n2. Beto hace el seguimiento automático: le vuelve a escribir con tacto a quien cotizó y no respondió, recuperando ventas que hoy se pierden solo por falta de tiempo de tus vendedores.\n3. Vera mide la satisfacción postventa y escala reclamos a tiempo antes de que se conviertan en malas reseñas.\n\nAdemás, tienes un portal centralizado para ver todo el embudo y conectamos tu agenda para que tus clientes reserven directo en el chat sin solaparse nunca. Partimos con 14 días de prueba y vemos los resultados con números reales.",
    targetAudience: "Reunión de discovery con decisores",
  },
];

export const PLAYBOOK_COMPETITORS: CompetitorCard[] = [
  {
    name: "Meta Business Agent",
    category: "IA Nativa de Meta",
    tagline: "El bot gratuito de Meta en WhatsApp Business",
    whenMentioned: "Cuando el cliente dice: 'Meta ya sacó su propia IA gratis en WhatsApp'",
    whatTheyDoWell: [
      "Integración nativa dentro de la app móvil de WhatsApp Business",
      "Costo casi nulo de tokens para consultas muy básicas de catálogo",
      "Configuración simple de respuestas a FAQs",
    ],
    whereRespondoDiffers: [
      "Meta jamás se integrará con tu sistema contable, tu stock ni con Google Calendar",
      "Meta es un jardín amurallado: no hace seguimiento proactivo de cotizaciones (Beto)",
      "No ofrece portal multiagente ni coexistencia respetuosa con tu equipo de vendedores",
      "No tiene analítica de atribución de campañas ni optimización cruzada con Google Ads",
    ],
    whatNOTToClaim: "NO decir que Meta no sirve o que su IA es tonta. Reconocer que sirve para dudas básicas individuales, pero no para ordenar una operación de ventas.",
    killerQuestion: "¿Meta le hace seguimiento a los clientes que te pidieron cotización ayer y no volvieron a escribir, o eso sigue dependiendo de la memoria de tu equipo?",
  },
  {
    name: "AgendaPro",
    category: "Software Vertical de Citas",
    tagline: "El estándar en centros de estética, belleza y salud menor",
    whenMentioned: "Cuando el cliente dice: 'Ya usamos AgendaPro para las horas'",
    whatTheyDoWell: [
      "Ficha clínica/estética consolidada y control de comisiones de profesionales",
      "Gran penetración en Chile y soporte local para el sector belleza",
      "Recordatorios por SMS y correo",
    ],
    whereRespondoDiffers: [
      "AgendaPro solo gestiona al cliente que ya llegó: NO genera ventas ni atiende preventa consultiva",
      "Su bot (Julia AI) es un árbol rígido que no negocia ni recupera cotizaciones huérfanas",
      "No resuelve dudas complejas de productos, precios o condiciones antes de agendar",
      "Respondo convive con tu operación y puede derivar el enlace de reserva asegurando que la persona sí reserve",
    ],
    whatNOTToClaim: "NO afirmar que reemplazamos el ERP clínico o la ficha médica de AgendaPro. Respondo es el motor de venta y atención, no el software de comisiones de estética.",
    killerQuestion: "¿Cuántas personas te escriben preguntando precios o servicios por WhatsApp y nunca llegan a abrir el link de AgendaPro porque nadie les respondió al instante?",
  },
  {
    name: "Kommo (ex-amoCRM)",
    category: "CRM de Mensajería",
    tagline: "El CRM visual de WhatsApp más vendido en LatAm",
    whenMentioned: "Cuando el cliente dice: 'Nos cotizaron Kommo' o 'Un consultor nos recomendó Kommo'",
    whatTheyDoWell: [
      "Tablero visual Kanban de etapas muy completo y atractivo",
      "Gran ecosistema de agencias de marketing y partners en LatAm",
      "Automatizaciones de pipeline basadas en eventos",
    ],
    whereRespondoDiffers: [
      "Kommo castiga el crecimiento: cobra por cada usuario humano ($25 a $45 USD/mes) con contratos semestrales forzosos",
      "Los bots de Kommo son árboles de decisión rígidos o integraciones de ChatGPT que alucinan si no se programan con semanas de consultoría técnica",
      "No tiene empleados digitales especializados con personalidad y límites de negocio definidos (Tino/Beto/Vera)",
      "Respondo tiene tarifa plana por negocio sin límite de usuarios de tu equipo",
    ],
    whatNOTToClaim: "NO criticar la interfaz de Kommo (es buena). Enfocarse en el costo por asiento, la rigidez del bot y la complejidad de puesta en marcha.",
    killerQuestion: "¿Tienes tiempo y un consultor para dedicar 4 semanas a armar flujos en Kommo, o necesitas algo que en 5 días esté atendiendo con tus reglas reales?",
  },
  {
    name: "ManyChat",
    category: "Automatizador de Redes Sociales",
    tagline: "Líder en Instagram Direct y automatización de comentarios",
    whenMentioned: "Cuando el cliente dice: 'Tenemos ManyChat para responder comentarios en Instagram'",
    whatTheyDoWell: [
      "Excelente trigger de 'comenta una palabra y te envío un mensaje'",
      "Bajo costo de entrada ($15 USD) para cuentas con pocos suscriptores",
      "Flujos visuales sencillos de armar para marketing básico",
    ],
    whereRespondoDiffers: [
      "ManyChat es un bot de botones y flujos cuadrados; no entiende lenguaje natural chileno ni variaciones comerciales",
      "No tiene noción de agenda, cotización compleja ni seguimiento de ventas",
      "Si un cliente escribe algo fuera del botón, el flujo de ManyChat se rompe o se queda en blanco",
      "Respondo razona sobre tu base de conocimiento sin forzar al cliente a hacer clic en botones",
    ],
    whatNOTToClaim: "NO decir que ManyChat no funciona para captar leads en Instagram. ManyChat es útil para pedir correos en IG, pero deficiente para vender en WhatsApp.",
    killerQuestion: "Cuando un cliente te pregunta por un caso especial en WhatsApp, ¿ManyChat puede responderle con criterio o le sigue mostrando botones rígidos?",
  },
  {
    name: "Vambe AI",
    category: "AI Conversacional B2B / Voz",
    tagline: "Plataforma chilena de agentes IA y bots de voz para medianas y grandes empresas",
    whenMentioned: "Cuando el prospecto menciona que cotizó Vambe para agentes de voz o atención",
    whatTheyDoWell: [
      "Tecnología robusta en agentes de voz y transcripción",
      "Fuerte posicionamiento en salud y retail en Chile",
    ],
    whereRespondoDiffers: [
      "Vambe está enfocado en Mid-Market y Enterprise con tickets desde $300 a $1.500+ USD mensuales más cobros por minuto/llamada",
      "Su venta es de ciclo largo y requiere equipos de TI internos",
      "Respondo está diseñado para la pyme y empresa mediana chilena con onboarding en 5 días y precios en pesos chilenos desde $149.990 netos",
    ],
    whatNOTToClaim: "NO descalificar la capacidad técnica de Vambe. Destacar la accesibilidad, simplicidad operativa y foco específico en WhatsApp para pymes.",
    killerQuestion: "¿El presupuesto y tiempo de implementación de Vambe calza con la velocidad a la que necesitas recuperar ventas este mes?",
  },
];

export const PLAYBOOK_OBJECTIONS: ObjectionScript[] = [
  {
    id: "mandame_correo",
    objection: "Mándame la información por correo y lo revisamos.",
    context: "Llamada en frío o primer contacto (intento común del gatekeeper o decisor ocupado de cortar la llamada).",
    mindset: "No enviar un brochure genérico para morir en la bandeja de entrada. Pedir 30 segundos o validar interés mínimo.",
    responseScript: "Con gusto te lo mando, [Nombre]. Pero para no enviarte un PDF genérico de 10 páginas que nadie lee: nosotros resolvemos puntualmente la atención y el seguimiento de ventas por WhatsApp para [su rubro]. En tu caso, ¿hoy quién atiende los mensajes que entran por WhatsApp o redes?",
    recommendedCTA: "Pregunta abierta sobre su proceso actual para reiniciar la conversación.",
  },
  {
    id: "ya_tenemos_bot",
    objection: "Ya tenemos un bot / Ya tenemos respuestas automáticas.",
    context: "Prospecto que usa las respuestas rápidas de WhatsApp Business o un menú numérico (1 para ventas, 2 para horarios).",
    mindset: "Diferenciar entre un menú numérico que frustra y un asistente inteligente que cotiza y deriva.",
    responseScript: "Totalmente entendido. Y la mayoría de las empresas con las que hablamos tienen el mensaje de bienvenida de WhatsApp Business. La diferencia con Respondo es que no es un menú de 'marque 1 o 2', sino un asistente que entiende preguntas completas, entrega precios con tus listas base y le hace seguimiento automático a quien cotizó y no compró. ¿Hoy tu bot hace seguimiento a cotizaciones o si el cliente no responde queda ahí?",
    recommendedCTA: "Ofrecer demo de 15 minutos comparando su flujo actual con Tino.",
  },
  {
    id: "equipo_humano",
    objection: "Preferimos que atienda una persona real / A nuestros clientes no les gusta hablar con bots.",
    context: "Dueño que teme deshumanizar el trato o que tuvo malas experiencias con bots telefónicos.",
    mindset: "Validar su preocupación al 100%. Respondo NO reemplaza a las personas; las protege de lo repetitivo.",
    responseScript: "Tienen toda la razón: a nadie le gusta hablar con un robot que no entiende nada. Por eso Respondo está pensado al revés: atiende lo repetitivo al instante (horarios, precios base, si hay cupo) y apenas el cliente tiene una duda compleja o quiere negociar, se lo pasa a tu vendedor con todo el contexto recopilado. Tu equipo humano se dedica solo a cerrar, no a responder 40 veces al día '¿hasta qué hora atienden?'.",
    recommendedCTA: "Probar el modo coexistencia donde el vendedor sigue usando su WhatsApp y la IA se calla si una persona entra.",
  },
  {
    id: "no_tenemos_tiempo",
    objection: "Estamos con mucho trabajo ahora / No tenemos tiempo para implementar un sistema nuevo.",
    context: "Dueño o gerente abrumado por la operación del día a día.",
    mindset: "Demostrar que la falta de tiempo es el síntoma del problema y que la implementación exige solo 45 minutos.",
    responseScript: "Justamente por eso te llamo, [Nombre]: la razón por la que están sin tiempo es porque el equipo pasa el día contestando los mismos mensajes una y otra vez. Para la puesta en marcha solo necesitamos una llamada de 45 minutos con nosotros; todo lo público lo precargamos nosotros y en 5 días hábiles ya está funcionando.",
    recommendedCTA: "Agendar llamada de 15 minutos fuera de hora punta para revisar el formulario precargado.",
  },
  {
    id: "es_muy_caro",
    objection: "$150.000 mensuales es muy caro para nosotros.",
    context: "Reunión post-demo o presentación de propuesta comercial.",
    mindset: "Anclar el valor al costo de oportunidad y a cuántas ventas perdidas se necesitan para pagar el sistema.",
    responseScript: "Te entiendo. Mirémoslo con tus propios números: en tu negocio, ¿cuánto es el ticket promedio de una venta? [Cliente responde, ej: $40.000]. Con solo rescatar 4 clientes al mes que hoy se quedan sin respuesta o que cotizan y nadie los recontacta, el sistema se paga solo y todo el resto es ganancia neta. Además, partimos con 14 días de prueba gratis para que lo compruebes antes de pagar un solo peso.",
    recommendedCTA: "Iniciar los 14 días de prueba con garantía de medición con números reales.",
  },
];
