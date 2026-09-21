import { NextResponse } from "next/server";
import { verificarAutorizacionOutbound } from "@/lib/outbound/auth";
import { getOutboundStore } from "@/lib/outbound/runtimeStore";
import { normalizarEmail, normalizarDominio } from "@/lib/outbound/normalization";

export const dynamic = "force-dynamic";

/**
 * GET /api/outbound/suppressions -> Lista supresiones
 * POST /api/outbound/suppressions -> Añade supresión manual
 */
export async function GET(req: Request) {
  if (!verificarAutorizacionOutbound(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const store = getOutboundStore();
  const list = await store.listSuppressions();
  return NextResponse.json({ ok: true, supresiones: list });
}

export async function POST(req: Request) {
  if (!verificarAutorizacionOutbound(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const rawValor = String(body.valor || "").trim();
    const tipo = body.tipo === "dominio" ? "dominio" : "email";
    const motivo = body.motivo || "manual";
    const origen = body.origen || "api";
    const notas = body.notas || null;

    const valorNormalizado =
      tipo === "email" ? normalizarEmail(rawValor) : normalizarDominio(rawValor);

    if (!valorNormalizado) {
      return NextResponse.json({ error: "Valor de supresión inválido" }, { status: 400 });
    }

    const store = getOutboundStore();
    await store.addSuppression({
      tipo,
      valor: valorNormalizado,
      motivo,
      origen,
      notas,
    });

    return NextResponse.json({
      ok: true,
      mensaje: `Supresión registrada para ${valorNormalizado}`,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
