import { NextResponse } from "next/server";
import { readHqLedger, readJson } from "@/lib/growthOs/store";

export const dynamic = "force-dynamic";

/**
 * GET /api/growth-os/state — la instantánea que subió tools/hq_sync.py + las decisiones
 * tomadas en el HQ que el Growth OS todavía no importó (se agregan a `ledger` sin duplicar).
 */
export async function GET() {
  try {
    const state = await readJson<Record<string, any>>("state/growth-state.json");
    if (!state) {
      return NextResponse.json(
        { error: "Todavía no hay estado sincronizado. Corre python tools/hq_sync.py en la carpeta del Growth OS." },
        { status: 404 },
      );
    }
    const have = new Set<string>((state.ledger ?? []).map((e: any) => e.id));
    const hq = (await readHqLedger(have)).filter((e) => !have.has(e.id));
    state.ledger = [...(state.ledger ?? []), ...hq];
    state.hq = { pending_decisions: hq.length };
    return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error leyendo el estado" }, { status: 500 });
  }
}
