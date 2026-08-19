import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { revelarContactoApollo } from "@/lib/apolloAPI";
import { revelarContactoLusha } from "@/lib/lushaAPI";
import type { ContactoDecision } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/prospects/:id/contactos/:contactoId/revelar
 * Para contactos con fuente="apollo" o fuente="lusha": gasta un crédito del
 * plan gratuito correspondiente para obtener el email/teléfono real de un
 * candidato ya encontrado gratis. Se llama a pedido explícito del usuario
 * (nunca automático) — ambos planes gratuitos tienen pocos créditos.
 */
export async function POST(
  _req: Request,
  { params }: { params: { id: string; contactoId: string } },
) {
  try {
    const s = db();
    const { data: contacto, error: cErr } = await s
      .from("contactos_decision")
      .select("*")
      .eq("id", params.contactoId)
      .eq("prospect_id", params.id)
      .single();
    if (cErr) throw new Error(cErr.message);
    if (!contacto) {
      return NextResponse.json({ error: "Contacto no encontrado" }, { status: 404 });
    }

    if (contacto.fuente === "apollo" && contacto.apollo_person_id) {
      const rev = await revelarContactoApollo(contacto.apollo_person_id);
      const { data: actualizado, error: uErr } = await s
        .from("contactos_decision")
        .update({
          nombre: rev.nombre ?? contacto.nombre,
          cargo: rev.cargo ?? contacto.cargo,
          telefono: rev.telefono,
          email: rev.email,
          linkedin_url: rev.linkedin_url,
          confianza: rev.email || rev.telefono ? "alta" : "media",
          notas: `Revelado con Apollo (${rev.creditos_consumidos} crédito${rev.creditos_consumidos === 1 ? "" : "s"} consumido${rev.creditos_consumidos === 1 ? "" : "s"}).`,
        })
        .eq("id", params.contactoId)
        .select("*")
        .single();
      if (uErr) throw new Error(uErr.message);
      return NextResponse.json({ contacto: actualizado as ContactoDecision });
    }

    if (contacto.fuente === "lusha" && contacto.lusha_contact_id) {
      const rev = await revelarContactoLusha(contacto.lusha_contact_id);
      const { data: actualizado, error: uErr } = await s
        .from("contactos_decision")
        .update({
          telefono: rev.telefono ?? contacto.telefono,
          email: rev.email ?? contacto.email,
          confianza: rev.email || rev.telefono ? "alta" : "media",
          notas:
            rev.email || rev.telefono
              ? `Revelado con Lusha (${rev.creditos_consumidos} crédito${rev.creditos_consumidos === 1 ? "" : "s"} consumido${rev.creditos_consumidos === 1 ? "" : "s"}).`
              : `Lusha no devolvió email/teléfono reconocible en este intento (respuesta cruda guardada para revisar): ${rev.crudo}`,
        })
        .eq("id", params.contactoId)
        .select("*")
        .single();
      if (uErr) throw new Error(uErr.message);
      return NextResponse.json({ contacto: actualizado as ContactoDecision });
    }

    return NextResponse.json(
      { error: "Este contacto no viene de Apollo/Lusha o no tiene id para revelar" },
      { status: 400 },
    );
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
