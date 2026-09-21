import { NextResponse } from "next/server";
import { verificarAutorizacionOutbound } from "@/lib/outbound/auth";
import { getOutboundStore } from "@/lib/outbound/runtimeStore";
import { listarMensajesBandeja } from "@/lib/outbound/gmail";
import { procesarRebote } from "@/lib/outbound/bounces";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/outbound/bounces/check
 * Revisa bandejas de entrada para detectar rebotes (NDR), suprimir hard bounces y registrar soft bounces.
 */
export async function POST(req: Request) {
  if (!verificarAutorizacionOutbound(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const store = getOutboundStore();
    const senders = await store.getSenders();
    let hardBounces = 0;
    let softBounces = 0;
    const detalles: unknown[] = [];

    for (const s of senders) {
      if (!s.active) continue;
      const mensajes = await listarMensajesBandeja(
        s.email,
        "from:mailer-daemon OR from:postmaster OR subject:delivery",
        20,
      );

      for (const m of mensajes) {
        const res = await procesarRebote(m, store);
        if (res.esBounce) {
          if (res.tipo === "hard" || res.tipo === "blocked") {
            hardBounces++;
          } else {
            softBounces++;
          }
          detalles.push({ sender: s.email, ...res });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      hard_bounces: hardBounces,
      soft_bounces: softBounces,
      detalles,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
