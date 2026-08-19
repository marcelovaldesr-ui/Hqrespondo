import { unstable_noStore as noStore } from "next/cache";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/decisiones — últimas 200 */
export async function GET() {
  noStore();
  const { data, error } = await db()
    .from("decisiones")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ decisiones: data ?? [] });
}

/** POST /api/decisiones — {titulo, detalle?} */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.titulo || !String(body.titulo).trim()) {
      return NextResponse.json({ error: "titulo es obligatorio" }, { status: 400 });
    }
    const { error } = await db().from("decisiones").insert({
      titulo: String(body.titulo).trim(),
      detalle: body.detalle || null,
      decidido_por: req.headers.get("x-hq-user"),
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
