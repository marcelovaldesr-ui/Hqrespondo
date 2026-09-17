/**
 * RESPONDO HQ — REVENUE OPERATING SYSTEM V1
 * Capa de Validación Runtime y Reglas de Negocio en Servidor
 *
 * No confía en el navegador ni en tipos estáticos de TypeScript.
 * Valida formatos, rangos, esquemas, enums, fechas, montos y transiciones.
 */

import {
  RevenueStage,
  REVENUE_STAGES,
  LostReason,
  LOST_REASONS,
  HqDeal,
  HqMeeting,
  HqPilot,
  HqProposal,
  MeetingStatus,
  MeetingType,
  PilotStatus,
  ProposalStatus,
} from "./types";
import { Plan } from "@/lib/types";
import { validarReglaNextAction } from "./guardrails";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function esUUIDValido(val: unknown): boolean {
  if (typeof val !== "string") return false;
  return UUID_REGEX.test(val);
}

export function validarUUID(id: unknown, nombreCampo = "id"): string {
  if (!esUUIDValido(id)) {
    throw new Error(
      `VALIDATION_ERROR: '${nombreCampo}' debe ser un UUID válido (recibido: ${String(id)})`
    );
  }
  return id as string;
}

export const PLANES_VALIDOS: Plan[] = ["tino_solo", "inicial", "crecimiento", "empresa"];

export const MEETING_STATUSES: MeetingStatus[] = [
  "agendada",
  "completada",
  "no_show",
  "cancelada",
  "reprogramada",
];

export const MEETING_TYPES: MeetingType[] = [
  "discovery",
  "demo",
  "pilot_review",
  "proposal_review",
  "decision",
];

export const PILOT_STATUSES: PilotStatus[] = [
  "propuesto",
  "programado",
  "configuracion",
  "activo",
  "revision_pendiente",
  "exitoso",
  "no_concluyente",
  "fallido",
  "cancelado",
];

export const PROPOSAL_STATUSES: ProposalStatus[] = [
  "borrador",
  "enviada",
  "en_revision",
  "cambios_solicitados",
  "aceptada",
  "rechazada",
  "sin_decision",
];

/**
 * Matriz de transiciones de etapa válidas
 */
const TRANSICIONES_VALIDAS: Record<RevenueStage, readonly RevenueStage[]> = {
  nuevo: ["contactando", "reunion_agendada", "perdido", "nurture"],
  contactando: ["reunion_agendada", "perdido", "nurture"],
  reunion_agendada: ["discovery_completado", "piloto_propuesto", "piloto_activo", "propuesta_enviada", "perdido", "nurture"],
  discovery_completado: ["calificado", "piloto_propuesto", "piloto_activo", "propuesta_enviada", "perdido", "nurture"],
  calificado: ["piloto_propuesto", "piloto_activo", "propuesta_enviada", "perdido", "nurture"],
  piloto_propuesto: ["piloto_activo", "propuesta_enviada", "perdido", "nurture"],
  piloto_activo: ["propuesta_enviada", "en_decision", "ganado", "perdido", "nurture"],
  propuesta_enviada: ["en_decision", "ganado", "perdido", "nurture"],
  en_decision: ["ganado", "perdido", "nurture"],
  ganado: ["nurture"], // un cliente ganado nunca vuelve a etapa activa
  nurture: ["contactando", "reunion_agendada", "perdido"],
  perdido: ["nurture"], // un deal perdido nunca vuelve directamente a etapa activa
};

export function validarTransicionEtapa(fromStage: RevenueStage, toStage: RevenueStage): void {
  if (fromStage === toStage) return;

  const permitidas = TRANSICIONES_VALIDAS[fromStage];
  if (!permitidas || !permitidas.includes(toStage)) {
    throw new Error(
      `TRANSITION_ERROR: Transición no permitida desde etapa '${fromStage}' hacia '${toStage}'.`
    );
  }
}

/**
 * Valida y sanitiza los datos para crear un Deal
 */
