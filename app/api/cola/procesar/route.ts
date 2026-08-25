import { NextResponse } from "next/server";
import { autorizado } from "@/lib/prospeccion/auth";
import { correrWorker, enriquecerSimulado, proveedoresDisponibles } from "@/lib/cola";
import { cascadaTelefonoDirecto } from "@/lib/cascada";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * GET /api/cola/procesar?key=SECRETO[&modo=real|seco|simulado][&lote=N]
 *
 * Una corrida del worker de la cola.
 *
 * Modos:
 *   real      (por defecto) — la cascada completa: web → Places → búsqueda IA.
 *                             Gasta cupo de Places y de Gemini.
 *   seco                    — solo los pasos GRATIS (la web del negocio). No
 *                             toca ningún proveedor de pago. Para mirar
 *                             resultados reales sin gastar nada.
 *   simulado                — no llama a nadie; devuelve datos inventados.
 *                             Solo sirve para probar la tubería.
 *
 * Sobre el tamaño del lote: en modo real cada empresa puede tomar hasta ~25
 * segundos (bajar un sitio + consultar Maps + una búsqueda con IA). Con el
 * límite de tiempo de Vercel eso da para pocas por corrida, así que el defecto
 * es 6. Lo que no alcanza a procesarse vuelve solo a la cola — no se pierde,
 * lo toma la corrida siguiente. En seco y simulado no hay esperas largas, así
 * que el defecto sube a 25.
 *
 * Es seguro llamarlo dos veces a la vez: `obtener_lote_cola` usa
 * FOR UPDATE SKIP LOCKED, así que el segundo worker se lleva otras filas.
 *
 * Protegido por PROS_CRON_SECRET (o CRON_SECRET, que es el que manda Vercel).
 */
export async function GET(req: Request) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const pedido = (url.searchParams.get("modo") ?? "real").toLowerCase();
  const modo = pedido === "seco" || pedido === "simulado" ? pedido : "real";

  const porDefecto = modo === "real" ? 25 : 50;
  const lote = Math.min(
    Math.max(Number(url.searchParams.get("lote")) || porDefecto, 1),
    100,
  );

  try {
    const enriquecedor =
      modo === "simulado"
        ? enriquecerSimulado
        : cascadaTelefonoDirecto({
            vivos: await proveedoresDisponibles(),
            modo: modo === "seco" ? "seco" : "real",
          });

    const r = await correrWorker({
      lote,
      // 280s deja 20 de margen bajo el tope de 300 de Vercel. Con 45s
      // alcanzaban 6 empresas por corrida; con esto, unas 35.
      limiteMs: 280_000,
      enriquecedor,
    });
    return NextResponse.json({ ok: true, modo, ...r });
  } catch (e) {
    return NextResponse.json(
      { ok: false, modo, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

/** POST hace lo mismo que GET. GitHub Actions manda POST por costumbre. */
export const POST = GET;
