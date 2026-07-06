import { unstable_noStore as noStore } from "next/cache";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/gastos — últimos 300 */
export async function GET() {
  noStore();
  const { data, error } = await db()
    .from("gastos")
    .select("*")
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ gastos: data ?? [] });
}

/** POST /api/gastos — {concepto, monto, fecha?, categoria?, pagado_por?, notas?} */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.concepto || !String(body.concepto).trim()) {
      return NextResponse.json({ error: "concepto es obligatorio" }, { status: 400 });
    }
    const { error } = await db().from("gastos").insert({
      concepto: String(body.concepto).trim(),
      monto: Number(body.monto) || 0,
      fecha: body.fecha || new Date().toISOString().slice(0, 10),
      categoria: body.categoria ? String(body.categoria).trim() : null,
      pagado_por: body.pagado_por || req.headers.get("x-hq-user"),
      notas: body.notas || null,
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