export function validarCreateDealInput(raw: unknown): Omit<HqDeal, "id" | "created_at" | "updated_at"> {
  if (!raw || typeof raw !== "object") {
    throw new Error("VALIDATION_ERROR: Datos de Deal inválidos");
  }

  const d = raw as Record<string, unknown>;

  const company_name = typeof d.company_name === "string" ? d.company_name.trim() : "";
  if (!company_name) {
    throw new Error("VALIDATION_ERROR: 'company_name' es obligatorio y no puede estar vacío");
  }

  const etapa = (typeof d.etapa === "string" ? d.etapa : "nuevo") as RevenueStage;
  if (!REVENUE_STAGES.includes(etapa)) {
    throw new Error(`VALIDATION_ERROR: Etapa inválida: ${String(d.etapa)}`);
  }

  const plan = (typeof d.plan === "string" ? d.plan : "inicial") as Plan;
  if (!PLANES_VALIDOS.includes(plan)) {
    throw new Error(`VALIDATION_ERROR: Plan comercial inválido: ${String(d.plan)}`);
  }

  const valor_mensual_neto =
    typeof d.valor_mensual_neto === "number" && !isNaN(d.valor_mensual_neto)
      ? Math.max(0, Math.floor(d.valor_mensual_neto))
      : 149990;

  const valor_setup_neto =
    typeof d.valor_setup_neto === "number" && !isNaN(d.valor_setup_neto)
      ? Math.max(0, Math.floor(d.valor_setup_neto))
      : 0;

  const next_action = typeof d.next_action === "string" ? d.next_action.trim() : "";
  const next_action_at = typeof d.next_action_at === "string" ? d.next_action_at : null;

  // Invariante de next action
  const ruleCheck = validarReglaNextAction({ etapa, next_action, next_action_at });
  if (!ruleCheck.valid) {
    throw new Error(`GUARDRAIL_ERROR: ${ruleCheck.error}`);
  }

  // Invariante de etapa perdida
  let lost_reason: LostReason | null = null;
  let lost_notes: string | null = null;
  if (etapa === "perdido") {
    if (!d.lost_reason || !LOST_REASONS.includes(d.lost_reason as LostReason)) {
      throw new Error(
        "GUARDRAIL_ERROR: Para marcar un Deal como 'perdido' se exige un 'lost_reason' válido."
      );
    }
    lost_reason = d.lost_reason as LostReason;
    lost_notes = typeof d.lost_notes === "string" ? d.lost_notes.trim() : null;
  }

  const won_notes = etapa === "ganado" && typeof d.won_notes === "string" ? d.won_notes.trim() : null;

  const isClosed = etapa === "ganado" || etapa === "perdido";

    const fit_score = typeof d.fit_score === "number" ? Math.max(0, Math.min(100, Math.floor(d.fit_score))) : 0;
    const intent_score = typeof d.intent_score === "number" ? Math.max(0, Math.min(100, Math.floor(d.intent_score))) : 0;
    // Derivación forzada en servidor (Regla inviolable de Marcelo: si fit < 40 => priority = 0)
    const priority_score = fit_score < 40 ? 0 : Math.round(Math.sqrt(fit_score * intent_score));

    return {
      company_name,
      contact_name: typeof d.contact_name === "string" ? d.contact_name.trim() : "",
      contact_role: typeof d.contact_role === "string" ? d.contact_role.trim() : "",
      contact_phone: typeof d.contact_phone === "string" ? d.contact_phone.trim() : "",
      contact_email: typeof d.contact_email === "string" ? d.contact_email.trim() : "",
      contact_whatsapp: typeof d.contact_whatsapp === "string" ? d.contact_whatsapp.trim() : "",
      industry: typeof d.industry === "string" ? d.industry.trim() : "general",
      city: typeof d.city === "string" ? d.city.trim() : "Santiago",
      etapa,
      plan,
      valor_mensual_neto,
      valor_setup_neto,
      pain_primary: typeof d.pain_primary === "string" ? d.pain_primary.trim() : "",
      use_case: typeof d.use_case === "string" ? d.use_case.trim() : "",
      competidor: typeof d.competidor === "string" ? d.competidor.trim() : "",
      next_action: isClosed ? "" : (next_action || "Revisar datos y primer contacto"),
      next_action_at: isClosed ? "" : (next_action_at || new Date(Date.now() + 86400000).toISOString()),
      next_action_owner: typeof d.next_action_owner === "string" ? d.next_action_owner.trim() : "Fundador",
      stalled: false,
      stalled_reason: null,
      fit_score,
      intent_score,
      priority_score,
      lost_reason,
      lost_notes,
      won_notes,
      experiment_id: esUUIDValido(d.experiment_id) ? (d.experiment_id as string) : null,
      prospect_id: esUUIDValido(d.prospect_id) ? (d.prospect_id as string) : null,
      lead_foco_id: esUUIDValido(d.lead_foco_id) ? (d.lead_foco_id as string) : null,
    };
}

/**
 * Valida y sanitiza updates parciales a Deal evitando Mass-Assignment
 */
