import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { personaDeLogin } from "@/lib/equipo";
import { normalizarPerfil, telefonoPorLinkedin } from "@/lib/telefonoPorLinkedin";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/foco/telefono  { id?, linkedin_url? }
 *
 * Busca el teléfono de una persona a partir de su perfil de LinkedIn,
 * preguntándole a los proveedores de datos configurados (Apollo, Lusha).
 *
 * Se puede llamar de dos formas:
 *  · con `id` de un lead de Foco → usa su linkedin_contacto y, si aparece
 *    teléfono, lo GUARDA en el lead y deja la línea en la bitácora.
 *  · con `linkedin_url` suelta → solo consulta y devuelve, sin guardar nada.
 *
 * GASTA CRÉDITOS del plan del proveedor. Por eso es una acción manual, de a
 * un lead, disparada por una persona: nunca se recorre la lista sola.
 */
export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    const id = typeof b?.id === "string" ? b.id : null;
    const s = db();

    let url: string | null = typeof b?.linkedin_url === "string" ? b.linkedin_url : null;
    let lead: {
      empresa: string; contacto: string; telefono: string;
      linkedin_contacto: string; nota: string | null;
    } | null = null;

    if (id) {
      const { data, error } = await s
        .from("leads_foco")
        .select("empresa,contacto,telefono,linkedin_contacto,nota")
        .eq("id", id)
        .single();
      if (error) throw new Error(error.message);
      if (!data) return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });
      lead = data as any;
      url = url || lead!.linkedin_contacto;
      if (lead!.telefono?.trim()) {
        return NextResponse.json(
          { error: "Este lead ya tiene teléfono. Bórralo primero si quieres volver a buscarlo — la consulta gasta créditos." },
          { status: 400 },
        );
      }
    }

    if (!normalizarPerfil(url ?? "")) {
      return NextResponse.json(
        { error: "Falta un perfil de LinkedIn válido (linkedin.com/in/…). El de empresa no sirve: se busca a una persona." },
        { status: 400 },
      );
    }

    const r = await telefonoPorLinkedin(url!);

    if (id && lead && (r.telefono || r.email)) {
      const cambios: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (r.telefono) cambios.telefono = r.telefono;
      if (r.email) cambios.email = r.email;
      // Se anota en la nota del lead, NO en la bitácora de actividades: esto
      // no es un toque comercial y contarlo como tal ensuciaría el marcador
      // de llamadas y contactados de /metricas.
      const quien = personaDeLogin(req.headers.get("x-hq-user")) || "alguien";
      const linea =
        `[${new Date().toLocaleDateString("es-CL")} · dato] ` +
        (r.telefono
          ? `${quien} obtuvo el teléfono desde LinkedIn vía ${r.fuente} (${r.creditos} crédito${r.creditos === 1 ? "" : "s"}).`
          : `${quien} buscó el teléfono en LinkedIn: no había, pero ${r.fuente ?? "el proveedor"} devolvió el correo.`);
      cambios.nota = lead.nota ? `${lead.nota}\n${linea}` : linea;

      const { error: uErr } = await s.from("leads_foco").update(cambios).eq("id", id);
      if (uErr) throw new Error(uErr.message);
    }

    return NextResponse.json({ ok: true, guardado: !!(id && r.telefono), ...r });
  } catch (e: any) {
    console.error("[foco/telefono]", e);
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
