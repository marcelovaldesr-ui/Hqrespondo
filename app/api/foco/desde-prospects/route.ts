import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { insertarLeads } from "@/lib/insertarLeads";
import { evaluarEncaje } from "@/lib/encaje";
import { alcanceDe, esCelularChileno, ALCANCE_LABEL } from "@/lib/alcance";
import { normalizarTelefono } from "@/lib/actividades";
import type { SenalesWeb } from "@/lib/enriquecimiento";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * GET /api/foco/desde-prospects?modo=seco|real[&limite=N][&alcanceMin=3][&lista=places]
 *
 * EL PUENTE QUE FALTABA — 4-sep-2026
 *
 * HQ tiene dos listas de llamadas y ninguna sirve sola:
 *
 *   · `prospects` la llena la búsqueda por Places (rubro + comuna). Trae el
 *     número que el negocio PUBLICA para que le escriban los clientes —que en
 *     una pyme chilena es el celular del dueño— y las señales de su web. Le
 *     falta el nombre de la persona.
 *   · `leads_foco` la llenan Apollo y el padrón del SII. Trae el nombre y el
 *     cargo del decisor. Le falta un número que alguien conteste: el del SII
 *     es el fijo del mesón y el de Apollo es de una base que no sabemos si
 *     está al día.
 *
 * El equipo llama desde la segunda. O sea, de las dos mitades que hacen falta
 * para agendar una reunión, el vendedor tiene la que no incluye "que
 * contesten". Eso es lo que estaba pasando.
 *
 * Esto pasa los prospects que SÍ tienen un número alcanzable a la lista desde
 * la que se llama, con su motivo de llamada armado. El nombre del decisor se
 * completa después con `/api/decisores` (que ya sabe buscarlo en la web del
 * negocio); llegar sin nombre a un celular es mucho mejor que llegar con
 * nombre a una recepción.
 *
 * Corre en seco por defecto: dice qué pasaría sin escribir nada.
 */

/**
 * El motivo de la llamada, armado con lo que se observó del negocio.
 *
 * Habla en el encuadre VIGENTE (pilares actualizados el 3-sep-2026): los TRES
 * lugares donde se pierde la venta. No el de "responder rápido", que se retiró
 * a propósito porque Meta lanzó su propio agente en junio y contestar rápido
 * dejó de ser un producto.
 *
 *   1. la consulta que queda en visto
 *   2. la cotización que quedó en "lo pienso" y nadie retoma
 *   3. la agenda en la cabeza del dueño, con no-show y cero visibilidad
 *
 * Cada señal que se observó desde afuera se traduce al lugar que delata. Así
 * el vendedor abre nombrando el hoyo que ESTE negocio tiene, no recitando el
 * pitch — que es la diferencia entre una llamada que sigue y una que se corta.
 */