export function validarUpdateDealInput(
  current: HqDeal,
  updates: Record<string, unknown>
): Partial<HqDeal> {
  const allowedKeys = new Set([
    "company_name",
    "contact_name",
    "contact_role",
    "contact_phone",
    "contact_email",
    "contact_whatsapp",
    "industry",
    "city",
    "etapa",
    "plan",
    "valor_mensual_neto",
    "valor_setup_neto",
    "pain_primary",
    "use_case",
    "competidor",
    "next_action",
    "next_action_at",
    "next_action_owner",
    "stalled",
    "stalled_reason",
    "fit_score",
    "intent_score",
    "priority_score",
    "lost_reason",
    "lost_notes",
    "won_notes",
    "experiment_id",
    "prospect_id",
    "lead_foco_id",
  ]);

  const protectedFields = new Set(["id", "created_at", "updated_at"]);

  for (const key of Object.keys(updates)) {
    if (protectedFields.has(key)) {
      throw new Error(`MASS_ASSIGNMENT_ERROR: Prohibido enviar o modificar el campo protegido '${key}'`);
    }
    if (!allowedKeys.has(key)) {
      throw new Error(`VALIDATION_ERROR: Propiedad desconocida o no permitida en actualización de deal: '${key}'`);
    }
  }

  const sanitized: Partial<HqDeal> = {};

  for (const [key, value] of Object.entries(updates)) {
    if (!allowedKeys.has(key)) continue;

    if (key === "company_name" && typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) throw new Error("VALIDATION_ERROR: 'company_name' no puede estar vacío");
      sanitized.company_name = trimmed;
    } else if (key === "etapa" && typeof value === "string") {
      const targetStage = value as RevenueStage;
      if (!REVENUE_STAGES.includes(targetStage)) {
        throw new Error(`VALIDATION_ERROR: Etapa no válida: ${value}`);
      }
      validarTransicionEtapa(current.etapa, targetStage);
      sanitized.etapa = targetStage;
    } else if (key === "plan" && typeof value === "string") {
      if (!PLANES_VALIDOS.includes(value as Plan)) {
        throw new Error(`VALIDATION_ERROR: Plan no válido: ${value}`);
      }
      sanitized.plan = value as Plan;
    } else if (key === "valor_mensual_neto" && typeof value === "number") {
      if (value < 0) throw new Error("VALIDATION_ERROR: Monto mensual no puede ser negativo");
      sanitized.valor_mensual_neto = Math.floor(value);
    } else if (key === "valor_setup_neto" && typeof value === "number") {
      if (value < 0) throw new Error("VALIDATION_ERROR: Monto setup no puede ser negativo");
      sanitized.valor_setup_neto = Math.floor(value);
    } else if (key === "next_action" && typeof value === "string") {
      sanitized.next_action = value.trim();
    } else if (key === "next_action_at" && typeof value === "string") {
      sanitized.next_action_at = value;
    } else if (key === "lost_reason") {
      if (value !== null && !LOST_REASONS.includes(value as LostReason)) {
        throw new Error(`VALIDATION_ERROR: Motivo de pérdida inválido: ${String(value)}`);
      }
      sanitized.lost_reason = value as LostReason | null;
    } else if (key === "lost_notes" && typeof value === "string") {
      sanitized.lost_notes = value.trim();
    } else if (key === "won_notes" && typeof value === "string") {
      sanitized.won_notes = value.trim();
    } else if (["fit_score", "intent_score"].includes(key) && typeof value === "number") {
      sanitized[key as "fit_score" | "intent_score"] = Math.max(
        0,
        Math.min(100, Math.floor(value))
      );
    } else if (key === "priority_score") {
      // Ignorado: priority_score se deriva forzosamente en servidor y no se confía del input
    } else {
      (sanitized as any)[key] = value;
    }
  }

  // Evaluar invariantes combinadas del nuevo estado
  const finalStage = sanitized.etapa || current.etapa;
  const isClosed = finalStage === "ganado" || finalStage === "perdido";

  // Derivación forzada de priority_score en servidor (Regla inviolable de Marcelo: fit < 40 => priority = 0)
  const finalFit = sanitized.fit_score !== undefined ? sanitized.fit_score : current.fit_score;
  const finalIntent = sanitized.intent_score !== undefined ? sanitized.intent_score : current.intent_score;
  sanitized.priority_score = finalFit < 40 ? 0 : Math.round(Math.sqrt(finalFit * finalIntent));

  if (isClosed) {
    sanitized.stalled = false;
    sanitized.stalled_reason = null;
  }

  if (finalStage === "perdido") {
    const finalLostReason = sanitized.lost_reason !== undefined ? sanitized.lost_reason : current.lost_reason;
    if (!finalLostReason) {
      throw new Error("GUARDRAIL_ERROR: Deal marcado como 'perdido' requiere un 'lost_reason'.");
    }
  } else {
    // Si no está perdido, lost_reason debe ser null
    sanitized.lost_reason = null;
  }

  if (finalStage === "ganado") {
    sanitized.lost_reason = null;
  }

  // Next action en deals activos
  if (!isClosed) {
    const finalNextAction =
      sanitized.next_action !== undefined ? sanitized.next_action : current.next_action;
    const finalNextActionAt =
      sanitized.next_action_at !== undefined ? sanitized.next_action_at : current.next_action_at;

    const ruleCheck = validarReglaNextAction({
      etapa: finalStage,
      next_action: finalNextAction,
      next_action_at: finalNextActionAt,
    });
    if (!ruleCheck.valid) {
      throw new Error(`GUARDRAIL_ERROR: ${ruleCheck.error}`);
    }
  }

  return sanitized;
}

