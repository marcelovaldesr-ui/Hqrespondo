import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ONBOARDING_PASOS_DEFAULT, PLAN_PRECIOS, type Plan } from "@/lib/types";

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
    const s = db();
    const { data: nuevo, error } = await s
      .from("clients")
      .insert({
        nombre: body.nombre,
        rubro: body.rubro ?? null,
        plan,
        mensualidad: body.mensualidad ?? PLAN_PRECIOS[plan].mensual,
        telefono_bot: body.telefono_bot ?? null,
        workflow_id: body.workflow_id ?? null,
        fecha_inicio: body.fecha_inicio ?? new Date().toISOString().slice(0, 10),
        activo: true,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // Checklist de onboarding estándar para el cliente nuevo
    if (nuevo?.id) {
      await s.from("onboarding_tasks").insert(
        ONBOARDING_PASOS_DEFAULT.map((paso, i) => ({
          client_id: nuevo.id,
          paso,
          orden: i + 1,
        })),
      );
    }

    return NextResponse.json({ ok: true, id: nuevo?.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
