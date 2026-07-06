import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/** PATCH /api/cobros/:id — {estado?, monto?, notas?} */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const body = await req.json();
    const update: Record<string, unknown> = {};
    if ("estado" in body) {
      if (!["pendiente", "pagado"].includes(body.estado)) {
        return NextResponse.json({ error: "estado inválido" }, { status: 400 });
      }
      update.estado = body.estado;
      update.pagado_at = body.estado === "pagado" ? new Date().toISOString() : null;
    }
    if ("monto" in body) update.monto = Number(body.monto) || 0;
    if ("notas" in body) update.notas = body.notas || null;
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
    }
    const { error } = await db().from("cobros").update(update).eq("id", params.id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/** DELETE /api/cobros/:id */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const { error } = await db().from("cobros").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
