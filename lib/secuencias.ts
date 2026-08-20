import type { LeadFoco } from "@/lib/foco";

/**
 * Secuencia de correos en frío — copiada del doc "SECUENCIA" del Drive
 * (respon-do.com, 12-ago-2026). Seis verticales × 3 correos.
 *
 * ESTE TEXTO NO SE INVENTA NI SE MEJORA "DE PASO".
 * Es copy que el equipo escribió, con referencias de clientes reales y cifras
 * que ya se están enviando. Una versión anterior de este archivo tenía copy
 * redactado por mí a partir de lo que se alcanzaba a leer en un video: sonaba
 * bien y decía cosas que no eran ciertas (referencias genéricas, métricas
 * inventadas). Si el texto del Drive cambia, se actualiza acá — no al revés.
 *
 * Lo único que agrega HQ: los {{merge_tags}} se rellenan con los datos del
 * lead, que es el paso donde se cuelan los "Hola {{first_name}}" enviados de
 * verdad, y la elección automática de la vertical según el rubro.
 */

export interface CorreoSecuencia {
  n: number;
  cuando: string;
  asuntoA: string;
  asuntoB: string | null;
  cuerpo: string;
}

export interface Vertical {
  clave: string;
  label: string;
  test: RegExp;
  /** Quién es el destinatario dentro de la empresa. */
  rol: string;
  /** Sobre qué le llegan las consultas. */
  consultas: string;
  /** Qué hace el asistente en ese rubro. */
  hace: string;
  /** El resultado que se promete, en las palabras del doc. */
  logra: string;
  /** Prueba social: cantidad y nombres reales. */
  prueba: string;
  /** Métricas del vertical, tal como están escritas. */
  metricas: string;
  asuntos2: [string, string];
  /**
   * Solo mira el nombre de fantasía, nunca el rubro SII.
   * Necesario para dental: el código del SII es "ACTIVIDADES DE MEDICOS Y
   * ODONTOLOGOS" y agrupa a TODA la medicina ambulatoria. Buscando
   * "odontolog" en el rubro, un laboratorio de histopatología recibía la
   * secuencia dental —hablándole de implantes y ortodoncia— y encima con
   * referencias de clínicas dentales que no le dicen nada.
   */
  soloNombre?: boolean;
}

/**
 * El orden importa: gana la primera que calza. Dental antes que estética
 * porque una "clínica dental estética" es dental.
 */
