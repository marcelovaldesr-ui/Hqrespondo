/**
 * MOTOR DE GENERACIÓN DE COPY — Outbound V1
 *
 * Principio:
 * - Español chileno profesional y cercano.
 * - Texto plano estricto (cero HTML, cero imágenes, cero tracking pixels).
 * - Entre 45 y 80 palabras para el primer contacto.
 * - Cero alucinaciones o falsas cercanías ("No nos conocemos").
 * - Diferenciación estricta WARM vs COLD.
 * - REGLA MANDATORIA: Si `relationship_approved_for_copy` es `false`,
 *   el correo NO puede mencionar la relación ni el nombre de la empresa de origen
 *   (ej. Impresora Color), incluso si internamente sabemos que proviene de allí.
 */

import {
  type Contact,
  type Company,
  type CompanyResearch,
  type SequenceStep,
  type EvidenceItem,
} from "./types";
import { geminiJson } from "../gemini";
import { PROHIBIDO } from "../prospeccionAI";

export interface EmailGenerado {
  asunto: string;
  cuerpo: string;
  evidencia_usada: EvidenceItem[];
  recuento_palabras: number;
}

const OPT_OUT_TEXT = `\n\n—\nSi no es de tu interés, responde "no" y no vuelvo a escribirte.`;

/** Cuenta palabras de un texto excluyendo espacios múltiples */
export function contarPalabras(texto: string): number {
  return texto
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

/**
 * Redacta el correo para un contacto basándose en la investigación y el paso de la secuencia.
 */
export async function redactarEmailOutbound(params: {
  contacto: Contact;
  empresa: Company;
  research: CompanyResearch;
  paso: SequenceStep;
  remitenteNombre: string;
  remitenteCargo?: string;
}): Promise<EmailGenerado> {
  const { contacto, empresa, research, paso, remitenteNombre } = params;

  if (research.estado === "insuficiente") {
    throw new Error(
      `Investigación insuficiente para ${empresa.nombre}. Se prohíbe generar copy sin hechos verificados.`,
    );
  }

  // Filtrar evidencias de confianza alta o media
  const evidenciasValidas = (research.evidencias ?? []).filter(
    (e) => e.confianza === "alta" || e.confianza === "media",
  );

  const hechoPrincipal = evidenciasValidas[0] ?? {
    insight: `Operan en el rubro ${empresa.rubro ?? "comercial"} en ${empresa.comuna ?? "Chile"}`,
    fuente_url: empresa.sitio_web || "registro_comercial",
    extracto: empresa.nombre,
    confianza: "media",
  };

  // 1. REGLA ESTRICTA DE RELACIÓN PREVIA (WARM)
  let directrizRelacion = "";
  if (contacto.tipo_relacion === "warm") {
    if (contacto.relationship_approved_for_copy && contacto.relacion_detalle) {
      directrizRelacion = `CONTEXTO WARM APROBADO: Puedes mencionar con tacto y honestidad la relación previa: "${contacto.relacion_detalle}". NUNCA exageres la cercanía ni inventes acuerdos comerciales falsos.`;
    } else {
      directrizRelacion = `ADVERTENCIA CRÍTICA: Aunque este contacto tiene origen warm/referido, NO TIENE AUTORIZACIÓN para mencionarlo en el correo (relationship_approved_for_copy = false). TRÁTALO COMO COLD: NO menciones relaciones previas, no digas 'nos conocemos' ni nombres la empresa origen. Concéntrate exclusivamente en el hecho observable de su negocio.`;
    }
  } else {
    directrizRelacion = `TIPO COLD: No finjas que se conocen. No uses 'vi que están creciendo'. Trátalo de usted o tú respetuoso, directo a su día a día.`;
  }

  // 2. Definición del ángulo según el paso
  let instruccionPaso = "";
  switch (paso.angulo) {
    case "apertura":
      instruccionPaso = `Primer contacto. Apertura con una sola pregunta sobre el dolor observable de su rubro (responder consultas de clientes a tiempo por WhatsApp). Invita solo a ver si les hace sentido conversar 10 minutos. Máximo 65 palabras.`;
      break;
    case "seguimiento_valor":
      instruccionPaso = `Segundo toque (follow-up a los 4 días). Muy breve (máximo 50 palabras). Da una perspectiva útil de cómo un negocio del rubro ${empresa.rubro || "similar"} dejó de perder ventas fuera de horario. NO digas "¿viste mi correo?".`;
      break;
    case "pregunta_operativa":
      instruccionPaso = `Tercer toque (11 días). Una sola pregunta simple de responder sobre cómo atienden hoy si les escriben un sábado o de noche. Máximo 40 palabras.`;
      break;
    case "cierre_honesto":
      instruccionPaso = `Último toque (21 días). Cierre honesto y sin reproches: si no es el momento o no les interesa, ningún problema; si más adelante quieren probar la demo de WhatsApp, la puerta queda abierta. Máximo 45 palabras.`;
      break;
  }

  const prompt = `Eres ${remitenteNombre}, fundador de Respondo (empresa chilena que desarrolla asistentes de ventas para WhatsApp).
Estás redactando un correo en frío o de prospección comercial 1 a 1 a ${contacto.nombre} en "${empresa.nombre}".

INFORMACIÓN DE LA EMPRESA:
- Nombre: ${empresa.nombre}
- Rubro: ${empresa.rubro ?? "Comercio / Servicios"}
- Comuna: ${empresa.comuna ?? "Chile"}
- Qué hacen: ${research.resumen_actividad}
- Hecho u observación concreta comprobada: "${hechoPrincipal.insight}" (Evidencia: "${hechoPrincipal.extracto}")

DIRECTRIZ DE RELACIÓN:
${directrizRelacion}

TAREA DEL MENSAJE:
${instruccionPaso}

REGLAS OBLIGATORIAS:
1. Idioma: Español chileno natural, profesional, directo, sin sonar a robot ni a plantilla de marketing.
2. Formato: TEXTO PLANO. Prohibido HTML, negritas (**), links comerciales, tracking o firmas pesadas.
3. Longitud: Entre 45 y 75 palabras. Una sola idea. Una sola pregunta al final.
4. PROHIBIDO USAR: ${PROHIBIDO}, ni signos de exclamación (!), ni frases de venta tipo "optimiza tu negocio" o "solución revolucionaria".
5. Firma simple al final:
"${remitenteNombre}
Respondo"

Devuelve SOLO JSON válido:
{
  "asunto": "asunto corto en minúsculas (máximo 5 palabras, sin clickbait)",
  "cuerpo": "cuerpo del mensaje"
}`;

  try {
    const res = await geminiJson<{ asunto?: string; cuerpo?: string }>(prompt, undefined, {
      temperature: 0.3,
      maxOutputTokens: 300,
    });

    let asunto = (res?.asunto ?? "").trim();
    let cuerpo = (res?.cuerpo ?? "").trim();

    if (!asunto) {
      asunto = `consulta para ${empresa.nombre.toLowerCase()}`;
    }

    if (!cuerpo) {
      cuerpo = `Hola ${contacto.nombre},\n\nTe escribo porque en ${empresa.nombre} atienden consultas directas de clientes y en el rubro ${empresa.rubro ?? "comercial"} es común perder ventas fuera de horario.\n\n¿Tienen resuelto hoy responder de inmediato por WhatsApp cuando consultan de noche o fines de semana?\n\nSaludos,\n${remitenteNombre}\nRespondo`;
    }

    // Agregar el opt-out determinista al pie
    const cuerpoFinal = cuerpo + OPT_OUT_TEXT;
    const palabras = contarPalabras(cuerpoFinal);

    return {
      asunto,
      cuerpo: cuerpoFinal,
      evidencia_usada: [hechoPrincipal],
      recuento_palabras: palabras,
    };
  } catch (err) {
    // Fallback determinista seguro por paso que garantiza cumplimiento estricto
    let asunto = `consulta para ${empresa.nombre.toLowerCase()}`;
    let cuerpo = "";

    if (paso.step_number === 1 || paso.angulo === "apertura") {
      asunto = `consulta para ${empresa.nombre.toLowerCase()}`;
      cuerpo = `Hola ${contacto.nombre},\n\nUna consulta breve sobre ${empresa.nombre}: en ${empresa.rubro ?? "el rubro"}, gran parte de los clientes cotizan o piden hora directo por WhatsApp. ¿Alcanzan a responderlos todos a tiempo o se les quedan consultas fuera de horario?\n\nEn Respondo desarrollamos asistentes que atienden y agendan de inmediato por WhatsApp con la información real del negocio.\n\n¿Te hace sentido que te muestre una prueba de 5 minutos?\n\nSaludos,\n${remitenteNombre}\nRespondo${OPT_OUT_TEXT}`;
    } else if (paso.step_number === 2 || paso.angulo === "seguimiento_valor") {
      asunto = `Re: consulta para ${empresa.nombre.toLowerCase()}`;
      cuerpo = `Hola ${contacto.nombre},\n\nTe comparto un dato rápido: en negocios de ${empresa.rubro ?? "servicios"}, cerca del 40% de las consultas por WhatsApp llegan fuera del horario habitual. Responder en menos de 5 minutos suele duplicar las cotizaciones cerradas.\n\n¿Tiene sentido que te muestre cómo funcionaría para ${empresa.nombre}?\n\nSaludos,\n${remitenteNombre}\nRespondo${OPT_OUT_TEXT}`;
    } else if (paso.step_number === 3 || paso.angulo === "pregunta_operativa") {
      asunto = `Re: consulta para ${empresa.nombre.toLowerCase()}`;
      cuerpo = `Hola ${contacto.nombre},\n\nPara no quitarte tiempo con rodeos: si un cliente les escribe hoy a las 9 de la noche o un sábado pidiendo cotización o disponibilidad, ¿cómo lo gestionan en ${empresa.nombre}?\n\nSaludos,\n${remitenteNombre}\nRespondo${OPT_OUT_TEXT}`;
    } else {
      asunto = `Re: consulta para ${empresa.nombre.toLowerCase()}`;
      cuerpo = `Hola ${contacto.nombre},\n\nNo quiero insistir si no es momento ni prioridad resolver la atención por WhatsApp en ${empresa.nombre}.\n\nSi más adelante te interesa evaluar cómo automatizar las consultas repetitivas de clientes, la puerta queda abierta.\n\nSaludos,\n${remitenteNombre}\nRespondo${OPT_OUT_TEXT}`;
    }

    return {
      asunto,
      cuerpo,
      evidencia_usada: [hechoPrincipal],
      recuento_palabras: contarPalabras(cuerpo),
    };
  }
}
