import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/prospects/filtrar?rubro=&comuna=&score_min=70&potencial=alto
 *
 * Devuelve prospects enriquecidos para el panel o para scripts.
 * Todos los parámetros son opcionales:
 *  - rubro:     match parcial, case-insensitive ("dental" pilla "clínica dental")
 *  - comuna:    match parcial, case-insensitive
 *  - score_min: default 70
 *  - potencial: alto | medio | bajo | desconocido (señal web)
 *  - limit:     default 200
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const rubro = url.searchParams.get("rubro")?.trim();
    const comuna = url.searchParams.get("comuna")?.trim();
    const potencial = url.searchParams.get("potencial")?.trim();
    const scoreMin = Number(url.searchParams.get("score_min") ?? 70);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 200), 1000);

    let q = db()
      .from("prospects")
      .select(
        "id,nombre,rubro,comuna,telefono,web,direccion,rating,reviews,score,razon_score,senales_web,score_detalle,estado,mensaje,ultimo_intento_llamada,intentos_llamada",
      )
      .gte("score", scoreMin)
      .order("score", { ascending: false })
      .limit(limit);

    if (rubro) q = q.ilike("rubro", `%${rubro}%`);
    if (comuna) q = q.ilike("comuna", `%${comuna}%`);
    if (potencial) q = q.eq("senales_web->>potencial", potencial);

    const { data, error } = await q;
    if (error) throw new Error(error.message);

    return NextResponse.json({ total: data?.length ?? 0, prospects: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