/**
 * Valida la creación de una reunión
 */
export function validarCreateMeetingInput(
  raw: unknown
): Omit<HqMeeting, "id" | "created_at" | "updated_at"> {
  if (!raw || typeof raw !== "object") {
    throw new Error("VALIDATION_ERROR: Datos de reunión inválidos");
  }

  const m = raw as Record<string, unknown>;
  const deal_id = validarUUID(m.deal_id, "deal_id");

  const company_name = typeof m.company_name === "string" ? m.company_name.trim() : "";
  if (!company_name) {
    throw new Error("VALIDATION_ERROR: 'company_name' es obligatorio en reunión");
  }

  const scheduled_at = typeof m.scheduled_at === "string" ? m.scheduled_at : "";
  if (!scheduled_at || isNaN(new Date(scheduled_at).getTime())) {
    throw new Error("VALIDATION_ERROR: 'scheduled_at' debe ser una fecha/hora válida");
  }

  const status = (typeof m.status === "string" ? m.status : "agendada") as MeetingStatus;
  if (!MEETING_STATUSES.includes(status)) {
    throw new Error(`VALIDATION_ERROR: Estado de reunión inválido: ${String(m.status)}`);
  }

  const meeting_type = (typeof m.meeting_type === "string" ? m.meeting_type : "discovery") as MeetingType;
  if (!MEETING_TYPES.includes(meeting_type)) {
    throw new Error(`VALIDATION_ERROR: Tipo de reunión inválido: ${String(m.meeting_type)}`);
  }

  let interest_score: number | null = null;
  if (typeof m.interest_score === "number") {
    if (m.interest_score < 1 || m.interest_score > 5) {
      throw new Error("VALIDATION_ERROR: 'interest_score' debe estar entre 1 y 5");
    }
    interest_score = Math.floor(m.interest_score);
  }

  return {
    deal_id,
    company_name,
    contact_name: typeof m.contact_name === "string" ? m.contact_name.trim() : "",
    scheduled_at,
    status,
    meeting_type,
    interest_score,
    pain_diagnosticado: typeof m.pain_diagnosticado === "string" ? m.pain_diagnosticado.trim() : "",
    volumen_mensual: typeof m.volumen_mensual === "number" ? Math.max(0, m.volumen_mensual) : 0,
    proceso_actual: typeof m.proceso_actual === "string" ? m.proceso_actual.trim() : "",
    herramientas_actuales: typeof m.herramientas_actuales === "string" ? m.herramientas_actuales.trim() : "",
    urgencia: m.urgencia === "alta" || m.urgencia === "baja" ? m.urgencia : "media",
    decisor_involucrado: Boolean(m.decisor_involucrado),
    proceso_decision: typeof m.proceso_decision === "string" ? m.proceso_decision.trim() : "",
    objeciones: typeof m.objeciones === "string" ? m.objeciones.trim() : "",
    demo_mostrada: typeof m.demo_mostrada === "string" ? m.demo_mostrada.trim() : "",
    siguiente_paso: typeof m.siguiente_paso === "string" ? m.siguiente_paso.trim() : "",
    siguiente_paso_at: typeof m.siguiente_paso_at === "string" ? m.siguiente_paso_at : null,
    notas: typeof m.notas === "string" ? m.notas.trim() : "",
  };
}

/**
 * Valida la creación de un piloto
 */
