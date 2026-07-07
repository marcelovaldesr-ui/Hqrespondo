"use client";

import { useMemo, useState } from "react";
import {
  CANAL_LABEL,
  COPY_TIPO_LABEL,
  FUNNEL_LABEL,
  type Canal,
  type CopySnippet,
  type CopyTipo,
  type Funnel,
} from "@/lib/growth/types";
import { RUBROS } from "@/lib/growth/industries";

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setOk(true);
          setTimeout(() => setOk(false), 1200);
        } catch {}
      }}
      className="btn-ghost shrink-0 px-2 py-0.5 text-[10px]"
    >
      {ok ? "¡Copiado!" : "Copiar"}
    </button>
  );
}

export default function CopiesClient({
  initial,
  tipoInicial,
}: {
  initial: CopySnippet[];
  tipoInicial: string;
}) {
  const [tipo, setTipo] = useState(tipoInicial);
  const [q, setQ] = useState("");
  const [rubro, setRubro] = useState("");

  const tipos = useMemo(
    () => Array.from(new Set(initial.map((c) => c.tipo))) as CopyTipo[],
    [initial],
  );

  const visibles = useMemo(
    () =>
      initial.filter((c) => {
        if (tipo && c.tipo !== tipo) return false;
        if (rubro && c.rubro !== rubro) return false;
        if (q.trim() && !c.texto.toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      }),
    [initial, tipo, rubro, q],
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar copies…" className="input max-w-xs py-1.5 text-sm" />
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="input w-auto py-1.5 text-xs">
          <option value="">Todos los tipos</option>
          {tipos.map((t) => <option key={t} value={t}>{COPY_TIPO_LABEL[t]}</option>)}
        </select>
        <select value={rubro} onChange={(e) => setRubro(e.target.value)} className="input w-auto py-1.5 text-xs">
          <option value="">Todos los rubros</option>
          {RUBROS.map((r) => <option key={r.slug} value={r.slug}>{r.nombre}</option>)}
        </select>
        <span className="ml-auto font-mono text-[11px] text-ink-dim">{visibles.length} copies</span>
      </div>

      <div className="flex flex-col gap-2">
        {visibles.map((c) => (
          <div key={c.id} className="panel flex items-start gap-3 px-4 py-3">
            <div className="flex-1">
              <p className="text-[13.5px] leading-relaxed text-ink">{c.texto}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <span className="chip px-2 py-0 text-[9.5px]">{COPY_TIPO_LABEL[c.tipo]}</span>
                {c.canal && <span className="chip px-2 py-0 text-[9.5px]">{CANAL_LABEL[c.canal as Canal]}</span>}
                {c.funnel && <span className="chip px-2 py-0 text-[9.5px]">{FUNNEL_LABEL[c.funnel as Funnel]}</span>}
                {c.rubro && <span className="chip px-2 py-0 text-[9.5px]">{c.rubro}</span>}
                {c.fuente && <span className="text-[9.5px] text-ink-dim">· {c.fuente}</span>}
              </div>
            </div>
            <CopyBtn text={c.texto} />
          </div>
        ))}
      </div>
    </div>
  );
}
