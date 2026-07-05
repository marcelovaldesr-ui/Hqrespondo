import { db } from "@/lib/db";
import type { Brief } from "@/lib/types";
import { fechaCorta, hora, timeAgo } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import BriefActions from "@/components/BriefActions";

export const dynamic = "force-dynamic";

interface BriefRow extends Brief {
  tipo: string;
  client_id: string | null;
}

export default async function BriefPage() {
  const s = db();
  const [diariosRes, mensualesRes, clientesRes] = await Promise.all([
    s
      .from("briefs")
      .select("*")
      .eq("tipo", "diario")
      .order("created_at", { ascending: false })
      .limit(14),
    s
      .from("briefs")
      .select("*")
      .eq("tipo", "mensual_cliente")
      .order("created_at", { ascending: false })
      .limit(6),
    s.from("clients").select("id,nombre").eq("activo", true).order("nombre"),
  ]);

  const briefs = (diariosRes.data ?? []) as BriefRow[];
  const mensuales = (mensualesRes.data ?? []) as BriefRow[];
  const clientes = (clientesRes.data ?? []) as { id: string; nombre: string }[];
  const nombreCliente = new Map(clientes.map((c) => [c.id, c.nombre]));
  const [ultimo, ...anteriores] = briefs;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="brief del día"
        sub="operaciones"
        right={<BriefActions clients={clientes} />}
      />

      {!ultimo ? (
        <div className="panel rounded-xl border-dashed border-line2 p-10 text-center text-sm text-ink-dim">
          Aún no hay briefs. Genera el primero con el botón, o configura el
          workflow n8n para recibirlo cada mañana a las 8:00 por WhatsApp.
        </div>
      ) : (
        <article className="panel-hot scanline mx-auto max-w-3xl p-6">
          <div className="relative flex items-center justify-between border-b border-line pb-4">
            <div>
              <div className="lbl">brief operativo</div>
              <div className="mt-2 font-mono text-xl font-semibold">
                {fechaCorta(ultimo.created_at)} · {hora(ultimo.created_at)}
              </div>
            </div>
            <span className="rounded-full border border-brand/30 bg-brand/10 px-3 py-1.5 font-mono text-[11px] text-brand">
              {timeAgo(ultimo.created_at)}
            </span>
          </div>
          <pre className="relative mt-5 whitespace-pre-wrap border-l-2 border-brand/70 bg-surface-3/45 px-5 py-4 font-sans text-[15px] leading-8 text-ink-soft shadow-glow">
            {ultimo.contenido}
          </pre>
        </article>
      )}

      {anteriores.length > 0 && (
        <section className="mt-6">
          <div className="lbl mb-3">anteriores</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {anteriores.map((b) => (
              <details key={b.id} className="panel px-4 py-3">
                <summary className="cursor-pointer font-mono text-xs text-ink-mut transition hover:text-brand">
                  {fechaCorta(b.created_at)} · {hora(b.created_at)}
                </summary>
                <pre className="mt-3 whitespace-pre-wrap border-t border-line pt-3 font-sans text-[12.5px] leading-relaxed text-ink-soft">
                  {b.contenido}
                </pre>
              </details>
            ))}
          </div>
        </section>
      )}

      {mensuales.length > 0 && (
        <section className="mt-8">
          <div className="mb-3 flex items-center gap-3">
            <span className="lbl">reportes mensuales de cliente</span>
            <span className="chip text-[10px]">uso interno — no se envían aún</span>
          </div>
          <div className="grid gap-2">
            {mensuales.map((b) => (
              <details key={b.id} className="panel border-accent/20 px-4 py-3">
                <summary className="cursor-pointer font-mono text-xs text-ink-mut transition hover:text-accent">
                  <span className="text-accent">
                    {b.client_id
                      ? nombreCliente.get(b.client_id) ?? "cliente eliminado"
                      : "sin cliente"}
                  </span>{" "}
                  · {fechaCorta(b.created_at)} · {hora(b.created_at)}
                </summary>
                <pre className="mt-3 whitespace-pre-wrap border-t border-line pt-3 font-sans text-[12.5px] leading-relaxed text-ink-soft">
                  {b.contenido}
                </pre>
              </details>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
