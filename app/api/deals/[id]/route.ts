import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const CAMPOS_EDITABLES = [
  "etapa",
  "plan",
  "valor_setup",
  "valor_mensual",
  "proxima_accion",
  "fecha_proxima",
  "notas",
  "nombre_negocio",
] as const;

/** PATCH /api/deals/:id */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const body = await req.json();
    const update: Record<string, unknown> = {};
    for (const campo of CAMPOS_EDITABLES) {
      if (campo in body) update[campo] = body[campo];
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
    }

    const { error } = await db().from("deals").update(update).eq("id", params.id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/** DELETE /api/deals/:id */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const { error } = await db().from("deals").delete().eq("id", params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
