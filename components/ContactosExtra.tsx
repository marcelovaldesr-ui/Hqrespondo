"use client";

/**
 * Lista editable de teléfonos o correos adicionales.
 *
 * Existe porque la base ya guardaba varios (migración 034) y la ficha los
 * mostraba, pero no había dónde ESCRIBIR el segundo a mano — solo llegaban si
 * venían de una importación. Copiando de Apollo, que suele dar el móvil y el
 * corporativo de la misma persona, eso dejaba el trabajo a medias.
 *
 * El mismo componente sirve en el alta manual y en la edición de la ficha, así
 * no se repite la lógica en dos lados y no se desincronizan — que es
 * exactamente el error que ya cometí con el formulario y su endpoint.
 *
 * OJO: acá NO va el principal. El principal es el que ordena la cola y el que
 * alguien marca; se edita en su propio campo, arriba. Esto es el resto.
 */

export type DatoContacto = { valor: string; tipo: string; fuente: string };

export default function ContactosExtra({
  titulo,
  items,
  onChange,
  tipos,
  placeholder,
  etiquetaAgregar,
}: {
  titulo: string;
  items: DatoContacto[];
  onChange: (v: DatoContacto[]) => void;
  tipos: string[];
  placeholder: string;
  etiquetaAgregar: string;
}) {
  const set = (i: number, parche: Partial<DatoContacto>) =>
    onChange(items.map((x, j) => (j === i ? { ...x, ...parche } : x)));

  return (
    <div className="space-y-1.5">
      <div className="pt-1.5 text-[9.5px] uppercase tracking-[0.13em] text-ink-faint">{titulo}</div>

      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input
            className="input !py-1.5 flex-1 text-[12px]"
            placeholder={placeholder}
            value={it.valor}
            onChange={(e) => set(i, { valor: e.target.value })}
          />
          <select
            className="input !py-1.5 w-[6.5rem] shrink-0 text-[11px]"
            value={it.tipo}
            onChange={(e) => set(i, { tipo: e.target.value })}
          >
            {tipos.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-ghost shrink-0 !px-2 !py-1 text-[12px]"
            title="Quitar"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
          >
            ✕
          </button>
        </div>
      ))}

      <button
        type="button"
        className="btn-ghost w-full !py-1 text-[11px]"
        onClick={() => onChange([...items, { valor: "", tipo: tipos[0], fuente: "a mano" }])}
      >
        + {etiquetaAgregar}
      </button>
    </div>
  );
}

/** Deja la lista lista para guardar: sin vacíos y sin repetidos. */
export function limpiarContactos(items: DatoContacto[], normaliza: (v: string) => string): DatoContacto[] {
  const vistos = new Set<string>();
  const out: DatoContacto[] = [];
  for (const it of items) {
    const valor = (it.valor ?? "").trim();
    if (!valor) continue;
    const llave = normaliza(valor);
    if (!llave || vistos.has(llave)) continue;
    vistos.add(llave);
    out.push({ valor, tipo: it.tipo || "otro", fuente: it.fuente || "a mano" });
  }
  return out.slice(0, 8);
}
