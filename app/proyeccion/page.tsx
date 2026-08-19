import { unstable_noStore as noStore } from "next/cache";
import { db } from "@/lib/db";
import PageHeader from "@/components/PageHeader";
import Proyeccion from "@/components/Proyeccion";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * La proyección arranca de la realidad, no de un supuesto: los clientes
 * activos y su recurrente salen de la tabla `clients`, y el costo por
 * conversación del costo real registrado en `bot_events` cuando exista.
 * Mientras no haya datos cargados, la pantalla lo dice en vez de fingir.
 */
export default async function ProyeccionPage() {
  noStore();
  const s = db();

  const [cliRes, evRes] = await Promise.all([
    s.from("clients").select("mensualidad,activo"),
    s.from("bot_events").select("costo_clp,tipo").not("costo_clp", "is", null).limit(5000),
  ]);

  const activos = ((cliRes.data ?? []) as { mensualidad: number; activo: boolean }[]).filter(
    (c) => c.activo,
  );
  const mrrInicial = activos.reduce((a, c) => a + (c.mensualidad || 0), 0);

  // Costo real por conversación: promedio de los eventos que traen costo.
  // Si nadie lo ha registrado todavía, el componente usa su propio supuesto.
  const eventos = (evRes.data ?? []) as { costo_clp: number | null }[];
  const conCosto = eventos.filter((e) => typeof e.costo_clp === "number");
  const costoReal =
    conCosto.length >= 30
      ? conCosto.reduce((a, e) => a + (e.costo_clp as number), 0) / conCosto.length
      : null;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Proyección"
        sub="En qué mes esto le paga a cada socio"
        right={
          <span className="chip">
            {activos.length > 0 ? `${activos.length} clientes reales` : "sin clientes cargados"}
          </span>
        }
      />
      <Proyeccion
        clientesIniciales={activos.length}
        mrrInicial={mrrInicial}
        costoRealPorConversacion={costoReal !== null ? Math.round(costoReal) : null}
      />
    </div>
  );
}