export const VERTICALES: Vertical[] = [
  {
    clave: "dental",
    label: "Clínicas dentales",
    test: /dental|odontolog|implante|ortodoncia|dentist/i,
    soloNombre: true,
    rol: "la operación comercial y atención de pacientes",
    consultas: "implantes, ortodoncia, estética dental, precios y disponibilidad, pero muchas no avanzan hasta una evaluación por falta de respuesta o seguimiento",
    hace: "atienden 24/7, responden consultas administrativas, recopilan antecedentes iniciales, agendan evaluaciones, confirman citas y retoman a quienes preguntaron por un tratamiento pero no continuaron. Las consultas clínicas o sensibles siempre se derivan al equipo humano",
    logra: "convertir más consultas en evaluaciones y recuperar pacientes que quedaron sin seguimiento",
    prueba: "Ya trabajamos con **+17** clínicas como **Odontoandrauss, Zenith, CREB Clínica Dental, TriniDent**.",
    metricas: "Implementaciones de este tipo han conseguido un 39% de aumento promedio en conversión de leads, una reducción de 93% en el tiempo de respuesta y 27% menos abandono.",
    asuntos2: ["Gestión de pacientes y evaluaciones", "Pacientes que consultan y no agendan en {{empresa}}"],
  },
  {
    clave: "estetica",
    label: "Clínicas estéticas",
    /**
     * Solo términos de estética real. La versión anterior incluía
     * `clinica|medic|salud|laboratorio|oftalmolog` y se tragaba cualquier
     * centro de salud: medido sobre la base, 16 centros médicos, 9 clínicas
     * dentales y 4 veterinarias recibían la secuencia de estética —con
     * referencias a Velours, Renuva y Biolaser, que a un veterinario no le
     * dicen nada. Un centro médico general no tiene vertical, y eso está
     * bien: sin vertical no se manda secuencia, en vez de mandar la
     * equivocada.
     */
    test: /estetic|estétic|dermatolog|depilacion|depilación|\blaser\b|láser|cosmetolog|rejuvenecimiento|medicina estetica/i,
    rol: "la operación comercial y atención de pacientes",
    consultas: "tratamientos, precios, disponibilidad y evaluaciones, muchas veces fuera de horario o mientras recepción está ocupada",
    hace: "atienden 24/7, responden con información real de la clínica, califican pacientes, agendan evaluaciones, envían recordatorios y hacen seguimiento a quienes consultaron pero no reservaron. Todo se integra con el calendario, planilla o CRM de la clínica y el equipo humano puede tomar la conversación cuando corresponda",
    logra: "convertir más consultas en evaluaciones y tratamientos agendados, sin sumar carga a recepción",
    prueba: "Ya trabajamos con **+12** clínicas y centros como **Velours, Renuva, Biolaser, Thaya Clinic Spa**.",
    metricas: "Este tipo de automatización ha logrado, en promedio, un 39% de aumento en conversión de leads, una reducción de 93% en el tiempo de respuesta y una disminución de 27% en la tasa de abandono.",
    asuntos2: ["Atención y conversión de pacientes", "Más evaluaciones agendadas en {{empresa}}"],
  },
  {
    clave: "automotora",
    label: "Automotoras y concesionarios",
    test: /automotora|concesionari|vehiculo|automotor|automotriz|repuesto|motocicleta|\bmoto\b|venta de partes/i,
    rol: "la operación comercial y gestión de leads",
    consultas: "modelos, stock, precios, financiamiento y test drives, pero muchos interesados siguen cotizando si el primer contacto no ocurre de inmediato",
    hace: "atienden 24/7, responden con información autorizada, identifican modelo, presupuesto, intención y forma de financiamiento, agendan test drives, realizan seguimiento y registran cada lead en el CRM para que el ejecutivo lo reciba con todo su contexto",
    logra: "contactar, calificar y convertir más leads en test drives sin aumentar la carga de los ejecutivos",
    prueba: "Ya trabajamos con **+18** empresas como **Motorman, Montiel Automotora, Motorland, Codas Automóviles**.",
    metricas: "En el sector automotor, la integración de IA generativa por WhatsApp con el CRM ha alcanzado un 90% de aumento en la tasa de contacto, junto con reducciones de hasta 93% en el tiempo de respuesta.",
    asuntos2: ["Gestión de leads comerciales", "Más contactos y test drives en {{empresa}}"],
  },
  {
    clave: "inmobiliaria",
    label: "Inmobiliarias",
    test: /inmobiliaria|corretaje|corredora de propiedades|propiedades/i,
    rol: "la operación comercial y gestión de leads",
    consultas: "propiedades, precios y disponibilidad, y los corredores deben responder preguntas repetitivas, calificar interesados y coordinar visitas manualmente",
    hace: "atienden 24/7, responden con información real de las propiedades, consultan presupuesto, sector, modalidad y plazo, recomiendan alternativas, agendan visitas y registran las oportunidades en el CRM. El corredor conserva la negociación y el cierre",
    logra: "convertir más consultas en visitas calificadas y liberar tiempo comercial de los corredores",
    prueba: "Ya trabajamos con **+15** inmobiliarias como **EYDISA, Nueva Alianza, Ariza, Mersan, Propiver**.",
    metricas: "En el sector inmobiliario, la asesoría 24/7 impulsada por IA ha generado mejoras cercanas al 30% en eficiencia y hasta 2X en conversión de reuniones agendadas mediante WhatsApp.",
    asuntos2: ["Gestión de leads inmobiliarios", "Más visitas calificadas en {{empresa}}"],
  },
  {
    clave: "gimnasio",
    label: "Gimnasios",
    test: /gimnasio|centro deportivo|crossfit|fitness|actividades deportivas|padel|pádel|cancha|futbolito|complejo deportivo|club deportivo/i,
    rol: "la operación comercial del centro",
    consultas: "planes, horarios, clases de prueba e inscripciones, mientras el equipo está atendiendo a socios y operando el gimnasio",
    hace: "responden 24/7, explican planes y horarios, agendan clases de prueba, confirman la asistencia y hacen seguimiento a quienes consultaron pero no se inscribieron. También pueden reactivar antiguos interesados o socios, sin cambiar las herramientas que el centro ya utiliza",
    logra: "transformar más consultas en clases de prueba e inscripciones sin sumar personal administrativo",
    prueba: "Ya trabajamos con **+20** centros como **Ytororō Centro Deportivo, Infinity Pilates, Fit Wise, Qanttum Sport**.",
    metricas: "La combinación de IA y equipo humano ha permitido multiplicar hasta 12 veces la capacidad comercial y conseguir hasta 2X en conversión de reuniones o instancias agendadas.",
    asuntos2: ["Inscripciones y clases de prueba", "Gestión comercial del gimnasio en {{empresa}}"],
  },
  {
    clave: "boutique",
    label: "Centros boutique",
    test: /pilates|yoga|wellness|nutricion|nutrición|masaje|\bspa\b|peluqueria|peluquería|barberia|barbería|kinesiolog|kinesic|fisioterap|podolog/i,
    rol: "la operación comercial y reservas del centro",
    consultas: "precios, horarios, disponibilidad, clases, sesiones y reservas, al mismo tiempo que el equipo entrega una experiencia presencial personalizada",
    hace: "atienden 24/7, responden con la información real del centro, agendan reservas o clases de prueba, envían recordatorios y hacen seguimiento a quienes consultaron pero no reservaron. La solución se adapta a pilates, yoga, wellness, depilación, nutrición, masajes, spa y servicios relacionados",
    logra: "aumentar reservas y asistencia sin perder la atención boutique ni sumar carga operativa",
    prueba: "Ya trabajamos con **+20** centros como **Ytororō Centro Deportivo, Infinity Pilates, Fit Wise, Qanttum Sport**.",
    metricas: "Implementaciones comparables han multiplicado hasta 12 veces la capacidad de atención comercial, reducido 93% el tiempo de respuesta y aumentado 39% la conversión promedio de leads.",
    asuntos2: ["Reservas y atención en el centro", "Más reservas sin sumar carga operativa en {{empresa}}"],
  },
];

