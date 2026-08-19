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

// La clave interna sigue siendo "demo" (así está guardada en los deals de la
// base); lo que cambia es cómo se LEE. El equipo habla de "reuniones", no de
// "demos" — la reunión es donde se muestra la demo, pero lo que se agenda y
// se celebra es la reunión. El tablero habla el idioma del equipo.
export const ETAPA_LABEL: Record<Etapa, string> = {
  contactado: "Contactado",
  demo: "Reunión agendada",
  propuesta: "Propuesta enviada",
  cliente: "Cliente 🎉",
  perdido: "Perdido",
};

/**
 * Planes comerciales VIGENTES — tabla aprobada por Marcelo el 12-ago-2026.
 *
 * ⚠ TODOS LOS VALORES SON NETOS, MÁS IVA (decisión del 14-ago-2026). En la UI
 * se marcan con "+ IVA" a propósito: sin esa marca alguien cotiza de memoria
 * un número con IVA incluido y se pierde el margen en la reunión.
 *
 *   inicial     → "Inicial"      $149.990/mes · 1.200 conv · excedente $80/conv
 *   crecimiento → "Crecimiento"  $269.990/mes · 3.000 conv · excedente $60/conv
 *   empresa     → "Empresa"      $449.990/mes · 6.000 conv · excedente $50/conv
 *
 * Instalación GRATIS · 14 días de prueba · bot extra +$20.000/mes.
 *
 * "Tino solo" ($120.000/mes, 800 conv, excedente $90) existe como oferta pero
 * NO entra al CRM por decisión de Marcelo (19-ago-2026): es una venta distinta
 * que no pasa por pipeline.
 *
 * Conversación = todo el contacto con un mismo cliente en 24 h corridas. Si
 * nadie respondió, no se cuenta.
 *
 * Reemplaza el esquema anterior de 'esencial/cotizador/pro' con setup + mensual
 * ($24.990/$39.990/$69.990 + setup $99.990/$290.000/$590.000), que venía de
 * los precios de julio y quedó anulado. Migración 018.
 */
// "tino_solo" es un plan REAL que faltaba en HQ: un solo asistente, 800
// conversaciones. Está en la tabla de la Guía interna de prospección
// (ago-2026), que dice de sí misma: "esta tabla es la única versión válida".
// Sin él no se podía cotizar al negocio chico que solo quiere a Tino, ni usar
// el argumento que más mueve al plan Inicial (ver ARGUMENTO_INICIAL abajo).
export const PLANES = ["tino_solo", "inicial", "crecimiento", "empresa"] as const;
export type Plan = (typeof PLANES)[number];

export const PLAN_LABEL: Record<Plan, string> = {
  tino_solo: "Tino solo",
  inicial: "Inicial",
  crecimiento: "Crecimiento",
  empresa: "Empresa",
};

/** Mensualidad NETA. El setup es 0: la instalación va incluida. */
export const PLAN_PRECIOS: Record<Plan, { setup: number; mensual: number }> = {
  tino_solo: { setup: 0, mensual: 120000 },
  inicial: { setup: 0, mensual: 149990 },
  crecimiento: { setup: 0, mensual: 269990 },
  empresa: { setup: 0, mensual: 449990 },
};

/** Conversaciones incluidas al mes. */
export const PLAN_LIMITES: Record<Plan, number> = {
  tino_solo: 800,
  inicial: 1200,
  crecimiento: 3000,
  empresa: 6000,
};

/** Precio NETO por conversación pasada del cupo. Nunca se corta el servicio:
 *  se avisa al 80% y al 100% del cupo. */
export const PLAN_EXCEDENTE: Record<Plan, number> = {
  tino_solo: 90,
  inicial: 80,
  crecimiento: 60,
  empresa: 50,
};

/** Costo NETO de cada bot adicional sobre el plan contratado. */
export const PRECIO_BOT_EXTRA = 20000;

/** Qué asistentes incluye cada plan. Los nombres son producto, no apodos. */
export const PLAN_ASISTENTES: Record<Plan, string> = {
  tino_solo: "Solo Tino",
  inicial: "Los 3 (Tino, Beto y Vera)",
  crecimiento: "Todos",
  empresa: "Todos + analítica especializada",
};

/** Canales por plan. La agenda entra recién en Crecimiento. */
export const PLAN_CANALES: Record<Plan, string> = {
  tino_solo: "WhatsApp",
  inicial: "WhatsApp",
  crecimiento: "WhatsApp + Instagram + agenda",
  empresa: "Todo + analítica especializada",
};

/**
 * El argumento que más mueve gente al plan Inicial, tal como está escrito en
 * la guía: Tino solo más dos asistentes adicionales cuesta MÁS que el Inicial.
 */
export const ARGUMENTO_INICIAL =
  `Los tres asistentes juntos cuestan menos que Tino solo más dos adicionales: ` +
  `$120.000 + $20.000 + $20.000 = $160.000, contra $149.990 del plan Inicial.`;

/** Qué cuenta como una conversación (la pregunta que sale en toda reunión). */
export const DEFINICION_CONVERSACION =
  "Todo el contacto con una misma persona dentro de 24 horas cuenta como UNA conversación.";

/** El servicio no se corta al pasarse del cupo: se avisa al 80% y al 100%. */
export const POLITICA_EXCEDENTE =
  "El servicio nunca se corta si se pasan del cupo. Se avisa al 80% y al 100%, y el excedente " +
  "se cobra POR CONVERSACIÓN — nunca en paquetes: \"$80 la conversación adicional\" suena mucho " +
  "más barato que \"cada 300 más por $24.000\", y es exactamente lo mismo.";

