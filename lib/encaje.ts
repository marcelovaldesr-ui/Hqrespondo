/**
 * Encaje con Respondo — ¿este negocio se puede atender, o solo se puede llamar?
 *
 * POR QUÉ EXISTE
 * Tener el teléfono del gerente general no sirve si el negocio no tiene nada
 * que Respondo pueda resolver. Un estudio jurídico grande tiene decisor,
 * teléfono y plata, y aun así es imposible: cada consulta es única, la relación
 * es personal y nadie pide asesoría legal por WhatsApp. Es el rubro y la forma
 * de operar lo que descarta, no el tamaño.
 *
 * EL CRITERIO
 * Sale del checklist ICP que ya está en `lib/venta.ts`, quedándose con las dos
 * preguntas que se pueden responder ANTES de llamar:
 *   · ¿cotiza o agenda seguido, con preguntas repetidas?
 *   · ¿es contactable por WhatsApp, o su mundo es la licitación y el correo?
 * Las otras tres (volumen real, software que ya usa, capacidad de pago) solo se
 * saben hablando. Por eso esto ordena la cola; no reemplaza la calificación.
 *
 * NO ES UN ORÁCULO
 * Cada nivel viene con su motivo escrito para que se pueda discutir, y se puede
 * corregir a mano desde la ficha. La regla acierta en el grueso y se equivoca en
 * los bordes; quien llamó ayer sabe más que esta tabla.
 */

