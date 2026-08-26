import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { evaluarEncaje } from "@/lib/encaje";
import { normalizarTelefono } from "@/lib/actividades";
import { quienEs } from "@/lib/equipo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/foco/nuevo — agrega UN lead a mano.
 *
 * Existe porque hasta ahora la única puerta era pegar un CSV, y eso sirve para
 * una tanda de cien pero no para el caso real más común: te pasan un dato en
 * una conversación, o ves un negocio en Instagram, y quieres anotarlo ahora sin
 * armar una planilla.
 *
 * Pide poco a propósito. Empresa es lo único obligatorio; el resto se completa
 * después desde la ficha, que ya sabe editar esos campos. Un formulario que
 * exige diez campos para guardar uno es un formulario que nadie usa.
 *
 * El encaje se calcula solo con la misma regla que usa la importación, así el
 * lead entra ordenado en la cola desde el primer momento.
 */
export async function POST(req: Request) {
  try {
    const b = await req.json();

    const empresa = String(b.empresa ?? "").trim().slice(0, 300);
    if (!empresa) {
      return NextResponse.json({ error: "La empresa es lo único obligatorio." }, { status: 400 });
    }

    const contacto = String(b.contacto ?? "").trim().slice(0, 300);
    const lista = String(b.lista ?? "general").trim().slice(0, 100) || "general";
    const telefono = String(b.telefono ?? "").trim().slice(0, 60);
    const industria = String(b.industria ?? "").trim().slice(0, 200);
    const comuna = String(b.comuna ?? "").trim().slice(0, 120);
    const cargo = String(b.cargo ?? "").trim().slice(0, 200);
    // OJO — bug real del 25-ago-2026: el formulario mandaba `email` y este
    // endpoint no lo leía, así que se perdía en silencio y había que volver a
    // escribirlo desde "editar datos". El formulario y el endpoint son dos
    // listas de campos separadas y se desincronizaron. Cada vez que se agregue
    // un campo a NuevoLeadFoco.tsx hay que agregarlo ACÁ y en el insert.
    const email = String(b.email ?? "").trim().slice(0, 200);
    const web = String(b.web ?? "").trim().slice(0, 300);
    const senal = String(b.senal ?? "").trim().slice(0, 600);
    const nota = String(b.nota ?? "").trim().slice(0, 4000);
    const nEmpleados = Number.isFinite(Number(b.n_empleados)) && Number(b.n_empleados) > 0
      ? Math.min(Math.round(Number(b.n_empleados)), 100_000)
      : null;

    const s = db();

    // Misma llave que la importación: (lista + empresa + contacto). Si ya
    // existe, se avisa en vez de crear un duplicado silencioso — el índice
    // único lo rechazaría igual, pero con un error que no explica nada.
    const { data: existe } = await s
      .from("leads_foco")
      .select("id,empresa,contacto")
      .eq("lista", lista)
      .ilike("empresa", empresa)
      .ilike("contacto", contacto)
      .limit(1);
    if (existe?.length) {
      return NextResponse.json(
        { error: "Ese lead ya está en esta lista.", id: existe[0].id, duplicado: true },
        { status: 409 },
      );
    }

    // Si el número está en la lista de supresión, se avisa ANTES de guardar.
    // Alguien que pidió no ser contactado no puede volver a entrar por la
    // puerta de atrás de un alta manual (Ley 21.719, derecho de oposición).
    if (telefono) {
      const valor = normalizarTelefono(telefono);
      if (valor) {
        const { data: sup } = await s
          .from("supresiones")
          .select("valor,motivo")
          .eq("valor", valor)
          .limit(1);
        if (sup?.length) {
          return NextResponse.json(
            {
              error: `Ese número está en la lista de no contactar (${sup[0].motivo ?? "sin motivo registrado"}). No se agregó.`,
              suprimido: true,
            },
            { status: 409 },
          );
        }
      }
    }

    const encaje = evaluarEncaje({
      empresa,
      industria,
      senal,
      n_empleados: nEmpleados ?? undefined,
    } as Parameters<typeof evaluarEncaje>[0]);

    const { data, error } = await s
      .from("leads_foco")
      .insert({
        empresa,
        contacto,
        cargo,
        telefono,
        email,
        web,
        // El arreglo se llena también acá para que no existan dos formas de
        // leer lo mismo: la ficha siempre mira `telefonos`/`emails`.
        telefonos: telefono ? [{ valor: telefono, tipo: "otro", fuente: "alta manual" }] : [],
        emails: email ? [{ valor: email, tipo: "trabajo", fuente: "alta manual" }] : [],
        industria,
        comuna,
        lista,
        senal,
        nota,
        n_empleados: nEmpleados,
        // Queda anotado que lo puso una persona: si mañana se reimporta un CSV
        // que traiga esta misma empresa, se puede distinguir qué vino de dónde.
        fuente_url: "alta manual en HQ",
        creado_por: quienEs(req) ?? "alta manual",
        confianza: "media",
        encaje: encaje.nivel,
        encaje_motivo: encaje.motivo,
        estado: "nuevo",
      })
      .select("id,empresa,contacto,encaje")
      .single();
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, lead: data, encaje: encaje.nivel, motivo: encaje.motivo });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
