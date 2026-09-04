import { db } from "@/lib/db";
import { ENCAJE_RANK, type NivelEncaje } from "@/lib/encaje";
import { alcanceDe } from "@/lib/alcance";
import { normalizarTelefono, telefonosSuprimidos } from "@/lib/actividades";

/**
 * Leads Foco — el segundo motor de prospección.
 *
 * La lista de Google Maps trae micro-pymes y el número del local. Esta trae
 * empresas medianas con una PERSONA identificada: nombre, cargo y su número.
 * Son dos juegos distintos y por eso viven separados.
 */

/**
 * Regla TGP: a la 3ª llamada seguida sin que nadie conteste, el lead se retira
 * solo de la base (estado descartado, con el motivo en la nota). El contador
 * se reinicia si CUALQUIERA contesta — portero incluido: un portero prueba que
 * el número funciona, lo que retira es el número muerto.
 */
export const MAX_SIN_CONTESTAR = 3;

/** Disposiciones del modal de resultado. El orden es el de la pantalla. */
export const RESULTADOS_FOCO = [
  "no_contesta",
  "exito",
  "rechazo",
  "derivo",
  "llamar_mas_tarde",
  "mandar_correo",
  "gatekeeper",
  "equivocado",
  "no_existe",
  "no_aplica",
  "ya_cliente",
  "mandar_whatsapp",
  "duplicado",
  "no_contactar",
  "blacklist",
] as const;
export type ResultadoFoco = (typeof RESULTADOS_FOCO)[number];

export interface CfgResultado {
  label: string;
  /** Estado al que lleva el lead. null = no cambia. */
  estado: "nuevo" | "contactando" | "agendado" | "ganado" | "descartado" | null;
  /** Cuántos días después vuelve a la cola. null = no vuelve solo. */
  reagendaDias: number | null;
  /** Suma un intento de marcado. */
  cuentaIntento: boolean;
  /** Manda el número a la lista de supresión global. */
  suprime: boolean;
  tono: "ok" | "warn" | "danger" | "neutro";
}

export const RESULTADO_CFG: Record<ResultadoFoco, CfgResultado> = {
  no_contesta:      { label: "No contesta",       estado: "contactando", reagendaDias: 3,  cuentaIntento: true,  suprime: false, tono: "neutro" },
  exito:            { label: "Éxito",             estado: "agendado",    reagendaDias: null, cuentaIntento: true,  suprime: false, tono: "ok" },
  rechazo:          { label: "Rechazo",           estado: "descartado",  reagendaDias: null, cuentaIntento: true,  suprime: true,  tono: "danger" },
  derivo:           { label: "Derivó",            estado: "contactando", reagendaDias: 1,  cuentaIntento: true,  suprime: false, tono: "ok" },
  llamar_mas_tarde: { label: "Llamar más tarde",  estado: "contactando", reagendaDias: 2,  cuentaIntento: true,  suprime: false, tono: "warn" },
  mandar_correo:    { label: "Mandar correo",     estado: "contactando", reagendaDias: 3,  cuentaIntento: true,  suprime: false, tono: "neutro" },
  // Llegar al portero NO es conectar. Se cuenta aparte, igual que en /llamadas.
  gatekeeper:       { label: "Quedó en el portero", estado: "contactando", reagendaDias: 2, cuentaIntento: true, suprime: false, tono: "warn" },
  equivocado:       { label: "Número equivocado", estado: "contactando", reagendaDias: null, cuentaIntento: true,  suprime: false, tono: "warn" },
  no_existe:        { label: "No existe",         estado: "descartado",  reagendaDias: null, cuentaIntento: true,  suprime: false, tono: "danger" },
  no_aplica:        { label: "No aplica",         estado: "descartado",  reagendaDias: null, cuentaIntento: false, suprime: false, tono: "neutro" },
  ya_cliente:       { label: "Ya es cliente",     estado: "descartado",  reagendaDias: null, cuentaIntento: false, suprime: false, tono: "ok" },
  mandar_whatsapp:  { label: "Mandar WhatsApp",   estado: "contactando", reagendaDias: 2,  cuentaIntento: true,  suprime: false, tono: "ok" },
  duplicado:        { label: "Duplicado",         estado: "descartado",  reagendaDias: null, cuentaIntento: false, suprime: false, tono: "neutro" },
  // Oposición explícita: se suprime el número para todos los canales.
  no_contactar:     { label: "No contactar",      estado: "descartado",  reagendaDias: null, cuentaIntento: true,  suprime: true,  tono: "danger" },
  blacklist:        { label: "Sugerir blacklist", estado: "descartado",  reagendaDias: null, cuentaIntento: true,  suprime: true,  tono: "danger" },
};

