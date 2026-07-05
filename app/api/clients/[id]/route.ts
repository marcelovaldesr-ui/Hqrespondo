import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const CAMPOS_EDITABLES = [
  "nombre",
  "rubro",
  "plan",
  "mensualidad",
  "telefono_bot",
  "workflow_id",
  "activo",
] as const;

/** PATCH /api/clients/:id */
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

    const { error } = await db().from("clients").update(update).eq("id", params.id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/** DELETE /api/clients/:id — elimina el cliente (sus eventos quedan sin cliente, su config se borra) */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const { error } = await db().from("clients").delete().eq("id", params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
