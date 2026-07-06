import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { TIPOS_EVENTO, type TipoEvento } from "@/lib/types";
import { sendWhatsApp } from "@/lib/whatsapp";

/**
 * POST /api/hooks/bot-events — lo llama n8n.
 * Header obligatorio: x-hq-token = HQ_API_TOKEN
 * Body: { tipo, client_id?, workflow_id?, detalle?, costo_clp? }
 * Tipos: mensaje | error | heartbeat | lead_captured | quote_generated |
 *        meeting_booked | human_handoff — los 4 comerciales requieren la
 *        migración 008 en Supabase (sin ella el insert devuelve 500 claro).
 * Si viene workflow_id en vez de client_id, se resuelve contra clients.workflow_id.
 * Los errores disparan alerta por WhatsApp a MI_WHATSAPP.
 */
export async function POST(req: Request) {
  const token = req.headers.get("x-hq-token");
  if (!process.env.HQ_API_TOKEN || token !== process.env.HQ_API_TOKEN) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const tipo = body.tipo;
    if (!TIPOS_EVENTO.includes(tipo as TipoEvento)) {
      return NextResponse.json(
        { error: `tipo debe ser uno de: ${TIPOS_EVENTO.join(", ")}` },
        { status: 400 },
      );
    }

    const s = db();
    let clientId: string | null = body.client_id ?? null;
    let clientNombre = "desconocido";

    if (!clientId && body.workflow_id) {
      const { data } = await s
        .from("clients")
        .select("id,nombre")
        .eq("workflow_id", String(body.workflow_id))
        .maybeSingle();
      if (data) {
        clientId = data.id;
        clientNombre = data.nombre;
      }
    } else if (clientId) {
      const { data } = await s
        .from("clients")
        .select("nombre")
        .eq("id", clientId)
        .maybeSingle();
      if (data) clientNombre = data.nombre;
    }

    const { error } = await s.from("bot_events").insert({
      client_id: clientId,
      tipo,
      detalle: body.detalle ?? null,
      costo_clp: body.costo_clp ?? null,
    });
    if (error) throw new Error(error.message);

    if (tipo === "error") {
      await sendWhatsApp(
        process.env.MI_WHATSAPP ?? "",
        `⚠️ Respondo HQ: error en el bot de ${clientNombre}\n${body.detalle ?? "(sin detalle)"}`,
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