/** Los que significan que se habló con la persona objetivo. */
export const CONECTA_FOCO: ResultadoFoco[] = [
  "exito", "rechazo", "derivo", "llamar_mas_tarde", "mandar_correo", "mandar_whatsapp", "ya_cliente",
];

export const ESTADOS_FOCO = ["nuevo", "contactando", "agendado", "ganado", "descartado"] as const;
export type EstadoFoco = (typeof ESTADOS_FOCO)[number];
export const ESTADO_FOCO_LABEL: Record<EstadoFoco, string> = {
  nuevo: "Nuevo",
  contactando: "Contactando",
  agendado: "Agendado",
  ganado: "Ganado",
  descartado: "Descartado",
};

/** Un teléfono o correo conocido del lead. El que se trabaja es el primario. */
export interface DatoContacto {
  valor: string;
  /** movil | corporativo | otro · para correos: trabajo | personal | otro */
  tipo: string;
  fuente: string;
}

export interface LeadFoco {
  /** Todos los teléfonos conocidos (migración 034). `telefono` es el primario. */
  telefonos?: DatoContacto[] | null;
  emails?: DatoContacto[] | null;
  /** Fase 3 — copia de la señal vigente: ordena la cola y se dice en la llamada. */
  senal_reciente?: string | null;
  senal_reciente_url?: string | null;
  senal_reciente_at?: string | null;
  senal_vigente_hasta?: string | null;
  id: string;
  empresa: string;
  razon_social: string;
  rut: string;
  web: string;
  linkedin_empresa: string;
  industria: string;
  n_empleados: number | null;
  comuna: string;
  region: string;
  contacto: string;
  cargo: string;
  telefono: string;
  email: string;
  linkedin_contacto: string;
  lista: string;
  estado: EstadoFoco;
  ultimo_resultado: ResultadoFoco | null;
  tags: string[];
  nota: string;
  recordatorio: string | null;
  intentos: number;
  /** No-contesta seguidas. Al llegar a MAX_SIN_CONTESTAR el lead se retira. */
  sin_contestar: number;
  /** 3 = teléfono + persona · 2 = solo teléfono · 1 = solo persona · 0 = nada. */
  contactabilidad: number;
  /**
   * 0-4: ¿lo contesta quien decide? Celular publicado = el dueño; fijo = mesón.
   * Es lo que ordena la cola de llamadas desde el 4-sep-2026 (migración 036).
   */
  alcance: number;
  /** De dónde salió el número que se va a marcar: apollo, places, cascada, a mano. */
  origen_telefono: string;
  /** Contactos con evidencia (migración 037). Lo llena /api/foco/enriquecer. */
  contactos: import("@/lib/contactos").ContactoConEvidencia[];
  /** En qué montón va: excelente, buena, via_central… */
  calidad: import("@/lib/contactabilidad").EstadoLead;
  enriquecido_at: string | null;
  encaje: NivelEncaje;
  encaje_motivo: string;
  encaje_manual: boolean;
  /** El número está en la lista global de supresión (alguien pidió no ser
   *  contactado, desde CUALQUIERA de los dos motores). Se calcula al listar,
   *  no se guarda: la lista de supresión cambia todos los días. */
  suprimido: boolean;
  ultimo_intento: string | null;
  senal: string;
  confianza: string;
  fuente_url: string;
  ficha: Record<string, unknown> | null;
}

const SELECT =
  "id,empresa,razon_social,rut,web,linkedin_empresa,industria,n_empleados,comuna,region," +
  "contacto,cargo,telefono,email,linkedin_contacto,lista,estado,ultimo_resultado,tags,nota," +
  "recordatorio,intentos,sin_contestar,ultimo_intento,senal,confianza,fuente_url,ficha,contactabilidad," +
  "alcance,origen_telefono,contactos,calidad,enriquecido_at," +
  "encaje,encaje_motivo,encaje_manual," +
  "senal_reciente,senal_reciente_url,senal_reciente_at,senal_vigente_hasta," +
  "telefonos,emails";

/**
 * Grupos de cargo. El MISMO mapa arma los chips del filtro (en resumenFoco) y
 * traduce el filtro a la consulta (en listarFoco). Antes eran dos lógicas
 * separadas: el resumen agrupaba "Directora de Administración" bajo
 * "Dirección" con un regex, y el filtro después buscaba ilike '%Dirección%'
 * —con tilde— contra datos sin tilde. Resultado: el filtro devolvía cero
 * filas y parecía que no había nadie de dirección. Un solo mapa, cero drift.
 */
