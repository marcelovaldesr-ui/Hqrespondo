export const ESTADOS = [
  "nuevo",
  "contactado",
  "respondio",
  "reunion",
  "en_pipeline",
  "descartado",
] as const;
export type Estado = (typeof ESTADOS)[number];

export const ESTADO_CONFIG: Record<
  Estado,
  { value: Estado; label: string }
> = {
  nuevo: { value: "nuevo", label: "Nuevo" },
  contactado: { value: "contactado", label: "Contactado" },
  respondio: { value: "respondio", label: "Respondió" },
  reunion: { value: "reunion", label: "Reunión" },
  en_pipeline: { value: "en_pipeline", label: "En Pipeline" },
  descartado: { value: "descartado", label: "Descartado" },
};

export const ESTADO_LABEL = Object.fromEntries(
  ESTADOS.map((estado) => [estado, ESTADO_CONFIG[estado].label]),
) as Record<Estado, string>;

export const ESTADO_OPTIONS = ESTADOS.map((estado) => ESTADO_CONFIG[estado]);

export function isEstado(value: unknown): value is Estado {
  return typeof value === "string" && ESTADOS.includes(value as Estado);
}

export const ETAPAS = [
  "contactado",
  "demo",
  "propuesta",
  "cliente",
  "perdido",
] as const;
export type Etapa = (typeof ETAPAS)[number];

export const ETAPA_LABEL: Record<Etapa, string> = {
  contactado: "Contactado",
  demo: "Demo agendada",
  propuesta: "Propuesta enviada",
  cliente: "Cliente 🎉",
  perdido: "Perdido",
};

/**
 * Planes comerciales. Los VALORES ('esencial','cotizador','pro') son las
 * claves históricas de la base de datos (check constraint en deals/clients)
 * y NO deben cambiarse sin migración. Los NOMBRES y PRECIOS corresponden a
 * la Estructura Final de Precios (jul-2026, estrategia-comercial/PLANES_Y_
 * PRECIOS_RESPONDO.md), que reemplazó a la tabla interina:
 *   esencial  → "Inicial"      $79.000/mes  + setup $290.000
 *   cotizador → "Crecimiento"  $149.000/mes + setup $490.000  (plan ancla)
 *   pro       → "Pro"          $279.000/mes + setup $890.000
 * Plan Empresa (desde $450.000 + $1.200.000) se cotiza a medida: usar Pro
 * como base y ajustar valores en el deal.
 */
export const PLANES = ["esencial", "cotizador", "pro"] as const;
export type Plan = (typeof PLANES)[number];

export const PLAN_LABEL: Record<Plan, string> = {
  esencial: "Inicial",
  cotizador: "Crecimiento",
  pro: "Pro",
};

/** Estructura final de precios (jul-2026). Ajustables por deal. */
export const PLAN_PRECIOS: Record<Plan, { setup: number; mensual: number }> = {
  esencial: { setup: 290000, mensual: 79000 },
  cotizador: { setup: 490000, mensual: 149000 },
  pro: { setup: 890000, mensual: 279000 },
};

/** Límites de conversaciones/mes por plan (para propuestas). */
export const PLAN_LIMITES: Record<Plan, number> = {
  esencial: 800,
  cotizador: 3500,
  pro: 9000,
};

/**
 * Piloto Fundador (primeros 5 clientes): descuento SOLO en el setup,
 * mensualidad siempre de lista. Cliente 1: 30% · clientes 2–3: 20% ·
 * clientes 4–5: 10%. A cambio: testimonio + uso como caso + feedback.
 */
export const PILOTO_FUNDADOR_DCTO = [0.3, 0.2, 0.2, 0.1, 0.1] as const;

