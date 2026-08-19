import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const CAMPOS = ["concepto", "monto", "fecha", "categoria", "pagado_por", "notas"] as const;

/** PATCH /api/gastos/:id */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const body = await req.json();
    const update: Record<string, unknown> = {};
    for (const c of CAMPOS) if (c in body) update[c] = body[c];
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
    }
    const { error } = await db().from("gastos").update(update).eq("id", params.id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/** DELETE /api/gastos/:id */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const { error } = await db().from("gastos").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
