import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ESTADO_CONFIG, PLAN_PRECIOS, type Plan } from "@/lib/types";

/**
 * POST /api/deals
 * Opción A: { prospect_id } → crea deal desde un prospecto y lo marca en_pipeline.
 * Opción B: { nombre_negocio, rubro?, plan?, valor_setup?, valor_mensual? } → deal manual.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const s = db();

    if (body.prospect_id) {
      const { data: p, error: pErr } = await s
        .from("prospects")
        .select("*")
        .eq("id", body.prospect_id)
        .single();
      if (pErr || !p) {
        return NextResponse.json(
          { error: "Prospecto no encontrado" },
          { status: 404 },
        );
      }

      const plan: Plan = body.plan ?? "cotizador";
      const precios = PLAN_PRECIOS[plan];
      const { error } = await s.from("deals").insert({
        prospect_id: p.id,
        nombre_negocio: p.nombre,
        rubro: p.rubro,
        plan,
        valor_setup: precios.setup,
        valor_mensual: precios.mensual,
        etapa: "contactado",
        notas: p.notas,
      });
      if (error) throw new Error(error.message);

      await s
        .from("prospects")
        .update({ estado: ESTADO_CONFIG.en_pipeline.value })
        .eq("id", p.id);

      return NextResponse.json({ ok: true });
    }

    if (!body.nombre_negocio) {
      return NextResponse.json(
        { error: "nombre_negocio es obligatorio" },
        { status: 400 },
      );
    }

    const plan: Plan = body.plan ?? "cotizador";
    const precios = PLAN_PRECIOS[plan];
    const { error } = await s.from("deals").insert({
      nombre_negocio: body.nombre_negocio,
      rubro: body.rubro ?? null,
      plan,
      valor_setup: body.valor_setup ?? precios.setup,
      valor_mensual: body.valor_mensual ?? precios.mensual,
      etapa: body.etapa ?? "contactado",
      proxima_accion: body.proxima_accion ?? null,
    });
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
