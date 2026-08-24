import { NextResponse } from "next/server";
import { autorizado } from "@/lib/prospeccion/auth";
import { correrWorker } from "@/lib/cola";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Hobby permite hasta 300s. Se deja en 60 para que la corrida termine bien antes
// del corte; `correrWorker` además para sola con 15s de margen.
export const maxDuration = 60;

/**
 * GET /api/cola/procesar?key=SECRETO[&lote=25][&objetivo=telefono_directo]
 *
 * Una corrida del worker de la cola. Está pensado para llamarse varias veces al
 * día desde GitHub Actions —igual que /api/prospeccion/diaria— porque Vercel
 * Hobby solo deja UN cron diario y con precisión de ±59 minutos.
 *
 * Es seguro llamarlo dos veces a la vez: `obtener_lote_cola` usa
 * FOR UPDATE SKIP LOCKED, así que el segundo worker se lleva otras filas en vez
 * de repetir las del primero.
 *
 * Protegido por PROS_CRON_SECRET (o CRON_SECRET, que es el que manda Vercel).
 */
export async function GET(req: Request) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const lote = Math.min(Math.max(Number(url.searchParams.get("lote")) || 25, 1), 100);
  const objetivo = url.searchParams.get("objetivo") ?? undefined;

  try {
    const r = await correrWorker({
      lote,
      objetivo: objetivo as never,
      limiteMs: 50_000, // por debajo de maxDuration
    });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

/** POST hace lo mismo que GET. GitHub Actions manda POST por costumbre. */
export const POST = GET;