/**
 * Sin vertical no hay secuencia. Se devuelve null en vez de armar un correo
 * genérico: mandar copy sin prueba social ni métricas del rubro es peor que
 * no mandar nada, y además inventaría referencias que no existen.
 */
export function verticalDe(
  lead: Pick<LeadFoco, "industria" | "empresa">,
  opciones?: {
    /**
     * El rubro viene de una fuente precisa y se puede confiar en él.
     *
     * `soloNombre` existe por el rubro del SII, que agrupa toda la medicina
     * ambulatoria bajo "MEDICOS Y ODONTOLOGOS". Pero en Prospección el rubro
     * es el término exacto que se buscó en Google Maps ("Clínica dental"), y
     * ahí ignorarlo es peor: 25 clínicas dentales de la base se quedaban sin
     * vertical solo porque su nombre comercial es "Total Sonrisa" o
     * "Clínica Ichtus" y no dice la palabra dental.
     */
    rubroConfiable?: boolean;
  },
): Vertical | null {
  const nombre = lead.empresa ?? "";
  const todo = `${lead.industria ?? ""} ${nombre}`;
  return (
    VERTICALES.find((v) =>
      v.test.test(v.soloNombre && !opciones?.rubroConfiable ? nombre : todo),
    ) ?? null
  );
}

