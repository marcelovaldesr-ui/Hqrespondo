/**
 * RESPONDO HQ — REVENUE OPERATING SYSTEM V1
 * Modelo canónico de datos y tipos para el ciclo comercial completo:
 * PROSPECCIÓN → RESEARCH → CONTACTO → REUNIÓN → DISCOVERY →
 * DEMO → PILOTO → PROPUESTA → FOLLOW-UP → CIERRE → ONBOARDING → APRENDIZAJE
 */

import { Plan } from "@/lib/types";

export const REVENUE_STAGES = [
  "nuevo",
  "contactando",
  "reunion_agendada",
  "discovery_completado",
  "calificado",
  "piloto_propuesto",
  "piloto_activo",
  "propuesta_enviada",
  "en_decision",
  "ganado",
  "nurture",
  "perdido",
] as const;

export type RevenueStage = (typeof REVENUE_STAGES)[number];

export interface StageConfig {
  value: RevenueStage;
  label: string;
  order: number;
  description: string;
  color: string;
  isClosed: boolean;
  isWon: boolean;
}

export const REVENUE_STAGE_CONFIG: Record<RevenueStage, StageConfig> = {
  nuevo: {
    value: "nuevo",
    label: "Nuevo Lead",
    order: 1,
    description: "Empresa identificada con datos iniciales sin primer contacto.",
    color: "text-ink-dim border-line bg-surface",
    isClosed: false,
    isWon: false,
  },
  contactando: {
    value: "contactando",
    label: "En Contacto",
    order: 2,
    description: "Secuencia activa de llamadas o emails en curso.",
    color: "text-accent border-accent/30 bg-accent/[0.04]",
    isClosed: false,
    isWon: false,
  },
  reunion_agendada: {
    value: "reunion_agendada",
    label: "Reunión Agendada",
    order: 3,
    description: "Fecha y hora confirmada para discovery / demo.",
    color: "text-accent border-accent/40 bg-accent/[0.08]",
    isClosed: false,
    isWon: false,
  },
  discovery_completado: {
    value: "discovery_completado",
    label: "Discovery Hecho",
    order: 4,
    description: "Dolores, volumen, herramientas y proceso actual diagnosticados.",
    color: "text-brand border-brand/30 bg-brand/[0.05]",
    isClosed: false,
    isWon: false,
  },
  calificado: {
    value: "calificado",
    label: "Calificado (Fit Alto)",
    order: 5,
    description: "Encaje comercial validado, dolor urgente y capacidad de pago.",
    color: "text-brand border-brand/40 bg-brand/[0.08]",
    isClosed: false,
    isWon: false,
  },
  piloto_propuesto: {
    value: "piloto_propuesto",
    label: "Piloto 14d Propuesto",
    order: 6,
    description: "Acuerdo de prueba con Success Plan y matriz R vs D entregada.",
    color: "text-warn border-warn/30 bg-warn/[0.05]",
    isClosed: false,
    isWon: false,
  },
  piloto_activo: {
    value: "piloto_activo",
    label: "Piloto 14d en Curso",
    order: 7,
    description: "Prueba activa con WhatsApp conectado y medición hacia el Día 14.",
    color: "text-warn border-warn/40 bg-warn/[0.08]",
    isClosed: false,
    isWon: false,
  },
  propuesta_enviada: {
    value: "propuesta_enviada",
    label: "Propuesta Enviada",
    order: 8,
    description: "Propuesta comercial entregada con precio neto y fecha de revisión.",
    color: "text-ink border-brand/40 bg-surface",
    isClosed: false,
    isWon: false,
  },
  en_decision: {
    value: "en_decision",
    label: "En Decisión",
    order: 9,
    description: "Revisión final con socios o jefatura con fecha límite.",
    color: "text-accent border-accent/50 bg-accent/[0.12]",
    isClosed: false,
    isWon: false,
  },
  ganado: {
    value: "ganado",
    label: "Ganado / Cliente 🎉",
    order: 10,
    description: "Cliente cerrado formalmente con plan contratado.",
    color: "text-ok border-ok/40 bg-ok/[0.08]",
    isClosed: true,
    isWon: true,
  },
  nurture: {
    value: "nurture",
    label: "Nurture / Futuro",
    order: 11,
    description: "Sin urgencia hoy; reactivar en fecha acordada (30/60/90 días).",
    color: "text-ink-faint border-line bg-surface/50",
    isClosed: true,
    isWon: false,
  },
  perdido: {
    value: "perdido",
    label: "Perdido",
    order: 12,
    description: "Descartado con causa y motivo estructurado registrado.",
    color: "text-danger border-danger/30 bg-danger/[0.05]",
    isClosed: true,
    isWon: false,
  },
};

