import { NextResponse } from "next/server";
import { verificarAutorizacionOutbound } from "@/lib/outbound/auth";
import { getOutboundStore } from "@/lib/outbound/runtimeStore";
import { listarMensajesBandeja } from "@/lib/outbound/gmail";
import { procesarMensajeEntrante } from "@/lib/outbound/replies";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/outbound/replies/check
 * Revisa bandejas de entrada para detectar respuestas humanas y detener secuencias inmediatamente.
 */
export async function POST(req: Request) {
  if (!verificarAutorizacionOutbound(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const store = getOutboundStore();
    const senders = await store.getSenders();
    let totalMensajesLeidos = 0;
    let respuestasProcesadas = 0;
    let secuenciasDetenidas = 0;
    const detalles: unknown[] = [];

    for (const s of senders) {
      if (!s.active) continue;
      const mensajes = await listarMensajesBandeja(s.email, "in:inbox -from:me newer_than:2d", 20);
      totalMensajesLeidos += mensajes.length;

      for (const m of mensajes) {
        const res = await procesarMensajeEntrante(m, store);
        if (res.procesado) {
          respuestasProcesadas++;
          if (res.secuenciaDetenida) secuenciasDetenidas++;
          detalles.push({ sender: s.email, ...res });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      mensajes_leidos: totalMensajesLeidos,
      respuestas_procesadas: respuestasProcesadas,
      secuencias_detenidas: secuenciasDetenidas,
      detalles,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
