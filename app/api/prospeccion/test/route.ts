import { NextResponse } from "next/server";
import { probar } from "@/lib/prospeccion/orquestador";
import { autorizado } from "@/lib/prospeccion/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/prospeccion/test?key=SECRETO&n=5
 * DRY-RUN: enriquece n prospectos de la lista de oro y redacta el primer email
 * + la conexión de LinkedIn, SIN enviar ni tocar la base. Para validar calidad
 * de datos y de mensajes antes de encender el envío real.
 */
export async function GET(req: Request) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  try {
    const n = Math.min(10, Number(new URL(req.url).searchParams.get("n")) || 5);
    const previews = await probar(n);
    return NextResponse.json({ ok: true, n: previews.length, previews });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
