import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/foco/bitacora?id=<uuid> — la historia de UN lead.
 *
 * Devuelve dos cosas:
 *   · `resumen` — cuántas veces se llamó, cuántas contestaron, cuándo fue la
 *     última, cuál fue el desenlace. Es lo que se mira de un vistazo antes de
 *     marcar, para no repetir lo mismo que ya se dijo la vez pasada.
 *   · `eventos` — la línea de tiempo, del más nuevo al más viejo.
 *
 * Solo aparecen actividades registradas desde la migración 030 en adelante: las
 * anteriores se guardaron sin apuntar a qué lead y no se pueden atribuir sin
 * adivinar. La ficha lo dice en pantalla para que nadie crea que el lead es
 * nuevo cuando en realidad ya se le llamó antes.
 */

/** Desenlaces que prueban que hubo un ser humano al otro lado. */
const CONTESTARON = new Set(["contactado", "interesado", "gatekeeper", "seguimiento", "no_interesa"]);

export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "falta id" }, { status: 400 });

    const s = db();

    const { data: lead, error: e1 } = await s
      .from("leads_foco")
      .select("id,empresa,contacto,intentos,sin_contestar,ultimo_intento,ultimo_resultado,estado,recordatorio,proximo_paso,proximo_paso_at,created_at,creado_por,actualizado_por")
      .eq("id", id)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!lead) return NextResponse.json({ error: "lead no encontrado" }, { status: 404 });

    const { data: eventos, error: e2 } = await s
      .from("actividades")
      .select("id,canal,tipo,resultado,nota,actor,created_at")
      .eq("lead_foco_id", id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (e2) throw new Error(e2.message);

    const lista = eventos ?? [];
    const contestaron = lista.filter((a: { resultado: string }) => CONTESTARON.has(a.resultado)).length;

    return NextResponse.json({
      ok: true,
      resumen: {
        intentos: lead.intentos ?? 0,
        registrados: lista.length,
        contestaron,
        sin_contestar: lead.sin_contestar ?? 0,
        ultimo_intento: lead.ultimo_intento,
        ultimo_resultado: lead.ultimo_resultado,
        estado: lead.estado,
        recordatorio: lead.recordatorio,
        proximo_paso: lead.proximo_paso,
        proximo_paso_at: lead.proximo_paso_at,
        creado: lead.created_at,
        creado_por: lead.creado_por,
        actualizado_por: lead.actualizado_por,
      },
      eventos: lista,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