export interface Prospect {
  id: string;
  nombre: string;
  rubro: string;
  comuna: string;
  telefono: string | null;
  web: string | null;
  direccion: string | null;
  rating: number | null;
  reviews: number | null;
  score: number;
  razon_score: string | null;
  mensaje: string | null;
  estado: Estado;
  proxima_accion: string | null;
  notas: string | null;
  place_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Deal {
  id: string;
  prospect_id: string | null;
  nombre_negocio: string;
  rubro: string | null;
  plan: Plan;
  valor_setup: number;
  valor_mensual: number;
  etapa: Etapa;
  proxima_accion: string | null;
  fecha_proxima: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  nombre: string;
  rubro: string | null;
  plan: Plan;
  mensualidad: number;
  telefono_bot: string | null;
  workflow_id: string | null;
  activo: boolean;
  fecha_inicio: string | null;
  created_at: string;
}

/**
 * Tipos de evento de bot. Los 3 primeros son los históricos; los demás son
 * eventos COMERCIALES (requieren migración 008 en Supabase antes de usarse
 * desde n8n — si la base no está migrada, el insert falla con error claro).
 */
export const TIPOS_EVENTO = [
  "mensaje",
  "error",
  "heartbeat",
  "lead_captured",
  "quote_generated",
  "meeting_booked",
  "human_handoff",
] as const;
export type TipoEvento = (typeof TIPOS_EVENTO)[number];

export const TIPO_EVENTO_LABEL: Record<TipoEvento, string> = {
  mensaje: "Conversación atendida",
  error: "Error",
  heartbeat: "Heartbeat OK",
  lead_captured: "Lead capturado",
  quote_generated: "Cotización generada",
  meeting_booked: "Reunión agendada",
  human_handoff: "Derivado a humano",
};

export interface BotEvent {
  id: string;
  client_id: string | null;
  tipo: TipoEvento;
  detalle: string | null;
  costo_clp: number | null;
  created_at: string;
}

export interface Brief {
  id: string;
  contenido: string;
  created_at: string;
}

/** Bucket horario de actividad para las barras de uptime */
export interface UptimeBucket {
  n: number;
  err: boolean;
}

/** Cliente + métricas agregadas para la vista Clientes & Bots */
export interface ClientStats extends Client {
  ultimo_evento: string | null;
  errores_24h: number;
  mensajes_hoy: number;
  costo_mes: number;
  uptime: UptimeBucket[];
}

/** Horarios de atención del bot (texto libre por tramo, null = cerrado) */
export interface HorarioAtencion {
  lun_vie?: string | null;
  sab?: string | null;
  dom?: string | null;
}

/** Configuración operativa del bot de un cliente (tabla bot_configs) */
export interface BotConfig {
  id: string;
  client_id: string;
  tono: string | null;
  horario_atencion: HorarioAtencion;
  derivacion_reglas: string | null;
  derivacion_contacto: string | null;
  extra: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export const TIPOS_BRIEF = ["diario", "mensual_cliente"] as const;
export type TipoBrief = (typeof TIPOS_BRIEF)[number];

/** Ítem del roadmap interno compartido (tabla roadmap_items) */
export interface RoadmapItem {
  id: string;
  tarea: string;
  estado: string;
  area: string | null;
  fecha_limite: string | null;
  notas: string | null;
  creado_por: string | null;
  actualizado_por: string | null;
  created_at: string;
  updated_at: string;
}

/** Orden sugerido de columnas del roadmap (los demás estados van al final) */
export const ROADMAP_ESTADOS_BASE = [
  "Esta semana",
  "En curso",
  "Backlog",
  "Hecho",
] as const;

/** Paso del checklist de instalación de un cliente (tabla onboarding_tasks) */
export interface OnboardingTask {
  id: string;
  client_id: string;
  paso: string;
  orden: number;
  hecho: boolean;
  hecho_por: string | null;
  hecho_at: string | null;
  created_at: string;
}

/** Checklist estándar que se crea con cada cliente nuevo */
export const ONBOARDING_PASOS_DEFAULT = [
  "Kickoff con el cliente: qué vende, FAQs, tono deseado",
  "Crear workflow del bot en n8n (duplicar plantilla)",
  "Conectar número de WhatsApp (Cloud API)",
  "Configurar tono, horarios y derivación en el panel",
  "Guardar el workflow ID en la ficha del cliente",
  "Prueba end-to-end con el dueño del negocio",
  "Activar registro de mensajes y cobrar el setup",
] as const;

/** Decisión registrada del equipo (tabla decisiones) */
export interface Decision {
  id: string;
  titulo: string;
  detalle: string | null;
  decidido_por: string | null;
  created_at: string;
}

/** Gasto de la operación (tabla gastos) */
export interface Gasto {
  id: string;
  fecha: string;
  concepto: string;
  categoria: string | null;
  monto: number;
  pagado_por: string | null;
  notas: string | null;
  created_at: string;
}

/** Cobro de mensualidad (tabla cobros). */
export interface Cobro {
  id: string;
  client_id: string;
  mes: string;
  monto: number;
  estado: "pendiente" | "pagado";
  pagado_at: string | null;
  notas: string | null;
  created_at: string;
}
