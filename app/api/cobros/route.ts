import { unstable_noStore as noStore } from "next/cache";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/cobros?mes=YYYY-MM — cobros del mes con nombre de cliente */
export async function GET(req: Request) {
  noStore();
  const url = new URL(req.url);
  const mes = url.searchParams.get("mes"); // YYYY-MM
  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
    return NextResponse.json({ error: "mes inválido (YYYY-MM)" }, { status: 400 });
  }
  const s = db();
  const [cobrosRes, clientesRes] = await Promise.all([
    s.from("cobros").select("*").eq("mes", `${mes}-01`).order("created_at"),
    s.from("clients").select("id,nombre,mensualidad,activo"),
  ]);
  if (cobrosRes.error) {
    return NextResponse.json({ error: cobrosRes.error.message }, { status: 500 });
  }
  const nombres = new Map((clientesRes.data ?? []).map((c) => [c.id, c.nombre]));
  const cobros = (cobrosRes.data ?? []).map((c) => ({
    ...c,
    cliente_nombre: nombres.get(c.client_id) ?? "Cliente eliminado",
  }));
  return NextResponse.json({
    cobros,
    clientes_activos: (clientesRes.data ?? []).filter((c) => c.activo).length,
  });
}

/** POST /api/cobros — {mes: YYYY-MM} genera cobros pendientes para todos los clientes activos que aún no lo tengan */
export async function POST(req: Request) {
  try {
    const { mes } = await req.json();
    if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
      return NextResponse.json({ error: "mes inválido (YYYY-MM)" }, { status: 400 });
    }
    const s = db();
    const { data: clientes, error: cErr } = await s
      .from("clients")
      .select("id,mensualidad")
      .eq("activo", true);
    if (cErr) throw new Error(cErr.message);
    if (!clientes || clientes.length === 0) {
      return NextResponse.json({ ok: true, generados: 0, motivo: "sin clientes activos" });
    }
    const filas = clientes.map((c) => ({
      client_id: c.id,
      mes: `${mes}-01`,
      monto: c.mensualidad,
    }));
    const { error } = await s
      .from("cobros")
      .upsert(filas, { onConflict: "client_id,mes", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, generados: filas.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