/** Resultados estructurados de llamadas con acción sugerida */
export const CALL_OUTCOMES = [
  "no_contesta",
  "conectado",
  "gatekeeper",
  "contacto_incorrecto",
  "volver_a_llamar",
  "interesado",
  "reunion_agendada",
  "no_interesado",
  "nurture",
  "invalido",
] as const;

export type CallOutcome = (typeof CALL_OUTCOMES)[number];

export const CALL_OUTCOME_CONFIG: Record<
  CallOutcome,
  { label: string; actionSugerida: string; delayDias: number }
> = {
  no_contesta: {
    label: "No contesta",
    actionSugerida: "Reintentar llamada en 1 día hábil",
    delayDias: 1,
  },
  conectado: {
    label: "Conectó / Conversó",
    actionSugerida: "Enviar WhatsApp/correo de seguimiento de lo hablado",
    delayDias: 0,
  },
  gatekeeper: {
    label: "Filtro / Secretaria",
    actionSugerida: "Averiguar nombre y horario del decisor para volver a llamar",
    delayDias: 1,
  },
  contacto_incorrecto: {
    label: "Número no es del decisor",
    actionSugerida: "Investigar número directo alternativo",
    delayDias: 2,
  },
  volver_a_llamar: {
    label: "Pidió llamar más tarde",
    actionSugerida: "Llamar a la hora comprometida",
    delayDias: 1,
  },
  interesado: {
    label: "Interesado en propuesta",
    actionSugerida: "Coordinar reunión de 20 minutos por WhatsApp",
    delayDias: 0,
  },
  reunion_agendada: {
    label: "Reunión Agendada 🎉",
    actionSugerida: "Enviar invitación Google Meet + Ficha de preparación",
    delayDias: 0,
  },
  no_interesado: {
    label: "No interesado / Rechazo",
    actionSugerida: "Registrar motivo y pasar a perdido",
    delayDias: 0,
  },
  nurture: {
    label: "Interesa pero más adelante",
    actionSugerida: "Programar reactivación a 45 días",
    delayDias: 45,
  },
  invalido: {
    label: "Número inválido / Fuera de servicio",
    actionSugerida: "Descartar teléfono y buscar fuente alternativa",
    delayDias: 0,
  },
};

/** Motivos estructurados de pérdida */
export const LOST_REASONS = [
  "no_pain",
  "no_urgency",
  "no_budget",
  "no_decision",
  "product_gap",
  "implementation_friction",
  "trust",
  "competitor",
  "timing",
  "no_response",
  "other",
] as const;

export type LostReason = (typeof LOST_REASONS)[number];

export const LOST_REASON_LABEL: Record<LostReason, string> = {
  no_pain: "Sin dolor real (atienden poco volumen o les acomoda lo actual)",
  no_urgency: "Sin urgencia (lo ven para el próximo año)",
  no_budget: "Sin presupuesto / Muy caro para su escala",
  no_decision: "Falta de acuerdo entre socios / Parálisis de decisión",
  product_gap: "Brecha de producto (requieren algo que Respondo no hace)",
  implementation_friction: "Fricción operativa (miedo al cambio de proceso)",
  trust: "Desconfianza en IA / Miedo a alucinaciones de precios",
  competitor: "Eligieron competidor (Kommo, ManyChat, AgendaPro, etc.)",
  timing: "Momento complejo de la empresa (reestructuración, cierre)",
  no_response: "Ghosting total tras reunión o propuesta",
  other: "Otro motivo (ver notas)",
};

