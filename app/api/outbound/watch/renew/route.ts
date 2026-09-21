/**
 * ENDPOINT DE RENOVACIÓN AUTOMÁTICA DE GMAIL WATCH — Outbound V1
 *
 * Endpoint: POST /api/outbound/watch/renew
 *
 * Propósito:
 * - Renueva la suscripción de Gmail Watch (vence cada 7 días) para todos los buzones activos.
 * - Registra history_id, expiration y last_watch_renewal_at en outbound_mailbox_watches.
 * - Genera diagnóstico y evalúa umbrales de alerta (<48h warning, <24h critical).
 * - Diseñado para ser invocado diariamente vía cron (n8n o Cloud Scheduler).
 */

import { NextResponse } from "next/server";
import { verificarAutorizacionOutbound } from "@/lib/outbound/auth";
import { renovarTodosLosWatches } from "@/lib/outbound/gmail";
import { getOutboundStore } from "@/lib/outbound/runtimeStore";

export async function POST(req: Request) {
  // 1. Verificación de autorización segura (fail-closed)
  const autorizado = verificarAutorizacionOutbound(req);
  if (!autorizado) {
    return NextResponse.json({ error: "No autorizado. Token de API inválido o ausente." }, { status: 401 });
  }

  try {
    const store = getOutboundStore();
    const resultado = await renovarTodosLosWatches({ store });

    // 2. Comprobar si hay alertas críticas o advertencias
    const tieneCriticos = resultado.diagnosticos.some((d) => d.estado === "critical" || d.estado === "expired");
    const tieneWarnings = resultado.diagnosticos.some((d) => d.estado === "warning");

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      procesados: resultado.procesados,
      renovados: resultado.renovados,
      fallidos: resultado.fallidos,
      diagnosticos: resultado.diagnosticos,
      estado_general: tieneCriticos ? "critical" : tieneWarnings ? "warning" : "healthy",
      requiere_intervencion: tieneCriticos || resultado.fallidos.length > 0,
    });
  } catch (error) {
    console.error("Error en renovación de watches:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error interno renovando watches de Gmail" },
      { status: 500 },
    );
  }
}
