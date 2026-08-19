import { NextResponse } from "next/server";
import { revisarRespuestas } from "@/lib/prospeccion/calificador";
import { autorizado } from "@/lib/prospeccion/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/prospeccion/revisar?key=SECRETO&horas=3
 * Lee respuestas recientes de Gmail, las clasifica y avisa los leads calientes
 * por Telegram. Pensado para correr cada ~2 h. Protegido por PROS_CRON_SECRET.
 */
export async function GET(req: Request) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  try {
    const horas = Number(new URL(req.url).searchParams.get("horas")) || 3;
    const r = await revisarRespuestas(horas);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