export function validarCreatePilotInput(
  raw: unknown
): Omit<HqPilot, "id" | "created_at" | "updated_at"> {
  if (!raw || typeof raw !== "object") {
    throw new Error("VALIDATION_ERROR: Datos de piloto inválidos");
  }

  const p = raw as Record<string, unknown>;
  const deal_id = validarUUID(p.deal_id, "deal_id");

  const company_name = typeof p.company_name === "string" ? p.company_name.trim() : "";
  if (!company_name) {
    throw new Error("VALIDATION_ERROR: 'company_name' es obligatorio en piloto");
  }

  const status = (typeof p.status === "string" ? p.status : "propuesto") as PilotStatus;
  if (!PILOT_STATUSES.includes(status)) {
    throw new Error(`VALIDATION_ERROR: Estado de piloto inválido: ${String(p.status)}`);
  }

  const start_date = typeof p.start_date === "string" ? p.start_date : null;
  const end_date = typeof p.end_date === "string" ? p.end_date : null;
  const review_date = typeof p.review_date === "string" ? p.review_date : null;

  if (start_date && end_date && new Date(end_date).getTime() < new Date(start_date).getTime()) {
    throw new Error("VALIDATION_ERROR: 'end_date' no puede ser anterior a 'start_date'");
  }

  return {
    deal_id,
    company_name,
    status,
    start_date,
    end_date,
    review_date,
    hipotesis: typeof p.hipotesis === "string" ? p.hipotesis.trim() : "",
    metricas_base: typeof p.metricas_base === "string" ? p.metricas_base.trim() : "",
    resuelve_vs_deriva: typeof p.resuelve_vs_deriva === "object" && p.resuelve_vs_deriva !== null ? (p.resuelve_vs_deriva as any) : {
      catalogo_precios_base: "resuelve",
      disponibilidad_stock: "resuelve",
      agendamiento_horas: "resuelve",
      cotizaciones_especiales: "deriva",
      pedidos_despacho: "deriva",
      reclamos_postventa: "deriva",
    },
    kpi_primario: typeof p.kpi_primario === "string" ? p.kpi_primario.trim() : "Tasa de respuesta en horario no hábil",
    kpis_secundarios: typeof p.kpis_secundarios === "string" ? p.kpis_secundarios.trim() : "Cotizaciones rescatadas",
    meta_kpi: typeof p.meta_kpi === "string" ? p.meta_kpi.trim() : "",
    criterio_exito: typeof p.criterio_exito === "string" ? p.criterio_exito.trim() : "",
    decision_si_exito: typeof p.decision_si_exito === "string" ? p.decision_si_exito.trim() : "Contratación formal",
    casos_totales_atendidos: typeof p.casos_totales_atendidos === "number" ? Math.max(0, p.casos_totales_atendidos) : 0,
    casos_derivados_humano: typeof p.casos_derivados_humano === "number" ? Math.max(0, p.casos_derivados_humano) : 0,
    seguimientos_beto_enviados: typeof p.seguimientos_beto_enviados === "number" ? Math.max(0, p.seguimientos_beto_enviados) : 0,
    seguimientos_beto_respuestas: typeof p.seguimientos_beto_respuestas === "number" ? Math.max(0, p.seguimientos_beto_respuestas) : 0,
  };
}

/**
 * Valida la creación de una propuesta
 */
export function validarCreateProposalInput(
  raw: unknown
): Omit<HqProposal, "id" | "created_at" | "updated_at"> {
  if (!raw || typeof raw !== "object") {
    throw new Error("VALIDATION_ERROR: Datos de propuesta inválidos");
  }

  const p = raw as Record<string, unknown>;
  const deal_id = validarUUID(p.deal_id, "deal_id");

  const company_name = typeof p.company_name === "string" ? p.company_name.trim() : "";
  if (!company_name) {
    throw new Error("VALIDATION_ERROR: 'company_name' es obligatorio en propuesta");
  }

  const plan = (typeof p.plan === "string" ? p.plan : "inicial") as Plan;
  if (!PLANES_VALIDOS.includes(plan)) {
    throw new Error(`VALIDATION_ERROR: Plan inválido: ${String(p.plan)}`);
  }

  const valor_mensual_neto =
    typeof p.valor_mensual_neto === "number" && !isNaN(p.valor_mensual_neto)
      ? Math.max(0, Math.floor(p.valor_mensual_neto))
      : 149990;

  const valor_setup_neto =
    typeof p.valor_setup_neto === "number" && !isNaN(p.valor_setup_neto)
      ? Math.max(0, Math.floor(p.valor_setup_neto))
      : 0;

  const status = (typeof p.status === "string" ? p.status : "enviada") as ProposalStatus;
  if (!PROPOSAL_STATUSES.includes(status)) {
    throw new Error(`VALIDATION_ERROR: Estado de propuesta inválido: ${String(p.status)}`);
  }

  const review_date = typeof p.review_date === "string" ? p.review_date : null;
  const decision_date = typeof p.decision_date === "string" ? p.decision_date : null;

  if (review_date && decision_date && new Date(decision_date).getTime() < new Date(review_date).getTime()) {
    throw new Error("VALIDATION_ERROR: 'decision_date' no puede ser anterior a 'review_date'");
  }

  return {
    deal_id,
    company_name,
    version: typeof p.version === "number" ? Math.max(1, Math.floor(p.version)) : 1,
    plan,
    valor_mensual_neto,
    valor_setup_neto,
    condiciones_prueba: typeof p.condiciones_prueba === "string" ? p.condiciones_prueba.trim() : "14 días de prueba gratis",
    alcance_resumen: typeof p.alcance_resumen === "string" ? p.alcance_resumen.trim() : "Tino, Beto y Vera",
    sent_at: typeof p.sent_at === "string" ? p.sent_at : new Date().toISOString(),
    review_date,
    decision_date,
    status,
    notas: typeof p.notas === "string" ? p.notas.trim() : "",
  };
}

/**
 * DTO y allowlist estricta para actualizar una reunión
 * Prohíbe mutar id, deal_id, company_name, created_at, updated_at
 */
