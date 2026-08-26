import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { evaluarEncaje, ENCAJE_RANK, type NivelEncaje } from "@/lib/encaje";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/foco/reclasificar?modo=seco|real
 *
 * Vuelve a pasar todos los leads de Foco por `evaluarEncaje` y compara el
 * resultado nuevo con el que está guardado.
 *
 * POR QUÉ EN SECO PRIMERO
 * Cambiar la regla de encaje cambia el ORDEN DE LA COLA de mañana. Aplicarlo
 * a ciegas es cambiar a quién se llama primero sin haber visto a quién se
 * deja de llamar. En seco no escribe nada: solo dice qué pasaría.
 *
 * Lo que hay que mirar en la respuesta no es cuántos suben, sino
 * `reparto_nuevo`. El riesgo real de abrir el ICP no es equivocarse en un
 * lead: es que TODOS queden en el mismo nivel. Una lista donde el 90% dice
 * "medio" no ordena nada — y entonces el encaje deja de servir para decidir a
 * quién llamar, que es lo único para lo que existe.
 *
 * NUNCA pisa una corrección a mano: `encaje_manual = true` significa que
 * alguien miró ese lead y decidió. Esa decisión vale más que la regla.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const real = url.searchParams.get("modo") === "real";

  try {
    const s = db();
    // PostgREST nunca devuelve más de 1.000 filas; se pide el tope y se avisa
    // si se llegó a él, en vez de reclasificar la mitad en silencio.
    const { data, error } = await s
      .from("leads_foco")
      .select("id,empresa,razon_social,industria,senal,n_empleados,encaje,encaje_motivo,encaje_manual")
      .limit(1000);
    if (error) throw new Error(error.message);
    const filas = data ?? [];

    const reparto = (clave: "antes" | "despues", xs: { antes: NivelEncaje; despues: NivelEncaje }[]) =>
      xs.reduce<Record<string, number>>((acc, x) => {
        acc[x[clave]] = (acc[x[clave]] ?? 0) + 1;
        return acc;
      }, {});

    const evaluados = filas.map((f: any) => {
      const nuevo = evaluarEncaje({
        empresa: f.empresa,
        razon_social: f.razon_social,
        industria: f.industria,
        senal: f.senal,
        nEmpleados: f.n_empleados,
      });
      return {
        id: f.id as string,
        empresa: (f.empresa ?? "") as string,
        rubro: (f.industria ?? "") as string,
        antes: (f.encaje ?? "sin_evaluar") as NivelEncaje,
        despues: nuevo.nivel,
        motivo: nuevo.motivo,
        manual: Boolean(f.encaje_manual),
      };
    });

    const tocables = evaluados.filter((x) => !x.manual);
    const cambian = tocables.filter((x) => x.antes !== x.despues);
    const suben = cambian.filter((x) => ENCAJE_RANK[x.despues] > ENCAJE_RANK[x.antes]);
    const bajan = cambian.filter((x) => ENCAJE_RANK[x.despues] < ENCAJE_RANK[x.antes]);

    let escritos = 0;
    if (real) {
      for (const c of cambian) {
        const { error: e } = await s
          .from("leads_foco")
          .update({ encaje: c.despues, encaje_motivo: c.motivo })
          .eq("id", c.id)
          .eq("encaje_manual", false); // la guarda va también en la consulta
        if (!e) escritos++;
      }
    }

    return NextResponse.json({
      ok: true,
      modo: real ? "real" : "seco",
      leads: filas.length,
      tope_alcanzado: filas.length >= 1000,
      protegidos_a_mano: evaluados.length - tocables.length,
      cambian: cambian.length,
      suben: suben.length,
      bajan: bajan.length,
      escritos,
      reparto_antes: reparto("antes", tocables),
      reparto_nuevo: reparto("despues", tocables),
      // El detalle va recortado: sirve para revisar a ojo, no para exportar.
      detalle: cambian.slice(0, 60).map((c) => ({
        empresa: c.empresa,
        rubro: c.rubro || "— sin rubro —",
        de: c.antes,
        a: c.despues,
        porque: c.motivo.slice(0, 150),
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
