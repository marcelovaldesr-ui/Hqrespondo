import { NextResponse } from "next/server";
import { autorizado } from "@/lib/prospeccion/auth";
import { promoverPendientes } from "@/lib/promoverDecisor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * GET /api/cola/promover?key=SECRETO[&limite=200]
 *
 * Manda a la cola de llamadas todas las empresas que ya tienen teléfono directo
 * y todavía no están enlazadas a un lead de Foco.
 *
 * La cascada promueve sola cada hallazgo nuevo, así que esto es red de
 * seguridad: recupera lo que se encontró antes de que existiera la promoción
 * automática, y lo que se haya escapado por un error puntual. Es idempotente.
 */
export async function GET(req: Request) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  const limite = Number(new URL(req.url).searchParams.get("limite")) || 200;
  try {
    const r = await promoverPendientes(limite);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

export const POST = GET;
