import { unstable_noStore as noStore } from "next/cache";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { Prospect } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/** DELETE /api/prospects — borra TODOS los prospectos (empezar de cero).
 *  Requiere header x-confirm: BORRAR-TODO para evitar accidentes. */
export async function DELETE(req: Request) {
  if (req.headers.get("x-confirm") !== "BORRAR-TODO") {
    return NextResponse.json(
      { error: "Falta confirmación explícita" },
      { status: 400 },
    );
  }
  const { error, count } = await db()
    .from("prospects")
    .delete({ count: "exact" })
    .not("id", "is", null);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, eliminados: count ?? 0 });
}

export async function GET() {
  try {
    noStore();

    const { data, error } = await db()
      .from("prospects")
      .select("*")
      .order("score", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return NextResponse.json(
      { prospects: (data ?? []) as Prospect[] },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
