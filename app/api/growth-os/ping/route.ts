import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** La interfaz del Growth OS pregunta esto para saber que corre dentro del HQ (modo "hq"). */
export async function GET() {
  return NextResponse.json({ growth_os: true, mode: "hq" }, { headers: { "Cache-Control": "no-store" } });
}
