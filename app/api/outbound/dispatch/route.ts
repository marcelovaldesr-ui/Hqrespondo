import { NextResponse } from "next/server";
import { verificarAutorizacionOutbound } from "@/lib/outbound/auth";
import { getOutboundStore } from "@/lib/outbound/runtimeStore";
import { despacharColaOutbound } from "@/lib/outbound/dispatcher";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/outbound/dispatch
 * Invoca el despachador de la cola outbox con bloqueo atómico y guardrails.
 */
export async function POST(req: Request) {
  if (!verificarAutorizacionOutbound(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const workerId = body.workerId || `api_worker_${Date.now()}`;
    const limiteLote = Number(body.limiteLote) || 6;

    const store = getOutboundStore();
    const res = await despacharColaOutbound({
      store,
      workerId,
      limiteLote,
    });

    return NextResponse.json({ ok: true, ...res });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
