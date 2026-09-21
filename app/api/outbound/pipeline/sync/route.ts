import { NextResponse } from "next/server";
import { verificarAutorizacionOutbound } from "@/lib/outbound/auth";

export const dynamic = "force-dynamic";

/**
 * Explicitly disabled until Outbound and Revenue agree on an idempotent handoff contract.
 * This prevents the optional n8n workflow from failing as a misleading 404 or creating duplicates.
 */
export async function POST(req: Request) {
  if (!verificarAutorizacionOutbound(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return NextResponse.json(
    {
      ok: false,
      error: "PIPELINE_SYNC_DISABLED",
      accion: "Mantener workflow_e_state_updater inactivo hasta definir el contrato idempotente con Revenue.",
    },
    { status: 501 },
  );
}