export function validarUpdateMeetingInput(
  current: HqMeeting,
  raw: unknown
): Partial<HqMeeting> {
  if (!raw || typeof raw !== "object") {
    throw new Error("VALIDATION_ERROR: Datos de actualización de reunión inválidos");
  }

  const updates = raw as Record<string, unknown>;

  const protectedFields = new Set(["id", "deal_id", "company_name", "created_at", "updated_at"]);
  const allowedKeys = new Set([
    "contact_name",
    "scheduled_at",
    "status",
    "meeting_type",
    "interest_score",
    "pain_diagnosticado",
    "volumen_mensual",
    "proceso_actual",
    "herramientas_actuales",
    "urgencia",
    "decisor_involucrado",
    "proceso_decision",
    "objeciones",
    "demo_mostrada",
    "siguiente_paso",
    "siguiente_paso_at",
    "notas",
  ]);

  for (const key of Object.keys(updates)) {
    if (protectedFields.has(key)) {
      throw new Error(`MASS_ASSIGNMENT_ERROR: Prohibido enviar o modificar el campo protegido '${key}'`);
    }
    if (!allowedKeys.has(key)) {
      throw new Error(`VALIDATION_ERROR: Propiedad desconocida o no permitida en actualización de reunión: '${key}'`);
    }
  }

  const sanitized: Partial<HqMeeting> = {};

  if (updates.status !== undefined) {
    if (!MEETING_STATUSES.includes(updates.status as MeetingStatus)) {
      throw new Error(`VALIDATION_ERROR: Estado de reunión inválido: ${String(updates.status)}`);
    }
    sanitized.status = updates.status as MeetingStatus;
  }

  if (updates.scheduled_at !== undefined && typeof updates.scheduled_at === "string") {
    sanitized.scheduled_at = updates.scheduled_at;
  }

  if (updates.meeting_type !== undefined) {
    if (!MEETING_TYPES.includes(updates.meeting_type as MeetingType)) {
      throw new Error(`VALIDATION_ERROR: Tipo de reunión inválido: ${String(updates.meeting_type)}`);
    }
    sanitized.meeting_type = updates.meeting_type as MeetingType;
  }

  if (updates.interest_score !== undefined) {
    if (updates.interest_score === null) {
      sanitized.interest_score = null;
    } else if (typeof updates.interest_score === "number") {
      if (updates.interest_score < 1 || updates.interest_score > 5) {
        throw new Error("VALIDATION_ERROR: 'interest_score' debe estar entre 1 y 5");
      }
      sanitized.interest_score = Math.floor(updates.interest_score);
    }
  }

  if (updates.pain_diagnosticado !== undefined && typeof updates.pain_diagnosticado === "string") {
    sanitized.pain_diagnosticado = updates.pain_diagnosticado.trim();
  }

  if (updates.volumen_mensual !== undefined && typeof updates.volumen_mensual === "number") {
    sanitized.volumen_mensual = Math.max(0, Math.floor(updates.volumen_mensual));
  }

  if (updates.proceso_actual !== undefined && typeof updates.proceso_actual === "string") {
    sanitized.proceso_actual = updates.proceso_actual.trim();
  }

  if (updates.herramientas_actuales !== undefined && typeof updates.herramientas_actuales === "string") {
    sanitized.herramientas_actuales = updates.herramientas_actuales.trim();
  }

  if (updates.urgencia !== undefined && typeof updates.urgencia === "string") {
    if (!["baja", "media", "alta", "critica"].includes(updates.urgencia)) {
      throw new Error(`VALIDATION_ERROR: Urgencia inválida: ${updates.urgencia}`);
    }
    sanitized.urgencia = updates.urgencia as any;
  }

  if (updates.decisor_involucrado !== undefined) {
    sanitized.decisor_involucrado = Boolean(updates.decisor_involucrado);
  }

  if (updates.proceso_decision !== undefined && typeof updates.proceso_decision === "string") {
    sanitized.proceso_decision = updates.proceso_decision.trim();
  }

  if (updates.objeciones !== undefined && typeof updates.objeciones === "string") {
    sanitized.objeciones = updates.objeciones.trim();
  }

  if (updates.demo_mostrada !== undefined && typeof updates.demo_mostrada === "string") {
    sanitized.demo_mostrada = updates.demo_mostrada.trim();
  }

  if (updates.siguiente_paso !== undefined && typeof updates.siguiente_paso === "string") {
    sanitized.siguiente_paso = updates.siguiente_paso.trim();
  }

  if (updates.siguiente_paso_at !== undefined) {
    sanitized.siguiente_paso_at = typeof updates.siguiente_paso_at === "string" ? updates.siguiente_paso_at : null;
  }

  if (updates.notas !== undefined && typeof updates.notas === "string") {
    sanitized.notas = updates.notas.trim();
  }

  return sanitized;
}

/**
 * DTO y allowlist estricta para actualizar un piloto
 * Prohíbe mutar id, deal_id, company_name, created_at, updated_at
 */
