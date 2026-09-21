/**
 * GESTIÓN DE SENDERS, ROTACIÓN DETERMINISTA Y LÍMITES — Outbound V1
 *
 * Reglas mandatorias:
 * 1. Marcelo (`founder`): `cold_outreach_enabled = false` por defecto. Solo utilizable en campañas WARM o explícitas.
 * 2. Outbound 1 y 2 (`outbound`): `cold_outreach_enabled = true`.
 * 3. Continuidad de sender: Si un contacto ya recibió el paso 1 desde el Sender B, los pasos 2, 3 y 4 deben
 *    mantenerse con el Sender B a menos que esté pausado o inactivo.
 * 4. Control estricto de límites:
 *    - `new_leads_daily_limit`: Solo cuenta el paso 1 (nuevo lead).
 *    - `total_messages_daily_limit`: Cuenta todos los toques (pasos 1 a 4).
 *    - `domain_daily_limit`: Límite agregado de todo `respon-do.com`.
 * 5. Ramp-up progresivo real (sin bots ni trampas):
 *    - Días 1-3: 2 msgs/día
 *    - Días 4-7: 3 msgs/día
 *    - Sem 2: 5 msgs/día
 *    - Sem 3: 8 msgs/día
 *    - Sem 4: 12 msgs/día
 *    - Post-rampup: 15 msgs/día (con new leads ~ 5)
 */

import { type OutboundSender, type OutboundDomain, type Campaign, type TipoRelacion } from "./types";
import { type OutboundStore } from "./store";

export interface LimitesEfectivos {
  newLeadsLimit: number;
  totalMessagesLimit: number;
}

export interface SenderConfig {
  name: string;
  email: string;
  type: "founder" | "outbound";
  cold_outreach_enabled: boolean;
  warmup_stage: number;
  new_leads_daily_limit: number;
  total_messages_daily_limit: number;
}

export const TABLA_ETAPAS_RAMPUP: Record<number, LimitesEfectivos> = {
  1: { newLeadsLimit: 1, totalMessagesLimit: 2 },  // Días 1–3
  2: { newLeadsLimit: 2, totalMessagesLimit: 3 },  // Días 4–7
  3: { newLeadsLimit: 3, totalMessagesLimit: 6 },  // Semana 2
  4: { newLeadsLimit: 4, totalMessagesLimit: 10 }, // Semana 3
  5: { newLeadsLimit: 5, totalMessagesLimit: 15 }, // Semana 4 (Tope seguro estándar V1)
};

export interface RegistroAprobacionRampup {
  id: string;
  sender_id: string;
  sender_email: string;
  previous_stage: number;
  new_stage: number;
  approved_by: string;
  approved_at: string;
  reason: string;
  notes?: string;
  reinforced_approval: boolean;
  limites_aplicados: LimitesEfectivos;
}

/**
 * Obtiene la configuración de senders desde variables de entorno.
 * NO inventa identidades ficticias (usa nombres descriptivos de buzón configurables por el operador).
 * Marcelo (founder) permanece con cold_outreach_enabled = false por diseño (buzón principal, NO bot).
 */
export function obtenerConfiguracionSenders(): SenderConfig[] {
  const configs: SenderConfig[] = [
    {
      name: process.env.OUTBOUND_FOUNDER_NAME || "Marcelo Valdés",
      email: (process.env.OUTBOUND_FOUNDER_EMAIL || "").toLowerCase().trim(),
      type: "founder",
      cold_outreach_enabled: false, // REGLA ESTRICTA: Buzón principal del fundador. NO es bot de cold outreach.
      warmup_stage: 5,
      new_leads_daily_limit: 5,
      total_messages_daily_limit: 15,
    },
    {
      name: process.env.OUTBOUND_SENDER_1_NAME || "Buzón Outbound 1",
      email: (process.env.OUTBOUND_SENDER_1_EMAIL || "").toLowerCase().trim(),
      type: "outbound",
      cold_outreach_enabled: true,
      warmup_stage: 1, // Días 1-3
      new_leads_daily_limit: 1,
      total_messages_daily_limit: 2,
    },
    {
      name: process.env.OUTBOUND_SENDER_2_NAME || "Buzón Outbound 2",
      email: (process.env.OUTBOUND_SENDER_2_EMAIL || "").toLowerCase().trim(),
      type: "outbound",
      cold_outreach_enabled: true,
      warmup_stage: 1, // Días 1-3
      new_leads_daily_limit: 1,
      total_messages_daily_limit: 2,
    },
  ];
  return configs.filter((config) => config.email.length > 0);
}

