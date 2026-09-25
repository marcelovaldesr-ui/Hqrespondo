import { NextResponse } from "next/server";
import { readHqLedger, syncAuthorized } from "@/lib/growthOs/store";

export const dynamic = "force-dynamic";

/** GET — todas las decisiones tomadas en el HQ, para que tools/hq_sync.py las importe al Growth OS. */
export async function GET(req: Request) {
  if (!syncAuthorized(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return NextResponse.json({ entries: await readHqLedger() }, { headers: { "Cache-Control": "no-store" } });
}
