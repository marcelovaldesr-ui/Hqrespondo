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
 * los planes VIGENTES publicados en respon-do.com (verificados 6-jul-2026):
 *   esencial  → "Básico"   $24.990/mes + setup $150.000  (hasta 1.000 conv/mes)
 *   cotizador → "Pro"      $39.990/mes + setup $290.000  (recomendado, hasta 4.000)
 *   pro       → "Empresa"  $69.990/mes + setup $590.000  (hasta 12.000)
 * Oferta de reversión de riesgo vigente: prueba 30 días (si no ayuda, no paga la
 * mensualidad). El "plan piloto" quedó DESCONTINUADO — no ofrecerlo.
 */
export const PLANES = ["esencial", "cotizador", "pro"] as const;
export type Plan = (typeof PLANES)[number];

export const PLAN_LABEL: Record<Plan, string> = {
  esencial: "Básico",
  cotizador: "Pro",
  pro: "Empresa",
};

/** Precios VIGENTES (respon-do.com, jul-2026). Ajustables por deal. */
export const PLAN_PRECIOS: Record<Plan, { setup: number; mensual: number }> = {
  esencial: { setup: 150000, mensual: 24990 },
  cotizador: { setup: 290000, mensual: 39990 },
  pro: { setup: 590000, mensual: 69990 },
};

/** Límites de conversaciones/mes por plan (para propuestas). */
export const PLAN_LIMITES: Record<Plan, number> = {
  esencial: 1000,
  cotizador: 4000,
  pro: 12000,
};

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

/**
 * Prospección ADICIONAL (tabla contactos_decision, migración 010): busca al
 * ENCARGADO de un área específica dentro de un prospecto ya guardado — no
 * el dueño/teléfono general que ya trae `prospects`, sino ej. "el de
 * marketing" de una cadena o empresa con áreas separadas. Pensada para
 * negocios medianos/grandes, NO para reemplazar la prospección por rubro
 * (Places) que ya existe.
 */
export const AREAS_OBJETIVO = [
  "gerencia_general",
  "marketing",
  "operaciones",
  "compras",
  "rrhh",
  "ventas",
  "atencion_cliente",
] as const;
export type AreaObjetivo = (typeof AREAS_OBJETIVO)[number];

export const AREA_OBJETIVO_LABEL: Record<AreaObjetivo, string> = {
  gerencia_general: "Gerencia general",
  marketing: "Marketing",
  operaciones: "Operaciones",
  compras: "Compras / Abastecimiento",
  rrhh: "RR.HH.",
  ventas: "Ventas",
  atencion_cliente: "Atención al cliente",
};

export const AREA_OBJETIVO_OPTIONS = AREAS_OBJETIVO.map((a) => ({
  value: a,
  label: AREA_OBJETIVO_LABEL[a],
}));

export function isAreaObjetivo(value: unknown): value is AreaObjetivo {
  return typeof value === "string" && (AREAS_OBJETIVO as readonly string[]).includes(value);
}

export type Confianza = "alta" | "media" | "baja";

export interface FuenteContacto {
  url: string;
  titulo?: string;
}

/**
 * De dónde salió el contacto (migraciones 011 y 012):
 * - "ia": generado por Gemini con google_search grounding (lib/contactoAI.ts).
 * - "hunter": Domain Search de Hunter.io — base de datos real, no IA.
 * - "apollo": People Search + Enrichment de Apollo.io — DESHABILITADO en el
 *   selector: confirmado (API_INACCESSIBLE) que el plan gratuito no da
 *   acceso a mixed_people/api_search. El código queda listo por si suben
 *   de plan.
 * - "hunter_ia": modo mixto (lib/contactoMixto.ts) — Hunter aporta el dato
 *   real y la IA solo lo VERIFICA/enriquece (nunca inventa desde cero). Si
 *   Hunter no encuentra nada, el resultado se guarda como "ia" pura.
 */
export const FUENTES_CONTACTO = ["hunter_ia", "hunter", "ia", "apollo"] as const;
export type Fuente = (typeof FUENTES_CONTACTO)[number];

export const FUENTE_LABEL: Record<Fuente, string> = {
  hunter_ia: "Hunter + IA (recomendado)",
  hunter: "Solo Hunter.io",
  ia: "Solo IA (búsqueda web)",
  apollo: "Apollo.io",
};

/**
 * Un contacto encontrado (o intentado) para un prospecto. `verificado`
 * empieza SIEMPRE en false: significa que un humano confirmó el dato antes
 * de usarlo para contactar. La UI no debe ofrecer envío directo mientras
 * `verificado` sea false, sin importar la `confianza` que reporte la fuente.
 */
export interface ContactoDecision {
  id: string;
  prospect_id: string;
  area_objetivo: AreaObjetivo | string;
  nombre: string | null;
  cargo: string | null;
  telefono: string | null;
  email: string | null;
  linkedin_url: string | null;
  fuentes: FuenteContacto[];
  confianza: Confianza;
  verificado: boolean;
  notas: string | null;
  fuente: Fuente | string;
  // Solo relevante cuando fuente === "apollo": id interno de Apollo para
  // poder "revelar" (gastar crédito) más tarde. Null si nunca se buscó
  // por Apollo o si ya fue revelado y no hace falta reconsultar.
  apollo_person_id: string | null;
  created_at: string;
  updated_at: string;
}