/**
 * Calcula los límites según la etapa actual de calentamiento almacenada.
 * - Stage 1 (Días 1–3): 1 new lead, 2 total msgs/día
 * - Stage 2 (Días 4–7): 2 new leads, 3 total msgs/día
 * - Stage 3 (Semana 2): 3 new leads, 6 total msgs/día
 * - Stage 4 (Semana 3): 4 new leads, 10 total msgs/día
 * - Stage 5 (Semana 4): hasta 5 new leads, hasta 15 total msgs/día
 * PROHIBICIÓN ESTRICTA: Esta función solo lee la etapa guardada; JAMÁS incrementa etapas.
 */
export function calcularLimitesRampup(sender: OutboundSender): LimitesEfectivos {
  if (sender.type === "founder") {
    return {
      newLeadsLimit: sender.new_leads_daily_limit,
      totalMessagesLimit: sender.total_messages_daily_limit,
    };
  }

  if (sender.warmup_stage in TABLA_ETAPAS_RAMPUP) {
    return TABLA_ETAPAS_RAMPUP[sender.warmup_stage];
  }

  // Fallback seguro: no exceder límites configurados en BD sin superar tope seguro
  return {
    newLeadsLimit: Math.min(sender.new_leads_daily_limit, 5),
    totalMessagesLimit: Math.min(sender.total_messages_daily_limit, 15),
  };
}

/**
 * Evalúa las métricas de un remitente para emitir recomendaciones o alertas.
 * PROHIBICIÓN ESTRICTA: Esta función NUNCA incrementa etapas por sí sola.
 * El sistema automatizado solo puede sugerir o alertar; la promoción requiere operador humano.
 */
export function evaluarRecomendacionRampup(sender: OutboundSender): {
  elegibleParaRevisionHumana: boolean;
  proximaEtapaSugerida?: number;
  observaciones: string;
} {
  if (!sender.active || sender.health_status === "paused" || sender.paused_reason) {
    return {
      elegibleParaRevisionHumana: false,
      observaciones: `Remitente no elegible: actualmente inactivo o pausado (${sender.paused_reason || "pausa manual"}).`,
    };
  }

  if (sender.health_status !== "healthy") {
    return {
      elegibleParaRevisionHumana: false,
      observaciones: `Remitente no elegible: estado de salud ${sender.health_status}. Debe estabilizarse en healthy antes de evaluar promoción.`,
    };
  }

  if (sender.bounce_rate > 2.0 || sender.hard_bounce_rate > 1.0) {
    return {
      elegibleParaRevisionHumana: false,
      observaciones: `Métricas de rebote elevadas (bounce: ${sender.bounce_rate}%, hard: ${sender.hard_bounce_rate}%). No se aconseja promover.`,
    };
  }

  if (sender.opt_out_rate > 1.0) {
    return {
      elegibleParaRevisionHumana: false,
      observaciones: `Tasa de opt-out elevada (${sender.opt_out_rate}%). Requiere revisión de segmentación y copy.`,
    };
  }

  const etapaActual = sender.warmup_stage;
  if (etapaActual >= 5) {
    return {
      elegibleParaRevisionHumana: false,
      observaciones: `Remitente en etapa ${etapaActual} (tope estándar seguro V1 alcanzado). Cualquier incremento superior requiere aprobación humana reforzada.`,
    };
  }

  return {
    elegibleParaRevisionHumana: true,
    proximaEtapaSugerida: etapaActual + 1,
    observaciones: `Métricas saludables. Elegible para que un operador humano evalúe promover de Etapa ${etapaActual} a Etapa ${etapaActual + 1}.`,
  };
}

/**
 * GOBERNANZA HUMANA DE RAMP-UP — Promoción explícita de etapa.
 *
 * Requisitos mandatorios:
 * 1. Aprobación humana explícita (approved_by obligatorio, no nulo ni vacío ni 'system').
 * 2. Remitente debe estar activo y en estado 'healthy'.
 * 3. Si el remitente está en 'paused', 'warning' o 'critical', la promoción es RECHAZADA.
 * 4. Subir por sobre Stage 5 requiere aprobación humana reforzada explícita (reinforcedApproval: true).
 * 5. Registra un evento inmutable de auditoría en el store.
 */
