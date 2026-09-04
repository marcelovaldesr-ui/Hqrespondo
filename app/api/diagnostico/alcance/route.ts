import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { alcanceDe, esCelularChileno, ALCANCE_LABEL } from "@/lib/alcance";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/diagnostico/alcance
 *
 * Responde con datos —no con intuición— las tres preguntas que hoy están
 * abiertas sobre por qué no se alcanza a nadie:
 *
 *   1. De las llamadas YA HECHAS, ¿cuántas llegaron al que decide, cuántas
 *      quedaron en el mesón y cuántas no habló con nadie… separado por si el
 *      número marcado era CELULAR o FIJO?
 *      Esto no necesita instrumentación nueva: `actividades` guarda el número
 *      que se marcó y el resultado desde la migración 020. La respuesta está
 *      hace meses en la base y nadie la había mirado.
 *
 *   2. ¿Qué fuente produjo cada número? (Apollo, el SII, Places, a mano.)
 *      Es la pregunta de "¿los números de Apollo están viejos?" — pero
 *      contestada contando, no recordando.
 *
 *   3. ¿Cuántos leads llamables hay en cada lista y de qué tipo es su número?
 *      Incluye `prospects`, que es la tabla que llena la búsqueda por Places
 *      y que hoy NO alimenta a Leads Foco.
 *
 * No escribe nada. Es seguro correrlo cuantas veces se quiera.
 */

/** Las tres cosas que pueden pasar cuando marcas. Sale del vocabulario cerrado de `actividades`. */
const DESENLACE: Record<string, "decisor" | "meson" | "nadie"> = {
  interesado: "decisor",
  no_interesa: "decisor",
  seguimiento: "decisor",
  fuera_icp: "decisor",
  contactado: "decisor",
  gatekeeper: "meson",
  no_contesto: "nadie",
  numero_malo: "nadie",
};

type Cuenta = { decisor: number; meson: number; nadie: number; total: number };
const vacia = (): Cuenta => ({ decisor: 0, meson: 0, nadie: 0, total: 0 });
const sumar = (c: Cuenta, d: "decisor" | "meson" | "nadie") => { c[d]++; c.total++; };
const pct = (n: number, total: number) => (total ? `${Math.round((n / total) * 100)}%` : "—");

function conTasas(c: Cuenta) {
  return {
    llamadas: c.total,
    llego_al_que_decide: c.decisor,
    quedo_en_el_meson: c.meson,
    no_hablo_con_nadie: c.nadie,
    tasa_decisor: pct(c.decisor, c.total),
    tasa_meson: pct(c.meson, c.total),
  };
}

