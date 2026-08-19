import type { Cohorte } from "@/lib/actividades";

/**
 * Cohortes semanales: dónde está HOY cada camada de prospectos que entró.
 *
 * Es lo que un total acumulado no puede responder. Si la conversión se cae a
 * la mitad, el acumulado sigue subiendo y la caída queda tapada meses; acá se
 * ve la fila de esta semana peor que la de la anterior.
 */
export default function Cohortes({ filas }: { filas: Cohorte[] }) {
  if (filas.length === 0) return null;
  const maxEntraron = Math.max(...filas.map((f) => f.entraron), 1);

  const fecha = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "short",
      timeZone: "UTC",
    });
  };

  const COLS: { k: keyof Cohorte; t: string }[] = [
    { k: "tocados", t: "Tocados" },
    { k: "conectados", t: "Conectados" },
    { k: "interesados", t: "Interesados" },
    { k: "en_pipeline", t: "Pipeline" },
  ];

  return (
    <section className="panel p-4">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <p className="lbl">Cohortes · dónde está hoy cada camada</p>
        <p className="text-[11px] text-ink-dim">
          Cada fila es la semana en que ENTRARON, no en la que se trabajaron
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="lbl py-2 text-left font-normal">Semana</th>
              <th className="lbl py-2 text-right font-normal">Entraron</th>
              {COLS.map((c) => (
                <th key={c.k} className="lbl py-2 text-right font-normal">
                  {c.t}
                </th>
              ))}
              <th className="lbl py-2 pl-4 text-left font-normal">Embudo</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.semana} className="data-row">
                <td className="num py-2 text-[12px] text-ink-soft">{fecha(f.semana)}</td>
                <td className="num py-2 text-right font-semibold text-ink">{f.entraron}</td>
                {COLS.map((c) => {
                  const v = f[c.k] as number;
                  const p = f.entraron > 0 ? Math.round((v / f.entraron) * 100) : 0;
                  return (
                    <td key={c.k} className="py-2 text-right">
                      <span className="num font-semibold text-ink">{v}</span>
                      <span className="num ml-1 text-[10.5px] text-ink-dim">{p}%</span>
                    </td>
                  );
                })}
                <td className="w-40 py-2 pl-4">
                  {/* Barras encajadas: cada etapa como fracción de los que
                      entraron. Se lee el estrechamiento de un vistazo. */}
                  <span className="relative block h-2 w-full overflow-hidden rounded-full bg-surface-4">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{
                        width: `${(f.entraron / maxEntraron) * 100}%`,
                        background: "rgba(145,116,255,0.22)",
                      }}
                    />
                    <span
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{
                        width: `${(f.tocados / maxEntraron) * 100}%`,
                        background: "rgba(145,116,255,0.5)",
                      }}
                    />
                    <span
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{
                        width: `${(f.conectados / maxEntraron) * 100}%`,
                        background: "#9174FF",
                      }}
                    />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-ink-dim">
        &quot;Conectados&quot; cuenta solo las veces que se habló con quien decide. Quedar
        en el portero se registra aparte a propósito: mezclarlos infla la tasa de
        conexión y esconde si el problema es el número o el filtro.
      </p>
    </section>
  );
}