export async function promoverEtapaWarmupHumano(params: {
  store: OutboundStore;
  senderId: string;
  approvedBy: string;
  newStage: number;
  reason: string;
  notes?: string;
  reinforcedApproval?: boolean;
}): Promise<RegistroAprobacionRampup> {
  const { store, senderId, approvedBy, newStage, reason, notes, reinforcedApproval } = params;

  // 1. Validación de operador humano
  if (!approvedBy || approvedBy.trim() === "" || approvedBy.toLowerCase() === "system" || approvedBy.toLowerCase() === "cron" || approvedBy.toLowerCase() === "bot") {
    throw new Error("GOBERNANZA RAMP-UP: Se requiere un operador humano explícito en approved_by (no se permite 'system' o vacío).");
  }

  if (!reason || reason.trim() === "") {
    throw new Error("GOBERNANZA RAMP-UP: Se requiere un motivo (reason) explícito para registrar la aprobación humana.");
  }

  // 2. Obtener sender
  const sender = await store.getSenderById(senderId);
  if (!sender) {
    throw new Error(`GOBERNANZA RAMP-UP: Sender ${senderId} no encontrado en base de datos.`);
  }

  // 3. Prohibición en remitentes pausados o degradados
  if (sender.health_status === "paused" || sender.paused_reason) {
    throw new Error(
      `GOBERNANZA RAMP-UP RECHAZADA: No se puede promover la etapa de un sender pausado (${sender.email}). Causa: ${sender.paused_reason || "pausa activa"}. Debe resolverse la condición antes de cualquier cambio de etapa.`
    );
  }

  if (sender.health_status === "warning" || sender.health_status === "critical") {
    throw new Error(
      `GOBERNANZA RAMP-UP RECHAZADA: No se puede promover la etapa de un sender con salud degradada (${sender.health_status}). Debe recuperar estado 'healthy' primero.`
    );
  }

  // 4. Verificación de avance de etapa
  if (newStage <= sender.warmup_stage) {
    throw new Error(
      `GOBERNANZA RAMP-UP: La nueva etapa (${newStage}) debe ser estrictamente superior a la etapa actual (${sender.warmup_stage}). Para reducciones use pausarPreventivamenteSender().`
    );
  }

  // 5. Verificación de aprobación humana reforzada para Stage > 5
  if (newStage > 5 && !reinforcedApproval) {
    throw new Error(
      `GOBERNANZA RAMP-UP RECHAZADA: Promover a Stage ${newStage} supera el límite estándar seguro V1 (Stage 5 / 15 msgs/día). Requiere aprobación humana reforzada explícita (reinforcedApproval: true) y justificación técnica.`
    );
  }

  // 6. Calcular nuevos límites
  let nuevosLimites: LimitesEfectivos;
  if (newStage in TABLA_ETAPAS_RAMPUP) {
    nuevosLimites = TABLA_ETAPAS_RAMPUP[newStage];
  } else {
    // Stage > 5 con aprobación reforzada
    nuevosLimites = {
      newLeadsLimit: Math.min(sender.new_leads_daily_limit + 1, 10),
      totalMessagesLimit: Math.min(sender.total_messages_daily_limit + 5, 30),
    };
  }

  const nowIso = new Date().toISOString();
  const previousStage = sender.warmup_stage;

  // 7. Actualizar sender en el store
  await store.updateSender(sender.id, {
    warmup_stage: newStage,
    new_leads_daily_limit: nuevosLimites.newLeadsLimit,
    total_messages_daily_limit: nuevosLimites.totalMessagesLimit,
  });

  // 8. Crear registro auditable
  const record: RegistroAprobacionRampup = {
    id: "ramp_" + Math.random().toString(36).substring(2, 10),
    sender_id: sender.id,
    sender_email: sender.email,
    previous_stage: previousStage,
    new_stage: newStage,
    approved_by: approvedBy.trim(),
    approved_at: nowIso,
    reason: reason.trim(),
    notes: notes?.trim(),
    reinforced_approval: Boolean(reinforcedApproval),
    limites_aplicados: nuevosLimites,
  };

  // Registrar en bitácora de eventos del store
  await store.logEvent({
    sender_id: sender.id,
    tipo: "review_approved",
    metadata: {
      subtipo: "rampup_stage_promoted",
      ...record,
    },
  });

  return record;
}

/**
 * ACCIONES AUTOMÁTICAS PERMITIDAS: Pausa preventiva del sender ante degradación.
 * El sistema automatizado SÍ tiene permiso para pausar o frenar, pero NUNCA para subir etapa.
 */
export async function pausarPreventivamenteSender(params: {
  store: OutboundStore;
  senderId: string;
  motivo: string;
  origen: "sistema_automatizado" | "monitoreo_metricas";
}): Promise<void> {
  const { store, senderId, motivo, origen } = params;
  const sender = await store.getSenderById(senderId);
  if (!sender) return;

  await store.updateSender(senderId, {
    health_status: "paused",
    paused_reason: motivo,
  });

  await store.logEvent({
    sender_id: senderId,
    tipo: "killswitch_activated",
    metadata: {
      accion: "pausa_preventiva_automatica",
      origen,
      motivo,
      sender_email: sender.email,
    },
  });
}

