import { db } from "@/lib/db";

/**
 * Inserta filas en `leads_foco` y sobrevive a que falte una migración.
 *
 * POR QUÉ EXISTE — 4-sep-2026
 * La migración 036 agrega `origen_telefono`, y desde ese día las cuatro
 * puertas por las que entra un lead —importar CSV, alta manual, cascada del
 * SII y el puente desde Places— la escriben.
 *
 * El problema es el orden en que pasan las cosas de verdad: el código se
 * despliega solo (push a Vercel) y la migración se corre a mano en Supabase.
 * Entre una y otra hay una ventana. Si alguien importa una tanda de Apollo en
 * esa ventana, PostgREST responde «Could not find the 'origen_telefono'
 * column» y la importación entera se cae — no una columna, las 200 filas.
 *
 * Acá, si la base todavía no conoce una columna, se saca esa columna y se
 * reintenta. Se pierde ese dato hasta que se corra la migración; no se pierde
 * la tanda. Y queda avisado en el log qué migración falta, para que el arreglo
 * sea obvio en vez de un misterio.
 *
 * NO oculta errores de verdad: solo reintenta ante el error específico de
 * columna desconocida (PGRST204), y como máximo tres veces. Cualquier otra
 * cosa —un duplicado, un CHECK, un problema de permisos— sube tal cual.
 */

/** PostgREST: «Could not find the 'X' column of 'tabla' in the schema cache». */
const COLUMNA_DESCONOCIDA = /Could not find the '([a-zA-Z0-9_]+)' column/;

type ErrorPostgrest = { message: string; code?: string } | null;

export async function insertarLeads(
  filas: Record<string, unknown>[],
): Promise<{ error: ErrorPostgrest; columnasIgnoradas: string[] }> {
  if (!filas.length) return { error: null, columnasIgnoradas: [] };

  let actuales = filas;
  const ignoradas: string[] = [];

  for (let intento = 0; intento < 3; intento++) {
    const { error } = await db().from("leads_foco").insert(actuales);
    if (!error) return { error: null, columnasIgnoradas: ignoradas };

    const m = COLUMNA_DESCONOCIDA.exec(error.message ?? "");
    if (!m) return { error, columnasIgnoradas: ignoradas };

    const col = m[1];
    console.warn(
      `[leads] la base no conoce la columna "${col}": se inserta sin ella. ` +
        `Falta correr supabase/migrations/036_alcance_del_lead.sql.`,
    );
    ignoradas.push(col);
    actuales = actuales.map((f) => {
      const copia = { ...f };
      delete copia[col];
      return copia;
    });
  }

  return {
    error: { message: `no se pudo insertar tras quitar ${ignoradas.join(", ")}` },
    columnasIgnoradas: ignoradas,
  };
}

/**
 * Igual, pero para UNA fila de la que hace falta el resultado (el alta manual
 * y la promoción desde el SII necesitan el id recién creado).
 */
export async function insertarLead<T = Record<string, unknown>>(
  fila: Record<string, unknown>,
  devolver: string,
): Promise<{ data: T | null; error: ErrorPostgrest; columnasIgnoradas: string[] }> {
  let actual = fila;
  const ignoradas: string[] = [];

  for (let intento = 0; intento < 3; intento++) {
    const { data, error } = await db()
      .from("leads_foco")
      .insert(actual)
      .select(devolver)
      .single();
    if (!error) return { data: data as T, error: null, columnasIgnoradas: ignoradas };

    const m = COLUMNA_DESCONOCIDA.exec(error.message ?? "");
    if (!m) return { data: null, error, columnasIgnoradas: ignoradas };

    const col = m[1];
    console.warn(
      `[leads] la base no conoce la columna "${col}": se inserta sin ella. ` +
        `Falta correr supabase/migrations/036_alcance_del_lead.sql.`,
    );
    ignoradas.push(col);
    const copia = { ...actual };
    delete copia[col];
    actual = copia;
  }

  return {
    data: null,
    error: { message: `no se pudo insertar tras quitar ${ignoradas.join(", ")}` },
    columnasIgnoradas: ignoradas,
  };
}

/**
 * Y para ACTUALIZAR una fila, con la misma tolerancia.
 *
 * El enriquecimiento escribe columnas de tres migraciones distintas (037
 * contactos, 038 calidad, 039 prioridad). Sin esto, desplegar el código antes
 * de correr la 039 hace que una corrida sobre 200 leads no escriba NADA —ni
 * siquiera los contactos, que sí existían— porque PostgREST rechaza el patch
 * entero por una columna que no conoce. Con esto se pierde la columna nueva
 * hasta que se corra la migración; el trabajo del enriquecimiento se guarda.
 */
export async function actualizarLead(
  id: number | string,
  patch: Record<string, unknown>,
): Promise<{ error: ErrorPostgrest; columnasIgnoradas: string[] }> {
  let actual = patch;
  const ignoradas: string[] = [];

  for (let intento = 0; intento < 4; intento++) {
    if (!Object.keys(actual).length) return { error: null, columnasIgnoradas: ignoradas };
    const { error } = await db().from("leads_foco").update(actual).eq("id", id);
    if (!error) return { error: null, columnasIgnoradas: ignoradas };

    const m = COLUMNA_DESCONOCIDA.exec(error.message ?? "");
    if (!m) return { error, columnasIgnoradas: ignoradas };

    const col = m[1];
    console.warn(
      `[leads] la base no conoce la columna "${col}": se actualiza sin ella. ` +
        `Falta correr una migración (036 origen_telefono · 037 contactos/calidad · 039 prioridad).`,
    );
    ignoradas.push(col);
    const copia = { ...actual };
    delete copia[col];
    actual = copia;
  }

  return {
    error: { message: `no se pudo actualizar tras quitar ${ignoradas.join(", ")}` },
    columnasIgnoradas: ignoradas,
  };
}
