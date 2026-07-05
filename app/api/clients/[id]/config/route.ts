import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const CAMPOS_EDITABLES = [
  "tono",
  "horario_atencion",
  "derivacion_reglas",
  "derivacion_contacto",
  "extra",
] as const;

/** GET /api/clients/:id/config — config del bot (null si aún no existe) */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const { data, error } = await db()
    .from("bot_configs")
    .select("*")
    .eq("client_id", params.id)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ config: data ?? null });
}

/** PUT /api/clients/:id/config — crea o actualiza (upsert por client_id) */
export async function PUT(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const body = await req.json();
    const update: Record<string, unknown> = { client_id: params.id };
    for (const campo of CAMPOS_EDITABLES) {
      if (campo in body) update[campo] = body[campo];
    }
    if (Object.keys(update).length === 1) {
      return NextResponse.json({ error: "Nada que guardar" }, { status: 400 });
    }

    const { data, error } = await db()
      .from("bot_configs")
      .upsert(update, { onConflict: "client_id" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, config: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