function motivoDeLlamada(p: {
  razon_score?: string | null;
  senales_web?: SenalesWeb | null;
  rubro?: string | null;
  comuna?: string | null;
  reviews?: number | null;
}): string {
  const s = p.senales_web ?? ({} as SenalesWeb);
  const partes: string[] = [];

  // ── Lugar 1: la consulta queda en visto ──
  if (s.solo_redes)
    partes.push("su única presencia es Instagram/Facebook: todo lo que le preguntan entra por DM y lo contesta una persona a mano");
  else if (s.celular_whatsapp)
    partes.push("publica un celular como teléfono del negocio: las consultas le llegan al WhatsApp personal");
  if (s.boton_wa_flotante)
    partes.push("tiene botón flotante de WhatsApp: empuja toda la consulta al DM");

  // ── Lugar 3: la agenda vive en la cabeza del dueño ──
  if (s.formulario_hora && !s.reservas)
    partes.push("pide la hora por formulario y no tiene sistema de reservas: la agenda la lleva alguien a mano");

  // ── Lugar 2: la cotización sin seguimiento ──
  if (s.ecommerce && !s.crm)
    partes.push(`vende en línea (${s.ecommerce}) pero no se le ve CRM: la cotización que queda en "lo pienso" no la retoma nadie`);

  // ── El caso que ANTES se descartaba y ahora es el mejor argumento ──
  // Un bot que solo contesta tapa el primer hoyo y deja los otros dos. Con el
  // encuadre nuevo eso no descalifica al lead: es la frase de apertura.
  if (s.chatbot)
    partes.push(`ya tiene un bot que contesta (${s.chatbot}) — abre por ahí: contestar rápido tapa el primer hoyo, la cotización y la agenda le siguen quedando a mano`);
  if (s.reservas)
    partes.push(`OJO: ya tiene sistema de reservas (${s.reservas}), así que la agenda la tiene resuelta. El ángulo es la consulta y el seguimiento`);

  if (!partes.length && p.razon_score) partes.push(p.razon_score);
  // Mandar al vendedor con la casilla vacía es peor que no mandarlo: se nota
  // en el primer segundo de la llamada. Si no se observó nada, que lo diga y
  // que diga qué mirar — treinta segundos de Instagram antes de marcar valen
  // más que cualquier guion genérico.
  if (!partes.length) {
    partes.push(
      `No se pudo leer su web${s.visitada === false ? " (no abrió)" : ""}. Antes de marcar, mírale el Instagram 30 segundos: si tiene comentarios preguntando precio sin respuesta, esa es la apertura`,
    );
  }
  const cierre = p.reviews ? ` · ${p.reviews} reseñas en Google` : "";
  return (partes.join(" · ") + cierre).slice(0, 600);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const real = url.searchParams.get("modo") === "real";
  const limite = Math.min(Math.max(Number(url.searchParams.get("limite")) || 200, 1), 500);
  const alcanceMin = Math.min(Math.max(Number(url.searchParams.get("alcanceMin")) || 3, 0), 4);
  const lista = (url.searchParams.get("lista") ?? "places").trim().slice(0, 100) || "places";

  try {
    const s = db();

    // PostgREST corta en 1.000 filas pase lo que pase; se pide el tope y se
    // avisa si se llegó a él en vez de promover la mitad en silencio.
    const { data: pros, error: eP } = await s
      .from("prospects")
      .select("id,nombre,rubro,comuna,telefono,web,direccion,rating,reviews,score,razon_score,senales_web,contacto_nombre,contacto_celular,estado,intentos_llamada")
      .not("telefono", "is", null)
      .order("score", { ascending: false })
      .limit(1000);
    if (eP) throw new Error(`prospects: ${eP.message}`);
    const todos = (pros ?? []) as any[];

    // Lo que ya está en Leads Foco, para no duplicar. Se compara por número
    // normalizado Y por nombre de empresa: el mismo negocio puede haber
    // entrado por Apollo con otro teléfono.
    const { data: yaFoco, error: eF } = await s
      .from("leads_foco")
      .select("empresa,telefono,lista")
      .limit(1000);
    if (eF) throw new Error(`leads_foco: ${eF.message}`);
    const telsFoco = new Set<string>();
    const nombresFoco = new Set<string>();
    for (const l of (yaFoco ?? []) as any[]) {
      const n = normalizarTelefono(l.telefono ?? "");
      if (n) telsFoco.add(n);
      if (l.empresa) nombresFoco.add(String(l.empresa).trim().toLowerCase());
    }

    // Nadie que haya pedido no ser contactado vuelve a entrar por esta puerta.
    const { data: sup } = await s.from("supresiones").select("valor").eq("tipo", "telefono").limit(1000);
    const suprimidos = new Set((sup ?? []).map((x: any) => String(x.valor)));

    const descartes: Record<string, number> = {};
    const tira = (k: string) => { descartes[k] = (descartes[k] ?? 0) + 1; };

    const candidatos = todos.filter((p) => {
      const alc = alcanceDe({ telefono: p.telefono, contacto: p.contacto_nombre });
      if (alc < alcanceMin) { tira(`alcance bajo (${alc} · ${ALCANCE_LABEL[alc]})`); return false; }
      const n = normalizarTelefono(p.telefono ?? "");
      if (!n) { tira("teléfono no normalizable"); return false; }
      if (suprimidos.has(n)) { tira("en lista de no contactar"); return false; }
      if (telsFoco.has(n)) { tira("ese número ya está en Leads Foco"); return false; }
      if (nombresFoco.has(String(p.nombre ?? "").trim().toLowerCase())) { tira("esa empresa ya está en Leads Foco"); return false; }
      return true;
    }).slice(0, limite);

    // Un lead de encaje bajo o nulo no se llama nunca: la lista "los que
    // sirven" lo esconde de entrada. Meterlo igual sería ensuciar Leads Foco
    // con filas que solo estorban al contarlas. Se descarta acá y se dice por
    // qué, en vez de insertarlo y que desaparezca sin explicación.
    const conEncaje = candidatos.map((p) => {
      const senal = motivoDeLlamada(p);
      const encaje = evaluarEncaje({
        empresa: p.nombre, industria: p.rubro, senal,
      } as Parameters<typeof evaluarEncaje>[0]);
      return { p, senal, encaje };
    });
    const utiles = conEncaje.filter((x) => {
      if (x.encaje.nivel === "bajo" || x.encaje.nivel === "nulo") {
        tira(`encaje ${x.encaje.nivel} — no se llamaría igual`);
        return false;
      }
      return true;
    });

    const filas = utiles.map(({ p, senal, encaje }) => {
      const telefono = String(p.telefono ?? "").trim();
      return {
        empresa: String(p.nombre ?? "").slice(0, 300),
        industria: String(p.rubro ?? "").slice(0, 200),
        comuna: String(p.comuna ?? "").slice(0, 120),
        web: String(p.web ?? "").slice(0, 300),
        telefono,
        // El principal viaja también dentro del arreglo: la ficha lee de ahí y
        // no puede haber dos versiones del mismo dato.
        telefonos: telefono ? [{ valor: telefono, tipo: esCelularChileno(telefono) ? "movil" : "otro", fuente: "places" }] : [],
        emails: [],
        contacto: String(p.contacto_nombre ?? "").slice(0, 300),
        cargo: "",
        senal,
        lista,
        estado: "nuevo",
        confianza: "media",
        fuente_url: p.web || "Google Places",
        origen_telefono: "places",
        creado_por: "puente places→foco",
        encaje: encaje.nivel,
        encaje_motivo: encaje.motivo,
      };
    });

    let insertadas = 0;
    const errores: string[] = [];
    if (real && filas.length) {
      // De a 200: un insert de 500 filas con un solo duplicado se cae entero.
      for (let i = 0; i < filas.length; i += 200) {
        const trozo = filas.slice(i, i + 200);
        const { error, columnasIgnoradas } = await insertarLeads(trozo);
        if (columnasIgnoradas.length) errores.push(`sin ${columnasIgnoradas.join(", ")} — falta la migración 036`);
        if (error) errores.push(error.message);
        else insertadas += trozo.length;
      }
    }

    return NextResponse.json({
      ok: true,
      modo: real ? "real" : "seco",
      prospects_revisados: todos.length,
      tope_alcanzado: todos.length >= 1000,
      candidatos: filas.length,
      insertadas,
      errores,
      por_que_se_descarto_el_resto: Object.fromEntries(
        Object.entries(descartes).sort((a, b) => b[1] - a[1]),
      ),
      muestra: filas.slice(0, 15).map((f) => ({
        empresa: f.empresa,
        rubro: f.industria || "—",
        comuna: f.comuna || "—",
        telefono: f.telefono,
        tipo: esCelularChileno(f.telefono) ? "CELULAR" : "fijo",
        persona: f.contacto || "— falta el nombre —",
        encaje: f.encaje,
        con_que_abrir: f.senal.slice(0, 130),
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
