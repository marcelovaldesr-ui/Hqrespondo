import { db } from "@/lib/db";

/**
 * Objetivos semanales por socio — el reemplazo del Excel del Drive.
 *
 * Ritual que ya tenía el equipo y que acá se respeta tal cual:
 *   lunes    → cada socio carga 2-3 objetivos
 *   viernes  → reunión de números, se marca cómo fue y se conversa
 */

export const ESTADOS_OBJETIVO = [
  "pendiente",
  "cumplido",
  "parcial",
  "no_cumplido",
] as const;
export type EstadoObjetivo = (typeof ESTADOS_OBJETIVO)[number];

export const ESTADO_OBJETIVO_LABEL: Record<EstadoObjetivo, string> = {
  pendiente: "Pendiente",
  cumplido: "Cumplido",
  parcial: "Parcial",
  no_cumplido: "No cumplido",
};

/** Peso para el % de cumplimiento. Parcial vale medio, igual que en el Excel. */
export const PESO_ESTADO: Record<EstadoObjetivo, number> = {
  pendiente: 0,
  cumplido: 1,
  parcial: 0.5,
  no_cumplido: 0,
};

export interface Socio {
  nombre: string;
  rol: string;
}

/** Los 3 socios y su foco. Editable acá, no hay tabla aparte a propósito:
 *  son 3 personas, una tabla sería más ceremonia que ayuda. */
export const SOCIOS: Socio[] = [
  { nombre: "Marcelo", rol: "Producto y Tecnología" },
  { nombre: "José", rol: "Crecimiento y Demanda" },
  { nombre: "Tomás", rol: "Comercial y Ventas" },
];

export interface ObjetivoSemana {
  id: string;
  semana: string; // YYYY-MM-DD (lunes)
  socio: string;
  rol: string;
  objetivo: string;
  como_se_mide: string;
  estado: EstadoObjetivo;
  motivo: string;
  hablado_reunion: boolean;
}

/** Lunes de la semana de una fecha, en horario de Chile. */
export function lunesDe(fecha: Date = new Date()): string {
  const enChile = new Date(
    fecha.toLocaleString("en-US", { timeZone: "America/Santiago" }),
  );
  const dia = enChile.getDay(); // 0 domingo … 6 sábado
  const alLunes = dia === 0 ? -6 : 1 - dia;
  enChile.setDate(enChile.getDate() + alLunes);
  const y = enChile.getFullYear();
  const m = String(enChile.getMonth() + 1).padStart(2, "0");
  const d = String(enChile.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Corre una semana hacia adelante o hacia atrás desde un lunes. */
export function semanaOffset(lunes: string, semanas: number): string {
  const [y, m, d] = lunes.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + semanas * 7);
  return base.toISOString().slice(0, 10);
}

/** Etiqueta legible: "11 – 17 de agosto". */
export function rangoSemana(lunes: string): string {
  const [y, m, d] = lunes.split("-").map(Number);
  const ini = new Date(Date.UTC(y, m - 1, d));
  const fin = new Date(ini);
  fin.setUTCDate(fin.getUTCDate() + 6);
  const f = (dt: Date, conMes: boolean) =>
    dt.toLocaleDateString("es-CL", {
      day: "numeric",
      ...(conMes ? { month: "long" } : {}),
      timeZone: "UTC",
    });
  const mismoMes = ini.getUTCMonth() === fin.getUTCMonth();
  return mismoMes ? `${f(ini, false)} – ${f(fin, true)}` : `${f(ini, true)} – ${f(fin, true)}`;
}

export interface ResumenSocio {
  socio: string;
  rol: string;
  total: number;
  cumplidos: number;
  parciales: number;
  no_cumplidos: number;
  pendientes: number;
  /** 0–1. Parcial cuenta medio. Los pendientes NO se castigan: si la semana
   *  está en curso, marcar 0% sería mentir. */
  cumplimiento: number;
  /** El semáforo real: cayeron y nadie los conversó. */
  mudos: number;
}

export function resumirSocio(
  socio: Socio,
  objetivos: ObjetivoSemana[],
): ResumenSocio {
  const mios = objetivos.filter((o) => o.socio === socio.nombre);
  const cumplidos = mios.filter((o) => o.estado === "cumplido").length;
  const parciales = mios.filter((o) => o.estado === "parcial").length;
  const no_cumplidos = mios.filter((o) => o.estado === "no_cumplido").length;
  const pendientes = mios.filter((o) => o.estado === "pendiente").length;
  const evaluados = mios.length - pendientes;
  return {
    socio: socio.nombre,
    rol: socio.rol,
    total: mios.length,
    cumplidos,
    parciales,
    no_cumplidos,
    pendientes,
    cumplimiento: evaluados > 0 ? (cumplidos + 0.5 * parciales) / evaluados : 0,
    mudos: mios.filter((o) => o.estado === "no_cumplido" && !o.hablado_reunion)
      .length,
  };
}

const SELECT =
  "id,semana,socio,rol,objetivo,como_se_mide,estado,motivo,hablado_reunion";

export async function objetivosDeSemana(
  lunes: string,
): Promise<ObjetivoSemana[]> {
  const { data, error } = await db()
    .from("objetivos_semana")
    .select(SELECT)
    .eq("semana", lunes)
    .order("socio")
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as ObjetivoSemana[];
}

/** Cumplimiento por socio de las últimas N semanas, para la tendencia. */
export async function tendencia(
  lunesActual: string,
  semanas = 8,
): Promise<{ semana: string; porSocio: Record<string, number | null> }[]> {
  const desde = semanaOffset(lunesActual, -(semanas - 1));
  const { data, error } = await db()
    .from("objetivos_semana")
    .select("semana,socio,estado")
    .gte("semana", desde)
    .lte("semana", lunesActual);
  if (error) throw new Error(error.message);

  const filas = (data ?? []) as { semana: string; socio: string; estado: EstadoObjetivo }[];
  const out: { semana: string; porSocio: Record<string, number | null> }[] = [];
  for (let i = 0; i < semanas; i++) {
    const s = semanaOffset(desde, i);
    const porSocio: Record<string, number | null> = {};
    for (const soc of SOCIOS) {
      const suyos = filas.filter(
        (f) => f.semana === s && f.socio === soc.nombre && f.estado !== "pendiente",
      );
      porSocio[soc.nombre] = suyos.length
        ? suyos.reduce((a, f) => a + PESO_ESTADO[f.estado], 0) / suyos.length
        : null;
    }
    out.push({ semana: s, porSocio });
  }
  return out;
}
