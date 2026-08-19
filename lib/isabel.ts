import { gemini } from "@/lib/gemini";
import { db } from "@/lib/db";
import { EQUIPO, SOCIOS, lunesDe } from "@/lib/equipo";
import {
  ARGUMENTO_INICIAL,
  DEFINICION_CONVERSACION,
  DIAS_PRUEBA,
  PLAN_ASISTENTES,
  PLAN_CANALES,
  PLAN_EXCEDENTE,
  PLAN_LIMITES,
  PLAN_PRECIOS,
  POLITICA_EXCEDENTE,
  PRECIO_BOT_EXTRA,
} from "@/lib/types";
import {
  ASISTENTES,
  CANALES,
  CASOS_REALES,
  CALIFICACION_ICP,
  COMPETENCIA,
  FRASE_CATEGORIA,
  NO_COTIZA,
  OBJECIONES,
  PLATAFORMA,
  PREGUNTAS_DIAGNOSTICO,
  SALVEDAD_CASOS,
} from "@/lib/venta";
import { marcadorLlamadas, saludBase } from "@/lib/metricas";

/**
 * Isabel — la 4ª empleada. El cerebro de Respondo dentro del HQ.
 *
 * QUÉ ES
 * Un chat que sabe TODO lo del negocio: precios vigentes, ICP, objeciones con
 * sus respuestas aprobadas, quién es quién en el equipo, y —esto es lo que la
 * separa de un ChatGPT genérico— el estado VIVO de la operación: cuántos leads
 * hay, quién llamó cuánto, qué hay en el pipeline y qué se comprometió cada
 * socio esta semana. Se le pregunta como a una colega que llegó primero a la
 * oficina y ya leyó todos los números.
 *
 * QUÉ NO ES
 * No ejecuta acciones (no registra llamadas, no mueve deals). Aconseja,
 * redacta y resume. La mano en la base la ponen los humanos — a propósito:
 * un chat con permiso de escritura es un dedo gordo esperando su momento.
 *
 * CÓMO OBTIENE EL CONTEXTO
 * Cada mensaje reconstruye la foto fresca de la base (4-5 consultas baratas,
 * todas con try/catch individual: si una tabla falta, Isabel pierde ESE dato
 * y lo dice — no se cae entera).
 */

export interface MensajeIsabel {
  de: "yo" | "isabel";
  texto: string;
}

const clp = (n: number) => `$${n.toLocaleString("es-CL")}`;