/** Primer nombre: los correos tutean, y "Hola María Fernanda Errázuriz" no. */
function primerNombre(contacto: string): string {
  const n = (contacto ?? "").trim().split(/\s+/)[0];
  return n || "[nombre]";
}

export function secuenciaPara(lead: LeadFoco): CorreoSecuencia[] | null {
  const v = verticalDe(lead);
  if (!v) return null;

  const empresa = lead.empresa?.trim() || "[empresa]";
  const nombre = primerNombre(lead.contacto);
  const rellena = (s: string) => s.replace(/\{\{empresa\}\}/g, empresa);

  const cierrePOC =
    `Nos encantaría reunirnos para mostrarles cómo se vería funcionando con información real de ${empresa} y ofrecerles una **prueba de concepto personalizada** de dos semanas, **sin costo**, automatizando uno de sus procesos.`;

  return [
    {
      n: 1,
      cuando: "Día 1",
      asuntoA: `Solicitud de contacto - ${empresa}`,
      asuntoB: `Sobre la gestión de ${empresa}`,
      cuerpo:
        `Hola ${nombre},\n\n` +
        `Te escribo porque estoy buscando al dueño o encargado de ${v.rol} en ${empresa}. Por tu cargo en LinkedIn, pensé en preguntarte directamente.\n\n` +
        `Busco a esta persona porque desde Respondo sabemos que este tipo de negocio recibe consultas por WhatsApp e Instagram sobre ${v.consultas}.\n\n` +
        `Creamos asistentes de IA que ${v.hace}. Esto permite ${v.logra}.\n\n` +
        `${cierrePOC}\n\n` +
        `${v.prueba} ${v.metricas}\n\n` +
        `¿Eres tú la persona encargada de estos temas? De lo contrario, agradecería si pudieras ayudarme a conectar con quien corresponda.\n\n` +
        `Muchas gracias por tu ayuda, ${nombre}.\n\n` +
        `Saludos cordiales,`,
    },
    {
      n: 2,
      cuando: "Día 3–4",
      asuntoA: rellena(v.asuntos2[0]),
      asuntoB: rellena(v.asuntos2[1]),
      cuerpo:
        `Hola ${nombre},\n\n` +
        `¿Pudiste leer mi correo anterior? Sigo buscando al dueño o encargado de ${v.rol} de ${empresa} para mostrarte, en una reunión, cómo podemos automatizar su atención, seguimiento y agendamiento con una **prueba de concepto personalizada** de dos semanas.\n\n` +
        `Desde Respondo sabemos que este tipo de negocio recibe consultas por WhatsApp e Instagram sobre ${v.consultas}. Creamos asistentes de IA que ${v.hace}. Esto les permite ${v.logra}.\n\n` +
        `${v.prueba} ${v.metricas}\n\n` +
        `Por favor indícame tu disponibilidad para coordinar esta reunión. En caso de que no seas la persona encargada, agradecería que me pudieras redirigir.\n\n` +
        `Espero tu respuesta,\n\nSaludos cordiales,`,
    },
    {
      n: 3,
      cuando: "Día 7–8",
      asuntoA: `Reunión ${empresa} y Respondo`,
      asuntoB: null,
      cuerpo:
        `Hola ${nombre},\n\n` +
        `Este es el último correo que te envío para ofrecerte una **prueba de concepto personalizada** de dos semanas, donde automatizamos un proceso real de ${empresa} para que puedan evaluar cómo funciona Respondo con su propia operación.\n\n` +
        `La razón por la que insisto es porque genuinamente creo que podemos ayudarles a ${v.logra}. Creamos asistentes de IA que ${v.hace}.\n\n` +
        `${v.prueba} ${v.metricas}\n\n` +
        `Quedo a la espera de tu disponibilidad para coordinar la reunión.\n\n` +
        `Saludos cordiales,`,
    },
  ];
}
