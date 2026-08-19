import { unstable_noStore as noStore } from "next/cache";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buscarContactoDecision } from "@/lib/contactoAI";
import { buscarContactoHunter } from "@/lib/hunterAPI";
import { buscarContactoMixto } from "@/lib/contactoMixto";
import { buscarPersonasApollo } from "@/lib/apolloAPI";
import { buscarPersonasLusha } from "@/lib/lushaAPI";
import { buscarContactoCombinado } from "@/lib/contactoCombinado";
import { isAreaObjetivo, type ContactoDecision, type Fuente } from "@/lib/types";

const FUENTES_VALIDAS: Fuente[] = ["ia", "hunter", "apollo", "hunter_ia", "lusha", "todas"];

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** GET /api/prospects/:id/contactos — lista los contactos ya buscados para este prospecto. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    noStore();
    const { data, error } = await db()
      .from("contactos_decision")
      .select("*")
      .eq("prospect_id", params.id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return NextResponse.json(
      { contactos: (data ?? []) as ContactoDecision[] },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/**
 * POST /api/prospects/:id/contactos  { area_objetivo }
 * Dispara UNA búsqueda con IA (google_search) del encargado de esa área para
 * este prospecto y guarda el resultado (encontrado o no). Manual, uno a la
 * vez — nunca en lote, para poder revisar cada dato antes de usarlo.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    const area = body?.area_objetivo;
    const fuente: Fuente = FUENTES_VALIDAS.includes(body?.fuente) ? body.fuente : "todas";
    if (!isAreaObjetivo(area)) {
      return NextResponse.json({ error: "area_objetivo inválida" }, { status: 400 });
    }

    const s = db();
    const { data: prospect, error: pErr } = await s
      .from("prospects")
      .select("nombre,rubro,comuna,web")
      .eq("id", params.id)
      .single();
    if (pErr) throw new Error(pErr.message);
    if (!prospect) {
      return NextResponse.json({ error: "Prospecto no encontrado" }, { status: 404 });
    }

    // Apollo es distinto: la búsqueda es gratis pero devuelve VARIOS
    // candidatos con nombre parcial (sin contacto) — cada uno se guarda
    // como fila propia para poder "revelar" (gastar crédito) uno a uno.
    if (fuente === "apollo") {
      const { candidatos, motivo } = await buscarPersonasApollo(prospect, area);
      if (candidatos.length === 0) {
        return NextResponse.json({ contactos: [], encontrado: false, motivo });
      }
      const filas = candidatos.map((c) => ({
        prospect_id: params.id,
        area_objetivo: area,
        nombre: c.nombre_parcial,
        cargo: c.cargo,
        telefono: null,
        email: null,
        linkedin_url: null,
        fuentes: [],
        confianza: "media" as const,
        verificado: false,
        notas: `Nombre parcial (Apollo aún no revelado)${c.organizacion ? ` — ${c.organizacion}` : ""}. Usa "Revelar contacto" para pedir el email/teléfono (gasta 1 crédito Apollo).`,
        fuente: "apollo",
        apollo_person_id: c.apollo_person_id,
      }));
      const { data, error } = await s.from("contactos_decision").insert(filas).select("*");
      if (error) throw new Error(error.message);
      return NextResponse.json({ contactos: (data ?? []) as ContactoDecision[], encontrado: true });
    }

    // Lusha: mismo patrón que Apollo (búsqueda gratis con nombre completo
    // real, sin contacto) — pero acá el plan gratuito SÍ deja revelar
    // después (ver lib/lushaAPI.ts).
    if (fuente === "lusha") {
      const { candidatos, motivo } = await buscarPersonasLusha(prospect, area);
      if (candidatos.length === 0) {
        return NextResponse.json({ contactos: [], encontrado: false, motivo });
      }
      const filas = candidatos.map((c) => ({
        prospect_id: params.id,
        area_objetivo: area,
        nombre: c.nombre,
        cargo: c.cargo,
        telefono: null,
        email: null,
        linkedin_url: c.linkedin_url,
        fuentes: [],
        confianza: "media" as const,
        verificado: false,
        notas: `Encontrado con Lusha${c.ciudad_pais ? ` (${c.ciudad_pais})` : ""}${
          c.departamentos.length ? ` — depto. ${c.departamentos.join(", ")}` : ""
        }. Costo de revelar: ${c.costo_revelar}.`,
        fuente: "lusha",
        lusha_contact_id: c.lusha_contact_id,
      }));
      const { data, error } = await s.from("contactos_decision").insert(filas).select("*");
      if (error) throw new Error(error.message);
      return NextResponse.json({
        contactos: (data ?? []) as ContactoDecision[],
        encontrado: true,
        motivo,
      });
    }

    // "todas" (recomendado): Hunter + Lusha en paralelo, cruzados entre sí
    // y con verificación IA como respaldo. El resultado puede ser un único
    // contacto (hunter_lusha / hunter_ia / ia) o varios candidatos de Lusha
    // sin revelar (si Hunter no encontró nada pero Lusha sí).
    if (fuente === "todas") {
      const resultado = await buscarContactoCombinado(prospect, area);

      if (resultado.tipo === "multiple") {
        if (resultado.candidatos.length === 0) {
          return NextResponse.json({ contactos: [], encontrado: false, motivo: resultado.motivo });
        }
        const filas = resultado.candidatos.map((c) => ({
          prospect_id: params.id,
          area_objetivo: area,
          nombre: c.nombre,
          cargo: c.cargo,
          telefono: null,
          email: null,
          linkedin_url: c.linkedin_url,
          fuentes: [],
          confianza: "media" as const,
          verificado: false,
          notas: `Hunter no encontró nada; Lusha sí (${c.ciudad_pais ?? "Chile"}${
            c.departamentos.length ? `, depto. ${c.departamentos.join(", ")}` : ""
          }). Costo de revelar: ${c.costo_revelar}.`,
          fuente: "lusha",
          lusha_contact_id: c.lusha_contact_id,
        }));
        const { data, error } = await s.from("contactos_decision").insert(filas).select("*");
        if (error) throw new Error(error.message);
        return NextResponse.json({
          contactos: (data ?? []) as ContactoDecision[],
          encontrado: true,
          motivo: resultado.motivo,
        });
      }

      const { data: fila, error: iErr } = await s
        .from("contactos_decision")
        .insert({
          prospect_id: params.id,
          area_objetivo: area,
          nombre: resultado.nombre,
          cargo: resultado.cargo,
          telefono: resultado.telefono,
          email: resultado.email,
          linkedin_url: resultado.linkedin_url,
          fuentes: resultado.fuentes,
          confianza: resultado.confianza,
          verificado: false,
          notas: resultado.resumen,
          fuente: resultado.fuente_real,
          lusha_contact_id: resultado.lusha_contact_id ?? null,
        })
        .select("*")
        .single();
      if (iErr) throw new Error(iErr.message);
      return NextResponse.json({ contacto: fila as ContactoDecision, encontrado: resultado.encontrado });
    }

    // "hunter_ia" (modo mixto): Hunter aporta el dato real, la IA solo lo
    // verifica/enriquece. Si Hunter no encontró nada, el resultado vuelve
    // marcado como fuente_real="ia" (100% búsqueda IA, sin base real).
    if (fuente === "hunter_ia") {
      const resultado = await buscarContactoMixto(prospect, area);
      const { data: fila, error: iErr } = await s
        .from("contactos_decision")
        .insert({
          prospect_id: params.id,
          area_objetivo: area,
          nombre: resultado.nombre,
          cargo: resultado.cargo,
          telefono: resultado.telefono,
          email: resultado.email,
          linkedin_url: resultado.linkedin_url,
          fuentes: resultado.fuentes,
          confianza: resultado.confianza,
          verificado: false,
          notas: resultado.resumen,
          fuente: resultado.fuente_real,
        })
        .select("*")
        .single();
      if (iErr) throw new Error(iErr.message);
      return NextResponse.json({ contacto: fila as ContactoDecision, encontrado: resultado.encontrado });
    }

    const resultado =
      fuente === "hunter"
        ? await buscarContactoHunter(prospect, area)
        : await buscarContactoDecision(prospect, area);

    const { data: fila, error: iErr } = await s
      .from("contactos_decision")
      .insert({
        prospect_id: params.id,
        area_objetivo: area,
        nombre: resultado.nombre,
        cargo: resultado.cargo,
        telefono: resultado.telefono,
        email: resultado.email,
        linkedin_url: resultado.linkedin_url,
        fuentes: resultado.fuentes,
        confianza: resultado.confianza,
        verificado: false,
        notas: resultado.resumen,
        fuente,
      })
      .select("*")
      .single();
    if (iErr) throw new Error(iErr.message);

    return NextResponse.json({ contacto: fila as ContactoDecision, encontrado: resultado.encontrado });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