export async function GET(req: Request) {
  const detalle = new URL(req.url).searchParams.get("detalle") === "1";
  try {
    const s = db();

    // ── 1 y 2. Las llamadas ya hechas ──────────────────────────────────────
    // Se pide el tope de PostgREST y se avisa si se alcanzó, en vez de sacar
    // conclusiones de la mitad de los datos sin decirlo.
    // Se pide `origen_telefono` y, si la migración 036 todavía no corrió, se
    // reintenta sin ella: el diagnóstico sirve igual —el origen se deduce de
    // cómo entró el lead— y es lo primero que uno abre, así que no puede ser
    // lo que falle por un paso pendiente.
    const traerLlamadas = (conOrigen: boolean) =>
      s
        .from("actividades")
        .select(
          conOrigen
            ? "resultado,contacto,created_at,leads_foco(empresa,telefono,fuente_url,origen_telefono,telefonos)"
            : "resultado,contacto,created_at,leads_foco(empresa,telefono,fuente_url,telefonos)",
        )
        .eq("canal", "llamada")
        .order("created_at", { ascending: false })
        .limit(1000);

    let { data: acts, error: eA } = await traerLlamadas(true);
    if (eA && /origen_telefono/i.test(eA.message)) {
      ({ data: acts, error: eA } = await traerLlamadas(false));
    }
    if (eA) throw new Error(`actividades: ${eA.message}`);

    const porTipo: Record<"celular" | "fijo" | "sin_numero", Cuenta> = {
      celular: vacia(), fijo: vacia(), sin_numero: vacia(),
    };
    const porFuente: Record<string, Cuenta> = {};

    for (const a of (acts ?? []) as any[]) {
      const d = DESENLACE[a.resultado];
      if (!d) continue; // 'enviado' y otros canales no cuentan como llamada
      const tel = String(a.contacto ?? "").trim();
      const tipo = !tel ? "sin_numero" : esCelularChileno(tel) ? "celular" : "fijo";
      sumar(porTipo[tipo], d);

      // El origen del número: primero la columna nueva, y si está vacía —que
      // es el caso de todo lo anterior a hoy— se deduce de cómo entró el lead.
      const lead = a.leads_foco ?? {};
      const marcado = String(lead.origen_telefono ?? "").trim();
      const desdeArreglo = Array.isArray(lead.telefonos)
        ? (lead.telefonos.find((t: any) => String(t?.valor ?? "").replace(/\D/g, "") === tel.replace(/\D/g, ""))?.fuente ?? "")
        : "";
      const url = String(lead.fuente_url ?? "").toLowerCase();
      const fuente =
        marcado ||
        desdeArreglo ||
        (url.includes("cascada") ? "cascada (SII)"
          : url.includes("alta manual") ? "a mano"
          : url ? "importación (CSV/Apollo)"
          : "sin origen registrado");
      (porFuente[fuente] ??= vacia());
      sumar(porFuente[fuente], d);
    }

    // ── 3. El inventario de las dos listas ─────────────────────────────────
    // Con 17 llamadas los porcentajes no significan nada, pero mirarlas de a
    // una sí. `?detalle=1` las lista: qué número se marcó, de dónde salió y
    // cómo terminó. Es la diferencia entre una tasa y un hecho.
    const listado = !detalle ? [] : (acts ?? []).slice(0, 60).map((a: any) => {
      const tel = String(a.contacto ?? "").trim();
      const lead = a.leads_foco ?? {};
      return {
        cuando: String(a.created_at ?? "").slice(0, 16).replace("T", " "),
        empresa: lead.empresa ?? "—",
        marcado: tel || "— sin número registrado —",
        tipo: !tel ? "—" : esCelularChileno(tel) ? "celular" : "fijo",
        resultado: a.resultado,
        desenlace: DESENLACE[a.resultado] ?? "—",
        origen: String(lead.origen_telefono ?? "").trim() || String(lead.fuente_url ?? "").slice(0, 40) || "sin registrar",
        telefono_actual_del_lead: lead.telefono ?? "—",
        numeros_que_tiene_el_lead: Array.isArray(lead.telefonos)
          ? lead.telefonos.map((t: any) => `${t?.valor} (${t?.tipo}/${t?.fuente})`).join(" | ") || "ninguno"
          : "ninguno",
      };
    });

    const { data: foco, error: eF } = await s
      .from("leads_foco")
      .select("telefono,contacto,estado,encaje")
      .limit(1000);
    if (eF) throw new Error(`leads_foco: ${eF.message}`);

    const repartoFoco: Record<string, number> = {};
    let focoCelular = 0;
    for (const l of (foco ?? []) as any[]) {
      const a = alcanceDe(l);
      repartoFoco[`${a} · ${ALCANCE_LABEL[a]}`] = (repartoFoco[`${a} · ${ALCANCE_LABEL[a]}`] ?? 0) + 1;
      if (a >= 3) focoCelular++;
    }

    const { data: pros, error: eP } = await s
      .from("prospects")
      .select("telefono,contacto_nombre,estado,score,intentos_llamada")
      .limit(1000);
    if (eP) throw new Error(`prospects: ${eP.message}`);

    const P = (pros ?? []) as any[];
    const prosCelular = P.filter((p) => esCelularChileno(p.telefono));
    const prosSinTocar = prosCelular.filter((p) => !p.intentos_llamada || p.intentos_llamada === 0);

    return NextResponse.json({
      ok: true,
      leido: new Date().toISOString(),

      lo_que_ya_paso: {
        nota:
          "Sale de `actividades`, que guarda el número marcado y el resultado desde la migración 020. Es historia real, no una estimación.",
        llamadas_analizadas: Object.values(porTipo).reduce((a, c) => a + c.total, 0),
        tope_alcanzado: (acts ?? []).length >= 1000,
        segun_el_tipo_de_numero: {
          celular: conTasas(porTipo.celular),
          fijo: conTasas(porTipo.fijo),
          sin_numero_registrado: conTasas(porTipo.sin_numero),
        },
        segun_de_donde_salio_el_numero: Object.fromEntries(
          Object.entries(porFuente)
            .sort((a, b) => b[1].total - a[1].total)
            .map(([k, v]) => [k, conTasas(v)]),
        ),
      },

      leads_foco: {
        total: (foco ?? []).length,
        con_celular: focoCelular,
        reparto_por_alcance: Object.fromEntries(
          Object.entries(repartoFoco).sort((a, b) => b[0].localeCompare(a[0])),
        ),
      },

      ...(detalle ? { las_llamadas_una_por_una: listado } : {}),

      prospects: {
        nota:
          "Es la tabla que llena la búsqueda por Places (rubro + comuna). HOY no alimenta a Leads Foco: son dos listas separadas.",
        total: P.length,
        con_celular_publicado: prosCelular.length,
        con_celular_y_sin_llamar: prosSinTocar.length,
        con_nombre_de_decisor: P.filter((p) => (p.contacto_nombre ?? "").trim()).length,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