/** Lo que no cambia entre mensajes: el negocio en sí. */
function conocimientoBase(): string {
  const planes = (Object.keys(PLAN_PRECIOS) as (keyof typeof PLAN_PRECIOS)[])
    .map(
      (p) =>
        `- ${p}: ${clp(PLAN_PRECIOS[p].mensual)}/mes NETO (+IVA), ${PLAN_ASISTENTES[p]}, ${PLAN_CANALES[p]}, hasta ${PLAN_LIMITES[p]} conversaciones, excedente ${clp(PLAN_EXCEDENTE[p])} c/u`,
    )
    .join("\n");

  const objeciones = OBJECIONES.map((o) => `- "${o.gatillo}" → ${o.respuesta}`).join("\n");
  const icp = CALIFICACION_ICP.map((c) => `- ${c.pregunta} (✓ ${c.bueno} / ✗ ${c.malo})`).join("\n");
  const equipo = EQUIPO.map((s) => `- ${s.nombre}: ${s.rol}${SOCIOS.includes(s) ? " (socio)" : " (vendedor)"}`).join("\n");

  return `QUÉ VENDE RESPONDO (ago-2026)
NO es "un chatbot para WhatsApp" — esa frase hace que te comparen con un bot de
$15.000. Es "${FRASE_CATEGORIA.bien}": un equipo de asistentes que atiende
WhatsApp E INSTAGRAM con la información real del negocio, cotiza, agenda horas y
hace seguimiento, MÁS una plataforma donde el cliente ve, controla y mide todo.
La implementación la hace Respondo: el cliente no configura nada.
Prueba de ${DIAS_PRUEBA} días sin costo. Instalación gratis en todos los planes.
Asistente adicional sobre "Tino solo": ${clp(PRECIO_BOT_EXTRA)}/mes.
Regla comercial de fierro: NUNCA bajar el precio de un plan; se ofrece bajar de plan.

LOS CUATRO ASISTENTES
${ASISTENTES.map((a) => `- ${a.nombre} (${a.oficio}): ${a.hace}`).join("\n")}

LA PLATAFORMA
${PLATAFORMA.map((m) => `- ${m.modulo}: ${m.que}`).join("\n")}

CANALES
- WhatsApp: ${CANALES.whatsapp}
- Instagram: ${CANALES.instagram}

CASOS REALES (decirlos SIEMPRE con la salvedad)
${CASOS_REALES.map((c) => `- ${c.cliente} (${c.rubro}): ${c.dato}`).join("\n")}
${SALVEDAD_CASOS}

DÓNDE NO COTIZA
${NO_COTIZA}

COMPETENCIA
${COMPETENCIA.map((c) => `- ${c.quien}: ${c.que} → "${c.respuesta}"`).join("\n")}

REGLAS DE PRECIO
${ARGUMENTO_INICIAL}
${DEFINICION_CONVERSACION}
${POLITICA_EXCEDENTE}
Los precios se dicen SIEMPRE "más IVA", nunca redondeados.

PLANES VIGENTES (aprobados 12-ago-2026)
${planes}

EQUIPO
${equipo}

ICP — CHECKLIST DE CALIFICACIÓN
${icp}

OBJECIONES Y RESPUESTAS APROBADAS (usar estas, no inventar otras)
${objeciones}

PREGUNTAS DE DIAGNÓSTICO PARA LA LLAMADA
${PREGUNTAS_DIAGNOSTICO.map((p) => `- ${p}`).join("\n")}

PROTOCOLO DE REUNIÓN AGENDADA (está en Pipeline → botón "Reunión")
Al agendar se programan CUATRO recordatorios, siempre: apenas se agenda, el
día antes ~15:00, 45 minutos antes (se salta si la reunión es 9:00-9:30) y 3
minutos antes con el link. Si salió en frío (WhatsApp/llamada), además hay que
bajar la reunión al mail con el asunto "Reunión [Empresa] - [Nombre]". El
no-show es la forma más cara de perder una reunión que costó decenas de
llamadas.

SECUENCIA DE CORREOS EN FRÍO (está en Leads Foco → "Secuencia de correos")
3 correos: día 1, día 3-4 y día 7-8 (el tercero con asunto único). Hay copy
escrito para SEIS verticales, con clientes reales de referencia:
· Clínicas dentales (+17: Odontoandrauss, Zenith, CREB, TriniDent)
· Clínicas estéticas y salud (+12: Velours, Renuva, Biolaser, Thaya Clinic Spa)
· Automotoras y repuestos (+18: Motorman, Montiel, Motorland, Codas)
· Inmobiliarias (+15: EYDISA, Nueva Alianza, Ariza, Mersan, Propiver)
· Gimnasios y centros boutique (+20: Ytororō, Infinity Pilates, Fit Wise, Qanttum)
Para un rubro sin secuencia escrita NO se improvisa copy: se llama, o se
escribe el correo a mano. Inventar referencias de clientes sería mentir.

LA PRUEBA DE CONCEPTO (lo que se promete en los 18 correos)
Prueba de concepto personalizada de DOS SEMANAS, sin costo, automatizando un
proceso real del negocio. Se registra en el Pipeline al editar el deal: fecha
de inicio, término (se calcula solo, +14 días) y resultado. Si vence sin
resultado, la tarjeta lo avisa en rojo — una demo que se apaga sola es un
prospecto que se enfría sin que nadie se entere.

LOS DOS MOTORES DE PROSPECCIÓN
1. Llamadas del día: micro-pymes de Google Maps, número del local, volumen.
2. Leads Foco: empresas de 20-150 trabajadores con decisor identificado.
   Encaje = si el rubro/forma de operar calza con Respondo. Regla TGP: 3
   llamadas sin contestar y el lead se retira solo. Éxito → deal en Pipeline.`;
}

/**
 * La foto viva. Los 4 bloques corren EN PARALELO y cada uno falla por
 * separado. En serie sumaban ~2-3 s de latencia extra por mensaje — que se
 * siente exactamente como "Isabel es lenta", cuando la lenta era la espera
 * de consultas que no dependían entre sí.
 */
