/**
 * MOTOR DE DETECCIÓN DE RESPUESTAS Y AUTORESPONDERS — Outbound V1
 *
 * Principio Mandatorio:
 * 1. CUALQUIER RESPUESTA HUMANA DETIENE LA SECUENCIA INMEDIATAMENTE.
 *    Primero se cancelan los futuros envíos en cola; LUEGO se clasifica con IA.
 * 2. Auto-responder / Out-of-office:
 *    - Detección determinista por encabezados (Auto-Submitted, X-Autoreply) y patrones de asunto.
 *    - NO se clasifica como respuesta comercial definitiva.
 *    - Aplica política `temporary_hold` (pospone los próximos toques 5-7 días hábiles).
 * 3. Si la respuesta contiene solicitud de no contacto (opt-out), se añade a la supresión global permanente.
 */

import { type MensajeEntranteGmail } from "./gmail";
import { type OutboundStore } from "./store";
import { type ClasificacionRespuesta } from "./types";
import { geminiJson } from "../gemini";

/** Extrae email puro de un header From tipo "Nombre <x@y.cl>" */
export function extraerEmailDeHeader(fromHeader?: string): string | null {
  if (!fromHeader) return null;
  const m = fromHeader.match(/<([^>]+)>/) ?? fromHeader.match(/([^\s<>]+@[^\s<>]+)/);
  return m ? m[1].toLowerCase().trim() : null;
}

/** Detecta de forma determinista si un mensaje es un auto-responder / out-of-office */
export function esAutoresponderDeterminista(msg: MensajeEntranteGmail): boolean {
  const headers = msg.headers || {};
  const asunto = (msg.subject || "").toLowerCase();
  const snippet = (msg.snippet || "").toLowerCase();

  // 1. Encabezados estándar de auto-reply (RFC 3834)
  const autoSubmitted = headers["auto-submitted"]?.toLowerCase();
  if (autoSubmitted && autoSubmitted !== "no") return true;

  if (headers["x-autoreply"] === "yes") return true;
  if (headers["x-autorespond"] === "yes") return true;
  if (headers["precedence"] === "auto_reply" || headers["precedence"] === "bulk") return true;

  // 2. Patrones de asunto comunes en español e inglés
  const patronesAsunto = [
    "out of office",
    "automatic reply",
    "auto:",
    "auto reply",
    "respuesta automatica",
    "respuesta automática",
    "fuera de la oficina",
    "fuera de oficina",
    "de vacaciones",
    "estoy de vacaciones",
  ];
  if (patronesAsunto.some((p) => asunto.includes(p))) return true;

  // 3. Patrones en snippet
  const patronesSnippet = [
    "estoy fuera de la oficina",
    "me encuentro fuera de la oficina",
    "volveré el",
    "volvere el",
    "no tendré acceso a mi correo",
    "i am currently out of the office",
  ];
  if (patronesSnippet.some((p) => snippet.includes(p))) return true;

  return false;
}

/** Clasifica semánticamente el mensaje recibido utilizando Gemini */
export async function clasificarRespuestaIA(
  extracto: string,
  asunto: string,
): Promise<ClasificacionRespuesta> {
  // Heurística rápida determinista para opt-outs obvios
  const norm = extracto.toLowerCase();
  if (norm === "no" || norm.startsWith("no ") || norm.includes("no me interesa") || norm.includes("sacar de la lista")) {
    return "opt_out";
  }

  try {
    const prompt = `Clasifica esta respuesta a un correo de prospección comercial de Respondo (asistente de WhatsApp).
Asunto: "${asunto}"
Texto:
"""
${extracto}
"""

Responde SOLO JSON con una de estas opciones exactas:
{"clase": "positive" | "neutral" | "negative" | "later" | "opt_out" | "wrong_person" | "referral" | "autoresponder" | "unknown"}

Criterios:
- positive: pide demo, reunión, precios, muestra interés directo.
- neutral: saludo cortés, respuesta ambigua, pide más información general.
- later: pide hablar en otra fecha o mes ("háblame en octubre", "ahora no").
- opt_out: pide explícitamente no ser contactado, "no", "eliminar", "no enviar más".
- wrong_person: indica que ya no trabaja ahí o que no es la persona indicada.
- referral: deriva con el encargado ("habla con Juan al correo X").
- negative: no le interesa sin agresividad o rechazo seco.
- autoresponder: mensaje de ausencia automática.`;

    const res = await geminiJson<{ clase?: string }>(prompt, undefined, {
      temperature: 0,
      maxOutputTokens: 50,
    });

    const c = (res?.clase ?? "unknown").toLowerCase() as ClasificacionRespuesta;
    const clasesValidas: ClasificacionRespuesta[] = [
      "positive",
      "neutral",
      "negative",
      "later",
      "opt_out",
      "wrong_person",
      "referral",
      "autoresponder",
      "unknown",
    ];

    return clasesValidas.includes(c) ? c : "neutral";
  } catch {
    return "neutral";
  }
}

