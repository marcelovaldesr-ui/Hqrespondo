import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import GrowthNav from "@/components/growth/GrowthNav";
import { getIdeas, getCalendar } from "@/lib/growth/store";
import { PILARES } from "@/lib/growth/pillars";
import { RUBROS_PRIORITARIOS } from "@/lib/growth/industries";
import {
  CONTENT_STATUS_LABEL,
  PILAR_LABEL,
  FORMATO_LABEL,
  type ContentStatus,
} from "@/lib/growth/types";

export const dynamic = "force-dynamic";

function fechaCorta(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("es-CL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default async function GrowthDashboard() {
  const [{ ideas, dbActiva }, { items }] = await Promise.all([getIdeas(), getCalendar()]);

  const hoy = new Date();
  const hoyISO = hoy.toISOString().slice(0, 10);
  const en7 = new Date(hoy.getTime() + 7 * 86400000).toISOString().slice(0, 10);
  const inicioMes = hoyISO.slice(0, 7);

  const semana = items
    .filter((i) => i.fecha >= hoyISO && i.fecha <= en7)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  const proximas = items
    .filter((i) => i.fecha >= hoyISO)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .slice(0, 6);

  const porEstado = (e: ContentStatus) => ideas.filter((i) => i.estado === e).length;
  const pendientes = porEstado("idea");
  const borradores = porEstado("borrador");
  const listos = porEstado("listo");
  const publicadosMes = items.filter(
    (i) => i.estado === "publicado" && i.fecha.startsWith(inicioMes),
  ).length;

  const objeciones = ideas.filter((i) => i.pilar === "objeciones");
  const rubroIdeas = ideas.filter((i) => i.rubro);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Growth Studio"
        sub="Convierte tu estrategia en contenido que vende"
        right={
          <span className="flex items-center gap-2 rounded-full border border-brand/25 bg-brand/[0.07] px-3 py-1.5 font-mono text-[11px] text-brand">
            <span className="led bg-brand" />
            Motor de contenido
          </span>
        }
      />

      <GrowthNav />

      {/* Estado del motor */}
      <section
        className="panel relative overflow-hidden p-5"
        style={{
          backgroundImage:
            "linear-gradient(120deg, rgba(37,99,235,0.06), rgba(123,91,240,0.06) 55%, rgba(236,106,86,0.05))",
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="lbl">¿Qué creamos esta semana?</div>
            <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-ink-soft">
              No estás publicando por publicar: estás convirtiendo estrategia en
              demanda comercial. Empieza por lo que apoya la prospección de esta
              semana.
            </p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-ok/30 bg-ok/[0.07] px-3 py-1 text-[11px] text-ok">
              <span className="led bg-ok" />
              Prueba 30 días: si no ayuda, no paga la mensualidad
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/growth/generador" className="btn-primary text-xs">
              Generar carrusel / guion
            </Link>
            <Link href="/growth/ideas" className="btn-ghost">
              Ver ideas
            </Link>
          </div>
        </div>
      </section>

      {/* Métricas de producción */}
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { n: pendientes, l: "Ideas pendientes", href: "/growth/ideas", c: "" },
          { n: borradores, l: "En borrador", href: "/growth/ideas", c: "text-warn" },
          { n: listos, l: "Listas para publicar", href: "/growth/ideas", c: "text-ok" },
          { n: publicadosMes, l: "Publicadas este mes", href: "/growth/calendario", c: "text-brand" },
        ].map((m) => (
          <Link key={m.l} href={m.href} className="metric-card">
            <div className={`font-mono text-3xl font-medium leading-none ${m.c}`}>{m.n}</div>
            <div className="lbl mt-3">{m.l}</div>
          </Link>
        ))}
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.15fr_1fr]">
        {/* Calendario de la semana */}
        <section className="panel p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="lbl">Calendario de la semana</span>
            <Link href="/growth/calendario" className="text-[11px] text-brand hover:underline">
              ver todo →
            </Link>
          </div>
          {semana.length === 0 ? (
            <p className="text-sm text-ink-dim">
              Sin piezas agendadas en los próximos 7 días.{" "}
              <Link href="/growth/generador" className="text-brand underline">
                Planifica la semana
              </Link>{" "}
              o toma una idea del backlog.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {semana.map((i) => (
                <div key={i.id} className="flex items-center gap-3 rounded-lg border border-line bg-surface-3/60 px-3 py-2 text-[13px]">
                  <span className="w-24 shrink-0 font-mono text-[11px] text-ink-dim">
                    {fechaCorta(i.fecha)}
                  </span>
                  <span className="chip px-2 py-0 text-[10px]">{FORMATO_LABEL[i.formato]}</span>
                  <span className="flex-1 truncate text-ink-soft">{i.titulo}</span>
                  <span className="hidden text-[10px] text-ink-dim sm:inline">
                    {PILAR_LABEL[i.pilar]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Próximas recomendadas */}
        <section className="panel p-5">
          <div className="lbl mb-3">Próximas piezas recomendadas</div>
          <div className="flex flex-col gap-1.5">
            {proximas.map((i) => (
              <div key={i.id} className="flex items-center gap-2 text-[13px]">
                <span className="led bg-brand" />
                <span className="flex-1 truncate text-ink-soft">{i.titulo}</span>
                <span className="font-mono text-[10px] text-ink-dim">{fechaCorta(i.fecha)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Mezcla por pilar + apoyo a ventas */}
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <section className="panel p-5 lg:col-span-2">
          <div className="lbl mb-3">Contenido por rubro prioritario</div>
          <div className="grid gap-2 sm:grid-cols-3">
            {RUBROS_PRIORITARIOS.map((r) => {
              const cuenta = rubroIdeas.filter((i) => i.rubro === r.slug).length;
              return (
                <Link
                  key={r.slug}
                  href={`/growth/rubros#${r.slug}`}
                  className="subpanel px-3 py-2.5 transition hover:border-brand/30"
                >
                  <div className="flex items-center gap-2">
                    <span>{r.emoji}</span>
                    <span className="flex-1 truncate text-[13px] font-medium text-ink">{r.nombre}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-ink-dim">{cuenta} ideas en el backlog</div>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="panel p-5">
          <div className="lbl mb-3">Apoyo directo a ventas</div>
          <div className="flex flex-col gap-2 text-[13px]">
            <Link href="/growth/ideas?pilar=objeciones" className="flex items-center gap-2 text-ink-soft hover:text-brand">
              <span className="led bg-warn" /> {objeciones.length} piezas por objeción
            </Link>
            <Link href="/growth/battlecards" className="flex items-center gap-2 text-ink-soft hover:text-brand">
              <span className="led bg-accent" /> Battlecards de competencia
            </Link>
            <Link href="/growth/copies?tipo=prospeccion" className="flex items-center gap-2 text-ink-soft hover:text-brand">
              <span className="led bg-coral" /> Copies de prospección por rubro
            </Link>
            <Link href="/growth/destacadas" className="flex items-center gap-2 text-ink-soft hover:text-brand">
              <span className="led bg-brand" /> Plan de destacadas de Instagram
            </Link>
          </div>
        </section>
      </div>

      {/* Mezcla estratégica */}
      <section className="panel mt-3 p-5">
        <div className="lbl mb-3">Mezcla estratégica de pilares (guía semanal)</div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {PILARES.slice(0, 5).map((p) => (
            <Link key={p.key} href={`/growth/ideas?pilar=${p.key}`} className="subpanel px-3 py-2.5">
              <div className="text-[12px] font-medium text-ink">{p.nombre}</div>
              <div className="mt-1 text-[10.5px] leading-tight text-ink-dim">{p.mezcla_recomendada}</div>
            </Link>
          ))}
        </div>
      </section>

      {!dbActiva && (
        <p className="mt-4 rounded-lg border border-dashed border-line2 bg-surface-3/50 px-4 py-3 text-[12px] text-ink-mut">
          Estás viendo el <strong>seed de contenido</strong>. Para crear y guardar
          tus propias ideas y calendario, ejecuta la migración{" "}
          <code className="rounded bg-surface-3 px-1">009_growth_studio.sql</code> en
          Supabase. Todo el módulo funciona igual en modo lectura mientras tanto.
        </p>
      )}
    </div>
  );
}
