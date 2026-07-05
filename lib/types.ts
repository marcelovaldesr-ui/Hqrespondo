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

export const PLANES = ["esencial", "cotizador", "pro"] as const;
export type Plan = (typeof PLANES)[number];

export const PLAN_LABEL: Record<Plan, string> = {
  esencial: "Esencial",
  cotizador: "Cotizador",
  pro: "Pro",
};

/** Precios de partida (jun-2026). Ajustables por deal. */
export const PLAN_PRECIOS: Record<Plan, { setup: number; mensual: number }> = {
  esencial: { setup: 150000, mensual: 24990 },
  cotizador: { setup: 290000, mensual: 39990 },
  pro: { setup: 590000, mensual: 69990 },
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

export type TipoEvento = "mensaje" | "error" | "heartbeat";

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