export function validarUpdatePilotInput(
  current: HqPilot,
  raw: unknown
): Partial<HqPilot> {
  if (!raw || typeof raw !== "object") {
    throw new Error("VALIDATION_ERROR: Datos de actualización de piloto inválidos");
  }

  const updates = raw as Record<string, unknown>;

  const protectedFields = new Set(["id", "deal_id", "company_name", "created_at", "updated_at"]);
  const allowedKeys = new Set([
    "status",
    "start_date",
    "end_date",
    "review_date",
    "hipotesis",
    "metricas_base",
    "resuelve_vs_deriva",
    "kpi_primario",
    "kpis_secundarios",
    "meta_kpi",
    "criterio_exito",
    "decision_si_exito",
    "tiempo_respuesta_promedio_seg",
    "casos_totales_atendidos",
    "casos_derivados_humano",
    "seguimientos_beto_enviados",
    "seguimientos_beto_respuestas",
    "satisfaccion_vera_promedio",
    "resultado_dia_14",
    "resultado_notas",
  ]);

  for (const key of Object.keys(updates)) {
    if (protectedFields.has(key)) {
      throw new Error(`MASS_ASSIGNMENT_ERROR: Prohibido enviar o modificar el campo protegido '${key}'`);
    }
    if (!allowedKeys.has(key)) {
      throw new Error(`VALIDATION_ERROR: Propiedad desconocida o no permitida en actualización de piloto: '${key}'`);
    }
  }

  const sanitized: Partial<HqPilot> = {};

  if (updates.status !== undefined) {
    if (!PILOT_STATUSES.includes(updates.status as PilotStatus)) {
      throw new Error(`VALIDATION_ERROR: Estado de piloto inválido: ${String(updates.status)}`);
    }
    sanitized.status = updates.status as PilotStatus;
  }

  const finalStart = typeof updates.start_date === "string" ? updates.start_date : current.start_date;
  const finalEnd = typeof updates.end_date === "string" ? updates.end_date : current.end_date;
  if (finalStart && finalEnd && new Date(finalEnd).getTime() < new Date(finalStart).getTime()) {
    throw new Error("VALIDATION_ERROR: 'end_date' no puede ser anterior a 'start_date'");
  }

  if (updates.start_date !== undefined) {
    sanitized.start_date = typeof updates.start_date === "string" ? updates.start_date : null;
  }
  if (updates.end_date !== undefined) {
    sanitized.end_date = typeof updates.end_date === "string" ? updates.end_date : null;
  }
  if (updates.review_date !== undefined) {
    sanitized.review_date = typeof updates.review_date === "string" ? updates.review_date : null;
  }

  if (updates.hipotesis !== undefined && typeof updates.hipotesis === "string") {
    sanitized.hipotesis = updates.hipotesis.trim();
  }
  if (updates.metricas_base !== undefined && typeof updates.metricas_base === "string") {
    sanitized.metricas_base = updates.metricas_base.trim();
  }
  if (updates.resuelve_vs_deriva !== undefined && typeof updates.resuelve_vs_deriva === "object" && updates.resuelve_vs_deriva !== null) {
    sanitized.resuelve_vs_deriva = updates.resuelve_vs_deriva as any;
  }
  if (updates.kpi_primario !== undefined && typeof updates.kpi_primario === "string") {
    sanitized.kpi_primario = updates.kpi_primario.trim();
  }
  if (updates.kpis_secundarios !== undefined && typeof updates.kpis_secundarios === "string") {
    sanitized.kpis_secundarios = updates.kpis_secundarios.trim();
  }
  if (updates.meta_kpi !== undefined && typeof updates.meta_kpi === "string") {
    sanitized.meta_kpi = updates.meta_kpi.trim();
  }
  if (updates.criterio_exito !== undefined && typeof updates.criterio_exito === "string") {
    sanitized.criterio_exito = updates.criterio_exito.trim();
  }
  if (updates.decision_si_exito !== undefined && typeof updates.decision_si_exito === "string") {
    sanitized.decision_si_exito = updates.decision_si_exito.trim();
  }
  if (updates.resultado_dia_14 !== undefined && typeof updates.resultado_dia_14 === "string") {
    sanitized.resultado_dia_14 = updates.resultado_dia_14.trim();
  }
  if (updates.resultado_notas !== undefined && typeof updates.resultado_notas === "string") {
    sanitized.resultado_notas = updates.resultado_notas.trim();
  }

  if (updates.casos_totales_atendidos !== undefined && typeof updates.casos_totales_atendidos === "number") {
    sanitized.casos_totales_atendidos = Math.max(0, Math.floor(updates.casos_totales_atendidos));
  }
  if (updates.casos_derivados_humano !== undefined && typeof updates.casos_derivados_humano === "number") {
    sanitized.casos_derivados_humano = Math.max(0, Math.floor(updates.casos_derivados_humano));
  }
  if (updates.seguimientos_beto_enviados !== undefined && typeof updates.seguimientos_beto_enviados === "number") {
    sanitized.seguimientos_beto_enviados = Math.max(0, Math.floor(updates.seguimientos_beto_enviados));
  }
  if (updates.seguimientos_beto_respuestas !== undefined && typeof updates.seguimientos_beto_respuestas === "number") {
    sanitized.seguimientos_beto_respuestas = Math.max(0, Math.floor(updates.seguimientos_beto_respuestas));
  }

  return sanitized;
}