export interface EvaluacionCapacidadSender {
  disponible: boolean;
  motivo?: string;
}

/** Evalúa si un sender puede enviar un mensaje (distinguiendo new lead vs follow-up) */
export function evaluarCapacidadSender(
  sender: OutboundSender,
  esNuevoLead: boolean,
): EvaluacionCapacidadSender {
  if (!sender.active) {
    return { disponible: false, motivo: `Sender inactivo (${sender.email})` };
  }
  if (sender.health_status === "paused" || sender.paused_reason) {
    return { disponible: false, motivo: `Sender pausado: ${sender.paused_reason}` };
  }

  const limites = calcularLimitesRampup(sender);

  // Verificación de límite total
  if (sender.sent_today >= limites.totalMessagesLimit) {
    return {
      disponible: false,
      motivo: `Límite total diario alcanzado (${sender.sent_today}/${limites.totalMessagesLimit}) para ${sender.email}`,
    };
  }

  // Si es nuevo lead (paso 1), verificar new_leads_limit
  if (esNuevoLead && sender.new_leads_today >= limites.newLeadsLimit) {
    return {
      disponible: false,
      motivo: `Límite de nuevos leads alcanzado (${sender.new_leads_today}/${limites.newLeadsLimit}) para ${sender.email}`,
    };
  }

  return { disponible: true };
}

/**
 * Selecciona el remitente determinista más adecuado para una campaña y contacto.
 * - Mantiene continuidad si ya tenía sender previo asignado.
 * - Respeta WARM vs COLD.
 * - Balancea la carga entre senders disponibles con menor porcentaje de uso.
 */
export async function seleccionarSenderDeterminista(params: {
  store: OutboundStore;
  campana: Campaign;
  senderPrevioId?: string | null;
  esNuevoLead: boolean;
}): Promise<OutboundSender | null> {
  const { store, campana, senderPrevioId, esNuevoLead } = params;

  // 1. Si existe un sender previo en la secuencia, intentar mantener continuidad
  if (senderPrevioId) {
    const senderPrevio = await store.getSenderById(senderPrevioId);
    if (senderPrevio) {
      const cap = evaluarCapacidadSender(senderPrevio, esNuevoLead);
      if (cap.disponible) {
        return senderPrevio;
      }
    }
  }

  // 2. Obtener senders activos
  const allSenders = await store.getSenders();
  const sendersCandidatos = allSenders.filter((s) => {
    if (!s.active || s.health_status === "paused") return false;

    // Si la campaña es COLD, solo senders con cold_outreach_enabled = true
    if (campana.tipo === "cold" && !s.cold_outreach_enabled) {
      return false;
    }

    // Si la campaña define un pool específico, respetarlo
    if (campana.sender_pool_ids && campana.sender_pool_ids.length > 0) {
      if (!campana.sender_pool_ids.includes(s.id)) return false;
    }

    // Verificar capacidad
    const cap = evaluarCapacidadSender(s, esNuevoLead);
    return cap.disponible;
  });

  if (sendersCandidatos.length === 0) {
    return null;
  }

  // 3. Orden determinista por menor tasa de uso relativo de su límite diario
  sendersCandidatos.sort((a, b) => {
    const limA = calcularLimitesRampup(a);
    const limB = calcularLimitesRampup(b);
    const ratioA = a.sent_today / Math.max(1, limA.totalMessagesLimit);
    const ratioB = b.sent_today / Math.max(1, limB.totalMessagesLimit);
    return ratioA - ratioB;
  });

  return sendersCandidatos[0];
}

/** Verifica si el dominio corporativo tiene capacidad de envío */
export function evaluarCapacidadDominio(domain: OutboundDomain): { disponible: boolean; motivo?: string } {
  if (!domain.active) {
    return { disponible: false, motivo: `Dominio ${domain.domain} inactivo` };
  }
  if (domain.paused) {
    return { disponible: false, motivo: `Dominio ${domain.domain} pausado: ${domain.paused_reason}` };
  }
  if (domain.sent_today >= domain.domain_daily_limit) {
    return {
      disponible: false,
      motivo: `Límite agregado del dominio alcanzado (${domain.sent_today}/${domain.domain_daily_limit})`,
    };
  }
  return { disponible: true };
}
