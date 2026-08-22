import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buscarTelefonoDirecto } from "@/lib/agenteTelefono";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

/**
 * POST /api/decisores/telefono  { rut }  ó  { prospect_id }
 *
 * Manda al agente a buscar el número DIRECTO de la persona que manda, no el
 * de la línea pública del negocio. Busca la ficha propia de la persona en
 * Maps, el teléfono que esté junto a su nombre en el sitio del negocio, y por
 * último una búsqueda pública obligada a citar la fuente.
 *
 * Solo guarda si encontró un número DISTINTO al que ya estaba publicado: si
 * devuelve el mismo, no aporta nada y no se toca la ficha.
 */
export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    const s = db();

    let persona = "", empresa = "", comuna = "", telefono: string | null = null;
    let rut: string | null = b?.rut ? String(b.rut) : null;
    let prospectId: string | null = b?.prospect_id ? String(b.prospect_id) : null;

    if (rut) {
      const { data, error } = await s
        .from("empresas_sii")
        .select("rut,razon_social,comuna,telefono,decisor_nombre,prospect_id")
        .eq("rut", rut).single();
      if (error) throw new Error(error.message);
      if (!data) return NextResponse.json({ error: "RUT no encontrado" }, { status: 404 });
      persona = data.decisor_nombre ?? ""; empresa = data.razon_social;
      comuna = data.comuna ?? ""; telefono = data.telefono;
      prospectId = data.prospect_id;
    } else if (prospectId) {
      const { data, error } = await s
        .from("prospects").select("id,nombre,comuna,telefono,contacto_nombre")
        .eq("id", prospectId).single();
      if (error) throw new Error(error.message);
      if (!data) return NextResponse.json({ error: "Prospecto no encontrado" }, { status: 404 });
      persona = data.contacto_nombre ?? ""; empresa = data.nombre;
      comuna = data.comuna ?? ""; telefono = data.telefono;
    } else {
      return NextResponse.json({ error: "Falta rut o prospect_id" }, { status: 400 });
    }

    if (!persona) {
      return NextResponse.json(
        { error: "Todavía no sabemos el nombre de quién manda. Corre primero /api/decisores." },
        { status: 400 },
      );
    }

    const r = await buscarTelefonoDirecto({
      persona, empresa, comuna, telefonoConocido: telefono,
    });

    if (r.mejor) {
      const patch = {
        telefono_directo: r.mejor.telefono,
        telefono_directo_origen: `${r.mejor.fuente} · ${r.mejor.comoLoSupe}`,
        verificado_at: new Date().toISOString(),
      };
      if (rut) await s.from("empresas_sii").update(patch).eq("rut", rut);
      if (prospectId) {
        await s.from("prospects").update({
          contacto_celular: r.mejor.telefono,
          tipo_numero: r.mejor.tipo,
          verificado_at: patch.verificado_at,
        }).eq("id", prospectId);
      }
    }

    return NextResponse.json({
      ok: true, persona, empresa,
      telefono_publico: telefono,
      encontrado: r.mejor,
      otros: r.hallazgos.slice(1),
      traza: r.traza,
    });
  } catch (e: any) {
    console.error("[decisores/telefono]", e);
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
