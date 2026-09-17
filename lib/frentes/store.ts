import { db } from "@/lib/db";
import { Front } from "./model";
export async function listFronts(): Promise<Front[]> {
  const { data, error } = await db()
    .from("hq_fronts")
    .select("document")
    .order("created_at");
  if (error)
    throw new Error(
      "Frentes no disponible. Verifica la conexión y la migración 044_strategic_fronts.sql.",
    );
  return (data ?? [])
    .map((row) => row.document as Front)
    .sort((a, b) => a.prioridad.localeCompare(b.prioridad));
}