function limpiar(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * ¿La hora es indivisible? — el criterio que más pesa desde que existe la agenda.
 *
 * Viene de Marcelo (19-ago-2026): "cosas que se pueda agendar y tengan solo un
 * cupo, ya que nuestro sistema de agenda funciona mejor así".
 *
 * Un box dental, un sillón de peluquería, una cabina de depilación: una hora,
 * un profesional, un cupo. Ahí la garantía de que "dos personas no pueden tomar
 * la misma hora" ES el producto, y una inasistencia cuesta el cupo entero
 * (OdontoAndrauss: −38% de horas perdidas). En un gimnasio la clase de las
 * 19:00 tiene 20 lugares: el sistema igual controla el cupo, pero perder uno
 * no duele parecido.
 *
 * Por eso el mismo rubro "wellness" se parte en dos: la clínica estética entra
 * arriba y el gimnasio queda un escalón abajo.
 */
export const HORA_INDIVIDUAL =
  /dental|odontolog|\boral\b|ortodon|implant|endodon|periodon|kinesiolog|kinesic|fisioterap|podolog|fonoaudiolog|psicolog|psiquiatr|nutricion|oftalmolog|otorrino|dermatolog|estetic|esthetic|depilacion|laser|veterinari|peluqueria|barberia|masaje|consulta|policlinic/;

export function agendaDeCupoUnico(entrada: { empresa?: string; industria?: string }): boolean {
  const t = `${entrada.empresa ?? ""} ${entrada.industria ?? ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return HORA_INDIVIDUAL.test(t);
}

export const NIVELES_ENCAJE = ["alto", "medio", "bajo", "nulo", "sin_evaluar"] as const;
export type NivelEncaje = (typeof NIVELES_ENCAJE)[number];

export const ENCAJE_LABEL: Record<NivelEncaje, string> = {
  alto: "Encaje alto",
  medio: "Encaje medio",
  bajo: "Encaje bajo",
  nulo: "No encaja",
  sin_evaluar: "Falta el rubro",
};

export const ENCAJE_RANK: Record<NivelEncaje, number> = {
  alto: 4, medio: 3, sin_evaluar: 2, bajo: 1, nulo: 0,
};

export interface Encaje {
  nivel: NivelEncaje;
  motivo: string;
  noPromover?: boolean;
}

interface Regla {
  patron: RegExp;
  nivel: NivelEncaje;
  motivo: string;
  /** Empleados mínimos para el nivel principal. Bajo eso aplica nivelChico. */
  minEmpleados?: number;
  nivelChico?: NivelEncaje;
  motivoChico?: string;
  /** Bloquea la subida de nivel por señales del texto. Se usa donde el techo
   *  lo pone el modelo de negocio y no la evidencia de volumen: un club decide
   *  por directorio y un mayorista industrial vende con visita técnica, por
   *  mucho que concentren todo en un teléfono. */
  noPromover?: boolean;
}

/**
 * DESCARTES POR IDENTIDAD — se prueban SOLO contra el nombre y el rubro, nunca
 * contra el texto de investigación.
 *
 * Esto no es un detalle: la primera versión probaba los descartes contra todo
 * el texto junto y la palabra "holding", que aparecía describiendo a quién
 * pertenece una clínica, la descartaba como sociedad de inversión. Una clínica
 * de 100 trabajadores quedaba fuera de la lista por una palabra en una nota.
 */
const DESCARTES: Regla[] = [
  {
    // "Dónde se pierde el tiempo" — Guía interna de prospección, ago-2026.
    // OJO: esto DESHACE una corrección anterior. El doc ICP de julio ponía a
    // las ferreterías como ICP 1; la guía de agosto —que declara reemplazar
    // versiones anteriores— las manda a la lista de descarte por el catálogo
    // enorme y variable. Es la misma razón por la que el asistente no cotiza
    // en imprentas ni maestranzas: precio que depende de medidas y materiales.
    patron: /ferreteria|materiales de construccion|maestranza|imprenta/,
    nivel: "bajo",
    motivo:
      "Catálogo enorme y variable: el precio depende de medidas, materiales o cantidad, y ahí el asistente NO cotiza —solo toma datos y deriva—. La guía interna lo pone en «dónde se pierde el tiempo»: se puede vender, pero el esfuerzo por peso ganado es peor y el soporte pesa el doble.",
  },

  {
    patron: /constructora|contratista|obras civiles/,
    nivel: "nulo",
    motivo: "Constructoras y contratistas: ciclo por licitación y proyecto, sin consulta repetida que atender.",
  },
  {
    patron: /\b(abogad|juridic|legal(es)?\b|notaria|estudio de abogados|corporativ[oa] legal)/,
    nivel: "nulo",
    motivo:
      "Servicios jurídicos: cada consulta es distinta, la relación es personal y nadie contrata un abogado por WhatsApp. No hay pregunta repetida que automatizar.",
  },
  {
    patron: /\b(auditor|contabilidad|contable|consultor[ií]a|asesor[ií]a (financiera|tributaria)|estudio contable)/,
    nivel: "nulo",
    motivo:
      "Consultoría o auditoría: el trabajo es a medida y se vende por reunión, no por consulta entrante.",
  },
  {
    patron: /\b(licitacion|mercado publico|obra[s]? civil|epc|llave en mano|montaje industrial|ingenieria de proyectos)/,
    nivel: "nulo",
    motivo:
      "Vende por licitación o proyecto: el ciclo es de meses, entra por bases y propuesta técnica. Un asistente de WhatsApp no toca ese proceso.",
  },
  {
    patron: /\b(minera|mineria|planta industrial|automatizacion industrial|obras sanitarias|concesionaria vial)/,
    nivel: "nulo",
    motivo:
      "Industria pesada o infraestructura: no existe consulta entrante de consumidor, todo pasa por contratos y órdenes de compra.",
  },
  {
    patron: /\b(holding|sociedad de inversion|inversiones (spa|ltda|limitada)|administradora de fondos)/,
    nivel: "nulo",
    motivo: "Sociedad de inversión o holding: no atiende público, no hay operación que asistir.",
  },
  {
    patron: /\b(aseo industrial|seguridad privada|guardias|outsourcing de personal|servicios transitorios|empresa de servicios transitorios)/,
    nivel: "bajo",
    motivo:
      "Servicios a empresas por contrato: se vende en reuniones y se renueva por licitación, no por consultas entrantes.",
  },
  {
    patron: /\b(call center|contact center)/,
    nivel: "bajo",
    motivo:
      "Ya vive de operar conversaciones: o tiene plataforma propia o nos ve como competencia, no como proveedor.",
  },
];

/**
 * DESCARTES POR MODELO DE VENTA — estos sí miran el texto de investigación,
 * pero solo con frases que no admiten otra lectura. "Áreas de práctica" o
 * "bases técnicas" describen cómo vende la empresa; "holding" o "formulario"
 * no dicen nada por sí solos.
 */
const DESCARTES_MODELO: Regla[] = [
  {
    patron: /areas de practica|asesoria a medida|propuesta tecnica|bases tecnicas|proceso de licitacion|se cotiza por proyecto/,
    nivel: "nulo",
    motivo:
      "Su forma de vender es a medida —áreas de práctica, propuesta técnica o licitación—: no hay consulta repetida que un asistente pueda contestar.",
  },
  {
    // El criterio #2 de Investigacion_Nichos_Chile.md: "si tienen AgendaPro /
    // Reservo / Dentalink andando, perdiste". Es el filtro que hizo caer al
    // nicho dental en su propia investigación, y el que ICP_RESPONDO.md
    // repite como FILTRO DURO en los perfiles 3, 4 y 5.
    // Caso real: Labocenter estaba clasificado "encaje alto" y su ficha decía
    // "agenda dental en dominio externo (softwaredentalink)" — ya tenía la
    // conversación resuelta por un incumbente.
    patron:
      /agendapro|reservo\b|dentalink|mastercar|tallerhub|bujia\.io|dolione|appli-?car|\bayrto\b|kiteprop|tokko/,
    nivel: "medio",
    motivo:
      "Ya usa un software de agenda o cotización (AgendaPro, Reservo, Dentalink, MasterCar…). El ICP pide descartarlo SOLO si además tiene el WhatsApp activo y atendido: ahí el dolor está resuelto. Si el software agenda pero nadie contesta los mensajes, sigue siendo cliente — de hecho la secuencia dental se vende a clínicas que ya tienen sistema (\"sin cambiar las herramientas que ya utiliza\"). Verificar en la llamada antes de descartar.",
    noPromover: true,
  },
];

/**
 * PRECIO QUE SE CALCULA, NO QUE SE CONSULTA — el contrapeso del ensanche.
 *
 * Al abrir el ICP a "todo negocio que atiende por redes", el riesgo no es
 * teórico: es que vuelvan a entrar exactamente los negocios que la guía de
 * agosto sacó a mano. Y el motivo de esos descartes NUNCA fue el canal —una
 * ferretería vive en WhatsApp— sino que **el asistente no puede contestar**:
 * si el precio depende de los metros, del material o de la cantidad, no hay
 * respuesta que dar, solo datos que tomar y derivar a una persona.
 *
 * Eso es lo que separa una tienda de motos de una ferretería, aunque las dos
 * "vendan cosas por WhatsApp": la moto tiene precio por unidad; el perfil de
 * aluminio se cotiza por metro cortado.
 *
 * Se prueba contra el rubro Y contra la nota, porque esta forma de vender casi
 * siempre está escrita con todas sus letras ("cortamos a medida", "cotiza por
 * m2"). No baja a "nulo": son vendibles, solo cuestan más de lo que rinden.
 */
const PRECIO_A_MEDIDA =
  /a medida|a la medida|por metro|por m2|por m²|metro lineal|segun medida|segun material|corte de|cortamos|presupuesto por proyecto|segun cantidad|por kilo|por tonelada/;

/**
 * ENCAJES POSITIVOS — negocios donde la misma pregunta llega decenas de veces
 * al día y hoy la contesta una persona escribiendo a mano.
 *
 * El ORDEN importa: gana la primera que calza. Las cuatro primeras existen
 * porque al correr las reglas sobre el universo SII completo (41.507
 * empresas) aparecieron falsos positivos que una lista de 100 nunca mostró:
 * bencineras clasificadas "automotriz alto", hosting de DATOS clasificado
 * hotel por la palabra "hospedaje", laboratorios farmacéuticos industriales
 * como "salud ambulatoria" y rentistas de bienes propios como corretaje.
 */
const POSITIVOS: Regla[] = [
  {
    /**
     * Salud mental. La guía interna pone "psicólogos y consulta clínica" en la
     * lista de descarte, pero esa línea apunta al PROFESIONAL SOLO: 6 a 8
     * pacientes al día no llegan a las 15 consultas diarias que pide el ICP, y
     * ahí la conversación es la atención misma.
     *
     * Un CENTRO de salud mental es otra cosa completamente: tiene recepción,
     * agenda por profesional, preguntas de previsión y valores todo el día, y
     * una tasa de inasistencia alta —justo lo que ataca el recordatorio
     * automático (OdontoAndrauss: −38% de horas perdidas)—. Es literalmente
     * "clínicas y centros médicos sin software de agenda", que la MISMA guía
     * pone en los rubros donde mejor funciona.
     *
     * Y hay un dato que zanja la discusión: en el universo de Leads Foco
     * (20-150 trabajadores) NO existen psicólogos solos. Las 19 empresas de
     * salud mental que hay tienen mediana de 38 trabajadores. Descartarlas a
     * todas por esa línea era perder 19 centros reales.
     *
     * El límite clínico se respeta igual: el asistente nunca da indicación ni
     * evalúa un caso. Automatiza la hora, el valor y el recordatorio — nunca
     * la terapia.
     */
    patron: /psicolog|psiquiatr|salud mental|neuropsiquiatr|rehabilitacion|terapia/,
    nivel: "alto",
    motivo:
      "Centro de salud mental: agenda por profesional, preguntas de previsión y valores todo el día, y alta inasistencia — que es justo lo que baja el recordatorio automático. El asistente nunca da indicación clínica ni evalúa un caso: automatiza la hora, el valor y el recordatorio, y deriva todo lo demás al profesional.",
    minEmpleados: 4,
    /** Bajo el mínimo, cae a esto en vez de descartarse del todo. */
    nivelChico: "bajo",
    motivoChico:
      "Consulta individual, no centro: bajo 4 trabajadores en planilla es un profesional solo con secretaria, y el problema ahí es de volumen, no de rubro — no llega a las consultas diarias que justifican un plan. Desde 4 en planilla ya son varios profesionales con agenda propia y vuelve a nivel alto. Si igual recibe muchas más consultas de las que alcanza a atender, es cliente: el dolor de agenda y recordatorio es el mismo.",
  },
  {
    // Rubro nuevo que no existía en las reglas: la agenda con control de cupo
    // lo hizo posible. "Canchas de pádel y fútbol" está literal en la lista de
    // "rubros donde mejor funciona" de la guía de agosto.
    patron: /padel|cancha|club deportivo|centro deportivo|futbolito|complejo deportivo/,
    nivel: "alto",
    motivo:
      "Canchas y complejos deportivos (rubro nuevo desde que existe la agenda): reservar una hora hoy toma varios mensajes y se anota a mano. El sistema controla el cupo —dos personas no pueden tomar la misma hora— y recuerda antes para que no se pierda.",
  },
  {
    // Se separa del taller mecánico: el taller tiene incumbente, el servicio
    // a domicilio está en "rubros donde mejor funciona".
    patron: /servicio tecnico a domicilio|reparacion a domicilio|tecnico a domicilio|gasfiter|electricista|cerrajer|sanitizacion|control de plagas/,
    nivel: "alto",
    motivo:
      "Servicio técnico a domicilio: consultas repetidas por disponibilidad, cobertura de comuna, plazos y precio referencial, con el técnico en terreno sin poder contestar. Está en los rubros donde mejor funciona.",
  },
  {
    patron: /venta al por menor de combustibles|estacion de servicio|bencinera|servicentro/,
    nivel: "bajo",
    motivo:
      "Bencinera: nadie cotiza combustible por WhatsApp; la venta es presencial e instantánea. No hay conversación que asistir.",
    noPromover: true,
  },
  {
    patron: /procesamiento de datos|portales web|hosting|centro de datos/,
    nivel: "bajo",
    motivo:
      "Infraestructura tecnológica: venden B2B a clientes técnicos y tienen equipo para construirse sus propios bots. Mal prospecto para evangelizar.",
    noPromover: true,
  },
  {
    patron: /fabricacion de/,
    nivel: "medio",
    motivo:
      "Fabricante: vende B2B por orden de compra, pero si distribuye a pymes hay cotización repetida. Confirmar en la llamada quién le compra y por dónde.",
    noPromover: true,
  },
  {
    patron: /inmobiliarias realizadas con bienes propios/,
    nivel: "medio",
    motivo:
      "Rentista de bienes propios: muchas son sociedades de administración sin público. Si arrienda activamente (consultas por disponibilidad y visitas), sube. Mirar el sitio.",
    noPromover: true,
  },
  {
    patron: /\b(clinica|dental|odontolog|medic|kinesiolog|oftalmolog|dermatolog|salud)/,
    // (Psicología y consulta clínica salen antes, en DESCARTES.)
    nivel: "alto",
    motivo:
      "Salud ambulatoria: vertical con clientes reales y secuencia propia (+12 estéticas como Velours y Renuva; +17 dentales como Odontoandrauss y Zenith). 'Cuánto cuesta', '¿atienden mi isapre?', '¿hay hora?' todo el día. Ojo: si ya usa AgendaPro/Reservo/Dentalink CON WhatsApp atendido, el dolor está resuelto — preguntarlo en la llamada.",
  },
  {
    patron: /\b(laboratorio|histopatolog|imagenolog|imagenes medicas|toma de muestras|examenes)/,
    nivel: "alto",
    motivo:
      "Laboratorio o imágenes: consultas repetidas por precio, convenio, ayuno, horarios y entrega de resultados.",
  },
  {
    patron: /\b(veterinari|clinica veterinaria|petshop|pet shop)/,
    nivel: "alto",
    motivo: "Veterinaria: agenda, vacunas y precios preguntados una y otra vez.",
  },
  {
    patron: /\b(hotel|hostal|cabana|cabanas|apart hotel|lodge|resort|alojamiento|hospedaje)/,
    nivel: "alto",
    motivo:
      "Alojamiento y arriendo turístico (el #2 de la investigación y el mejor primer win): operan literalmente por WhatsApp, el incumbente es casi nulo y el build es el más simple. Disponibilidad, tarifas y reglas son la conversación entera, y llega a toda hora. Ojo con la estacionalidad: el dolor se siente en verano y Fiestas Patrias.",
  },
  {
    patron: /\b(restaurant|restoran|catering|banqueter|eventos|centro de eventos)/,
    nivel: "bajo",
    motivo:
      "«Restaurantes con pedidos» está en la lista de descarte de la guía interna: menú con modificadores, stock, pago y peak de hora punta hacen el bot más pesado de construir y mantener, y ya hay productos hechos para eso.",
    noPromover: true,
  },
  {
    // El taller se separó de la venta de repuestos a propósito: la
    // investigación de nichos marca al TALLER con incumbente alto (MasterCar,
    // TallerHub, Bujía, DoliOne, Appli-Car, Ayrto), mientras que la venta de
    // repuestos es una distribuidora que cotiza — el ICP 1, no el 5.
    patron: /\b(taller mecanico|desabolladura|vulcanizacion|servicio tecnico|mantenimiento y reparacion)/,
    nivel: "medio",
    motivo:
      "Taller o servicio técnico (ICP 5, el último de la lista): cotizan a mano y el dolor es real, pero el rubro ya está siendo softwarizado (MasterCar, TallerHub, Ayrto). Solo sirve el taller chico e informal, sin sistema y con +15 consultas/día.",
    noPromover: true,
  },
  {
    patron: /\b(repuesto|accesorios para veh|automotor|automotriz|motocicleta|motos?\b|moto ?shop|motor ?shop|neumatic|lubricentro|venta de partes)/,
    nivel: "alto",
    motivo:
      "Automotoras y repuestos: vertical con secuencia propia y +18 clientes (Motorman, Montiel, Motorland, Codas). Modelos, stock, precios, financiamiento y test drives; el interesado sigue cotizando si el primer contacto no es inmediato. Es el perfil de RS Shop, la reunión ya agendada.",
  },
  {
    // Bicicleterías, tiendas de patines, scooters, artículos deportivos. No
    // calzaban en ninguna regla y caían en "sin evaluar" — son tres de los
    // leads que Marcelo cargó a mano y quedaron con "?".
    //
    // Mecánicamente son idénticas a repuestos: catálogo con precio por unidad
    // y la misma pregunta todo el día ("¿tienen el modelo X?", "¿cuánto vale?",
    // "¿queda talla M?"). Eso es lo que el asistente sabe contestar.
    patron: /bicicleta|bicicleteria|\bbike\b|patin|scooter|articulos deportivos|tienda de deporte/,
    nivel: "medio",
    motivo:
      "Tienda con catálogo de precio fijo (bicicletas, patines, accesorios): la misma pregunta —modelo, talla, stock, precio— llega decenas de veces al día y hoy la contesta alguien escribiendo a mano. Sube a alto con señal de que no alcanzan a responder.",
  },
  {
    // Arriendo por unidad reservable: un auto, una máquina, un espacio. Es el
    // primo del cupo único — lo que se agenda es un objeto en vez de una hora,
    // pero la garantía de "esto ya está tomado" es igual de central.
    patron: /rent ?a ?car|rentacar|arriendo de|arriendo por|alquiler de|renta de (auto|vehic|maquin)|leasing operativo/,
    nivel: "medio",
    motivo:
      "Arriendo por unidad reservable (autos, maquinaria, espacios): la consulta es siempre la misma —disponibilidad para tal fecha, tarifa, requisitos— y el sistema puede responderla y bloquear la unidad. Confirmar en la llamada si hoy lo llevan a mano o ya tienen sistema.",
  },
  {
    patron: /\b(colegio|jardin infantil|preescolar|ensenanza|enseñanza|instituto|preuniversitario|academia|escuela)/,
    nivel: "alto",
    motivo:
      "Educación: la temporada de admisión y matrícula concentra cientos de consultas idénticas sobre vacantes, aranceles y documentos.",
  },
  {
    // Hora individual: una silla, un profesional. Va antes que el gimnasio.
    patron: /\b(centro de estetica|day spa|estetica|esthetic|peluqueria|barberia|masaje|depilacion|podolog|manicur)/,
    nivel: "alto",
    motivo:
      "Servicio de hora individual (una silla, una cabina, un profesional): es donde la agenda rinde más, porque el cupo es indivisible y la inasistencia cuesta la hora completa. Vertical con clientes reales y secuencia propia escrita.",
  },
  {
    patron: /\b(gimnasio|centro deportivo|crossfit|pilates|yoga|wellness)/,
    nivel: "medio",
    motivo:
      "Gimnasio o centro con clases: hay clientes reales y secuencia escrita (+20: Ytororō, Infinity Pilates, Fit Wise, Qanttum), pero el cupo es GRUPAL —la clase de las 19:00 tiene 20 lugares— así que perder uno duele mucho menos que perder un box. Encaja, pero después de los de hora individual.",
    noPromover: true,
  },
  {
    patron: /\b(inmobiliaria|corretaje|corredora de propiedades|arriendo de propiedades)/,
    nivel: "alto",
    motivo:
      "Inmobiliarias: vertical con secuencia propia y +15 clientes (EYDISA, Nueva Alianza, Ariza, Mersan, Propiver). Responder en menos de 5 minutos multiplica ~100x la probabilidad de contacto y el corredor está en visitas la mitad del día. Ticket enorme: una comisión paga años de servicio.",
  },
  {
    patron: /\b(materiales de construccion|ferreteria|electricidad|alambre|malla|insumo|distribuidora)/,
    nivel: "alto",
    motivo:
      "Ferretería o distribuidora (ICP 1, el primero en el orden de ataque): cotizan lo mismo 30 veces al día por WhatsApp —precio, stock y despacho— y una cotización que llega tarde es venta perdida. Advertencia de la investigación: entrar con cotización SIMPLE de catálogo acotado, no con todo el inventario.",
  },
  {
    patron: /\b(maquinaria|equipamiento)/,
    nivel: "medio",
    motivo:
      "Venta de maquinaria o equipamiento: hay cotización repetida, pero si vende por orden de compra con visita técnica el asistente sobra. Confirmar en la llamada quién le compra y por dónde.",
    noPromover: true,
  },
  {
    patron: /\b(hospital|red de salud|isapre)/,
    nivel: "medio",
    motivo:
      "Volumen de sobra, pero suelen tener sistema propio y compra por comité: ciclo largo. Vale la llamada, no la prioridad.",
    noPromover: true,
  },
  {
    patron: /\b(club de golf|club deportivo|club social|corporacion deportiva|club de campo)/,
    nivel: "medio",
    motivo:
      "Atención de socios con preguntas repetidas (horarios, canchas, invitados), pero el volumen es acotado y la decisión pasa por directorio.",
    noPromover: true,
  },
  {
    patron: /\b(club (social y )?deportivo|futbol profesional|estadio)/,
    nivel: "bajo",
    motivo:
      "Club de fútbol profesional: el inbound de hinchas es estacional y las entradas ya pasan por una ticketera.",
    noPromover: true,
  },
  {
    // Último de la lista a propósito: es el rubro SII, que agrupa desde un
    // gimnasio de barrio hasta un club de fútbol. Sirve para no dejarlos en
    // "sin evaluar", no para decidir.
    patron: /actividades deportivas/,
    nivel: "medio",
    motivo:
      "Rubro deportivo genérico: puede ser un club de socios o un centro con horas agendadas. Mirar el sitio antes de llamar.",
    noPromover: true,
  },
  // ---- Rubros SII genéricos de comercio. Van al final: cualquier regla más
  // específica de arriba (repuestos, ferretería, enseres) gana primero.
  // Existen porque dejaban un tercio de la lista en "sin evaluar" cuando el
  // rubro sí dice algo: una tienda vende, y las tiendas cotizan.
  {
    patron: /venta al por menor/,
    nivel: "medio",
    motivo:
      "Comercio minorista: si cotiza y vende por WhatsApp, encaja bien; si es una vitrina con e-commerce que ya resuelve todo, no. Dos señales del sitio lo suben a alto.",
  },
  {
    patron: /venta al por mayor|distribuidora|comercializadora/,
    nivel: "alto",
    motivo:
      "Distribuidoras y mayoristas: está en los rubros donde mejor funciona. Cotización repetida de clientes que recompran, con lista de precios propia. Ojo con el catálogo: si el precio depende de medidas o materiales, el asistente toma datos y deriva en vez de cotizar.",
  },
];

/**
 * Señales del texto que ajustan el nivel.
 *
 * OJO CON LA NEGACIÓN. Las notas de investigación dicen cosas como "el sitio no
 * tiene WhatsApp ni chat". Buscar `whatsapp` a secas leía eso como "ya atiende
 * por WhatsApp" y subía de nivel a tres negocios por exactamente lo contrario
 * de lo que decía la nota. Por eso cada señal se descarta si viene precedida de
 * una negación en las ~30 letras anteriores.
 */
const NEGACION = /\b(no|sin|ningun[ao]?|carece de|tampoco)\b[^.;]{0,30}$/;

function apareceAfirmado(texto: string, patron: RegExp): boolean {
  const re = new RegExp(patron.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto)) !== null) {
    const antes = texto.slice(Math.max(0, m.index - 40), m.index);
    if (!NEGACION.test(antes)) return true;
  }
  return false;
}

/**
 * Las TRES señales de la guía interna (§09): "dolor visible desde afuera" que
 * sube un prospecto al principio de la lista y, de paso, le da al vendedor la
 * primera frase de la llamada. Estaban descritas en el documento y no existían
 * en el código: se documentaban en la ficha y no movían la cola.
 */
export const SENALES_GUIA: { clave: string; patron: RegExp; nota: string; frase: string }[] = [
  {
    clave: "resenas",
    patron: /rese[nñ]a|google.{0,25}(queja|reclam|no contest)|(queja|reclam)[^.]{0,40}no contest|1 estrella|una estrella/,
    nota: "reseñas quejándose de que no contestan",
    frase: "Vi en sus reseñas de Google que a algunos clientes les cuesta que les contesten…",
  },
  {
    clave: "sin_whatsapp",
    patron: /formulario|solo correo|correo generico|sin whatsapp|no publica.{0,20}whatsapp|unico canal/,
    nota: "su único contacto es formulario o correo, no un WhatsApp visible",
    frase: "Entré a su sitio y para escribirles hay que llenar un formulario…",
  },
  {
    clave: "instagram",
    patron: /instagram[^.]{0,60}(pregunt|coment|sin respuesta)|comentarios[^.]{0,40}precio/,
    nota: "en Instagram le preguntan precio y quedan sin respuesta",
    frase: "Vi que en sus publicaciones de Instagram preguntan precio y quedan varios sin respuesta…",
  },
];

/** Cuáles de las tres señales tiene este lead, con su frase de apertura. */
export function senalesDeGuia(texto: string): { nota: string; frase: string }[] {
  const t = limpiar(texto);
  return SENALES_GUIA.filter((s) => s.patron.test(t)).map(({ nota, frase }) => ({ nota, frase }));
}

const SENALES_A_FAVOR: { patron: RegExp; nota: string }[] = [
  { patron: /venta telefonica|ventas por telefono|ejecutiv[oa]s? de vent/, nota: "tiene gente dedicada a contestar el teléfono" },
  { patron: /whatsapp/, nota: "ya atiende por WhatsApp" },
  { patron: /cotiza|cotizacion|presupuesto en linea/, nota: "cotiza de forma repetitiva" },
  { patron: /reserva|agendar?|hora medica|dar hora/, nota: "agenda horas" },
  { patron: /call center|mesa central|anexos/, nota: "concentra todo en un teléfono central" },
];

const SENALES_EN_CONTRA: { patron: RegExp; nota: string }[] = [
  { patron: /licitacion|bases tecnicas|orden de compra/, nota: "compra por licitación" },
  { patron: /areas de practica|asesoria a medida|propuesta tecnica/, nota: "el servicio es a medida" },
];

export interface EntradaEncaje {
  empresa?: string;
  razon_social?: string;
  industria?: string;
  senal?: string;
  /** Texto libre de canales observados, si la fuente lo trae. */
  canales?: string;
  /** Dato estructurado, más confiable que buscar "whatsapp" en la nota. */
  tieneWhatsapp?: boolean;
  /**
   * Número de trabajadores. Importa más de lo que parece: hay rubros donde el
   * MISMO giro es un cliente excelente o uno imposible según el tamaño, y sin
   * este dato las reglas trataban igual a un psicólogo solo y a un centro de
   * salud mental de 96 personas.
   */
  nEmpleados?: number | null;
}

/**
 * Clasifica un lead. Primero descarta por forma de operar, después busca el
 * rubro, y al final ajusta con lo que se observó del negocio.
 *
 * El motivo que devuelve NO es decorativo: es lo que se lee antes de marcar
 * para saber con qué abrir, y lo que permite discutir la clasificación.
 */
export function evaluarEncaje(e: EntradaEncaje): Encaje {
  // El nombre de fantasía es el negocio; la razón social es el envase legal.
  // Se separan porque el envase miente: "COMERCIAL Y PRODUCTORA DE EVENTOS
  // JEREMIAS SPA" es una tienda de motos, y buscar "eventos" ahí la clasificaba
  // como banquetería. Los rubros positivos miran SOLO el nombre de fantasía.
  const fantasia = limpiar(e.empresa ?? "");
  const legal = limpiar(e.razon_social ?? "");
  const rubro = limpiar(e.industria ?? "");
  const texto = limpiar(`${e.senal ?? ""} ${e.canales ?? ""}`);
  // Los descartes sí miran la razón social: "INVERSIONES X LIMITADA" como
  // nombre legal es justamente la señal de que no hay operación que atender.
  const identidadCompleta = `${fantasia} ${legal} ${rubro}`;
  const identidad = `${fantasia} ${rubro}`;
  for (const r of DESCARTES) {
    if (r.patron.test(identidadCompleta)) return { nivel: r.nivel, motivo: r.motivo };
  }
  for (const r of DESCARTES_MODELO) {
    if (r.patron.test(texto)) return { nivel: r.nivel, motivo: r.motivo };
  }
  // Este mira el rubro además de la nota: "vidrios a medida" o "corte de
  // melamina" viene escrito en el giro, no en la investigación.
  if (PRECIO_A_MEDIDA.test(`${identidad} ${texto}`)) {
    return {
      nivel: "bajo",
      motivo:
        "El precio se calcula (medidas, material, cantidad), no se consulta: ahí el asistente no cotiza, solo toma datos y deriva. Es la misma razón por la que la guía de agosto sacó a las ferreterías e imprentas de la lista. Se puede vender igual, pero rinde menos por el mismo esfuerzo — y el soporte pesa el doble.",
    };
  }

  let base: Encaje | null = null;
  for (const r of POSITIVOS) {
    if (r.patron.test(identidad)) {
      // Regla sensible al tamaño: bajo el mínimo se usa la variante chica.
      // Si no se sabe el tamaño se asume el nivel principal, porque descartar
      // por un dato que no tenemos es peor que revisarlo en la llamada.
      const chico =
        r.minEmpleados !== undefined &&
        typeof e.nEmpleados === "number" &&
        e.nEmpleados > 0 &&
        e.nEmpleados < r.minEmpleados;
      base = chico
        ? { nivel: r.nivelChico ?? "bajo", motivo: r.motivoChico ?? r.motivo, noPromover: true }
        : { nivel: r.nivel, motivo: r.motivo, noPromover: r.noPromover };
      break;
    }
  }

  if (!base) {
    // Sin rubro reconocible, pero si el nombre dice que la hora es indivisible
    // ya hay algo: el negocio agenda de a uno, que es donde la agenda rinde.
    if (agendaDeCupoUnico({ empresa: e.empresa, industria: e.industria })) {
      return {
        nivel: "medio",
        motivo:
          "El rubro no lo clasifica, pero el nombre dice que agenda de a uno (un box, una silla, un profesional). Ahí la agenda rinde al máximo y una inasistencia cuesta la hora completa. Vale mirar el sitio antes de descartarlo.",
      };
    }

    // ─────────────────────────────────────────────────────────────────────
    // EL SUPUESTO POR DEFECTO, DADO VUELTA — 26-ago-2026
    //
    // Marcelo: "podemos abarcar a todos los negocios que al final tienen
    // contacto con sus clientes por redes".
    //
    // Eso cambia la forma de la pregunta, no solo la lista. Hasta acá esto era
    // una LISTA BLANCA de rubros: lo que no estaba en la lista caía en "sin
    // evaluar", que en la práctica significaba "no lo mires". Tenía sentido
    // cuando el ICP eran cinco verticales. Con el ICP abierto, una lista
    // blanca es la estructura equivocada: el que no aparece en la lista pasa a
    // ser la mayoría, y la mayoría no puede quedar sin clasificar.
    //
    // Así que el que no calza ya no queda afuera: queda en MEDIO, que es lo
    // que de verdad sabemos de él —atiende clientes finales, probablemente por
    // mensajería— y con el motivo diciendo qué falta confirmar. Los que NO
    // sirven siguen cayendo antes, en los descartes de arriba, que es donde
    // está guardado lo que ya aprendieron vendiendo.
    //
    // "sin_evaluar" queda para un solo caso, y ahora significa algo concreto:
    // falta el dato. No es un veredicto sobre el negocio, es un pendiente
    // nuestro, y se arregla escribiendo el rubro en la ficha.
    // ─────────────────────────────────────────────────────────────────────
    if (!rubro.trim()) {
      return {
        nivel: "sin_evaluar",
        motivo:
          "Falta el rubro. No es que el negocio no encaje: es que no sabemos a qué se dedica. Escríbelo en la ficha —o pega el sitio y usa «leer sitio»— y se clasifica solo.",
      };
    }

    return {
      nivel: "medio",
      motivo:
        "Rubro fuera de las reglas conocidas. Entra en medio a propósito: casi cualquier negocio que atiende a sus clientes por WhatsApp o Instagram tiene consultas que se repiten. Lo que falta confirmar en la llamada es si ESA consulta se repite lo suficiente y si hoy la contesta una persona a mano.",
    };
  }

  // Ajuste por evidencia. Una señal a favor sube un nivel medio a alto; dos en
  // contra bajan un alto a medio. Nunca revive un descarte: si el modelo de
  // negocio no calza, que atienda por WhatsApp no lo arregla.
  const aFavor = SENALES_A_FAVOR.filter((s) => apareceAfirmado(texto, s.patron)).map((s) => s.nota);
  // Las tres señales de la guía pesan más que las genéricas: son dolor visible
  // desde afuera, verificado antes de marcar.
  const deGuia = SENALES_GUIA.filter((g) => g.patron.test(texto)).map((g) => g.nota);
  aFavor.push(...deGuia);
  const enContra = SENALES_EN_CONTRA.filter((s) => apareceAfirmado(texto, s.patron)).map((s) => s.nota);
  if (e.tieneWhatsapp && !aFavor.includes("ya atiende por WhatsApp")) aFavor.push("ya atiende por WhatsApp");

  let nivel = base.nivel;
  // Se exigen DOS señales para subir de nivel. Con una bastaba, y "concentra
  // todo en un teléfono central" ascendía a alto hasta a un club de golf.
  // Una sola señal de la guía basta para promover: son las que el equipo usa
  // para ordenar la lista antes de marcar.
  if (!base.noPromover && nivel === "medio" && enContra.length === 0 && (deGuia.length >= 1 || aFavor.length >= 2))
    nivel = "alto";

  // Y la hora indivisible promueve por sí sola: es el criterio donde la agenda
  // —lo más nuevo del producto— rinde al máximo.
  const cupoUnico = agendaDeCupoUnico({ empresa: e.empresa, industria: e.industria });
  if (!base.noPromover && nivel === "medio" && enContra.length === 0 && cupoUnico) nivel = "alto";
  if (nivel === "alto" && enContra.length >= 2) nivel = "medio";
  if (nivel === "medio" && enContra.length >= 2) nivel = "bajo";

  const extra = [
    aFavor.length ? `A favor: ${aFavor.join(", ")}.` : "",
    enContra.length ? `En contra: ${enContra.join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return { nivel, motivo: extra ? `${base.motivo} ${extra}` : base.motivo };
}
