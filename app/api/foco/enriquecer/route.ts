import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { enriquecerLead } from "@/lib/enriquecerLead";
import {
  ajustarPorHistorial, estadoDelLead, armarPlan,
  ESTADO_LEAD_LABEL, type TipoContactoAjuste,
} from "@/lib/contactabilidad";
import { digitosCL } from "@/lib/alcance";
import type { ContactoConEvidencia, TipoContacto } from "@/lib/contactos";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * GET /api/foco/enriquecer?modo=seco|real[&limite=N][&sinPlaces=1][&id=UUID]
 *
 * Pasa los leads por el pipeline de enriquecimiento y guarda los contactos con
 * su evidencia, la calidad y el mejor camino hacia el decisor.
 *
 * ORDEN DE ATENCIÓN: primero los que nunca se enriquecieron, después los más
 * viejos. Un lead enriquecido ayer no se vuelve a tocar mientras haya alguno
 * que nunca se miró — es lo que evita gastar la corrida en refrescar lo que ya
 * está bien.
 *
 * `sinPlaces=1` corre SOLO la parte gratis (leer el sitio del negocio). En el
 * banco de pruebas sobre 15 pymes chilenas reales eso solo ya devolvió un
 * teléfono publicado por el propio negocio en el 53% de los casos, y en el 73%
 * de aquellos cuyo sitio abrió. Conviene correrlo así la primera vez sobre
 * toda la base: no cuesta un peso y deja ver cuánto falta de verdad.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const real = url.searchParams.get("modo") === "real";
  const sinPlaces = url.searchParams.get("sinPlaces") === "1";
  const soloId = url.searchParams.get("id");
  const limite = Math.min(Math.max(Number(url.searchParams.get("limite")) || 40, 1), 200);
  // 280s deja 20 de margen bajo el tope de Vercel. Lo que no alcance queda
  // para la corrida siguiente: no se pierde, solo espera.
  const limiteMs = 270_000;
  const t0 = Date.now();

  try {
    const s = db();

    // ── Lo que ya se comprobó malo, para no volver a proponerlo ────────────
    const { data: malosRows } = await s.from("numeros_malos").select("clave").limit(2000);
    const malos = new Set((malosRows ?? []).map((r: any) => String(r.clave)));

    // ── Corrección aprendida de las llamadas reales ────────────────────────
    const ajustes = await calcularAjustes(s);

    // ── A quién le toca ────────────────────────────────────────────────────
    let q = s
      .from("leads_foco")
      .select("id,empresa,comuna,industria,web,telefono,telefonos,contacto,cargo,linkedin_contacto,enriquecido_at,calidad")
      .in("estado", ["nuevo", "contactando"]);
    if (soloId) q = q.eq("id", soloId);
    const { data: leads, error } = await q
      .order("enriquecido_at", { ascending: true, nullsFirst: true })
      .limit(limite);
    if (error) throw new Error(`leads_foco: ${error.message}`);

    const resultados: any[] = [];
    let escritos = 0, costoPlaces = 0, cortoPorTiempo = false;

    for (const l of (leads ?? []) as any[]) {
      if (Date.now() - t0 > limiteMs) { cortoPorTiempo = true; break; }

      const previos: { valor: string; fuente?: string }[] = [];
      if (l.telefono) previos.push({ valor: l.telefono, fuente: "el que ya estaba en la ficha" });
      if (Array.isArray(l.telefonos)) {
        for (const t of l.telefonos) if (t?.valor) previos.push({ valor: String(t.valor), fuente: String(t.fuente ?? "base previa") });
      }

      let r;
      try {
        r = await enriquecerLead({
          empresa: l.empresa,
          comuna: l.comuna,
          rubro: l.industria,
          web: l.web,
          telefonosPrevios: previos,
          decisor: { nombre: l.contacto, cargo: l.cargo },
          linkedin: l.linkedin_contacto,
          malos,
          ajustes,
          usarPlaces: !sinPlaces,
        });
      } catch (e) {
        resultados.push({ empresa: l.empresa, error: e instanceof Error ? e.message : String(e) });
        continue;
      }
      costoPlaces += r.costoPlaces;

      const mejor = r.pasos[0];
      resultados.push({
        empresa: l.empresa,
        antes: l.calidad ?? "—",
        ahora: ESTADO_LEAD_LABEL[r.estado],
        contactos: r.contactos.length,
        mejor_camino: mejor ? `${mejor.puntos} pts · ${mejor.valor}` : "ninguno",
        con_que_abrir: mejor?.guion,
        traza: r.traza,
      });

      if (real) {
        const patch: Record<string, unknown> = {
          contactos: r.contactos,
          calidad: r.estado,
          enriquecido_at: new Date().toISOString(),
        };
        // Solo se rellena el teléfono principal si estaba VACÍO. Si hay uno
        // puesto, es trabajo de una persona o un dato que alguien eligió, y
        // pisarlo automáticamente es la clase de cosa que hace desconfiar de
        // la herramienta entera.
        const mejorTel = r.pasos.find((p) => p.via !== "email" && p.via !== "linkedin" && p.via !== "formulario");
        if (!String(l.telefono ?? "").trim() && mejorTel) {
          patch.telefono = mejorTel.valor;
          patch.origen_telefono = "enriquecimiento (sitio del negocio)";
        }
        const { error: e2 } = await s.from("leads_foco").update(patch).eq("id", l.id);
        if (!e2) escritos++;
      }
    }

    const conteo: Record<string, number> = {};
    for (const x of resultados) if (x.ahora) conteo[x.ahora] = (conteo[x.ahora] ?? 0) + 1;

    return NextResponse.json({
      ok: true,
      modo: real ? "real" : "seco",
      places: sinPlaces ? "no se usó (corrida gratis)" : "se usó cuando el sitio no bastó",
      leads_mirados: resultados.length,
      escritos,
      corto_por_tiempo: cortoPorTiempo,
      costo_places_usd: Number((costoPlaces * 0.035).toFixed(4)),
      ajustes_aprendidos: Object.keys(ajustes).length ? ajustes : "todavía no hay llamadas suficientes para corregir nada",
      como_quedaron: conteo,
      detalle: resultados.slice(0, 40),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

/**
 * Mira las llamadas ya hechas, ve de qué TIPO era el número que se marcó, y
 * devuelve un multiplicador por tipo.
 *
 * Solo se puede hacer para leads ya enriquecidos —son los únicos que tienen
 * los contactos tipificados—, así que al principio devuelve vacío. Es lo
 * correcto: no hay nada que aprender todavía.
 */
async function calcularAjustes(s: ReturnType<typeof db>): Promise<TipoContactoAjuste> {
  const { data } = await s
    .from("actividades")
    .select("resultado,contacto,leads_foco(contactos)")
    .eq("canal", "llamada")
    .order("created_at", { ascending: false })
    .limit(1000);

  const LLEGO = new Set(["interesado", "no_interesa", "seguimiento", "fuera_icp", "contactado"]);
  const hist: Partial<Record<TipoContacto, { llamadas: number; llegoAlDecisor: number }>> = {};

  for (const a of (data ?? []) as any[]) {
    const clave = digitosCL(String(a.contacto ?? ""));
    if (!clave) continue;
    const cs = (a.leads_foco?.contactos ?? []) as ContactoConEvidencia[];
    const c = Array.isArray(cs) ? cs.find((x) => x?.clave === clave) : undefined;
    if (!c) continue;
    const h = (hist[c.tipo] ??= { llamadas: 0, llegoAlDecisor: 0 });
    h.llamadas++;
    if (LLEGO.has(a.resultado)) h.llegoAlDecisor++;
  }
  return ajustarPorHistorial(hist);
}
