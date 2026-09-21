/**
 * TIPOS Y DEFINICIONES CENTRALES — Motor de Prospección Outbound V1 (Respondo)
 *
 * Principio: Separación estricta entre AI Reasoning (investigación, copy, clasificación)
 * y Business Logic (límites, fechas, supresión, asignación, guardrails).
 */

export type EncajeICP = "alto" | "medio" | "bajo" | "no_encaja" | "sin_evaluar";

export type TipoOrigenLead =
  | "relacion_previa"
  | "referido"
  | "cliente_partner"
  | "web_publica"
  | "directorio_publico"
  | "proveedor_externo"
  | "carga_manual"
  | "csv"
  | "google_sheets"
  | "investigacion_interna";

export type TipoRelacion = "warm" | "cold";

export type VerificacionEmailEstado =
  | "unknown"
  | "valid"
  | "invalid"
  | "risky"
  | "catch_all"
  | "disposable"
  | "verification_failed";

export type ConfianzaEvidencia = "alta" | "media" | "baja";

export type EstadoInvestigacion = "completo" | "insuficiente" | "pendiente";

export type EstadoOutbox =
  | "generated"
  | "pending_review"
  | "approved"
  | "scheduled"
  | "sending"
  | "simulated"
  | "sent"
  | "failed"
  | "cancelled"
  | "blocked"
  | "suppressed";

export type MotivoSupresion = "opt_out" | "hard_bounce" | "queja" | "manual" | "solicitud_21719";

export type TipoSupresion = "email" | "dominio";

export type ClasificacionRespuesta =
  | "positive"
  | "neutral"
  | "negative"
  | "later"
  | "opt_out"
  | "wrong_person"
  | "referral"
  | "autoresponder"
  | "unknown";

export type TipoSender = "founder" | "outbound";

export type HealthStatus = "healthy" | "warning" | "critical" | "paused";

export type DnsCheckStatus = "pass" | "warning" | "fail" | "unknown";

export type ClasificacionBounce =
  | "RECIPIENT_INVALID" // 5.1.1, user unknown, mailbox not found -> invalidar email, stop sequence, suppression
  | "SENDER_OR_POLICY_REJECTION" // SPF/DKIM/DMARC fail, sender blocked, content block -> NO invalidar contacto, NO suppression
  | "SOFT_BOUNCE" // 4.X.X, 5.2.2 mailbox full, timeout -> temporary hold
  | "UNKNOWN"; // revisión conservadora

export type TipoBounce =
  | ClasificacionBounce
  | "hard"
  | "soft"
  | "blocked"
  | "mailbox_full"
  | "policy_rejection"
  | "unknown";

/** Entidad Dominio Corporativo (respon-do.com) */
export interface OutboundDomain {
  id: string;
  domain: string;
  active: boolean;
  domain_daily_limit: number;
  sent_today: number;
  health_status: HealthStatus;
  paused: boolean;
  paused_reason: string | null;
  spf_status: DnsCheckStatus;
  dkim_status: DnsCheckStatus;
  dmarc_status: DnsCheckStatus;
  mx_status: DnsCheckStatus;
  last_dns_check: string | null;
  created_at: string;
  updated_at: string;
}

/** Entidad Sender Account (Bandeja real de Google Workspace) */
export interface OutboundSender {
  id: string;
  name: string;
  email: string;
  domain_id: string;
  type: TipoSender;
  active: boolean;
  cold_outreach_enabled: boolean; // false por defecto para Marcelo
  new_leads_daily_limit: number;
  total_messages_daily_limit: number;
  sent_today: number;
  new_leads_today: number;
  warmup_stage: number;
  warmup_started_at: string | null;
  health_status: HealthStatus;
  bounce_rate: number;
  hard_bounce_rate: number;
  opt_out_rate: number;
  reply_rate: number;
  last_send_at: string | null;
  last_error: string | null;
  paused_reason: string | null;
  created_at: string;
  updated_at: string;
}

/** Procedencia del lead (Obligatorio para trazabilidad y Ley 21.719) */
export interface LeadSource {
  id: string;
  tipo_origen: TipoOrigenLead;
  nombre: string;
  referencia?: string | null;
  url?: string | null;
  notas?: string | null;
  procedencia_datos?: string | null;
  base_legal?: string | null;
  justificacion?: string | null;
  fecha_obtencion?: string | null;
  created_at: string;
}

