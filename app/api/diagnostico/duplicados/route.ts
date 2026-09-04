import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { digitosCL } from "@/lib/alcance";
import { pareceNombreDePersona } from "@/lib/nombrePersona";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/diagnostico/duplicados
 *
 * ¿Cuántas veces está el MISMO teléfono en dos fichas distintas?
 *
 * POR QUÉ EXISTE — 4-sep-2026
 * En la tanda real de 84 leads apareció "Clínica Hunza" dos veces, con el
 * mismo número (+56 9 5804 9193) y puntajes distintos: una ficha con el
 * nombre de la decisora y 67 de prioridad, la otra sin nombre y con 50.
 * Tomás las habría llamado a las dos, con dos guiones distintos, al mismo
 * teléfono.
 *
 * También apareció "Maestra Inmobiliaria" y "Eduardo Torres" con el mismo
 * número y el mismo sitio: el campo `empresa` de la segunda tiene el nombre
 * de una PERSONA, que es el decisor de la primera.
 *
 * El índice único de la migración 021 es (lista, empresa, contacto) y no
 * puede atrapar esto: los nombres de empresa son distintos, así que las dos
 * filas son legítimas para la base. La unidad que le importa a quien llama no
 * es la fila: es el número. Dos fichas con el mismo teléfono son UNA llamada.
 *
 * POR QUÉ UN DIAGNÓSTICO Y NO UN ÍNDICE ÚNICO
 * Porque a veces es correcto: dos sucursales de verdad comparten mesa
 * central, y un índice único rompería la importación entera por un caso
 * legítimo. Esto los muestra para decidir a mano, que es lo que corresponde
 * cuando fusionar significa perder historial de llamadas.
 *
 * No escribe nada. Es seguro correrlo cuantas veces se quiera.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const lista = url.searchParams.get("lista");

  try {
    let q = db()
      .from("leads_foco")
      .select("id,empresa,contacto,cargo,telefono,telefonos,web,lista,estado,intentos,calidad,prioridad,veredicto")
      .limit(1000);
    if (lista && lista !== "todas") q = q.eq("lista", lista);
    const { data, error } = await q;
    if (error) throw new Error(error.message);

    type Fila = Record<string, any>;
    const filas = (data ?? []) as Fila[];

    // Un lead puede tener varios números (migración 034). Cuenta cualquiera
    // de ellos: si el segundo teléfono de una ficha es el primero de otra,
    // igual es la misma llamada.
    const porNumero = new Map<string, Fila[]>();
    for (const f of filas) {
      const nums = new Set<string>();
      for (const t of [f.telefono, ...(Array.isArray(f.telefonos) ? f.telefonos : [])]) {
        const d = digitosCL(String(t ?? ""));
        if (d.length === 9) nums.add(d);
      }
      for (const d of nums) {
        const g = porNumero.get(d) ?? [];
        g.push(f);
        porNumero.set(d, g);
      }
    }

    const grupos = [...porNumero.entries()]
      .filter(([, g]) => g.length > 1)
      .map(([num, g]) => ({
        telefono: num,
        fichas: g.length,
        // El mismo sitio web en las dos es la señal más fuerte de que es la
        // misma empresa y no dos sucursales.
        mismo_sitio: new Set(g.map((f) => String(f.web ?? "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/+$/, "").toLowerCase()).filter(Boolean)).size === 1
          && g.every((f) => f.web),
        ya_se_llamo: g.reduce((a, f) => a + (Number(f.intentos) || 0), 0),
        // Cuál conviene conservar. El orden importa y salió de un caso real:
        // "Maestra Inmobiliaria" y "Eduardo Torres" comparten número y sitio,
        // y ordenando solo por prioridad ganaba "Eduardo Torres" por UN punto
        // — o sea, la ficha cuyo campo `empresa` tiene el nombre de una
        // persona, que es la peor de las dos. Primero se descarta esa; recién
        // después manda la prioridad.
        sugerida: [...g].sort((a, b) =>
          (Number(pareceNombreDePersona(String(a.empresa ?? ""))) -
           Number(pareceNombreDePersona(String(b.empresa ?? "")))) ||
          (b.prioridad ?? -1) - (a.prioridad ?? -1) ||
          (String(b.contacto ?? "").length - String(a.contacto ?? "").length),
        )[0]?.id,
        fichas_detalle: g.map((f) => ({
          id: f.id, empresa: f.empresa, contacto: f.contacto || "—", cargo: f.cargo || "—",
          lista: f.lista, estado: f.estado, intentos: f.intentos,
          calidad: f.calidad, prioridad: f.prioridad, veredicto: f.veredicto,
        })),
      }))
      .sort((a, b) => b.fichas - a.fichas || Number(b.mismo_sitio) - Number(a.mismo_sitio));

    const llamadasDeMas = grupos.reduce((a, g) => a + g.fichas - 1, 0);

    return NextResponse.json({
      ok: true,
      leads_mirados: filas.length,
      numeros_repetidos: grupos.length,
      llamadas_de_mas: llamadasDeMas,
      que_significa: llamadasDeMas
        ? `hay ${llamadasDeMas} ficha(s) de más: son el mismo teléfono en otra ficha, o sea la misma llamada dos veces`
        : "ningún teléfono aparece en dos fichas",
      grupos: grupos.slice(0, 60),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
