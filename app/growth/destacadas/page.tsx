import PageHeader from "@/components/PageHeader";
import GrowthNav from "@/components/growth/GrowthNav";
import { DESTACADAS } from "@/lib/growth/highlights";
import { CONTENT_STATUS_LABEL } from "@/lib/growth/types";

export const dynamic = "force-dynamic";

const ESTADO_COLOR: Record<string, string> = {
  listo: "border-ok/30 bg-ok/10 text-ok",
  idea: "border-line2 bg-surface-3 text-ink-mut",
};

const PRIO_COLOR: Record<string, string> = {
  alta: "text-ok",
  media: "text-warn",
  baja: "text-ink-dim",
};

export default function DestacadasPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Destacadas de Instagram" sub="Orden del perfil + guiones por historia" />
      <GrowthNav />
      <p className="mb-4 text-[13px] text-ink-mut">
        Orden en el perfil: Respon-Do → Demo → Industrias → Planes → Dudas → Pilotos → Equipo → Clientes.
        Sin testimonios inventados: <strong className="text-ink">&quot;Clientes&quot; se llena con el primer piloto</strong>.
      </p>

      <div className="grid gap-3 lg:grid-cols-2">
        {DESTACADAS.map((d) => (
          <section key={d.slug} className="panel p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="flex-1 text-[15px] font-semibold text-ink">{d.nombre}</h2>
              <span className={`chip px-2 py-0 text-[10px] ${ESTADO_COLOR[d.estado] ?? ""}`}>
                {CONTENT_STATUS_LABEL[d.estado]}
              </span>
              <span className={`font-mono text-[10px] ${PRIO_COLOR[d.prioridad]}`}>prioridad {d.prioridad}</span>
            </div>
            <p className="mb-3 text-[12.5px] text-ink-mut">{d.objetivo}</p>
            <div className="flex flex-col gap-1.5">
              {d.historias.map((h, i) => (
                <div key={i} className="flex items-start gap-2.5 rounded-lg border border-line bg-surface-3/50 px-3 py-2">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand/10 font-mono text-[10px] text-brand">
                    {i + 1}
                  </span>
                  <div className="text-[12.5px]">
                    <p className="text-ink">{h.texto}</p>
                    <p className="mt-0.5 text-[10.5px] text-ink-dim">🎨 {h.visual}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 border-t border-line pt-2 text-[12px] text-ink-mut">
              <strong className="text-ink">CTA:</strong> {d.cta}
            </p>
          </section>
        ))}
      </div>
    </div>
  );
}
