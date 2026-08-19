import PageHeader from "@/components/PageHeader";
import GrowthNav from "@/components/growth/GrowthNav";
import { RUBROS } from "@/lib/growth/industries";

export const dynamic = "force-dynamic";

const PRIO_COLOR: Record<string, string> = {
  alta: "border-ok/30 bg-ok/10 text-ok",
  media: "border-warn/30 bg-warn/10 text-warn",
  baja: "border-line2 bg-surface-3 text-ink-mut",
};

function Bloque({ titulo, items }: { titulo: string; items: string[] }) {
  return (
    <div>
      <div className="lbl mb-1.5 text-[10px]">{titulo}</div>
      <ul className="flex flex-col gap-1 text-[12.5px] text-ink-mut">
        {items.map((t, i) => (
          <li key={i} className="flex gap-1.5">
            <span className="text-ink-faint">·</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function RubrosPage() {
  const rubros = [...RUBROS].sort((a, b) => a.orden_ataque - b.orden_ataque);
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Contenido por rubro" sub="Ordenado por prioridad comercial" />
      <GrowthNav />
      <p className="mb-4 text-[13px] text-ink-mut">
        Cada rubro sale del ICP y de la prospección real. Usa la fórmula{" "}
        <em>&quot;[beneficio] sin [dolor]&quot;</em> como hook y conecta el contenido con los
        mensajes de prospección del rubro.
      </p>

      <div className="flex flex-col gap-3">
        {rubros.map((r) => (
          <section key={r.slug} id={r.slug} className="panel scroll-mt-24 p-5">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span className="text-xl">{r.emoji}</span>
              <h2 className="text-[16px] font-semibold text-ink">{r.nombre}</h2>
              <span className={`chip px-2 py-0.5 text-[10px] ${PRIO_COLOR[r.prioridad_comercial]}`}>
                prioridad {r.prioridad_comercial}
              </span>
              <span className="font-mono text-[11px] text-ink-dim">#{r.orden_ataque} en orden de ataque</span>
            </div>

            <div className="mb-4 rounded-lg border border-brand/20 bg-brand/[0.05] px-3 py-2">
              <span className="lbl text-[10px]">Fórmula &quot;sin&quot; (hook)</span>
              <p className="text-[14px] font-medium text-ink">{r.formula_sin}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Bloque titulo="Dolores principales" items={r.dolores} />
              <Bloque titulo="Preguntas del cliente final" items={r.preguntas_cliente} />
              <Bloque titulo="Casos de uso de Respondo" items={r.casos_uso} />
              <Bloque titulo="Objeciones típicas" items={r.objeciones} />
              <Bloque titulo="Ideas de post" items={r.ideas_post} />
              <Bloque titulo="Ideas de carrusel" items={r.ideas_carrusel} />
              <Bloque titulo="Ideas de reel" items={r.ideas_reel} />
              <div>
                <div className="lbl mb-1.5 text-[10px]">Mensaje de prospección</div>
                <p className="rounded-lg border border-line bg-surface-3/60 px-3 py-2 text-[12.5px] italic text-ink-mut">
                  {r.mensaje_prospeccion}
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3 text-[12px]">
              <span className="text-ink-mut"><strong className="text-ink">CTA:</strong> {r.cta}</span>
              {r.pagina_seo && (
                <span className="font-mono text-[11px] text-ink-dim">página SEO: {r.pagina_seo}</span>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
