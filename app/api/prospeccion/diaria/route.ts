import { NextResponse } from "next/server";
import { correrDiaria } from "@/lib/prospeccion/orquestador";
import { autorizado } from "@/lib/prospeccion/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60; // requiere plan Vercel Pro; en Hobby usar cron externo

/**
 * GET /api/prospeccion/diaria?key=SECRETO
 * Una corrida del agente: enriquece un lote + envía toques vencidos + resumen
 * a Telegram. Diseñado para llamarse VARIAS veces al día (cada corrida procesa
 * un lote chico). Protegido por PROS_CRON_SECRET.
 */
export async function GET(req: Request) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  try {
    const r = await correrDiaria(true);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
