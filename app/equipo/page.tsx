import PageHeader from "@/components/PageHeader";
import EquipoSemanal from "@/components/EquipoSemanal";
import {
  lunesDe,
  objetivosDeSemana,
  rangoSemana,
  tendencia,
  type ObjetivoSemana,
} from "@/lib/equipo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** SQL de la migración 019, para mostrarlo si la tabla todavía no existe. */
const SQL_PENDIENTE = `create table if not exists objetivos_semana (
  id uuid primary key default gen_random_uuid(),
  semana date not null,
  socio text not null,
  rol text not null default '',
  objetivo text not null,
  como_se_mide text not null default '',
  estado text not null default 'pendiente'
    check (estado in ('pendiente','cumplido','parcial','no_cumplido')),
  motivo text not null default '',
  hablado_reunion boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists objetivos_semana_semana_idx
  on objetivos_semana (semana desc, socio);
create unique index if not exists objetivos_semana_unico_idx
  on objetivos_semana (semana, socio, lower(objetivo));`;

export default async function EquipoPage({
  searchParams,
}: {
  searchParams?: { semana?: string };
}) {
  const semana = /^\d{4}-\d{2}-\d{2}$/.test(searchParams?.semana ?? "")
    ? (searchParams!.semana as string)
    : lunesDe();

  let objetivos: ObjetivoSemana[] = [];
  let serie: Awaited<ReturnType<typeof tendencia>> = [];
  let faltaTabla = false;

  try {
    [objetivos, serie] = await Promise.all([
      objetivosDeSemana(semana),
      tendencia(semana),
    ]);
  } catch (e) {
    // La tabla se crea con la migración 019, que hay que aplicar a mano en el
    // editor SQL de Supabase. Sin esto la página reventaría con un 500 opaco.
    const msg = e instanceof Error ? e.message : String(e);
    if (/objetivos_semana/i.test(msg) && /(does not exist|schema cache|relation)/i.test(msg)) {
      faltaTabla = true;
    } else {
      throw e;
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Objetivos del equipo" sub={rangoSemana(semana)} />
      {faltaTabla ? (
        <section className="panel-hot brackets p-6">
          <p className="lbl mb-2">Falta un paso</p>
          <h2 className="ttl mb-2 text-[15px]">
            La tabla <code className="text-brand">objetivos_semana</code> todavía no existe
          </h2>
          <p className="mb-4 max-w-2xl text-[13px] leading-relaxed text-ink-mut">
            Es la migración <b className="text-ink">019</b>. Ábrela en el editor SQL de
            Supabase, pega esto y ejecútalo. Después recarga esta página y la sección
            queda funcionando. Se aplica una sola vez.
          </p>
          <pre className="subpanel max-h-80 overflow-auto p-4 font-mono text-[11.5px] leading-relaxed text-ink-soft">
{SQL_PENDIENTE}
          </pre>
        </section>
      ) : (
        <EquipoSemanal semana={semana} objetivosIniciales={objetivos} serie={serie} />
      )}
    </div>
  );
}
