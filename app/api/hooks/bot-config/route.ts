import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/hooks/bot-config?workflow_id=XXX  (o ?client_id=UUID)
 * Lo llaman los workflows n8n de cada bot para leer su configuración
 * (tono, horarios, reglas de derivación a humano).
 * Header obligatorio: x-hq-token = HQ_API_TOKEN
 */
export async function GET(req: Request) {
  const token = req.headers.get("x-hq-token");
  if (!process.env.HQ_API_TOKEN || token !== process.env.HQ_API_TOKEN) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const workflowId = url.searchParams.get("workflow_id");
  const clientId = url.searchParams.get("client_id");
  if (!workflowId && !clientId) {
    return NextResponse.json(
      { error: "Falta workflow_id o client_id" },
      { status: 400 },
    );
  }

  const s = db();
  const query = s.from("clients").select("id,nombre,activo");
  const { data: client, error } = workflowId
    ? await query.eq("workflow_id", workflowId).maybeSingle()
    : await query.eq("id", clientId!).maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!client) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  const { data: config } = await s
    .from("bot_configs")
    .select("tono,horario_atencion,derivacion_reglas,derivacion_contacto,extra")
    .eq("client_id", client.id)
    .maybeSingle();

  return NextResponse.json({
    client: { id: client.id, nombre: client.nombre, activo: client.activo },
    config: config ?? {
      tono: null,
      horario_atencion: {},
      derivacion_reglas: null,
      derivacion_contacto: null,
      extra: {},
    },
  });
}
