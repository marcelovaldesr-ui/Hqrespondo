"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Alta manual de un lead de Foco.
 *
 * Deliberadamente corto: la empresa es lo único obligatorio y el resto se puede
 * completar después desde la ficha, que ya sabe editar esos campos. El caso que
 * esto resuelve es "me pasaron un dato ahora y lo quiero anotar antes de que se
 * me olvide", no "voy a llenar una planilla".
 */

const CAMPOS = [
  { k: "empresa",   label: "Empresa",        ph: "Clínica Dental Aurora",     req: true },
  { k: "contacto",  label: "Persona",        ph: "María José Contreras" },
  { k: "cargo",     label: "Cargo",          ph: "Dueña / Gerente" },
  { k: "telefono",  label: "Teléfono",       ph: "+56 9 1234 5678" },
  { k: "industria", label: "Rubro",          ph: "Clínica dental" },
  { k: "comuna",    label: "Comuna",         ph: "Providencia" },
] as const;

export default function NuevoLeadFoco({ lista = "general" }: { lista?: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [f, setF] = useState<Record<string, string>>({});

  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  function cerrar() {
    if (guardando) return;
    setAbierto(false);
    setMsg(null);
  }

  async function guardar() {
    if (!f.empresa?.trim()) {
      setMsg({ tipo: "error", texto: "Falta el nombre de la empresa." });
      return;
    }
    setGuardando(true);
    setMsg(null);
    try {
      const r = await fetch("/api/foco/nuevo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, nota: f.nota ?? "", lista }),
      });
      const j = await r.json();
      if (!r.ok) {
        setMsg({ tipo: "error", texto: j.error ?? "No se pudo guardar." });
        return;
      }
      setMsg({
        tipo: "ok",
        texto: `${j.lead?.empresa} agregado · encaje ${j.encaje}. Puedes agregar otro.`,
      });
      // Se limpia todo menos la lista: lo normal es cargar varios seguidos.
      setF({});
      router.refresh();
    } catch (e) {
      setMsg({ tipo: "error", texto: e instanceof Error ? e.message : String(e) });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <button className="btn-ghost" onClick={() => setAbierto(true)}>
        + Lead a mano
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={cerrar}
        >
          <div className="glass w-full max-w-xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="lbl">Agregar a Leads Foco</div>
            <div className="ttl mt-1 text-[15px]">Un lead, a mano</div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-ink-mut">
              Lo único obligatorio es la <b className="text-ink-soft">empresa</b>. Todo lo demás se
              puede completar después desde la ficha. Si el teléfono está en la lista de no
              contactar, el lead <b className="text-ink-soft">no se agrega</b> y te avisa por qué.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {CAMPOS.map((c) => (
                <label key={c.k} className="block">
                  <span className="lbl mb-1 block">
                    {c.label}
                    {"req" in c && c.req ? <span className="text-coral"> *</span> : null}
                  </span>
                  <input
                    className="input text-[12.5px]"
                    placeholder={c.ph}
                    value={f[c.k] ?? ""}
                    onChange={(e) => set(c.k, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !guardando) guardar();
                    }}
                  />
                </label>
              ))}
            </div>

            <label className="mt-2.5 block">
              <span className="lbl mb-1 block">Por qué llamarlos</span>
              <textarea
                className="input min-h-[56px] text-[12.5px]"
                placeholder="Me lo recomendó Amaro · atienden todo por WhatsApp · vi que están contratando recepcionista…"
                value={f.senal ?? ""}
                onChange={(e) => set("senal", e.target.value)}
              />
            </label>

            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              <button className="btn-primary" disabled={guardando} onClick={guardar}>
                {guardando ? "Guardando…" : "Agregar lead"}
              </button>
              <button className="btn-ghost" disabled={guardando} onClick={cerrar}>
                Cerrar
              </button>
              {msg && (
                <span className={`text-[12px] ${msg.tipo === "error" ? "text-danger" : "text-ok"}`}>
                  {msg.texto}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
