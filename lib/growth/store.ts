import { db } from "@/lib/db";
import type { ContentCalendarItem, ContentIdea } from "./types";
import { IDEAS_SEED, CALENDARIO } from "./ideas";

/**
 * Capa de persistencia de Growth Studio — DEFENSIVA por diseño.
 *
 * El contenido base vive como SEED en código (lib/growth/*). Las tablas
 * `growth_ideas` y `growth_calendar` son OPCIONALES y additivas (migración 009).
 * Si la migración no se ejecutó, estas funciones NO rompen la app: capturan el
 * error "tabla no existe" y devuelven solo el seed. Así RespondHQ sigue
 * desplegando en Vercel aunque la base no esté migrada.
 */

function tablaFaltante(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return (
    err.code === "42P01" ||
    /does not exist|relation .* does not exist|could not find the table/i.test(
      err.message ?? "",
    )
  );
}

/** Ideas: seed de código + ideas creadas por el equipo (BD, si existe la tabla). */
export async function getIdeas(): Promise<{ ideas: ContentIdea[]; dbActiva: boolean }> {
  let dbActiva = false;
  let dbRows: ContentIdea[] = [];
  try {
    const { data, error } = await db()
      .from("growth_ideas")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      if (!tablaFaltante(error)) throw new Error(error.message);
    } else {
      dbActiva = true;
      dbRows = ((data ?? []) as ContentIdea[]).map((r) => ({ ...r, seed: false }));
    }
  } catch {
    // Falla dura de red/credenciales: degradar a solo seed, nunca romper la página.
    dbActiva = false;
  }
  return { ideas: [...dbRows, ...IDEAS_SEED], dbActiva };
}

/** Calendario: seed + ítems creados por el equipo (BD, si existe la tabla). */
export async function getCalendar(): Promise<{
  items: ContentCalendarItem[];
  dbActiva: boolean;
}> {
  let dbActiva = false;
  let dbRows: ContentCalendarItem[] = [];
  try {
    const { data, error } = await db()
      .from("growth_calendar")
      .select("*")
      .order("fecha", { ascending: true });
    if (error) {
      if (!tablaFaltante(error)) throw new Error(error.message);
    } else {
      dbActiva = true;
      dbRows = ((data ?? []) as ContentCalendarItem[]).map((r) => ({ ...r, seed: false }));
    }
  } catch {
    dbActiva = false;
  }
  const items = [...dbRows, ...CALENDARIO].sort((a, b) =>
    (a.fecha ?? "").localeCompare(b.fecha ?? ""),
  );
  return { items, dbActiva };
}