/** El mismo SELECT sin lo que agrega la migración 036, para el reintento. */
const SELECT_SIN_036 = SELECT.replace("alcance,origen_telefono,contactos,calidad,enriquecido_at,", "");

export const GRUPOS_CARGO: Record<string, string[]> = {
  "Gerencia general": ["gerente general", "director ejecutivo", "ceo", "general manager"],
  Comercial: ["comercial", "ventas", "sales"],
  Operaciones: ["operacion", "logist"],
  Marketing: ["marketing"],
  "Administración": ["administra", "finanz"],
  "Dirección": ["rector", "director"],
};

function grupoDeCargo(cargo: string): string | null {
  const c = cargo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  for (const [grupo, terminos] of Object.entries(GRUPOS_CARGO)) {
    if (terminos.some((t) => c.includes(t))) return grupo;
  }
  return c.trim() ? "Otros" : null;
}

export interface FiltrosFoco {
  lista?: string;
  estado?: EstadoFoco | "activos" | "procesados";
  cargo?: string;
  q?: string;
  /** "hoy" = lo que toca marcar ahora · "investigar" = sirven pero les falta
   *  teléfono o persona (trabajo de escritorio) · "todos" = sin filtro. */
  cola?: "hoy" | "todos" | "investigar";
  /** "sirven" = alto, medio y sin evaluar. Es el default: lo que no encaja no
   *  se borra, se saca de la vista para no gastarle el día a nadie. */
  encaje?: NivelEncaje | "sirven" | "todos";
  limite?: number;
}

