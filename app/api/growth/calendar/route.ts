import { unstable_noStore as noStore } from "next/cache";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CAMPOS = [
  "titulo",
  "fecha",
  "canal",
  "formato",
  "pilar",
  "rubro",
  "estado",
  "responsable",
  "idea_id",
  "notas",
] as const;

function tablaFaltante(msg: string) {
  return /does not exist|could not find the table|schema cache/i.test(msg);
}

/** GET /api/growth/calendar */
export async function GET() {
  try {
    noStore();
    const { data, error } = await db()
      .from("growth_calendar")
      .select("*")
      .order("fecha", { ascending: true });
    if (error) {
      if (tablaFaltante(error.message))
        return NextResponse.json({ items: [], dbActiva: false });
      throw new Error(error.message);
    }
    return NextResponse.json({ items: data ?? [], dbActiva: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/** POST /api/growth/calendar */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.titulo || !String(body.titulo).trim()) {
      return NextResponse.json({ error: "El título es obligatorio" }, { status: 400 });
    }
    if (!body.fecha) {
      return NextResponse.json({ error: "La fecha es obligatoria" }, { status: 400 });
    }
    const usuario = req.headers.get("x-hq-user");
    const insert: Record<string, unknown> = { responsable: body.responsable ?? usuario };
    for (const c of CAMPOS) if (c in body && body[c] !== undefined) insert[c] = body[c];
    insert.titulo = String(body.titulo).trim();

    const { data, error } = await db()
      .from("growth_calendar")
      .insert(insert)
      .select("*")
      .single();
    if (error) {
      if (tablaFaltante(error.message))
        return NextResponse.json(
          {
            error:
              "Falta ejecutar la migración 009_growth_studio.sql en Supabase para guardar en el calendario.",
          },
          { status: 409 },
        );
      throw new Error(error.message);
    }
    return NextResponse.json({ ok: true, item: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