/** Interfaz principal de un Deal en Revenue Operating System */
export interface HqDeal {
  id: string;
  company_name: string;
  contact_name: string;
  contact_role: string;
  contact_phone: string;
  contact_email: string;
  contact_whatsapp: string;
  industry: string;
  city: string;
  etapa: RevenueStage;
  plan: Plan;
  valor_mensual_neto: number;
  valor_setup_neto: number;
  pain_primary: string;
  use_case: string;
  competidor: string;
  next_action: string;
  next_action_at: string;
  next_action_owner: string;
  stalled: boolean;
  stalled_reason: string | null;
  fit_score: number;
  intent_score: number;
  priority_score: number;
  lost_reason: LostReason | null;
  lost_notes: string | null;
  won_notes: string | null;
  experiment_id: string | null;
  prospect_id: string | null;
  lead_foco_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Reunión y Discovery */
export type MeetingStatus = "agendada" | "completada" | "no_show" | "cancelada" | "reprogramada";
export type MeetingType = "discovery" | "demo" | "pilot_review" | "proposal_review" | "decision";

export interface HqMeeting {
  id: string;
  deal_id: string;
  company_name: string;
  contact_name: string;
  scheduled_at: string;
  status: MeetingStatus;
  meeting_type: MeetingType;
  interest_score: number | null; // 1 a 5
  pain_diagnosticado: string;
  volumen_mensual: number;
  proceso_actual: string;
  herramientas_actuales: string;
  urgencia: "alta" | "media" | "baja";
  decisor_involucrado: boolean;
  proceso_decision: string;
  objeciones: string;
  demo_mostrada: string;
  siguiente_paso: string;
  siguiente_paso_at: string | null;
  notas: string;
  created_at: string;
  updated_at: string;
}

/** Piloto de 14 días */
export type PilotStatus =
  | "propuesto"
  | "programado"
  | "configuracion"
  | "activo"
  | "revision_pendiente"
  | "exitoso"
  | "no_concluyente"
  | "fallido"
  | "cancelado";

export interface PilotResolveVsDerive {
  catalogo_precios_base: "resuelve" | "deriva";
  disponibilidad_stock: "resuelve" | "deriva";
  agendamiento_horas: "resuelve" | "deriva";
  cotizaciones_especiales: "resuelve" | "deriva";
  pedidos_despacho: "resuelve" | "deriva";
  reclamos_postventa: "resuelve" | "deriva";
  umbral_monto_derivacion_clp?: number;
  palabras_clave_escalacion?: string[];
}

export interface HqPilot {
  id: string;
  deal_id: string;
  company_name: string;
  status: PilotStatus;
  start_date: string | null;
  end_date: string | null;
  review_date: string | null;
  hipotesis: string;
  metricas_base: string;
  resuelve_vs_deriva: PilotResolveVsDerive;
  kpi_primario: string;
  kpis_secundarios: string;
  meta_kpi: string;
  criterio_exito: string;
  decision_si_exito: string;
  tiempo_respuesta_promedio_seg?: number;
  casos_totales_atendidos: number;
  casos_derivados_humano: number;
  seguimientos_beto_enviados: number;
  seguimientos_beto_respuestas: number;
  satisfaccion_vera_promedio?: number;
  resultado_dia_14?: string;
  resultado_notas?: string;
  created_at: string;
  updated_at: string;
}

/** Propuesta comercial */
export type ProposalStatus =
  | "borrador"
  | "enviada"
  | "en_revision"
  | "cambios_solicitados"
  | "aceptada"
  | "rechazada"
  | "sin_decision";

export interface HqProposal {
  id: string;
  deal_id: string;
  company_name: string;
  version: number;
  plan: Plan;
  valor_mensual_neto: number;
  valor_setup_neto: number;
  condiciones_prueba: string;
  alcance_resumen: string;
  sent_at: string;
  review_date: string | null;
  decision_date: string | null;
  status: ProposalStatus;
  notas: string;
  created_at: string;
  updated_at: string;
}

/** Experimento comercial */
export interface HqExperiment {
  id: string;
  name: string;
  hipotesis: string;
  canal: "cold_call" | "cold_email" | "warm_outreach" | "multichannel" | "referral";
  segmento_icp: string;
  hook_probado: string;
  oferta_probada: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  tamano_muestra: number;
  metrica_primaria: string;
  resultado_resumen: string | null;
  aprendizaje: string | null;
  decision: "validado" | "descartado" | "iterar" | "en_curso" | null;
  created_at: string;
  updated_at: string;
}

/** Feedback de producto y mercado */
export type FeedbackCategory =
  | "objecion"
  | "bug"
  | "competidor"
  | "integracion_solicitada"
  | "precio_reaccion"
  | "friccion_implementacion"
  | "gap_producto"
  | "elogio";

export interface HqFeedback {
  id: string;
  deal_id: string | null;
  company_name: string;
  categoria: FeedbackCategory;
  competidor_mencionado: string | null;
  detalle: string;
  frecuencia: number;
  created_at: string;
}

/** Actividad / Timeline */
export type ActivityType =
  | "llamada"
  | "email"
  | "reunion"
  | "piloto"
  | "propuesta"
  | "cambio_etapa"
  | "nota"
  | "tarea";

export interface HqActivity {
  id: string;
  deal_id: string;
  company_name: string;
  tipo: ActivityType;
  resultado?: CallOutcome | string;
  detalle: string;
  proxima_accion?: string;
  proxima_accion_at?: string;
  creado_por: string;
  created_at: string;
}
