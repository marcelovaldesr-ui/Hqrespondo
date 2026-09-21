import { NextResponse } from "next/server";
import { verificarAutorizacionOutbound } from "@/lib/outbound/auth";
import { importarCSV } from "@/lib/outbound/ingestion";
import { getOutboundStore } from "@/lib/outbound/runtimeStore";
import type { TipoOrigenLead } from "@/lib/outbound/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const ORIGENES: TipoOrigenLead[] = [
  "relacion_previa", "referido", "cliente_partner", "web_publica", "directorio_publico",
  "proveedor_externo", "carga_manual", "csv", "google_sheets", "investigacion_interna",
];

export async function POST(req: Request) {
  if (!verificarAutorizacionOutbound(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const csv = typeof body.csv === "string" ? body.csv : "";
    const tipoOrigen = body.tipo_origen as TipoOrigenLead;
    const nombreFuente = typeof body.nombre_fuente === "string" ? body.nombre_fuente.trim() : "";

    if (!csv || Buffer.byteLength(csv, "utf8") > 2_000_000) {
      return NextResponse.json({ error: "CSV ausente o superior a 2 MB" }, { status: 400 });
    }
    if (!ORIGENES.includes(tipoOrigen) || !nombreFuente) {
      return NextResponse.json({ error: "tipo_origen o nombre_fuente inválido" }, { status: 400 });
    }

    const resultado = await importarCSV(csv, {
      tipo_origen: tipoOrigen,
      nombre_fuente: nombreFuente,
      referencia_fuente: typeof body.referencia_fuente === "string" ? body.referencia_fuente : undefined,
      url_fuente: typeof body.url_fuente === "string" ? body.url_fuente : undefined,
      tipo_relacion_default: body.tipo_relacion_default === "warm" ? "warm" : "cold",
      relationship_approved_for_copy: false,
    }, getOutboundStore());

    return NextResponse.json({ ok: true, resultado });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Error de ingestión" },
      { status: 500 },
    );
  }
}
