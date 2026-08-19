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
 * Acceso: SIEMPRE exige el secreto.
 *
 * Antes quedaba abierto mientras PROS_CRON_SECRET no estuviera definido, para
 * facilitar el setup. Eso ya pasó, y era un fail-open: bastaba con que alguien
 * renombrara o borrara esa variable en Vercel para que este endpoint quedara
 * público — y lo que devuelve es el inventario de QUÉ secretos existen, que es
 * justo lo que uno no quiere regalar. Ahora, sin secreto configurado, no
 * responde: `autorizado()` ya es fail-closed.
 */
export async function GET(req: Request) {
  if (!autorizado(req)) {
    return NextResponse.json(
      { error: "no autorizado (agrega ?key=PROS_CRON_SECRET)" },
      { status: 401 },
    );
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
