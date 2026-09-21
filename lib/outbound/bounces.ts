/**
 * MOTOR DE DETECCIÓN DEFENSIVA DE REBOTES (NDR / BOUNCES) — Outbound V1
 *
 * Principio:
 * - Best-effort y defensivo: No asumir formatos idénticos entre servidores SMTP.
 * - Alta certeza de Hard Bounce (550, 5.1.1, User Unknown):
 *   -> Invalida contacto (`verificacion_estado = invalid`), detiene secuencia y añade a supresiones.
 * - Soft Bounce o Incertidumbre (Mailbox full, 452, Timeout):
 *   -> Registra evento, no destruye el dato ni suprime automáticamente.
 */

import { type MensajeEntranteGmail } from "./gmail";
import { type OutboundStore } from "./store";
import { type TipoBounce, type ClasificacionBounce, type BounceEvent } from "./types";

export interface DiagnosticoBounce {
  esBounce: boolean;
  tipo: TipoBounce;
  clasificacion: ClasificacionBounce;
  esHard: boolean;
  diagnostico: string;
  emailDestinatarioRebotado?: string | null;
}

/** Extrae el correo del destinatario que rebotó a partir del cuerpo o headers del NDR */
export function extraerDestinatarioRebotado(msg: MensajeEntranteGmail): string | null {
  const texto = (msg.snippet + " " + (msg.rawBody ?? "")).toLowerCase();

  // Patrones típicos de NDR: "Final-Recipient: rfc822; user@dominio.cl" o "Failed Recipient: user@dominio.cl"
  const matchFinal = texto.match(/final-recipient:\s*rfc822;\s*([^\s;]+@[^\s;]+)/i);
  if (matchFinal) return matchFinal[1].trim();

  const matchFailed = texto.match(/failed recipient:\s*([^\s;]+@[^\s;]+)/i);
  if (matchFailed) return matchFailed[1].trim();

  const matchTo = texto.match(/to:\s*<([^\s;]+@[^\s;]+)>/i);
  if (matchTo) return matchTo[1].trim();

  // Fallback: busca direcciones de email en el texto que no sean de postmaster / mailer-daemon
  const emails = texto.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? [];
  for (const em of emails) {
    const norm = em.toLowerCase().trim();
    if (
      !norm.includes("mailer-daemon") &&
      !norm.includes("postmaster") &&
      !norm.includes("googlemail") &&
      !norm.includes("google.com")
    ) {
      return norm;
    }
  }

  return null;
}

/**
 * Analiza defensivamente si un mensaje entrante corresponde a un rebote (NDR)
 */
export function analizarMensajeRebote(msg: MensajeEntranteGmail): DiagnosticoBounce {
  const from = msg.from.toLowerCase();
  const subject = msg.subject.toLowerCase();
  const snippet = msg.snippet.toLowerCase();

  // 1. Identificar si proviene de un Mailer-Daemon o Postmaster
  const esRemitenteNDR =
    from.includes("mailer-daemon") ||
    from.includes("postmaster") ||
    from.includes("mail delivery subsystem");

  const esAsuntoNDR =
    subject.includes("delivery status notification") ||
    subject.includes("undelivered mail") ||
    subject.includes("mail delivery failed") ||
    subject.includes("failure notice") ||
    subject.includes("returned mail");

  if (!esRemitenteNDR && !esAsuntoNDR) {
    return {
      esBounce: false,
      tipo: "unknown",
      clasificacion: "UNKNOWN",
      esHard: false,
      diagnostico: "No es un mensaje de notificación de entrega",
    };
  }

  const contenido = `${subject} ${snippet}`;
  const destinatario = extraerDestinatarioRebotado(msg);

  // 1. SENDER_OR_POLICY_REJECTION: Rechazo por infraestructura, autenticación o política de spam
  // (SPF, DKIM, DMARC, IP blacklisted, spamhaus, throttling, reputación del sender)
  // Acción: NO invalidar contacto, NO suprimir permanentemente. Alerta de infraestructura.
  const patronesPolicy = [
    "554",
    "5.7.1",
    "5.7.26",
    "blocked by policy",
    "spamhaus",
    "blacklist",
    "access denied",
    "spf",
    "dkim",
    "dmarc",
    "policy rejection",
    "policy failed",
    "sender denied",
    "message rejected due to",
    "authentication required",
    "authentication checks",
    "reputation",
  ];

  if (patronesPolicy.some((p) => contenido.includes(p))) {
    return {
      esBounce: true,
      tipo: "blocked",
      clasificacion: "SENDER_OR_POLICY_REJECTION",
      esHard: false, // CRÍTICO: NO es culpa del destinatario -> no es hard bounce del lead
      diagnostico: "Rechazado por política/infraestructura del remitente o filtro anti-spam (Policy/Sender Rejection). Lead intacto.",
      emailDestinatarioRebotado: destinatario,
    };
  }

  // 2. RECIPIENT_INVALID: Cuenta/usuario o dirección inexistente
  // Acción: invalidar email, detener secuencia y supresión permanente
  const patronesRecipientInvalid = [
    "5.1.1",
    "5.1.2",
    "5.4.1",
    "user unknown",
    "user not found",
    "no such user",
    "recipient address rejected",
    "mailbox unavailable",
    "does not exist",
    "address rejected",
    "invalid recipient",
    "recipient not found",
    "account that you tried to reach does not exist",
  ];

  const tiene550Invalido = contenido.includes("550") && (
    contenido.includes("user") ||
    contenido.includes("mailbox") ||
    contenido.includes("recipient") ||
    contenido.includes("account") ||
    contenido.includes("unknown") ||
    contenido.includes("not found")
  );

  if (patronesRecipientInvalid.some((p) => contenido.includes(p)) || tiene550Invalido) {
    return {
      esBounce: true,
      tipo: "hard",
      clasificacion: "RECIPIENT_INVALID",
      esHard: true,
      diagnostico: "Dirección o usuario inexistente / rechazado permanentemente por el servidor destino (Recipient Invalid).",
      emailDestinatarioRebotado: destinatario,
    };
  }

  // 3. SOFT_BOUNCE: Buzón lleno o problema transitorio de entrega (4.X.X, 452, 4.2.2)
  const patronesSoft = ["452", "4.2.2", "mailbox full", "quota exceeded", "temporarily deferred", "450", "timeout", "try again later"];
  if (patronesSoft.some((p) => contenido.includes(p))) {
    return {
      esBounce: true,
      tipo: "mailbox_full",
      clasificacion: "SOFT_BOUNCE",
      esHard: false,
      diagnostico: "Soft Bounce: buzón temporalmente lleno o servidor diferido.",
      emailDestinatarioRebotado: destinatario,
    };
  }

  // 4. UNKNOWN: Notificación de entrega indeterminada
  return {
    esBounce: true,
    tipo: "unknown",
    clasificacion: "UNKNOWN",
    esHard: false,
    diagnostico: "Notificación de entrega indeterminada. Clasificada como unknown para revisión conservadora.",
    emailDestinatarioRebotado: destinatario,
  };
}