/** Días de prueba sin costo (reemplaza el "primer mes gratis" de julio). */
export const DIAS_PRUEBA = 14;

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
  /** Señales de automatización de la web (lib/enriquecimiento.ts) */
  senales_web?: {
    potencial?: "alto" | "medio" | "bajo" | "desconocido";
    chatbot?: string | null;
    reservas?: string | null;
    formulario_hora?: boolean;
    solo_redes?: boolean;
    celular_whatsapp?: boolean;
    whatsapp_link?: boolean;
  } | null;
  mensaje: string | null;
  estado: Estado;
  proxima_accion: string | null;
  notas: string | null;
  place_id: string | null;
  created_at: string;
  updated_at: string;
}

/** La prueba de concepto de 2 semanas que promete la secuencia de correos. */
export const RESULTADOS_DEMO = ["", "en_curso", "exitosa", "sin_uso", "no_convencio", "cancelada"] as const;
export type ResultadoDemo = (typeof RESULTADOS_DEMO)[number];

export const RESULTADO_DEMO_LABEL: Record<ResultadoDemo, string> = {
  "": "Sin demo",
  en_curso: "Demo en curso",
  exitosa: "Demo exitosa",
  sin_uso: "No la usaron",
  no_convencio: "No convenció",
  cancelada: "Cancelada",
};

/** Duración estándar de la prueba de concepto, en días. */
export const DIAS_DEMO = 14;

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
  demo_inicio: string | null;
  demo_termino: string | null;
  demo_resultado: ResultadoDemo;
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
/**
 * Actualizado 1-ago-2026 (ver AUDITORIA_RESPONDHQ_AGO2026.md): los pasos
 * viejos ("crear workflow en n8n") describían la arquitectura anterior al
 * 21-jul. Hoy el cliente se da de alta en respondo-portal (ed_clientes/
 * ed_empleados), no en n8n.
 */
export const ONBOARDING_PASOS_DEFAULT = [
  "Kickoff con el cliente: qué vende, FAQs, tono deseado",
  "Crear el cliente y su empleado digital en respondo-portal (ed_clientes/ed_empleados)",
  "Conectar el canal de WhatsApp (Evolution/QR u oficial Cloud API, según corresponda)",
  "Configurar tono, horarios y derivación (en Información, dentro del Portal)",
  "Pegar el ID del cliente del Portal en \"ID de referencia\" de esta ficha (activa el puente de eventos a HQ)",
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
 * De dónde salió el contacto (migraciones 011, 012, 013 y 014):
 * - "ia": generado por Gemini con google_search grounding (lib/contactoAI.ts).
 * - "hunter": Domain Search de Hunter.io — base de datos real, no IA.
 * - "apollo": People Search + Enrichment de Apollo.io — DESHABILITADO en el
 *   selector: confirmado (API_INACCESSIBLE) que el plan gratuito no da
 *   acceso a mixed_people/api_search. El código queda listo por si suben
 *   de plan.
 * - "hunter_ia": modo mixto (lib/contactoMixto.ts) — Hunter aporta el dato
 *   real y la IA solo lo VERIFICA/enriquece (nunca inventa desde cero). Si
 *   Hunter no encuentra nada, el resultado se guarda como "ia" pura.
 * - "lusha": Prospecting + Enrich de Lusha.io (lib/lushaAPI.ts) — a
 *   diferencia de Apollo, el plan gratuito SÍ permite buscar y revelar.
 *   Probado el 14-jul-2026 con cobertura real para pymes/medianas
 *   chilenas (no solo multinacionales). Igual que Apollo: busca gratis
 *   (nombre real, sin contacto) y revela a pedido (gasta crédito).
 * - "todas": el que se PIDE (lib/contactoCombinado.ts) — nunca se guarda
 *   tal cual, siempre se resuelve a uno de los siguientes:
 * - "hunter_lusha": Hunter y Lusha confirmaron la MISMA persona (cruce de
 *   dos bases reales independientes) — confianza alta sin pasar por IA.
 *   Si no hay cruce, "todas" cae a "hunter_ia" (con nota de qué otros
 *   candidatos vio Lusha), a "lusha" (candidatos múltiples, si Hunter no
 *   encontró nada) o a "ia" pura (si ninguna base real encontró nada).
 */
export const FUENTES_CONTACTO = ["todas", "hunter_ia", "hunter", "ia", "lusha", "apollo"] as const;
export type Fuente = (typeof FUENTES_CONTACTO)[number] | "hunter_lusha";

export const FUENTE_LABEL: Record<Fuente, string> = {
  todas: "Todas las fuentes (recomendado)",
  hunter_ia: "Hunter + IA",
  hunter: "Solo Hunter.io",
  ia: "Solo IA (búsqueda web)",
  lusha: "Lusha (busca gratis, revela con crédito)",
  apollo: "Apollo.io",
  hunter_lusha: "Hunter + Lusha (cruzado)",
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
  // Solo relevante cuando fuente === "lusha": id interno de Lusha para
  // poder "revelar" (gastar crédito) más tarde. Null si nunca se buscó
  // por Lusha o si ya fue revelado y no hace falta reconsultar.
  lusha_contact_id: string | null;
  created_at: string;
  updated_at: string;
}
