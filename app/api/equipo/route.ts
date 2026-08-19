import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ESTADOS_OBJETIVO, SOCIOS, type EstadoObjetivo } from "@/lib/equipo";

/**
 * /api/equipo — objetivos semanales por socio.
 *  POST   { semana, socio, objetivo, como_se_mide }  → crea
 *  PATCH  { id, estado?, motivo?, hablado_reunion?, objetivo?, como_se_mide? }
 *  DELETE ?id=...
 */

export async function POST(req: Request) {
  try {
    const b = await req.json();
    const semana = String(b.semana ?? "").slice(0, 10);
    const socio = String(b.socio ?? "").trim();
    const objetivo = String(b.objetivo ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(semana)) {
      return NextResponse.json({ error: "semana inválida" }, { status: 400 });
    }
    const cfg = SOCIOS.find((s) => s.nombre === socio);
    if (!cfg) return NextResponse.json({ error: "socio desconocido" }, { status: 400 });
    if (!objetivo) return NextResponse.json({ error: "el objetivo va vacío" }, { status: 400 });

    const { error } = await db().from("objetivos_semana").insert({
      semana,
      socio,
      rol: cfg.rol,
      objetivo,
      como_se_mide: String(b.como_se_mide ?? "").trim(),
    });
    if (error) {
      // Índice único: mismo objetivo, mismo socio, misma semana.
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Ya existe ese objetivo para este socio en esta semana" },
          { status: 409 },
        );
      }
      throw new Error(error.message);
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const b = await req.json();
    const id = String(b.id ?? "");
    if (!id) return NextResponse.json({ error: "falta id" }, { status: 400 });

    const upd: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (b.estado !== undefined) {
      const e = String(b.estado) as EstadoObjetivo;
      if (!ESTADOS_OBJETIVO.includes(e)) {
        return NextResponse.json({ error: "estado inválido" }, { status: 400 });
      }
      upd.estado = e;
      // Volver a "pendiente" o "cumplido" limpia el motivo: dejarlo colgando
      // hace que la próxima lectura muestre una excusa de otro estado.
      if (e === "pendiente" || e === "cumplido") upd.motivo = "";
    }
    if (b.motivo !== undefined) upd.motivo = String(b.motivo).slice(0, 500);
    if (b.hablado_reunion !== undefined) upd.hablado_reunion = Boolean(b.hablado_reunion);
    if (b.objetivo !== undefined) upd.objetivo = String(b.objetivo).trim().slice(0, 300);
    if (b.como_se_mide !== undefined) upd.como_se_mide = String(b.como_se_mide).trim().slice(0, 300);

    const { error } = await db().from("objetivos_semana").update(upd).eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "falta id" }, { status: 400 });
    const { error } = await db().from("objetivos_semana").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
