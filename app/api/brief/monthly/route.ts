import { NextResponse } from "next/server";
import { generarReporteMensual } from "@/lib/brief";

export const maxDuration = 60;

/**
 * POST /api/brief/monthly  { client_id }
 * Genera el reporte mensual en lenguaje de cliente (uso interno:
 * queda en la tabla briefs y visible en /brief, no se envía a nadie).
 */
export async function POST(req: Request) {
  try {
    const { client_id } = await req.json();
    if (!client_id) {
      return NextResponse.json(
        { error: "client_id es obligatorio" },
        { status: 400 },
      );
    }
    const contenido = await generarReporteMensual(String(client_id));
    return NextResponse.json({ ok: true, contenido });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
