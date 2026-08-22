import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolverDecisor } from "@/lib/decisorDe";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/decisores  { fuente: "prospects" | "leads_foco", limite?, id? }
 *
 * Busca quién manda en cada negocio usando SOLO fuentes públicas: la razón
 * social del SII (que en una EIRL nombra al dueño por obligación legal) y la
 * web del propio negocio. No consulta LinkedIn ni gasta créditos de nadie.
 *
 * Guarda el nombre, el cargo, CÓMO PREGUNTAR por él en la llamada y de dónde
 * salió. Nunca pisa un contacto cargado a mano.
 *
 * Corre de a lotes para no morir en el timeout de la función: cada llamada
 * procesa `limite` (por defecto 25) y devuelve cuántos quedan.
 */
export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    const fuente = b?.fuente === "leads_foco" ? "leads_foco" : "prospects";
    const limite = Math.min(Math.max(Number(b?.limite) || 25, 1), 100);
    const s = db();

    const campos =
      fuente === "prospects"
        ? "id,nombre,web,notas,contacto_nombre,direccion"
        : "id,empresa,razon_social,web,contacto";
    let q = s.from(fuente).select(campos).limit(limite);
    if (b?.id) q = q.eq("id", String(b.id));
    else if (fuente === "prospects") q = q.is("contacto_nombre", null).not("web", "is", null);
    else q = q.is("contacto", null);

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const filas = (data ?? []) as any[];
    if (!filas.length) return NextResponse.json({ ok: true, revisados: 0, encontrados: 0, resultados: [] });

    const resultados: any[] = [];
    // De a 6 en paralelo: son fetch a sitios ajenos, no conviene apurarlos más.
    for (let i = 0; i < filas.length; i += 6) {
      const trozo = filas.slice(i, i + 6);
      const parte = await Promise.all(
        trozo.map(async (f) => {
          const razon =
            fuente === "prospects"
              ? (String(f.notas ?? "").match(/^SII:\s*([^·]+)·/)?.[1] ?? "").trim() || null
              : f.razon_social ?? null;
          const d = await resolverDecisor({
            razon_social: razon,
            web: f.web,
            direccion: f.direccion ?? null,
            contactoActual: fuente === "prospects" ? f.contacto_nombre : f.contacto,
          });
          return { f, d };
        }),
      );
      resultados.push(...parte);
    }

    let guardados = 0;
    for (const { f, d } of resultados) {
      if (!d.nombre || d.origen === "cargado a mano") continue;
      const patch: Record<string, unknown> =
        fuente === "prospects"
          ? {
              contacto_nombre: d.nombre,
              contacto_confianza: d.confianza,
              decisor_cargo: d.cargo,
              decisor_origen: d.origen,
              verificado_at: new Date().toISOString(),
            }
          : {
              contacto: d.nombre,
              cargo: d.cargo,
              confianza: d.confianza,
              decisor_origen: d.origen,
              verificado_at: new Date().toISOString(),
            };
      const { error: e } = await s.from(fuente).update(patch).eq("id", f.id);
      if (e) {
        // Si faltan las columnas nuevas (migración 025 sin correr), se dice
        // claro en vez de fallar entero y dejar todo a medias.
        return NextResponse.json(
          { error: `No se pudo guardar: ${e.message}. ¿Corriste la migración 025?` },
          { status: 500 },
        );
      }
      guardados++;
    }

    const { count } = await s
      .from(fuente)
      .select("id", { count: "exact", head: true })
      .is(fuente === "prospects" ? "contacto_nombre" : "contacto", null);

    return NextResponse.json({
      ok: true,
      revisados: resultados.length,
      encontrados: resultados.filter((r) => r.d.nombre).length,
      guardados,
      quedan_sin_decisor: count ?? null,
      resultados: resultados.map(({ f, d }) => ({
        empresa: f.nombre ?? f.empresa,
        decisor: d.nombre,
        cargo: d.cargo,
        comoPreguntar: d.comoPreguntar,
        confianza: d.confianza,
        origen: d.origen,
        candidatos: d.candidatos.length,
        traza: d.traza,
      })),
    });
  } catch (e: any) {
    console.error("[decisores]", e);
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
