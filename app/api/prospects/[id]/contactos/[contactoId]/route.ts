import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const CAMPOS_EDITABLES = [
  "verificado",
  "nombre",
  "cargo",
  "telefono",
  "email",
  "linkedin_url",
  "notas",
] as const;

/** PATCH /api/prospects/:id/contactos/:contactoId — marcar verificado o corregir a mano un dato. */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string; contactoId: string } },
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

    const { data, error } = await db()
      .from("contactos_decision")
      .update(update)
      .eq("id", params.contactoId)
      .eq("prospect_id", params.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, contacto: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/** DELETE /api/prospects/:id/contactos/:contactoId */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; contactoId: string } },
) {
  const { error } = await db()
    .from("contactos_decision")
    .delete()
    .eq("id", params.contactoId)
    .eq("prospect_id", params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