async function fotoViva(): Promise<string> {
  const s = db();

  const base = saludBase()
    .then(
      (b) =>
        `BASE: llamadas-día ${b.llamadas.total} prospectos (${b.llamadas.elegibles} elegibles hoy, ${b.llamadas.dormidos} dormidos 14+d, ${b.llamadas.quemados} quemados) · foco ${b.foco.total} leads (${b.foco.trabajables} trabajables, ${b.foco.porInvestigar} por investigar, ${b.foco.retirados} retirados) · ${b.suprimidos} números suprimidos.`,
    )
    .catch(() => "BASE: sin acceso ahora.");

  const marcador = marcadorLlamadas(7)
    .then((m) => {
      const filas = m.filas
        .filter((f) => f.llamadas > 0)
        .map((f) => `${f.persona} ${f.llamadas} llamadas/${f.contestaron} contestadas/${f.reuniones} reuniones`);
      return `MARCADOR 7 DÍAS: ${filas.length ? filas.join(" · ") : "sin llamadas registradas"}.`;
    })
    .catch(() => "MARCADOR: sin acceso ahora.");

  const pipeline = s
    .from("deals")
    .select("nombre_negocio,etapa,valor_mensual,proxima_accion")
    .in("etapa", ["contactado", "demo", "propuesta"])
    .then(({ data }) => {
      const d = (data ?? []) as { nombre_negocio: string; etapa: string; proxima_accion: string | null }[];
      return d.length
        ? `PIPELINE ABIERTO (${d.length}): ${d.map((x) => `${x.nombre_negocio} [${x.etapa}${x.proxima_accion ? ` → ${x.proxima_accion}` : ""}]`).join(" · ")}.`
        : "PIPELINE: vacío.";
    })
    .then((x) => x, () => "PIPELINE: sin acceso ahora.");

  const objetivos = s
    .from("objetivos_semana")
    .select("socio,objetivo,estado")
    .eq("semana", lunesDe())
    .then(({ data }) => {
      const o = (data ?? []) as { socio: string; objetivo: string; estado: string }[];
      return o.length
        ? `OBJETIVOS DE ESTA SEMANA: ${o.map((x) => `${x.socio}: "${x.objetivo}" (${x.estado})`).join(" · ")}.`
        : "OBJETIVOS DE ESTA SEMANA: todavía no se cargan.";
    })
    .then((x) => x, () => "OBJETIVOS: sin acceso ahora.");

  return (await Promise.all([base, marcador, pipeline, objetivos])).join("\n");
}

/**
 * El límite de historia NO es cosmético: cada mensaje viaja completo a la API
 * y una conversación de semanas reventaría el contexto (y la cuota) sin que
 * nadie sepa por qué Isabel se puso lenta y cara.
 */
const MAX_HISTORIA = 16;
const MAX_LARGO_MSG = 2000;

export async function responderIsabel(historia: MensajeIsabel[], actor?: string): Promise<string> {
  const hoy = new Date().toLocaleDateString("es-CL", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "America/Santiago",
  });

  const recorte = historia.slice(-MAX_HISTORIA).map((m) => ({
    de: m.de,
    texto: String(m.texto).slice(0, MAX_LARGO_MSG),
  }));

  // Isabel sabe con QUIÉN habla: el nombre viene del mismo selector "¿Quién
  // llama?" del resto del HQ. Cambia el consejo — a Amaro se le prepara la
  // llamada; a Marcelo se le habla de producto.
  const quien = actor && actor.trim() ? actor.trim().slice(0, 40) : "Equipo";
  const conversacion = recorte
    .map((m) => (m.de === "yo" ? `[${quien}]: ${m.texto}` : `[Isabel]: ${m.texto}`))
    .join("\n");

  const prompt = `Eres Isabel, la cuarta integrante del equipo de Respondo — la empleada de IA
que la empresa usa internamente y que no suele ofrecer a clientes. Eres el
cerebro de la operación: conoces cada número, cada precio y cada guion.

Estás conversando con ${quien}. PERSONALIDAD: chilena, directa y cálida. Cero jerga corporativa. Respondes
corto y accionable (2-6 frases la mayoría de las veces; más solo si piden un
texto redactado o un análisis). Tuteas. Puedes tener opinión y recomendar con
firmeza. Si un dato no está en tu contexto, lo dices derecho ("eso no lo tengo
a la vista") en vez de inventarlo — inventar números en una empresa que vende
IA honesta sería el peor chiste.

PUEDES: aconsejar sobre ventas y prospección, redactar mensajes de WhatsApp o
correos, preparar llamadas (gancho de apertura, objeciones probables), resumir
el estado de la operación con los datos vivos, ayudar a decidir prioridades.
NO PUEDES: registrar llamadas, mover deals ni tocar la base — eso se hace en
las pantallas del HQ, y si te lo piden, indica en qué pantalla se hace.

HOY ES: ${hoy}.

======= CONOCIMIENTO DEL NEGOCIO =======
${conocimientoBase()}

======= FOTO VIVA DE LA OPERACIÓN (recién consultada) =======
${await fotoViva()}

======= CONVERSACIÓN =======
${conversacion}
[Isabel]:`;

  const texto = await gemini(prompt, undefined, {
    temperature: 0.7,
    maxOutputTokens: 1400,
    // Igual que TODOS los demás usos de Gemini en HQ: sin razonamiento
    // interno. En los modelos 2.5 el "thinking" se descuenta de
    // maxOutputTokens — con presupuesto libre, una respuesta larga podía
    // volver truncada o vacía tras haberse gastado el tope en pensar.
    thinkingConfig: { thinkingBudget: 0 },
  });
  return texto.trim() || "Me quedé en blanco un segundo — ¿me lo repites?";
}