export interface ExtractoAutoresponderMinimizado {
  is_auto_reply: boolean;
  extractoMinimizado: string;
  sanitized_snippet: string;
  reason_category: "out_of_office" | "general";
  reasonCategory: "out_of_office" | "general";
  return_date: string | null;
  fechaRetornoEstimada: string | null;
}

/** Minimiza y sanitiza el texto de respuestas automáticas bajo Ley 21.719 */
export function minimizarExtractoAutoresponder(snippet: string): ExtractoAutoresponderMinimizado {
  let fechaRetorno: string | null = null;
  const matchFecha = snippet.match(
    /(?:de regreso|volveré|volvere|retorno|hasta el|vuelvo el)\s+([0-9]{1,2}[/-][0-9]{1,2}(?:[/-][0-9]{2,4})?|[0-9]{1,2}\s+(?:de\s+)?[a-zA-Z]+)/i,
  );
  if (matchFecha) {
    const rawFecha = matchFecha[1].trim();
    const partes = rawFecha.split(/[/-]/);
    if (partes.length === 3) {
      const dia = partes[0].padStart(2, "0");
      const mes = partes[1].padStart(2, "0");
      const anio = partes[2].length === 2 ? `20${partes[2]}` : partes[2];
      fechaRetorno = `${anio}-${mes}-${dia}`;
    } else {
      fechaRetorno = rawFecha;
    }
  }

  const sanitizado = "[Autorespuesta OOO detectada - texto personal omitido por política de minimización Ley 21.719]";

  return {
    is_auto_reply: true,
    extractoMinimizado: sanitizado,
    sanitized_snippet: sanitizado,
    reason_category: "out_of_office",
    reasonCategory: "out_of_office",
    return_date: fechaRetorno,
    fechaRetornoEstimada: fechaRetorno,
  };
}

export interface ResultadoProcesamientoRespuesta {
  procesado: boolean;
  contact_id?: string;
  tipo: "reply_humano" | "autoresponder" | "ignorado";
  clasificacion: ClasificacionRespuesta;
  secuenciaDetenida: boolean;
  motivo?: string;
}

/**
 * Procesa un mensaje entrante de Gmail:
 * - Detecta el contacto por threadId o por email.
 * - Si es respuesta humana: DETIENE LA SECUENCIA DE INMEDIATO.
 * - Si es autoresponder: Aplica temporary_hold.
 */
