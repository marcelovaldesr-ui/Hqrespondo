import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PLAN_PRECIOS, type Plan } from "@/lib/types";

/** POST /api/clients — crea un cliente */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.nombre) {
      return NextResponse.json(
        { error: "nombre es obligatorio" },
        { status: 400 },
      );
    }

    const plan: Plan = body.plan ?? "cotizador";
    const { error } = await db().from("clients").insert({
      nombre: body.nombre,
      rubro: body.rubro ?? null,
      plan,
      mensualidad: body.mensualidad ?? PLAN_PRECIOS[plan].mensual,
      telefono_bot: body.telefono_bot ?? null,
      workflow_id: body.workflow_id ?? null,
      fecha_inicio: body.fecha_inicio ?? new Date().toISOString().slice(0, 10),
      activo: true,
    });
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
