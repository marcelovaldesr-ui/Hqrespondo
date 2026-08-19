import PageHeader from "@/components/PageHeader";
import GrowthNav from "@/components/growth/GrowthNav";
import { BATTLECARDS } from "@/lib/growth/battlecards";

export const dynamic = "force-dynamic";

const TIPO_LABEL: Record<string, string> = {
  plataforma: "Plataforma",
  agencia: "Agencia",
  chatbot: "Chatbot",
  casero: "Casero",
};

export default function BattlecardsPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Battlecards de competencia" sub="Argumentos y ángulos de contenido" />
      <GrowthNav />
      <p className="mb-4 text-[13px] text-ink-mut">
        Regla de oro: <strong className="text-ink">nunca nombrar competidores en contenido público</strong>;
        traducir a positivo. Los precios de terceros son referenciales (jul-2026) y deben
        verificarse en su web antes de citarlos en una propuesta.
      </p>

      <div className="grid gap-3 lg:grid-cols-2">
        {BATTLECARDS.map((b) => (
          <section key={b.slug} className="panel p-5">
            <div className="mb-2 flex items-center gap-2">
              <h2 className="flex-1 text-[15px] font-semibold text-ink">{b.nombre}</h2>
              <span className="chip px-2 py-0 text-[10px]">{TIPO_LABEL[b.tipo]}</span>
              {b.requiere_investigacion && (
                <span className="chip border-warn/30 bg-warn/10 px-2 py-0 text-[10px] text-warn">requiere investigación</span>
              )}
            </div>

            <dl className="flex flex-col gap-2 text-[12.5px]">
              <div>
                <dt className="lbl text-[10px]">Qué ofrecen</dt>
                <dd className="text-ink-mut">{b.que_ofrecen}</dd>
              </div>
              <div>
                <dt className="lbl text-[10px]">Dónde nos diferenciamos</dt>
                <dd className="text-ink">{b.donde_diferenciarnos}</dd>
              </div>
              <div>
                <dt className="lbl text-[10px]">Objeción típica → respuesta</dt>
                <dd className="text-ink-mut"><em>{b.objecion_tipica}</em> — {b.respuesta_comercial}</dd>
              </div>
              <div>
                <dt className="lbl text-[10px]">Ángulos de contenido</dt>
                <dd>
                  <ul className="flex flex-col gap-0.5 text-ink-mut">
                    {b.angulos_contenido.map((a, i) => (
                      <li key={i} className="flex gap-1.5"><span className="text-ink-faint">·</span>{a}</li>
                    ))}
                  </ul>
                </dd>
              </div>
              <div className="grid grid-cols-2 gap-2 border-t border-line pt-2">
                <div>
                  <dt className="lbl text-[10px]">No copiar</dt>
                  <dd className="text-ink-dim">{b.no_copiar}</dd>
                </div>
                <div>
                  <dt className="lbl text-[10px]">Riesgo de comparar</dt>
                  <dd className="text-ink-dim">{b.riesgo}</dd>
                </div>
              </div>
              <div>
                <dt className="lbl text-[10px]">Contenido recomendado</dt>
                <dd className="text-ink-mut">{b.contenido_recomendado}</dd>
              </div>
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}
