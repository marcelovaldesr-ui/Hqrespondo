import { NextResponse } from "next/server";
import { autorizado } from "@/lib/prospeccion/auth";
import { db } from "@/lib/db";
import { encolar, type PorEncolar } from "@/lib/cola";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * GET /api/cola/llenar?key=SECRETO[&limite=500][&objetivo=telefono_directo]
 *
 * Llena la cola con las empresas del SII que ya tienen nombre de dueño pero
 * todavía no tienen teléfono — que es exactamente el trabajo pendiente hoy
 * (~860 empresas). Sin esto la cola nace vacía y el worker no tiene qué hacer.
 *
 * Es idempotente: lo que ya está encolado no se duplica.
 */
export async function GET(req: Request) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);

  // ---- Fase 3: llenar la cola de SEÑALES ----
  // Se encolan los leads de Foco que alguien puede llamar mañana. No las 7.312
  // empresas del SII: saber que una empresa está contratando recepcionista, sin
  // tener su teléfono ni el nombre de nadie, es información que no se puede usar.
  if (url.searchParams.get("objetivo") === "senal") {
    const lim = Math.min(Math.max(Number(url.searchParams.get("limite")) || 200, 1), 1000);
    try {
      const { data, error } = await db()
        .from("leads_foco")
        .select("id,contactabilidad")
        .in("estado", ["nuevo", "contactando"])
        .in("encaje", ["alto", "medio", "sin_evaluar"])
        .or(`senal_vigente_hasta.is.null,senal_vigente_hasta.lt.${new Date().toISOString()}`)
        .order("contactabilidad", { ascending: false })
        .limit(lim);
      if (error) throw new Error(error.message);

      const items: PorEncolar[] = (data ?? []).map(
        (l: { id: string; contactabilidad: number | null }) => ({
          entidad: "lead_foco" as const,
          id: l.id,
          objetivo: "senal" as const,
          // Los que ya se pueden marcar primero: una señal sobre un lead
          // llamable se usa mañana; sobre uno sin teléfono, no se usa.
          prioridad: (l.contactabilidad ?? 0) >= 3 ? 100 : 0,
        }),
      );
      const nuevas = await encolar(items);
      return NextResponse.json({ ok: true, objetivo: "senal", candidatas: items.length, encoladas: nuevas });
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: e instanceof Error ? e.message : String(e) },
        { status: 500 },
      );
    }
  }
  const limite = Math.min(Math.max(Number(url.searchParams.get("limite")) || 500, 1), 1000);
  const objetivo = (url.searchParams.get("objetivo") ?? "telefono_directo") as PorEncolar["objetivo"];

  try {
    // Ojo: PostgREST nunca devuelve más de 1.000 filas por respuesta, sin
    // importar el `limit` que se pida. Por eso el tope de 1.000 de arriba.
    const { data, error } = await db()
      .from("empresas_sii")
      .select("rut,n_trabajadores")
      .not("decisor_nombre", "is", null)
      .is("telefono_directo", null)
      .order("n_trabajadores", { ascending: false, nullsFirst: false })
      .limit(limite);
    if (error) throw new Error(error.message);

    const items: PorEncolar[] = (data ?? []).map((e: { rut: string; n_trabajadores: number | null }) => ({
      entidad: "empresa_sii" as const,
      id: e.rut,
      objetivo,
      // Las de 12+ trabajadores primero: son las únicas donde Apollo devuelve
      // algo (medido: 24 de 51 arriba de 12, 0 de 12 abajo).
      prioridad: (e.n_trabajadores ?? 0) >= 12 ? 50 : 0,
    }));

    const nuevas = await encolar(items);
    return NextResponse.json({ ok: true, candidatas: items.length, encoladas: nuevas });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
