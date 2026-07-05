import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const CAMPOS_EDITABLES = [
  "tarea",
  "estado",
  "area",
  "fecha_limite",
  "notas",
] as const;

/** PATCH /api/roadmap/:id — actualiza campos permitidos */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const body = await req.json();
    const update: Record<string, unknown> = {};
    for (const campo of CAMPOS_EDITABLES) {
      if (campo in body) {
        update[campo] =
          typeof body[campo] === "string" ? body[campo].trim() || null : body[campo];
      }
    }
    if ("tarea" in update && !update.tarea) {
      return NextResponse.json({ error: "tarea no puede quedar vacía" }, { status: 400 });
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
    }
    update.actualizado_por = req.headers.get("x-hq-user");

    const { data, error } = await db()
      .from("roadmap_items")
      .update(update)
      .eq("id", params.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, item: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/** DELETE /api/roadmap/:id */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const { error } = await db().from("roadmap_items").delete().eq("id", params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
