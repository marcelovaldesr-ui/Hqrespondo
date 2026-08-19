import { listarFoco, resumenFoco, type EstadoFoco, type LeadFoco, type ResumenFoco } from "@/lib/foco";
import { type NivelEncaje } from "@/lib/encaje";
import { headers } from "next/headers";
import { EQUIPO, personaDeLogin } from "@/lib/equipo";
import LeadsFoco from "@/components/LeadsFoco";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * /foco — el SEGUNDO motor de prospección.
 *
 * /llamadas trabaja la lista de Google Maps: micro-pymes, número del local.
 * Acá la unidad es la PERSONA (nombre + cargo + su número) en empresas
 * medianas. Es el perfil con el que salieron las dos reuniones agendadas,
 * y es un juego distinto: menos volumen, más preparación por llamada.
 */
export default async function PaginaFoco({
  searchParams,
}: {
  searchParams?: {
    lista?: string; estado?: string; cargo?: string; q?: string; cola?: string; encaje?: string;
  };
}) {
  const lista = searchParams?.lista || "todas";
  const estado = (searchParams?.estado || "activos") as EstadoFoco | "activos" | "procesados";
  const cargo = searchParams?.cargo || "todos";
  const q = searchParams?.q || "";
  const cola = (["todos", "investigar"].includes(searchParams?.cola ?? "")
    ? searchParams!.cola
    : "hoy") as "hoy" | "todos" | "investigar";
  const encaje = (searchParams?.encaje || "sirven") as NivelEncaje | "sirven" | "todos";

  let filas: LeadFoco[] = [];
  let resumen: ResumenFoco = {
    listas: [], cargos: [], activos: 0, procesados: 0, total: 0,
    conTelefono: 0, conDecisor: 0, llamables: 0, trabajables: 0, porInvestigar: 0,
    porEncaje: {}, vencidos: 0,
  };
  let fallo: string | null = null;

  // Si la tabla todavía no existe, la pantalla NO se cae: dice exactamente qué
  // falta. Una pantalla en blanco con "Application error" no le sirve a nadie.
  try {
    [filas, resumen] = await Promise.all([
      listarFoco({ lista, estado, cargo, q, cola, encaje }),
      resumenFoco(lista),
    ]);
  } catch (e) {
    fallo = e instanceof Error ? e.message : String(e);
  }

  if (fallo) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="panel-hot brackets p-6">
          <div className="lbl">Leads Foco</div>
          <h1 className="ttl mt-1 text-[17px]">Falta crear la tabla</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-mut">
            La pantalla está lista, pero a la base le falta estructura. Aplica en el
            SQL Editor de Supabase, en este orden,{" "}
            <span className="font-mono text-ink">021_leads_foco.sql</span> y{" "}
            <span className="font-mono text-ink">022_encaje_leads_foco.sql</span>{" "}
            (están en <span className="font-mono text-ink">supabase/migrations/</span>) y recarga.
          </p>
          <p className="mt-3 font-mono text-[11px] text-ink-faint">{fallo}</p>
        </div>
      </div>
    );
  }

  return (
    <LeadsFoco
      filasIniciales={filas}
      resumen={resumen}
      filtros={{ lista, estado, cargo, q, cola, encaje }}
      socios={EQUIPO.map((s) => s.nombre)}
      yo={personaDeLogin(headers().get("x-hq-user"))}
    />
  );
}
