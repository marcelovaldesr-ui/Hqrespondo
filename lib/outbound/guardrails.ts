/**
 * GUARDRAILS DE SEGURIDAD Y VALIDACIÓN PRE-SEND — Outbound V1
 *
 * El corazón de la seguridad del sistema.
 * Antes de que un mensaje salga hacia Gmail o n8n, se ejecuta esta validación ATÓMICA.
 *
 * Resuelve la carrera crítica:
 * 09:00 - Seguimiento en cola
 * 09:02 - Prospecto responde
 * 09:03 - Worker intenta enviar -> PRE-SEND CHECK RECHAZA EL ENVÍO y cancela la secuencia.
 */

import { type OutboxItem, type OutboundSender, type OutboundDomain, type Campaign, type Contact } from "./types";
import { type OutboundStore, calcularHashCopy } from "./store";
import { evaluarCapacidadSender, evaluarCapacidadDominio } from "./senders";
import { verificarFrescuraHiloEnGmail } from "./gmail";
import { OUTBOUND_DOMAIN } from "./config";

export interface ResultadoPreSendCheck {
  autorizado: boolean;
  motivoBloqueo?: string;
  accionRequerida?: "cancelar_secuencia" | "marcar_suprimido" | "pausar_cola" | "posponer";
  esDryRun?: boolean;
}

/** Configuración de guardrails globales */
export function obtenerConfigSeguridad(): {
  outboundEnabled: boolean;
  dryRun: boolean;
} {
  const envEnabled = process.env.OUTBOUND_ENABLED;
  const envDryRun = process.env.DRY_RUN;

  return {
    // Por defecto apagado por seguridad estricta
    outboundEnabled: envEnabled === "true",
    // Por defecto en modo dry-run por seguridad estricta
    dryRun: envDryRun !== "false",
  };
}

/**
 * VALIDACIÓN PREVIA AL ENVÍO (Pre-Send Check)
 * Se ejecuta milisegundos antes del envío real. Revalida en vivo todas las condiciones.
 */
