import { NextResponse } from "next/server";
import { diagnosticar } from "@/lib/prospeccion/salud";
import { autorizado } from "@/lib/prospeccion/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/prospeccion/salud?ping=1&chatid=1[&key=SECRETO]
 * Diagnóstico del agente: qué variables faltan, si corrió la migración 017,
 * cuántas leads de oro hay y —con ping=1— si cada servicio externo responde.
 * chatid=1 lista los chat_id que le escribieron al bot de Telegram.
 *
 * Acceso: mientras PROS_CRON_SECRET NO esté definido, queda abierto (para poder
 * diagnosticar durante el setup). Una vez definido el secreto, exige ?key=.
 */
export async function GET(req: Request) {
  const secretoDefinido = Boolean(process.env.PROS_CRON_SECRET || process.env.CRON_SECRET);
  if (secretoDefinido && !autorizado(req)) {
    return NextResponse.json({ error: "no autorizado (agrega ?key=PROS_CRON_SECRET)" }, { status: 401 });
  }
  const sp = new URL(req.url).searchParams;
  const ping = sp.get("ping") === "1";
  const chatid = sp.get("chatid") === "1";
  try {
    const d = await diagnosticar(ping, chatid);
    return NextResponse.json(d);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
