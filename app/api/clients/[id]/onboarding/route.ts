import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ONBOARDING_PASOS_DEFAULT } from "@/lib/types";

/** GET /api/clients/:id/onboarding — checklist del cliente */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const { data, error } = await db()
    .from("onboarding_tasks")
    .select("*")
    .eq("client_id", params.id)
    .order("orden", { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ tasks: data ?? [] });
}

/** POST /api/clients/:id/onboarding — crea el checklist estándar (si no existe) o agrega un paso custom {paso} */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const body = await req.json().catch(() => ({}));
    const s = db();

    if (body.paso) {
      const { data: max } = await s
        .from("onboarding_tasks")
        .select("orden")
        .eq("client_id", params.id)
        .order("orden", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { error } = await s.from("onboarding_tasks").insert({
        client_id: params.id,
        paso: String(body.paso).trim(),
        orden: (max?.orden ?? 0) + 1,
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true });
    }

    const { count } = await s
      .from("onboarding_tasks")
      .select("*", { count: "exact", head: true })
      .eq("client_id", params.id);
    if ((count ?? 0) > 0) {
      return NextResponse.json({ ok: true, ya_existia: true });
    }
    const { error } = await s.from("onboarding_tasks").insert(
      ONBOARDING_PASOS_DEFAULT.map((paso, i) => ({
        client_id: params.id,
        paso,
        orden: i + 1,
      })),
    );
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/** PATCH /api/clients/:id/onboarding — {task_id, hecho} marca/desmarca un paso */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const body = await req.json();
    if (!body.task_id) {
      return NextResponse.json({ error: "Falta task_id" }, { status: 400 });
    }
    const hecho = Boolean(body.hecho);
    const usuario = req.headers.get("x-hq-user");
    const { error } = await db()
      .from("onboarding_tasks")
      .update({
        hecho,
        hecho_por: hecho ? usuario : null,
        hecho_at: hecho ? new Date().toISOString() : null,
      })
      .eq("id", body.task_id)
      .eq("client_id", params.id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
