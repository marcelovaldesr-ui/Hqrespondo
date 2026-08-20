import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizarPerfil } from "@/lib/telefonoPorLinkedin";

export const dynamic = "force-dynamic";

/**
 * POST /api/hooks/apollo-telefono?token=HQ_API_TOKEN
 *
 * Acá aterrizan los teléfonos de Apollo. `people/match` NO devuelve el número
 * en su respuesta: lo verifica aparte y lo POSTea acá minutos después. Sin
 * este endpoint, pedirle el teléfono a Apollo es tirar créditos a la basura.
 *
 * El token va en la query y no en un header porque Apollo no deja configurar
 * headers propios en el webhook. Está bajo /api/hooks, que el middleware deja
 * fuera del Basic Auth justamente para esto.
 *
 * El lead se reencuentra por la URL de LinkedIn de la persona, que es el
 * mismo dato con el que se pidió la consulta. Si Apollo no la manda, se cae
 * a buscar por nombre — y si tampoco calza, se guarda el payload en la
 * bitácora en vez de descartarlo en silencio.
 */
export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!process.env.HQ_API_TOKEN || token !== process.env.HQ_API_TOKEN) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const gente: any[] = Array.isArray(body?.people)
      ? body.people
      : body?.person
        ? [body.person]
        : Array.isArray(body?.matches)
          ? body.matches
          : [body];

    const s = db();
    const resultados: {
      perfil: string | null;
      telefono: string | null;
      guardado: boolean;
      motivo?: string;
    }[] = [];

    for (const p of gente) {
      const crudo =
        p?.phone_numbers?.[0]?.sanitized_number ??
        p?.phone_numbers?.[0]?.raw_number ??
        p?.sanitized_phone ??
        p?.contact?.phone_numbers?.[0]?.sanitized_number ??
        null;
      const telefono = typeof crudo === "string" && crudo.replace(/\D/g, "").length >= 8 ? crudo.trim() : null;
      const perfil = normalizarPerfil(String(p?.linkedin_url ?? p?.contact?.linkedin_url ?? ""));

      if (!telefono) {
        resultados.push({ perfil, telefono: null, guardado: false, motivo: "Apollo no trajo número" });
        continue;
      }

      // 1) por perfil de LinkedIn — es el dato con el que se pidió
      let { data: leads } = perfil
        ? await s.from("leads_foco").select("id,empresa,contacto,telefono,nota").ilike("linkedin_contacto", `%${perfil.split("/in/")[1]}%`).limit(2)
        : { data: null as any };

      // 2) si no, por nombre exacto de la persona
      if ((!leads || !leads.length) && p?.name) {
        const r = await s.from("leads_foco").select("id,empresa,contacto,telefono,nota").ilike("contacto", String(p.name).trim()).limit(2);
        leads = r.data as any;
      }

      const lead = leads && leads.length === 1 ? (leads[0] as any) : null;
      if (!lead) {
        // No hay tabla de bitácora general en este esquema —la de Foco vive en
        // `leads_foco.nota`—, así que un teléfono huérfano se registra en el
        // log de la función y se devuelve en la respuesta. Inventar un insert
        // a una tabla que no existe sería perderlo en silencio.
        console.warn(
          `[apollo-telefono] sin lead único para ${p?.name ?? "?"} (${perfil ?? "sin LinkedIn"}): ${telefono}`,
        );
        resultados.push({ perfil, telefono, guardado: false, motivo: "no calzó con ningún lead único" });
        continue;
      }

      // No se pisa un teléfono que ya estaba: el trabajo humano manda.
      if (lead.telefono?.trim()) {
        resultados.push({ perfil, telefono, guardado: false, motivo: "el lead ya tenía teléfono cargado" });
        continue;
      }

      const linea = `[${new Date().toISOString().slice(0, 16).replace("T", " ")}] teléfono ${telefono} recibido de Apollo (webhook)`;
      await s
        .from("leads_foco")
        .update({
          telefono,
          nota: lead.nota ? `${lead.nota}\n${linea}` : linea,
          updated_at: new Date().toISOString(),
        })
        .eq("id", lead.id);
      resultados.push({ perfil, telefono, guardado: true });
    }

    return NextResponse.json({ ok: true, recibidos: resultados.length, resultados });
  } catch (e: any) {
    console.error("[hooks/apollo-telefono]", e);
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
