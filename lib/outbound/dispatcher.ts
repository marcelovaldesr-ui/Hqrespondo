/**
 * DESPACHADOR CENTRAL DE OUTBOX — Outbound V1
 *
 * Flujo de ejecución seguro:
 * 1. Busca ítems con fecha `scheduled_for` cumplida y estado `approved` o `scheduled`.
 * 2. Bloqueo atómico de concurrencia (`acquireOutboxLock`) para evitar doble worker.
 * 3. Ejecución del Pre-Send Check (`validarAntesDeEnvio`) para prevenir carreras.
 * 4. Si DRY_RUN = true: Simula el despacho sin tocar internet y avanza la máquina de estados.
 * 5. Si DRY_RUN = false: Envía a través de Gmail API individual de cada mailbox.
 * 6. Actualiza contadores del sender (`new_leads_today` si es paso 1, `sent_today`) y del dominio.
 * 7. Si el envío fue exitoso, genera el próximo paso de la secuencia (según cadencia y review_mode).
 */

import { type OutboundStore } from "./store";
import { type OutboxItem, type SequenceStep } from "./types";
import { validarAntesDeEnvio } from "./guardrails";
import { enviarMensajeGmail } from "./gmail";
import { calcularFechaProgramada, calcularDelayRelativoPaso, generarIdempotencyKey, SECUENCIA_DEFAULT } from "./scheduler";
import { redactarEmailOutbound } from "./copy";

export interface ResultadoDespachoLote {
  procesados: number;
  enviados: number;
  simulados: number;
  bloqueados: number;
  fallidos: number;
  detalles: Array<{
    outbox_id: string;
    estado: string;
    motivo?: string;
  }>;
}

export async function despacharColaOutbound(params: {
  store: OutboundStore;
  workerId?: string;
  limiteLote?: number;
  nowIso?: string;
}): Promise<ResultadoDespachoLote> {
  const { store } = params;
  const workerId = params.workerId ?? `worker_${Math.random().toString(36).substring(2, 8)}`;
  const limite = params.limiteLote ?? 10;
  const nowIso = params.nowIso ?? new Date().toISOString();

  const pendientes = await store.findScheduledOutboxItems(nowIso, limite);

  const resultado: ResultadoDespachoLote = {
    procesados: pendientes.length,
    enviados: 0,
    simulados: 0,
    bloqueados: 0,
    fallidos: 0,
    detalles: [],
  };

  for (const item of pendientes) {
    // 1. Adquisición atómica del Lock (duración 60 segundos)
    const lockAdquirido = await store.acquireOutboxLock(item.id, workerId, 60_000);
    if (!lockAdquirido) {
      resultado.detalles.push({
        outbox_id: item.id,
        estado: "concurrency_skip",
        motivo: "No se pudo adquirir el lock de concurrencia (otro worker en progreso)",
      });
      continue;
    }

    // 2. Pre-Send Check crítico (revalidación milisegundos antes del envío)
    const check = await validarAntesDeEnvio({
      store,
      outboxItem: item,
      workerId,
    });

    if (!check.autorizado) {
      resultado.bloqueados++;
      const nuevoEstado = check.accionRequerida === "cancelar_secuencia" ? "cancelled" : "blocked";
      await store.releaseOutboxLock(item.id, nuevoEstado, check.motivoBloqueo);

      await store.logEvent({
        outbox_id: item.id,
        contact_id: item.contact_id,
        company_id: item.company_id,
        sender_id: item.sender_id,
        tipo: "send_failed",
        metadata: { motivo: check.motivoBloqueo, accion: check.accionRequerida },
      });

      resultado.detalles.push({
        outbox_id: item.id,
        estado: nuevoEstado,
        motivo: check.motivoBloqueo,
      });
      continue;
    }

    const contact = await store.getContactById(item.contact_id);
    const sender = item.sender_id ? await store.getSenderById(item.sender_id) : null;
    if (!contact || !sender) {
      resultado.fallidos++;
      await store.releaseOutboxLock(item.id, "failed", "Contacto o Sender no encontrado");
      continue;
    }

    const esNuevoLead = item.step_number === 1;

    // 3. MODO DRY RUN
    if (check.esDryRun) {
      resultado.simulados++;
      const simulatedMessageId = `sim_msg_${Math.random().toString(36).substring(2, 10)}`;
      const simulatedThreadId = item.gmail_thread_id || `sim_thr_${Math.random().toString(36).substring(2, 10)}`;

      await store.updateOutboxItem(item.id, {
        gmail_message_id: simulatedMessageId,
        gmail_thread_id: simulatedThreadId,
      });
      await store.releaseOutboxLock(item.id, "simulated", null);

      await store.logEvent({
        outbox_id: item.id,
        contact_id: contact.id,
        sender_id: sender.id,
        tipo: "sent",
        metadata: {
          modo: "DRY_RUN",
          simulated: true,
          para: contact.email_normalizado,
          asunto: item.subject,
          step_number: item.step_number,
        },
      });

      resultado.detalles.push({
        outbox_id: item.id,
        estado: "simulated (dry-run, sin métricas ni follow-up)",
      });
      continue;
    }

    // 4. MODO REAL (Solo si DRY_RUN=false y OUTBOUND_ENABLED=true)
    const envioRes = await enviarMensajeGmail({
      deNombre: sender.name,
      deEmail: sender.email,
      para: contact.email,
      asunto: item.subject,
      cuerpo: item.body_text,
      threadId: item.gmail_thread_id,
    });

    if (envioRes.ok) {
      resultado.enviados++;
      await store.updateOutboxItem(item.id, {
        gmail_message_id: envioRes.messageId,
        gmail_thread_id: envioRes.threadId ?? item.gmail_thread_id,
      });
      await store.releaseOutboxLock(item.id, "sent", null);

      await store.incrementSenderCounts(sender.id, esNuevoLead ? 1 : 0, 1);
      await store.incrementDomainSent("respon.do", 1);

      await store.logEvent({
        outbox_id: item.id,
        contact_id: contact.id,
        sender_id: sender.id,
        tipo: "sent",
        metadata: {
          modo: "REAL",
          messageId: envioRes.messageId,
          threadId: envioRes.threadId,
          para: contact.email_normalizado,
        },
      });

      // Programar siguiente paso
      await programarSiguientePasoSecuencia({
        store,
        itemActual: item,
        threadId: envioRes.threadId ?? item.gmail_thread_id,
      });

      resultado.detalles.push({
        outbox_id: item.id,
        estado: "sent",
      });
    } else {
      resultado.fallidos++;
      await store.releaseOutboxLock(item.id, "failed", envioRes.error);

      await store.logEvent({
        outbox_id: item.id,
        contact_id: contact.id,
        sender_id: sender.id,
        tipo: "send_failed",
        metadata: { error: envioRes.error },
      });

      resultado.detalles.push({
        outbox_id: item.id,
        estado: "failed",
        motivo: envioRes.error,
      });
    }
  }

  return resultado;
}