export async function listarFoco(f: FiltrosFoco = {}): Promise<LeadFoco[]> {
  /**
   * Se consulta dos veces si hace falta, y esto no es paranoia de más.
   *
   * `alcance` y `origen_telefono` llegan con la migración 036. Si el código
   * se despliega ANTES de correr la migración —el orden en que estas cosas
   * pasan en la vida real— PostgREST responde "column does not exist" y la
   * pantalla de Leads Foco queda en blanco. No un dato faltante: la pantalla
   * completa, que es de la que trabaja el equipo todos los días.
   *
   * Así que si la columna no está todavía, se reintenta con el orden anterior
   * y `alcance` se calcula en la aplicación (`lib/alcance.ts` da exactamente
   * lo mismo que la columna generada: 14/14 en `pruebas/alcance.ts`). Se pierde
   * el orden nuevo hasta que se corra la migración, no la herramienta.
   */
  const traer = async (conAlcance: boolean) => {
    let q = db().from("leads_foco").select(conAlcance ? SELECT : SELECT_SIN_036);

    if (f.lista && f.lista !== "todas") q = q.eq("lista", f.lista);

    // "Activos" y "Procesados" son los dos montones que importan al trabajar:
    // lo que queda por tocar y lo que ya tuvo un desenlace.
    if (f.estado === "activos") q = q.in("estado", ["nuevo", "contactando"]);
    else if (f.estado === "procesados") q = q.in("estado", ["agendado", "ganado", "descartado"]);
    else if (f.estado) q = q.eq("estado", f.estado);

    if (!f.encaje || f.encaje === "sirven") q = q.in("encaje", ["alto", "medio", "sin_evaluar"]);
    else if (f.encaje !== "todos") q = q.eq("encaje", f.encaje);

    if (f.cargo && f.cargo !== "todos") {
      const terminos = GRUPOS_CARGO[f.cargo];
      if (terminos) {
        q = q.or(terminos.map((t) => `cargo.ilike.%${t}%`).join(","));
      } else if (f.cargo === "Otros") {
        // "Otros" no se puede expresar como un ilike; se filtra al volver.
      } else {
        q = q.ilike("cargo", `%${f.cargo}%`);
      }
    }
    if (f.q) {
      const t = f.q.replace(/[%,()]/g, "");
      q = q.or(`empresa.ilike.%${t}%,contacto.ilike.%${t}%,cargo.ilike.%${t}%,telefono.ilike.%${t}%`);
    }

    // La cola "hoy" esconde lo que está agendado para más adelante: un lead con
    // recordatorio al viernes no es trabajo de hoy y en la lista solo estorba.
    if (f.cola === "investigar") {
      // Los que SÍ sirven pero no se pueden marcar: falta el teléfono, la
      // persona, o las dos cosas. Es la cola de escritorio: se trabaja con
      // LinkedIn y el sitio, no con el teléfono.
      q = q.in("estado", ["nuevo", "contactando"]).lt("contactabilidad", 3);
    } else if (f.cola !== "todos") {
      q = q.or(`recordatorio.is.null,recordatorio.lte.${new Date().toISOString()}`);
    }

    // Orden de trabajo. PRIMERO las promesas: un recordatorio vencido es una
    // palabra empeñada ("llámame el jueves") y en la cola de hoy todos los
    // recordatorios visibles ya vencieron, así que van arriba, el más viejo
    // primero. (Bug real: al meter el orden por encaje, las promesas quedaron
    // enterradas bajo leads frescos durante una versión.)
    //
    // Después, y acá está la corrección del 25-ago-2026: en la COLA DE HOY manda
    // la contactabilidad, no el encaje.
    //
    // El orden anterior ponía el encaje primero, con el argumento de que "de nada
    // sirve un teléfono directo si el negocio no se puede atender". Suena bien y
    // está mal para esta pantalla: dejaba un lead con teléfono Y persona —o sea,
    // marcable AHORA— debajo de diez leads de encaje alto que dicen "sin número".
    // Un lead que no se puede llamar no es trabajo de la cola de llamadas; es
    // trabajo de escritorio, y para eso existe la cola "Por investigar", que
    // filtra justamente por contactabilidad < 3.
    //
    // El encaje no desaparece: sigue decidiendo el orden ENTRE los que sí se
    // pueden marcar, y sigue filtrando de entrada (bajo y nulo no se muestran).
    // En las demás vistas —"Todos" y "Por investigar"— el encaje manda como
    // antes, porque ahí sí se está eligiendo a quién vale la pena perseguir.
    let qo = q;
    const colaDeLlamadas = f.cola !== "investigar" && f.cola !== "todos";
    if (colaDeLlamadas) {
      qo = qo.order("recordatorio", { ascending: true, nullsFirst: false });
      // Corrección del 4-sep-2026, después de la tanda de llamadas de Tomás en
      // la que no alcanzó a nadie: acá mandaba `contactabilidad`, que cuenta si
      // HAY teléfono y si HAY persona pero nunca preguntó QUÉ teléfono.
      // Resultado: un fijo con nombre puntúa 3 —el máximo— y encabezaba la cola.
      // Eso es el mesón, y es exactamente lo que contestó.
      //
      // `alcance` (migración 036) responde la pregunta que importa antes de
      // marcar: ¿contesta el que decide? Y contiene a la anterior — un lead sin
      // teléfono o sin persona ya queda abajo igual.
      // La CALIDAD manda por sobre el alcance. `alcance` mira el formato del
    // número (móvil o fijo); `calidad` mira la evidencia: si el negocio lo
    // publica él mismo, si lo confirman dos fuentes, si alguien ya lo llamó y
    // resultó malo. Es estrictamente más información.
    //
    // `alcance` se queda como desempate: entre dos leads igual de buenos,
    // primero el que tiene móvil.
    qo = conAlcance
      ? qo.order("calidad_rank", { ascending: false }).order("alcance", { ascending: false })
      : qo.order("contactabilidad", { ascending: false });
      // Fase 3: entre los que se pueden marcar, primero los que tienen una señal
      // VIGENTE. Un aviso buscando recepcionista publicado esta semana es un
      // negocio diciendo que tiene el problema AHORA; llamarlo hoy no es lo mismo
      // que llamarlo en tres meses. Las vencidas las borra el worker antes de
      // detectar nuevas, así que lo que quede acá está vivo.
      qo = qo.order("senal_vigente_hasta", { ascending: false, nullsFirst: false });
      qo = qo.order("encaje_rank", { ascending: false });
    } else {
      qo = qo.order("encaje_rank", { ascending: false });
      qo = qo.order("contactabilidad", { ascending: false });
    }
    // El desempate final por `n_empleados` descendente se quedó SOLO en las
    // vistas de escritorio. En la cola de llamadas era, literalmente, la
    // instrucción "llama primero a las empresas más grandes" — o sea, primero a
    // las que tienen recepcionista. Es la misma raíz del problema del 4-sep:
    // ahí sirve para decidir a quién perseguir; acá servía para no alcanzar a
    // nadie.
    return await (colaDeLlamadas
      ? qo.order("intentos", { ascending: true })
      : qo.order("intentos", { ascending: true }).order("n_empleados", { ascending: false, nullsFirst: false })
    ).limit(f.limite ?? 300);
  };

  let r = await traer(true);
  if (r.error && /alcance|origen_telefono|contactos|calidad|enriquecido_at/i.test(r.error.message)) {
    console.warn(
      "[foco] faltan columnas de las migraciones 036/037: se ordena como antes y lo que falta se calcula en la app. " +
      "Corre supabase/migrations/036_alcance_del_lead.sql y 037_contactos_con_evidencia.sql.",
    );
    r = await traer(false);
  }
  const suprimidos = await telefonosSuprimidos();
  const { data, error } = r;
  if (error) throw new Error(error.message);

  // La supresión es GLOBAL entre los dos motores: si un número pidió no ser
  // contactado en /llamadas, acá tiene que aparecer bloqueado también. Se
  // marca en vez de esconderse: el lead sigue siendo trabajable por otro
  // canal (correo, LinkedIn), lo vetado es el teléfono.
  let filas = (data ?? []) as unknown as LeadFoco[];
  // Si la consulta cayó al respaldo, las columnas de la 036 no vienen. Se
  // calculan acá para que la lista, los badges y la ficha se vean igual.
  for (const fila of filas) {
    if (typeof fila.alcance !== "number") fila.alcance = alcanceDe(fila);
    if (typeof fila.origen_telefono !== "string") fila.origen_telefono = "";
    if (!Array.isArray(fila.contactos)) fila.contactos = [];
    if (typeof fila.calidad !== "string") fila.calidad = "insuficiente";
  }
  if (f.cargo === "Otros") filas = filas.filter((x) => grupoDeCargo(x.cargo) === "Otros");
  for (const fila of filas) {
    const tel = normalizarTelefono(fila.telefono ?? "");
    fila.suprimido = !!tel && suprimidos.has(tel);
  }
  return filas;
}