/**
 * DTO y allowlist estricta para actualizar una propuesta
 * Prohíbe mutar id, deal_id, company_name, created_at, updated_at
 */
export function validarUpdateProposalInput(
  current: HqProposal,
  raw: unknown
): Partial<HqProposal> {
  if (!raw || typeof raw !== "object") {
    throw new Error("VALIDATION_ERROR: Datos de actualización de propuesta inválidos");
  }

  const updates = raw as Record<string, unknown>;

  const protectedFields = new Set(["id", "deal_id", "company_name", "created_at", "updated_at"]);
  const allowedKeys = new Set([
    "version",
    "plan",
    "valor_mensual_neto",
    "valor_setup_neto",
    "condiciones_prueba",
    "alcance_resumen",
    "sent_at",
    "review_date",
    "decision_date",
    "status",
    "notas",
    "plan_ofrecido",
    "mrr_ofrecido",
    "setup_fee_ofrecido",
    "roi_esperado",
    "proposal_url",
  ]);

  for (const key of Object.keys(updates)) {
    if (protectedFields.has(key)) {
      throw new Error(`MASS_ASSIGNMENT_ERROR: Prohibido enviar o modificar el campo protegido '${key}'`);
    }
    if (!allowedKeys.has(key)) {
      throw new Error(`VALIDATION_ERROR: Propiedad desconocida o no permitida en actualización de propuesta: '${key}'`);
    }
  }

  const sanitized: Partial<HqProposal> = {};

  if (updates.version !== undefined && typeof updates.version === "number") {
    sanitized.version = Math.max(1, Math.floor(updates.version));
  }

  if (updates.plan !== undefined) {
    if (!PLANES_VALIDOS.includes(updates.plan as Plan)) {
      throw new Error(`VALIDATION_ERROR: Plan inválido: ${String(updates.plan)}`);
    }
    sanitized.plan = updates.plan as Plan;
  }

  if (updates.valor_mensual_neto !== undefined && typeof updates.valor_mensual_neto === "number") {
    if (updates.valor_mensual_neto < 0) throw new Error("VALIDATION_ERROR: Monto mensual no puede ser negativo");
    sanitized.valor_mensual_neto = Math.floor(updates.valor_mensual_neto);
  }

  if (updates.valor_setup_neto !== undefined && typeof updates.valor_setup_neto === "number") {
    if (updates.valor_setup_neto < 0) throw new Error("VALIDATION_ERROR: Monto setup no puede ser negativo");
    sanitized.valor_setup_neto = Math.floor(updates.valor_setup_neto);
  }

  if (updates.condiciones_prueba !== undefined && typeof updates.condiciones_prueba === "string") {
    sanitized.condiciones_prueba = updates.condiciones_prueba.trim();
  }

  if (updates.alcance_resumen !== undefined && typeof updates.alcance_resumen === "string") {
    sanitized.alcance_resumen = updates.alcance_resumen.trim();
  }

  if (updates.sent_at !== undefined && typeof updates.sent_at === "string") {
    sanitized.sent_at = updates.sent_at;
  }

  const finalReview = updates.review_date !== undefined ? (typeof updates.review_date === "string" ? updates.review_date : null) : current.review_date;
  const finalDecision = updates.decision_date !== undefined ? (typeof updates.decision_date === "string" ? updates.decision_date : null) : current.decision_date;

  if (finalReview && finalDecision && new Date(finalDecision).getTime() < new Date(finalReview).getTime()) {
    throw new Error("VALIDATION_ERROR: 'decision_date' no puede ser anterior a 'review_date'");
  }

  if (updates.review_date !== undefined) {
    sanitized.review_date = typeof updates.review_date === "string" ? updates.review_date : null;
  }

  if (updates.decision_date !== undefined) {
    sanitized.decision_date = typeof updates.decision_date === "string" ? updates.decision_date : null;
  }

  if (updates.status !== undefined) {
    if (!PROPOSAL_STATUSES.includes(updates.status as ProposalStatus)) {
      throw new Error(`VALIDATION_ERROR: Estado de propuesta inválido: ${String(updates.status)}`);
    }
    sanitized.status = updates.status as ProposalStatus;
  }

  if (updates.notas !== undefined && typeof updates.notas === "string") {
    sanitized.notas = updates.notas.trim();
  }

  return sanitized;
}
