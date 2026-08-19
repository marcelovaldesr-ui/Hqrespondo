import { unstable_noStore as noStore } from "next/cache";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { RoadmapItem } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** GET /api/roadmap — todas las tareas del roadmap */
export async function GET() {
  try {
    noStore();
    const { data, error } = await db()
      .from("roadmap_items")
      .select("*")
      .order("fecha_limite", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return NextResponse.json(
      { items: (data ?? []) as RoadmapItem[] },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/** POST /api/roadmap — crea una tarea. creado_por sale del login (x-hq-user). */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.tarea || !String(body.tarea).trim()) {
      return NextResponse.json({ error: "tarea es obligatoria" }, { status: 400 });
    }
    const usuario = req.headers.get("x-hq-user");

    const { data, error } = await db()
      .from("roadmap_items")
      .insert({
        tarea: String(body.tarea).trim(),
        estado: body.estado ? String(body.estado).trim() : "Backlog",
        area: body.area ? String(body.area).trim() : null,
        fecha_limite: body.fecha_limite || null,
        notas: body.notas || null,
        creado_por: usuario,
        actualizado_por: usuario,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, item: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