export async function procesarMensajeEntrante(
  msg: MensajeEntranteGmail,
  store: OutboundStore,
): Promise<ResultadoProcesamientoRespuesta> {
  const yaProcesado = await store.getReplyByGmailMessageId(msg.id);
  if (yaProcesado) {
    return {
      procesado: false,
      contact_id: yaProcesado.contact_id,
      tipo: "ignorado",
      clasificacion: yaProcesado.clasificacion_ia,
      secuenciaDetenida: yaProcesado.secuencia_detenida,
      motivo: "Mensaje Gmail ya procesado",
    };
  }

  const fromEmail = extraerEmailDeHeader(msg.from);
  if (!fromEmail) {
    return {
      procesado: false,
      tipo: "ignorado",
      clasificacion: "unknown",
      secuenciaDetenida: false,
      motivo: "No se pudo extraer remitente válido",
    };
  }

  // 1. Localizar contacto asociado
  let contact = await store.findContactByEmail(fromEmail);
  let outboxAsociadoId: string | null = null;

  // Si no se encuentra por email directo, buscar si coincide con el threadId en Outbox
  if (!contact && msg.threadId) {
    const items = await store.listOutbox();
    const outboxConThread = items.find((i) => i.gmail_thread_id === msg.threadId);
    if (outboxConThread) {
      contact = await store.getContactById(outboxConThread.contact_id);
      outboxAsociadoId = outboxConThread.id;
    }
  }

  if (!contact) {
    return {
      procesado: false,
      tipo: "ignorado",
      clasificacion: "unknown",
      secuenciaDetenida: false,
      motivo: `Remitente ${fromEmail} no coincide con ningún prospecto registrado`,
    };
  }

  // 2. Comprobar si es Auto-responder / Out of Office
  const esAuto = esAutoresponderDeterminista(msg);

  if (esAuto) {
    // POLÍTICA TEMPORARY_HOLD: No matar la secuencia comercial, pero posponer envíos 7 días
    const holdHasta = new Date(Date.now() + 7 * 86_400_000).toISOString();
    await store.updateContact(contact.id, { hold_hasta: holdHasta });

    const minInfo = minimizarExtractoAutoresponder(msg.snippet);

    await store.createReply({
      outbox_id: outboxAsociadoId,
      contact_id: contact.id,
      gmail_message_id: msg.id,
      gmail_thread_id: msg.threadId,
      from_email: fromEmail,
      subject: msg.subject,
      extracto: minInfo.extractoMinimizado,
      reason_category: minInfo.reasonCategory,
      return_date: minInfo.fechaRetornoEstimada,
      clasificacion_ia: "autoresponder",
      es_humano: false,
      es_autoresponder: true,
      secuencia_detenida: false,
    });

    await store.logEvent({
      contact_id: contact.id,
      tipo: "reply_received",
      metadata: { tipo: "autoresponder", hold_hasta: holdHasta, subject: msg.subject },
    });

    return {
      procesado: true,
      contact_id: contact.id,
      tipo: "autoresponder",
      clasificacion: "autoresponder",
      secuenciaDetenida: false,
      motivo: `Autoresponder detectado. Secuencia en hold temporal hasta ${holdHasta}`,
    };
  }

  // 3. RESPUESTA HUMANA: REGLA ABSOLUTA -> STOP SEQUENCE INMEDIATO
  // Se cancelan todos los mensajes futuros en cola de forma determinista
  const cancelados = await store.cancelPendingOutboxForContact(
    contact.id,
    `Respuesta humana recibida en hilo ${msg.threadId}`,
  );

  await store.updateContact(contact.id, {
    secuencia_pausada: true,
    secuencia_pausada_motivo: `Respuesta recibida: ${msg.subject}`,
  });

  // 4. Clasificación posterior con IA
  const clasificacion = await clasificarRespuestaIA(msg.snippet, msg.subject);

  // Si el usuario pidió explícitamente no ser contactado (opt-out)
  if (clasificacion === "opt_out") {
    await store.addSuppression({
      tipo: "email",
      valor: contact.email_normalizado,
      motivo: "opt_out",
      origen: "reply_detector",
      notas: `Solicitud en respuesta: ${msg.snippet.slice(0, 100)}`,
    });
    await store.logEvent({
      contact_id: contact.id,
      tipo: "suppressed",
      metadata: { motivo: "opt_out_en_reply", email: contact.email_normalizado },
    });
  }

  // Registrar respuesta
  await store.createReply({
    outbox_id: outboxAsociadoId,
    contact_id: contact.id,
    gmail_message_id: msg.id,
    gmail_thread_id: msg.threadId,
    from_email: fromEmail,
    subject: msg.subject,
    extracto: msg.snippet.slice(0, 500),
    clasificacion_ia: clasificacion,
    es_humano: true,
    es_autoresponder: false,
    secuencia_detenida: true,
  });

  await store.logEvent({
    contact_id: contact.id,
    tipo: "sequence_stopped",
    metadata: {
      clasificacion,
      mensajes_cancelados: cancelados,
      subject: msg.subject,
    },
  });

  return {
    procesado: true,
    contact_id: contact.id,
    tipo: "reply_humano",
    clasificacion,
    secuenciaDetenida: true,
    motivo: `Respuesta humana procesada (${clasificacion}). Secuencia detenida y ${cancelados} mensajes pendientes cancelados.`,
  };
}