/**
 * Programa deterministamente el paso N+1 en el outbox tras el éxito del paso N
 */
async function programarSiguientePasoSecuencia(params: {
  store: OutboundStore;
  itemActual: OutboxItem;
  threadId?: string | null;
}): Promise<void> {
  const { store, itemActual, threadId } = params;
  const pasoSiguienteNum = itemActual.step_number + 1;
  const pasoSiguienteDef = SECUENCIA_DEFAULT.find((s) => s.step_number === pasoSiguienteNum);

  // Si se agotó la secuencia (llegamos al paso 4), no hay más toques
  if (!pasoSiguienteDef) return;

  const campana = await store.getCampaignById(itemActual.campaign_id);
  const contact = await store.getContactById(itemActual.contact_id);
  const company = await store.getCompanyById(itemActual.company_id);
  const research = await store.getResearchByCompanyId(itemActual.company_id);
  const sender = itemActual.sender_id ? await store.getSenderById(itemActual.sender_id) : null;

  if (!campana || !contact || !company || !research || !sender) return;

  // Si el contacto respondió o está pausado, no programar
  if (contact.secuencia_pausada) return;

  const idempKey = generarIdempotencyKey({
    campaignId: campana.id,
    contactId: contact.id,
    stepNumber: pasoSiguienteNum,
  });

  const existente = await store.getOutboxItemByIdempotencyKey(idempKey);
  if (existente) return; // Ya existe

  // Calcular delay relativo en días (D0 -> D4 = +4d; D4 -> D11 = +7d; D11 -> D21 = +10d)
  const delayRelativo = calcularDelayRelativoPaso(itemActual.step_number, pasoSiguienteNum);

  // Calcular fecha de envío determinista
  const fechaActual = new Date();
  const fechaSiguiente = calcularFechaProgramada(
    fechaActual,
    delayRelativo,
    {
      horaInicio: campana.horario_inicio,
      horaFin: campana.horario_fin,
      zonaHoraria: campana.zona_horaria,
    },
    20, // jitter minutos
  );

  // Redactar copy del paso siguiente
  const copySiguiente = await redactarEmailOutbound({
    contacto: contact,
    empresa: company,
    research,
    paso: pasoSiguienteDef,
    remitenteNombre: sender.name,
  });

  // Estado según el modo de la campaña:
  // Si review_mode = true -> pending_review (requiere aprobación humana)
  // Si review_mode = false -> scheduled (envío directo en la fecha programada)
  const estadoInicial = campana.review_mode ? "pending_review" : "scheduled";

  await store.createOutboxItem({
    campaign_id: campana.id,
    contact_id: contact.id,
    company_id: company.id,
    step_number: pasoSiguienteNum,
    sender_id: sender.id, // Mantiene el mismo sender por continuidad
    subject: itemActual.subject.startsWith("Re:") ? itemActual.subject : `Re: ${itemActual.subject}`,
    body_text: copySiguiente.cuerpo,
    evidence_used: copySiguiente.evidencia_usada,
    estado: estadoInicial,
    scheduled_for: fechaSiguiente.toISOString(),
    idempotency_key: idempKey,
    locked_at: null,
    locked_by: null,
    lock_expires_at: null,
    gmail_message_id: null,
    gmail_thread_id: threadId ?? itemActual.gmail_thread_id,
    error_message: null,
    enviado_at: null,
  });
}