/** Empresa */
export interface Company {
  id: string;
  nombre: string;
  nombre_normalizado: string;
  matching_key: string; // Clave para búsqueda/duplicados SIN merge destructivo
  rut: string | null;
  sitio_web: string | null;
  dominio_web: string | null;
  rubro: string | null;
  comuna: string | null;
  region: string | null;
  n_empleados: number | null;
  encaje_icp: EncajeICP;
  posible_duplicado: boolean;
  duplicado_de_id: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

/** Contacto Persona */
export interface Contact {
  id: string;
  company_id: string;
  source_id: string;
  nombre: string;
  apellido: string | null;
  cargo: string | null;
  email: string;
  email_normalizado: string;
  telefono: string | null;
  linkedin_url: string | null;
  tipo_relacion: TipoRelacion;
  relacion_detalle: string | null;
  relationship_approved_for_copy: boolean; // Si false, el copy NO puede mencionar la relación
  verificacion_estado: VerificacionEmailEstado;
  verificacion_proveedor: string | null;
  verificacion_fecha: string | null;
  verificacion_detalle: string | null;
  secuencia_pausada: boolean;
  secuencia_pausada_motivo: string | null;
  hold_hasta: string | null; // Para auto-responders / out-of-office temporal
  created_at: string;
  updated_at: string;
}

/** Evidencia de investigación (Minimización de datos) */
export interface EvidenceItem {
  insight: string;
  fuente_url: string;
  extracto: string; // Breve cita o evidencia que respalda la conclusión
  confianza: ConfianzaEvidencia;
}

/** Ficha de investigación de la empresa */
export interface CompanyResearch {
  id: string;
  company_id: string;
  resumen_actividad: string;
  canales_visibles: string[];
  captacion_leads: string; // ej. "WhatsApp directo en sitio web"
  senales_dolor: string[];
  propuesta_valor_respondo: string;
  evidencias: EvidenceItem[];
  estado: EstadoInvestigacion;
  confidence_score: number; // 0-100
  investigado_at: string;
  created_at: string;
  updated_at: string;
}

/** Campaña */
export interface Campaign {
  id: string;
  nombre: string;
  slug: string;
  tipo: TipoRelacion; // WARM o COLD
  activa: boolean;
  review_mode: boolean; // true por defecto (revisión humana obligatoria)
  sender_pool_ids: string[];
  daily_new_leads_limit: number;
  horario_inicio: number; // 9
  horario_fin: number; // 18
  dias_laborales: number[]; // [1, 2, 3, 4, 5] (Lunes a Viernes)
  zona_horaria: string; // "America/Santiago"
  created_at: string;
  updated_at: string;
}

/** Paso de Secuencia */
export interface SequenceStep {
  step_number: number;
  delay_days: number; // ej. 0, 4, 11, 21
  delay_unit?: "calendar_days" | "business_days"; // Default en V1: "calendar_days" con ajuste a día hábil si cae en fin de semana
  channel: "email";
  angulo: "apertura" | "seguimiento_valor" | "pregunta_operativa" | "cierre_honesto";
}

/** Ítem en cola Outbox */
export interface OutboxItem {
  id: string;
  campaign_id: string;
  contact_id: string;
  company_id: string;
  step_number: number;
  sender_id: string | null;
  subject: string;
  body_text: string;
  evidence_used: EvidenceItem[];
  estado: EstadoOutbox;
  scheduled_for: string; // ISO timestamp con jitter
  idempotency_key: string;
  attempt_count?: number;
  approved_by?: string | null; // Auditoría de aprobación humana
  approved_at?: string | null;
  approved_copy_hash?: string | null; // SHA-256 del (asunto + cuerpo) aprobado para invalidar edición posterior
  locked_at?: string | null; // Lock de concurrencia
  locked_by?: string | null;
  lock_expires_at?: string | null;
  gmail_message_id?: string | null;
  gmail_thread_id?: string | null;
  error_message?: string | null;
  enviado_at?: string | null;
  created_at: string;
  updated_at: string;
}

/** Lista de Supresión Global */
export interface Suppression {
  id: string;
  tipo: TipoSupresion;
  valor: string; // email o dominio normalizado
  motivo: MotivoSupresion;
  origen: string;
  notas: string | null;
  created_at: string;
}

/** Respuesta recibida */
export interface ReplyEvent {
  id: string;
  outbox_id: string | null;
  contact_id: string;
  gmail_message_id: string;
  gmail_thread_id: string | null;
  from_email: string;
  subject: string;
  extracto: string;
  clasificacion_ia: ClasificacionRespuesta;
  es_humano: boolean;
  es_autoresponder: boolean;
  reason_category?: "out_of_office" | "general" | null;
  return_date?: string | null;
  secuencia_detenida: boolean;
  created_at: string;
}

/** Evento de Rebote */
export interface BounceEvent {
  id: string;
  outbox_id: string | null;
  contact_id: string;
  sender_id: string | null;
  tipo_bounce: TipoBounce;
  clasificacion?: ClasificacionBounce;
  es_hard: boolean;
  diagnostico: string;
  raw_headers: Record<string, string>;
  created_at: string;
}

/** Estado de suscripción Gmail Push Notifications (Pub/Sub) */
export interface MailboxWatchStatus {
  mailbox_email: string;
  history_id: string | null;
  expiration: string | null; // ISO timestamp de expiración del watch (Google renueva cada 7 días)
  last_notification_at?: string | null;
  last_watch_renewal_at?: string | null;
  created_at?: string;
  updated_at: string;
}

/** Log de Auditoría y Eventos */
export interface OutboundEvent {
  id: string;
  outbox_id?: string | null;
  contact_id?: string | null;
  company_id?: string | null;
  sender_id?: string | null;
  campaign_id?: string | null;
  tipo:
    | "import"
    | "research"
    | "copy_generated"
    | "review_approved"
    | "scheduled"
    | "lock_acquired"
    | "send_attempted"
    | "sent"
    | "send_failed"
    | "reply_received"
    | "sequence_stopped"
    | "bounced"
    | "suppressed"
    | "limit_reached"
    | "killswitch_activated"
    | "dns_check";
  metadata: Record<string, unknown>;
  created_at: string;
}