export interface ResumenFoco {
  listas: { lista: string; n: number }[];
  cargos: string[];
  activos: number;
  procesados: number;
  total: number;
  conTelefono: number;
  conDecisor: number;
  /** Teléfono Y persona: los que de verdad se pueden marcar. */
  llamables: number;
  /** Llamables Y con encaje alto o medio: el trabajo real. */
  trabajables: number;
  /** Encajan pero les falta teléfono o persona: la cola de investigación. */
  porInvestigar: number;
  porEncaje: Record<string, number>;
  vencidos: number;
}

export async function resumenFoco(lista?: string): Promise<ResumenFoco> {
  let q = db().from("leads_foco").select("lista,estado,cargo,telefono,contacto,recordatorio,encaje");
  if (lista && lista !== "todas") q = q.eq("lista", lista);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const filas = (data ?? []) as {
    lista: string; estado: string; cargo: string; telefono: string; contacto: string;
    recordatorio: string | null; encaje: NivelEncaje;
  }[];

  const porLista = new Map<string, number>();
  for (const f of filas) porLista.set(f.lista, (porLista.get(f.lista) ?? 0) + 1);

  // Mismo mapa que usa el filtro: lo que se ofrece es exactamente lo que se
  // puede consultar.
  const cargos = new Set<string>();
  for (const f of filas) {
    const g = grupoDeCargo(f.cargo);
    if (g) cargos.add(g);
  }

  const ahora = new Date().toISOString();
  return {
    listas: [...porLista.entries()].map(([lista, n]) => ({ lista, n })).sort((a, b) => b.n - a.n),
    cargos: [...cargos].sort(),
    activos: filas.filter((f) => ["nuevo", "contactando"].includes(f.estado)).length,
    procesados: filas.filter((f) => ["agendado", "ganado", "descartado"].includes(f.estado)).length,
    total: filas.length,
    conTelefono: filas.filter((f) => f.telefono.trim()).length,
    conDecisor: filas.filter((f) => f.contacto.trim()).length,
    llamables: filas.filter((f) => f.telefono.trim() && f.contacto.trim()).length,
    trabajables: filas.filter(
      (f) => f.telefono.trim() && f.contacto.trim() && ENCAJE_RANK[f.encaje] >= 3,
    ).length,
    // Incluye los "sin evaluar" a propósito: investigar es exactamente cómo un
    // sin-evaluar se convierte en alto o en descarte. (Y el contador tiene que
    // cuadrar con lo que muestra la cola, que usa el mismo corte.)
    porInvestigar: filas.filter(
      (f) =>
        ["nuevo", "contactando"].includes(f.estado) &&
        ENCAJE_RANK[f.encaje] >= 2 &&
        !(f.telefono.trim() && f.contacto.trim()),
    ).length,
    porEncaje: filas.reduce<Record<string, number>>((acc, f) => {
      acc[f.encaje] = (acc[f.encaje] ?? 0) + 1;
      return acc;
    }, {}),
    vencidos: filas.filter((f) => f.recordatorio && f.recordatorio <= ahora).length,
  };
}
