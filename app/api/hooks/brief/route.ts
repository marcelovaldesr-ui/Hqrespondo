import { NextResponse } from "next/server";
import { generarBrief } from "@/lib/brief";
import { sendWhatsApp } from "@/lib/whatsapp";

export const maxDuration = 60;

/**
 * POST /api/hooks/brief — lo llama n8n cada mañana (cron 8:00).
 * Header obligatorio: x-hq-token = HQ_API_TOKEN
 * Genera el brief y lo envía por WhatsApp a MI_WHATSAPP.
 */
export async function POST(req: Request) {
  const token = req.headers.get("x-hq-token");
  if (!process.env.HQ_API_TOKEN || token !== process.env.HQ_API_TOKEN) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const contenido = await generarBrief();
    const enviado = await sendWhatsApp(process.env.MI_WHATSAPP ?? "", contenido);
    return NextResponse.json({ ok: true, enviado_whatsapp: enviado });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
