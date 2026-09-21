import { NextResponse } from "next/server";
import { verificarUsuarioHq } from "@/lib/outbound/auth";
import { getOutboundStore } from "@/lib/outbound/runtimeStore";
import { obtenerConfigSeguridad } from "@/lib/outbound/guardrails";
import { OUTBOUND_DOMAIN } from "@/lib/outbound/config";

export const dynamic = "force-dynamic";

/**
 * GET /api/outbound/killswitch -> Retorna estado actual
 * POST /api/outbound/killswitch -> Pausa o reanuda todo el outbound
 */
export async function GET(req: Request) {
  if (!verificarUsuarioHq(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const store = getOutboundStore();
  const config = obtenerConfigSeguridad();
  const dominio = await store.getDomain(OUTBOUND_DOMAIN);

  return NextResponse.json({
    ok: true,
    outbound_enabled: config.outboundEnabled,
    dry_run: config.dryRun,
    dominio_pausado: dominio?.paused ?? false,
    dominio_motivo: dominio?.paused_reason,
  });
}

export async function POST(req: Request) {
  const actor = verificarUsuarioHq(req);
  if (!actor) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "pause_all"; // pause_all | resume
    const motivo = body.motivo || "Activación de Kill Switch manual";

    const store = getOutboundStore();

    if (action === "pause_all") {
      await store.updateDomain(OUTBOUND_DOMAIN, {
        paused: true,
        paused_reason: motivo,
      });

      await store.logEvent({
        tipo: "killswitch_activated",
        metadata: { accion: "pause_all", motivo, actor },
      });

      return NextResponse.json({
        ok: true,
        mensaje: "PAUSE ALL OUTBOUND ACTIVADO. Todo el envío automático queda bloqueado.",
        outbound_enabled: false,
        dominio_pausado: true,
      });
    }

    if (action === "resume") {
      // Reanudar dominio (pero OUTBOUND_ENABLED requiere configuración consciente)
      await store.updateDomain(OUTBOUND_DOMAIN, {
        paused: false,
        paused_reason: null,
      });

      return NextResponse.json({
        ok: true,
        mensaje: "Dominio despausado. Nota: El envío real requiere OUTBOUND_ENABLED=true y DRY_RUN=false.",
        outbound_enabled: process.env.OUTBOUND_ENABLED === "true",
        dominio_pausado: false,
      });
    }

    return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
