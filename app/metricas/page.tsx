import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import {
  N_MINIMO_CONFIABLE,
  calibracionScore,
  capacidadInversa,
  embudoPropio,
} from "@/lib/metricas";
import { estadoCadencia } from "@/lib/cadencia";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export default async function MetricasPage({
  searchParams,
}: {
  searchParams?: { meta?: string };
}) {
  const meta = Math.min(Math.max(Number(searchParams?.meta) || 5, 1), 50);

  const [cal, embudo, cap, cad] = await Promise.all([
    calibracionScore(),
    embudoPropio(),
    capacidadInversa(meta),
    estadoCadencia(10),
  ]);

  const maxTasa = Math.max(...cal.tramos.map((t) => t.tasa), 0.01);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Métricas propias"
        sub="Sin benchmarks prestados"
        right={
          <span className="chip">
            n mínimo confiable · {N_MINIMO_CONFIABLE}
          </span>
        }
      />

      <p className="mb-4 max-w-3xl text-[12.5px] leading-relaxed text-ink-mut">
        Ningún número de esta pantalla se compara contra la industria a propósito. El
        reply rate &quot;de referencia&quot; va de 0,45% a 8,3% según quién lo publique y
        con qué incentivo. La única vara que sirve es la serie propia — por eso cada
        porcentaje viene con su <b className="text-ink-soft">n</b>.
      </p>

      {/* ---------------------------------------------- CALIBRACIÓN DEL SCORE */}
      <section className="panel-hot brackets mb-3 p-5">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <p className="lbl">¿El score sirve de algo?</p>
          <span className="font-mono text-[10.5px] text-ink-dim">
            {cal.total} prospectos trabajados
          </span>
        </div>
        <p className="mb-4 max-w-3xl text-[12.5px] leading-relaxed text-ink-mut">
          Si la tasa de avance sube con el score, el scoring es una ventaja real. Si sale
          plana, está priorizando al azar y conviene simplificarlo. Solo cuentan los
          prospectos que efectivamente se trabajaron: incluir los nunca tocados mediría
          nuestra disciplina, no la calidad del score.
        </p>

        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="lbl py-2 text-left font-normal">Tramo</th>
              <th className="lbl py-2 text-right font-normal">Trabajados</th>
              <th className="lbl py-2 text-right font-normal">Avanzaron</th>
              <th className="lbl py-2 text-right font-normal">Tasa</th>
              <th className="lbl w-2/5 py-2 pl-4 text-left font-normal">&nbsp;</th>
            </tr>
          </thead>
          <tbody>
            {cal.tramos.map((t) => (
              <tr key={t.desde} className="data-row">
                <td className="num py-2 text-[12.5px] text-ink-soft">
                  {t.desde}–{t.hasta}
                </td>
                <td className="num py-2 text-right text-ink-soft">
                  {t.n}
                  {t.n > 0 && t.n < N_MINIMO_CONFIABLE && (
                    <span className="ml-1.5 text-[10px] uppercase text-warn">n bajo</span>
                  )}
                </td>
                <td className="num py-2 text-right text-ink-soft">{t.avanzaron}</td>
                <td className="num py-2 text-right font-semibold text-ink">
                  {t.n ? pct(t.tasa) : "—"}
                </td>
                <td className="py-2 pl-4">
                  <span className="meter">
                    <span
                      className="meter-fill"
                      style={{
                        width: `${(t.tasa / maxTasa) * 100}%`,
                        opacity: t.n >= N_MINIMO_CONFIABLE ? 1 : 0.35,
                      }}
                    />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 rounded-lg border border-line bg-surface-3/60 p-3.5">
          {!cal.suficiente ? (
            <p className="text-[12.5px] leading-relaxed text-ink-mut">
              <b className="text-warn">Todavía no se puede concluir.</b> Hay{" "}
              <b className="num text-ink">{cal.exitos}</b>{" "}
              {cal.exitos === 1 ? "prospecto que avanzó" : "prospectos que avanzaron"} en
              total{cal.faltanExitos > 0 && <> y hacen falta {cal.faltanExitos} más</>}.
              Con tan pocos casos de éxito, mover uno solo da vuelta el veredicto: la
              diferencia entre tramos sería ruido, no señal. El n grande engaña — lo que
              manda acá es el numerador.
            </p>
          ) : (cal.separacion ?? 0) < 0.05 ? (
            <p className="text-[12.5px] leading-relaxed text-ink-mut">
              <b className="text-warn">El score no está separando.</b> Entre el mejor y el
              peor tramo hay {pct(cal.separacion ?? 0)} de diferencia. Con esa curva,
              ordenar por score rinde casi lo mismo que ordenar al azar — conviene
              simplificar el scoring en vez de refinarlo.
            </p>
          ) : (
            <p className="text-[12.5px] leading-relaxed text-ink-mut">
              <b className="text-ok">El score separa.</b> Hay{" "}
              {pct(cal.separacion ?? 0)} de diferencia entre el mejor y el peor tramo:
              priorizar por score vale la pena y conviene atacar de arriba hacia abajo.
            </p>
          )}
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* ------------------------------------------------------- EMBUDO */}
        <section className="panel p-5">
          <p className="lbl mb-3">Embudo con tasas propias</p>
          <div className="space-y-2.5">
            {embudo.map((p, i) => (
              <div key={p.paso} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-[12.5px] text-ink-soft">{p.paso}</span>
                <span className="num w-12 shrink-0 text-right font-semibold text-ink">
                  {p.sinDato ? <span className="text-ink-faint">—</span> : p.n}
                </span>
                <span className="meter flex-1">
                  <span
                    className="meter-fill"
                    style={{
                      width: p.sinDato
                        ? "0%"
                        : `${embudo[0].n ? (p.n / embudo[0].n) * 100 : 0}%`,
                    }}
                  />
                </span>
                <span className="num w-20 shrink-0 text-right text-[11.5px]">
                  {p.sinDato ? (
                    <span className="text-[10px] uppercase text-ink-faint">sin registro</span>
                  ) : p.tasa === null ? (
                    <span className="text-ink-faint">—</span>
                  ) : (
                    <span className={p.confiable ? "text-ink-soft" : "text-ink-faint"}>
                      {pct(p.tasa)}
                      {!p.confiable && i > 0 && (
                        <span className="ml-1 text-[9px] uppercase text-warn">n bajo</span>
                      )}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-ink-dim">
            El porcentaje es la conversión desde el paso anterior. &quot;n bajo&quot;
            significa que el paso de origen tiene menos de {N_MINIMO_CONFIABLE} casos: el
            número existe pero todavía no dice nada. &quot;Sin registro&quot; es distinto
            de cero — es un paso que la bitácora todavía no alcanzó a medir, y por eso no
            se le calcula conversión al siguiente.
          </p>
        </section>

        {/* -------------------------------------------- CAPACIDAD INVERSA */}
        <section className="panel p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="lbl">Qué hace falta para {meta} clientes</p>
            <span className="flex gap-1">
              {[3, 5, 10].map((n) => (
                <Link
                  key={n}
                  href={`/metricas?meta=${n}`}
                  className={`btn-ghost px-2 py-0.5 ${
                    n === meta ? "border-brand/50 text-brand" : ""
                  }`}
                >
                  {n}
                </Link>
              ))}
            </span>
          </div>

          <div className="space-y-1.5">
            {cap.pasos.map((p) => (
              <div
                key={p.paso}
                className="flex items-center justify-between rounded-lg border border-line bg-surface-3/50 px-3 py-2"
              >
                <span className="text-[12.5px] text-ink-soft">{p.paso}</span>
                <span className="flex items-baseline gap-2">
                  <span className="num text-[15px] font-semibold text-ink">
                    {p.necesarios.toLocaleString("es-CL")}
                  </span>
                  {!p.propia && (
                    <span
                      className="chip border-warn/40 text-warn"
                      title="No hay casos propios suficientes: se usó un supuesto conservador"
                    >
                      estimado
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-ink-dim">
            Se lee de abajo hacia arriba. Reemplaza el forecasting probabilístico de las
            plataformas grandes: con este volumen de deals, la varianza de la muestra se
            come cualquier modelo.
            {cap.algunaEstimada && (
              <>
                {" "}
                <b className="text-warn">Los pasos marcados como estimados</b> usan
                supuestos conservadores porque todavía no hay tasas propias con casos
                suficientes.
              </>
            )}
          </p>
        </section>
      </div>

      {/* -------------------------------------------------------- CADENCIA */}
      <section className="panel mt-3 p-5">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <p className="lbl">Cadencia · lo que se está cayendo</p>
          <span className="font-mono text-[10.5px] text-ink-dim">
            {cad.agotados} agotaron los {7} toques sin respuesta
          </span>
        </div>
        <p className="mb-4 max-w-3xl text-[12.5px] leading-relaxed text-ink-mut">
          Espaciado de 3 a 5 días hábiles, hasta 7 toques. Es lo único del manual
          norteamericano con evidencia sólida: sin seguimiento la respuesta es 4,1%, con 3
          a 5 seguimientos sube a 8,3% sobre más de 20 millones de envíos medidos.
        </p>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <p className="mb-2 flex items-center gap-2 text-[12.5px] font-semibold text-ink">
              <span className="led led-glow-amber bg-warn" />
              Toque vencido ({cad.vencidos.length})
            </p>
            {cad.vencidos.length === 0 ? (
              <p className="subpanel p-3 text-[12px] text-ink-dim">
                Nada vencido. La cadencia está al día.
              </p>
            ) : (
              <ul className="space-y-1">
                {cad.vencidos.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-2 rounded-lg border border-line bg-surface-3/50 px-2.5 py-1.5"
                  >
                    <span className="num w-8 shrink-0 text-[12px] text-ink-soft">
                      {p.score}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">
                      {p.nombre}
                    </span>
                    <span className="num shrink-0 text-[11px] text-warn">
                      +{p.diasVencido}d
                    </span>
                    <span className="num shrink-0 text-[10.5px] text-ink-dim">
                      {p.toques}/7
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="mb-2 flex items-center gap-2 text-[12.5px] font-semibold text-ink">
              <span className="led led-glow-red bg-danger" />
              Nunca tocados ({cad.huerfanos.length})
            </p>
            {cad.huerfanos.length === 0 ? (
              <p className="subpanel p-3 text-[12px] text-ink-dim">
                Ninguno quedó sin trabajar. Cobertura al día.
              </p>
            ) : (
              <ul className="space-y-1">
                {cad.huerfanos.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-2 rounded-lg border border-line bg-surface-3/50 px-2.5 py-1.5"
                  >
                    <span className="num w-8 shrink-0 text-[12px] text-ink-soft">
                      {p.score}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">
                      {p.nombre}
                    </span>
                    <span className="num shrink-0 text-[11px] text-danger">
                      {p.diasVencido}d
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/llamadas" className="btn-primary">
            Ir a llamar
          </Link>
          <Link href="/prospeccion" className="btn-ghost px-3 py-2">
            Ver toda la base
          </Link>
        </div>
      </section>
    </div>
  );
}
