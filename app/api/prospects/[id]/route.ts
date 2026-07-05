import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isEstado } from "@/lib/types";

const CAMPOS_EDITABLES = [
  "estado",
  "notas",
  "proxima_accion",
  "mensaje",
  "score",
  "telefono",
] as const;

/** PATCH /api/prospects/:id — actualiza campos permitidos */
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
    if ("estado" in update && !isEstado(update.estado)) {
      return NextResponse.json(
        { error: "Estado de prospecto inválido" },
        { status: 400 },
      );
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
    }

    const { data, error } = await db()
      .from("prospects")
      .update(update)
      .eq("id", params.id)
      .select("id,estado")
      .single();
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, prospect: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/** DELETE /api/prospects/:id */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const { error } = await db().from("prospects").delete().eq("id", params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