export async function validarAntesDeEnvio(params: {
  store: OutboundStore;
  outboxItem: OutboxItem;
  workerId: string;
}): Promise<ResultadoPreSendCheck> {
  const { store, outboxItem } = params;
  const config = obtenerConfigSeguridad();

  // 1. GLOBAL KILL SWITCH
  if (!config.outboundEnabled) {
    return {
      autorizado: false,
      motivoBloqueo: "GLOBAL KILL SWITCH ACTIVO: OUTBOUND_ENABLED=false. Envío abortado.",
      accionRequerida: "pausar_cola",
    };
  }

  // 2. Comprobar contacto
  const contact = await store.getContactById(outboxItem.contact_id);
  if (!contact) {
    return {
      autorizado: false,
      motivoBloqueo: `Contacto ${outboxItem.contact_id} no encontrado en base de datos.`,
      accionRequerida: "cancelar_secuencia",
    };
  }

  // 3. Comprobar si la secuencia del contacto está pausada o en hold
  if (contact.secuencia_pausada) {
    return {
      autorizado: false,
      motivoBloqueo: `Secuencia del contacto pausada: ${contact.secuencia_pausada_motivo}`,
      accionRequerida: "cancelar_secuencia",
    };
  }

  if (contact.hold_hasta && new Date(contact.hold_hasta).getTime() > Date.now()) {
    return {
      autorizado: false,
      motivoBloqueo: `Contacto en hold temporal (autoresponder/vacaciones) hasta ${contact.hold_hasta}`,
      accionRequerida: "posponer",
    };
  }

  // 4. SUPRESIÓN PERMANENTE (Revalidar email y dominio)
  const comp = await store.getCompanyById(outboxItem.company_id);
  const supCheck = await store.isSuppressed(contact.email_normalizado, comp?.dominio_web ?? undefined);
  if (supCheck.suppressed) {
    await store.cancelPendingOutboxForContact(contact.id, `Supresión detectada: ${supCheck.reason}`);
    return {
      autorizado: false,
      motivoBloqueo: `Contacto o dominio suprimido: ${supCheck.reason}`,
      accionRequerida: "marcar_suprimido",
    };
  }

  // 5. CASO CRÍTICO: ¿Llegó alguna respuesta previa en este hilo o de este contacto?
  // Se consultan las respuestas registradas para este contacto
  const replies = await store.listReplies();
  const contactoRespondio = replies.some(
    (r) => r.contact_id === contact.id || r.from_email.toLowerCase().trim() === contact.email_normalizado,
  );
  if (contactoRespondio) {
    await store.cancelPendingOutboxForContact(
      contact.id,
      "Respuesta recibida mientras el mensaje estaba en cola (Reply While Queued).",
    );
    await store.updateContact(contact.id, {
      secuencia_pausada: true,
      secuencia_pausada_motivo: "Respuesta recibida",
    });
    return {
      autorizado: false,
      motivoBloqueo: "CARRERA EVITADA: El prospecto ya respondió. Secuencia cancelada inmediatamente.",
      accionRequerida: "cancelar_secuencia",
    };
  }

  // 6. Verificación de email: No enviar a inválidos ni desechables; posponer si falló verificación
  if (contact.verificacion_estado === "invalid" || contact.verificacion_estado === "disposable") {
    await store.cancelPendingOutboxForContact(contact.id, `Email verificado como ${contact.verificacion_estado}.`);
    return {
      autorizado: false,
      motivoBloqueo: `Email marcado como ${contact.verificacion_estado}. No se envía.`,
      accionRequerida: "cancelar_secuencia",
    };
  }

  if (contact.verificacion_estado === "verification_failed") {
    return {
      autorizado: false,
      motivoBloqueo: "Fallo transitorio en la verificación de email. Reintentar verificación antes de despachar.",
      accionRequerida: "posponer",
    };
  }

  // 7. Campaña activa y Review Mode
  const campana = await store.getCampaignById(outboxItem.campaign_id);
  if (!campana || !campana.activa) {
    return {
      autorizado: false,
      motivoBloqueo: `Campaña ${outboxItem.campaign_id} inactiva o no encontrada.`,
      accionRequerida: "posponer",
    };
  }

  // REVIEW MODE MANDATORIO: Ningún ítem en pending_review puede despacharse sin aprobación
  if (campana.review_mode) {
    if (outboxItem.estado === "pending_review") {
      return {
        autorizado: false,
        motivoBloqueo: "REVIEW MODE ACTIVO: El mensaje requiere aprobación humana antes de despacharse.",
        accionRequerida: "posponer",
      };
    }

    // Comprobación de auditoría y no-modificación posterior (Hash check)
    if (outboxItem.approved_copy_hash) {
      const currentHash = calcularHashCopy(outboxItem.subject, outboxItem.body_text);
      if (outboxItem.approved_copy_hash !== currentHash) {
        // El texto fue editado tras la aprobación
        await store.updateOutboxItem(outboxItem.id, {
          estado: "pending_review",
          approved_by: null,
          approved_at: null,
          approved_copy_hash: null,
        });
        return {
          autorizado: false,
          motivoBloqueo: "SEGURIDAD REVIEW MODE: El copy fue modificado tras ser aprobado. La aprobación previa quedó invalidada y requiere nueva revisión.",
          accionRequerida: "posponer",
        };
      }
    }
  }

  // 8. Estado del ítem: debe ser 'approved' o 'scheduled' (o 'sending' si el mismo worker lo bloqueó)
  if (outboxItem.estado !== "approved" && outboxItem.estado !== "scheduled" && outboxItem.estado !== "sending") {
    return {
      autorizado: false,
      motivoBloqueo: `Estado inválido para envío: '${outboxItem.estado}'. Debe ser approved o scheduled.`,
      accionRequerida: "posponer",
    };
  }

  // 9. Comprobar Sender asignado
  if (!outboxItem.sender_id) {
    return {
      autorizado: false,
      motivoBloqueo: "El mensaje no tiene un sender_id asignado.",
      accionRequerida: "posponer",
    };
  }

  const sender = await store.getSenderById(outboxItem.sender_id);
  if (!sender) {
    return {
      autorizado: false,
      motivoBloqueo: `Sender ID ${outboxItem.sender_id} no existe.`,
      accionRequerida: "posponer",
    };
  }

  // 10. COMPROBACIÓN FRESCA PRE-ENVÍO EN GMAIL (Race Condition Killer)
  // Si es un toque posterior (paso 2, 3 o 4) con hilo existente, consulta Gmail en vivo
  if (outboxItem.step_number > 1 && outboxItem.gmail_thread_id) {
    const checkFrescura = await verificarFrescuraHiloEnGmail({
      senderEmail: sender.email,
      threadId: outboxItem.gmail_thread_id,
      contactEmail: contact.email_normalizado,
    });

    if (checkFrescura.respuestaDetectada) {
      await store.cancelPendingOutboxForContact(
        contact.id,
        `Respuesta detectada en vivo en Gmail antes de envío: ${checkFrescura.motivo}`,
      );
      await store.updateContact(contact.id, {
        secuencia_pausada: true,
        secuencia_pausada_motivo: "Respuesta detectada en comprobación previa en Gmail",
      });
      return {
        autorizado: false,
        motivoBloqueo: `RACE CONDITION PREVENIDA EN VIVO: El prospecto respondió en Gmail antes del envío (${checkFrescura.motivo}). Secuencia cancelada.`,
        accionRequerida: "cancelar_secuencia",
      };
    }
  }

  // 11. Límites diarios de Sender (Evaluación con Ledger Transaccional)
  const esNuevoLead = outboxItem.step_number === 1;
  const ledgerSender = await store.getDailySentCounts(sender.id);

  if (esNuevoLead && ledgerSender.newLeadsToday >= sender.new_leads_daily_limit) {
    return {
      autorizado: false,
      motivoBloqueo: `Límite diario de nuevos prospectos alcanzado para ${sender.email} (${ledgerSender.newLeadsToday}/${sender.new_leads_daily_limit}).`,
      accionRequerida: "posponer",
    };
  }

  if (ledgerSender.sentToday >= sender.total_messages_daily_limit) {
    return {
      autorizado: false,
      motivoBloqueo: `Límite diario total de mensajes alcanzado para ${sender.email} (${ledgerSender.sentToday}/${sender.total_messages_daily_limit}).`,
      accionRequerida: "posponer",
    };
  }

  const capSender = evaluarCapacidadSender(sender, esNuevoLead);
  if (!capSender.disponible) {
    return {
      autorizado: false,
      motivoBloqueo: capSender.motivo,
      accionRequerida: "posponer",
    };
  }

  // 12. Comprobar el dominio agregado con Ledger Transaccional
  const dominio = await store.getDomain(OUTBOUND_DOMAIN);
  if (!dominio) {
    return {
      autorizado: false,
      motivoBloqueo: `Dominio ${OUTBOUND_DOMAIN} no encontrado en configuración.`,
      accionRequerida: "pausar_cola",
    };
  }

  if (!config.dryRun) {
    const dnsValido =
      dominio.spf_status === "pass" &&
      dominio.dkim_status === "pass" &&
      dominio.mx_status === "pass" &&
      (dominio.dmarc_status === "pass" || dominio.dmarc_status === "warning");
    const dnsFresco = Boolean(
      dominio.last_dns_check && Date.now() - new Date(dominio.last_dns_check).getTime() <= 24 * 60 * 60 * 1000,
    );
    if (!dnsValido || !dnsFresco) {
      return {
        autorizado: false,
        motivoBloqueo: "DNS no verificado o desactualizado: SPF, DKIM y MX deben pasar; DMARC debe existir; chequeo <24h.",
        accionRequerida: "pausar_cola",
      };
    }
  }

  const domainSent = await store.getDomainDailySentCount(dominio.id);
  if (domainSent >= dominio.domain_daily_limit) {
    return {
      autorizado: false,
      motivoBloqueo: `Límite diario agregado del dominio ${OUTBOUND_DOMAIN} alcanzado (${domainSent}/${dominio.domain_daily_limit}).`,
      accionRequerida: "posponer",
    };
  }

  const capDom = evaluarCapacidadDominio(dominio);
  if (!capDom.disponible) {
    return {
      autorizado: false,
      motivoBloqueo: capDom.motivo,
      accionRequerida: "posponer",
    };
  }

  // Si pasamos todos los guardrails:
  return {
    autorizado: true,
    esDryRun: config.dryRun,
  };
}