/**
 * Procesa un posible mensaje de rebote en el sistema
 */
export async function procesarRebote(
  msg: MensajeEntranteGmail,
  store: OutboundStore,
): Promise<{
  esBounce: boolean;
  tipo?: TipoBounce;
  clasificacion?: ClasificacionBounce;
  contact_id?: string;
  accionTomada?: string;
  contactoInvalidado?: boolean;
}> {
  const diag = analizarMensajeRebote(msg);
  if (!diag.esBounce) {
    return { esBounce: false };
  }

  // Intentar localizar el contacto rebotado
  let contact = null;
  if (diag.emailDestinatarioRebotado) {
    contact = await store.findContactByEmail(diag.emailDestinatarioRebotado);
  }

  // Si no se ubicó por email, buscar por threadId en outbox
  if (!contact && msg.threadId) {
    const items = await store.listOutbox();
    const outboxConThread = items.find((i) => i.gmail_thread_id === msg.threadId);
    if (outboxConThread) {
      contact = await store.getContactById(outboxConThread.contact_id);
    }
  }

  let accion = "Rebote registrado como evento";

  if (contact) {
    if (diag.clasificacion === "RECIPIENT_INVALID") {
      // 1. RECIPIENT_INVALID -> Invalida contacto, cancela secuencia y añade a supresiones
      await store.updateContact(contact.id, {
        verificacion_estado: "invalid",
        secuencia_pausada: true,
        secuencia_pausada_motivo: `Recipient Invalid: ${diag.diagnostico}`,
      });

      await store.cancelPendingOutboxForContact(contact.id, `Recipient Invalid detectado: ${diag.diagnostico}`);

      await store.addSuppression({
        tipo: "email",
        valor: contact.email_normalizado,
        motivo: "hard_bounce",
        origen: "bounce_detector",
        notas: diag.diagnostico,
      });

      accion = "RECIPIENT_INVALID: Contacto invalidado, secuencia cancelada y supresión permanente añadida.";
    } else if (diag.clasificacion === "SENDER_OR_POLICY_REJECTION") {
      // 2. SENDER_OR_POLICY_REJECTION -> Alerta de infraestructura.
      // NO invalidar el contacto. NO suprimir permanentemente.
      // Se pausa la secuencia por prudencia técnica para investigar SPF/DKIM/reputación.
      await store.updateContact(contact.id, {
        secuencia_pausada: true,
        secuencia_pausada_motivo: `Pausa preventiva por rechazo de política/infraestructura del remitente: ${diag.diagnostico}`,
      });

      await store.cancelPendingOutboxForContact(
        contact.id,
        `Pausa preventiva por rechazo de política del servidor: ${diag.diagnostico}`,
      );

      accion = "SENDER_OR_POLICY_REJECTION: Alerta de infraestructura registrada. Contacto preservado y NO suprimido.";
    } else if (diag.clasificacion === "SOFT_BOUNCE") {
      // 3. SOFT BOUNCE -> Buzón lleno o timeout. Aplicar hold temporal sin invalidar ni suprimir.
      const holdHasta = new Date(Date.now() + 3 * 86_400_000).toISOString();
      await store.updateContact(contact.id, { hold_hasta: holdHasta });
      accion = `SOFT_BOUNCE: Buzón lleno/error temporal. Secuencia en hold temporal hasta ${holdHasta}. Contacto preservado.`;
    } else {
      // 4. UNKNOWN -> Registrar para monitoreo sin efectos destructivos.
      accion = "UNKNOWN: Rebote indeterminado registrado para revisión conservadora.";
    }

    await store.logEvent({
      contact_id: contact.id,
      tipo: "bounced",
      metadata: {
        tipo: diag.tipo,
        clasificacion: diag.clasificacion,
        esHard: diag.esHard,
        diagnostico: diag.diagnostico,
        email: contact.email_normalizado,
      },
    });
  }

  return {
    esBounce: true,
    tipo: diag.tipo,
    clasificacion: diag.clasificacion,
    contact_id: contact?.id,
    accionTomada: accion,
    contactoInvalidado: diag.clasificacion === "RECIPIENT_INVALID",
  };
}
