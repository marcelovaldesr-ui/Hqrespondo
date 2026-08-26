"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ContactosExtra, { limpiarContactos, type DatoContacto } from "@/components/ContactosExtra";
import { revisarContactos } from "@/lib/validarContacto";

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
  { k: "email",     label: "Correo",         ph: "contacto@clinica.cl" },
  { k: "web",       label: "Sitio web",      ph: "clinicaaurora.cl" },
  { k: "industria", label: "Rubro",          ph: "Clínica dental" },
  { k: "comuna",    label: "Comuna",         ph: "Providencia" },
] as const;

export default function NuevoLeadFoco({ lista = "general" }: { lista?: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [f, setF] = useState<Record<string, string>>({});
  const [leyendo, setLeyendo] = useState(false);
  const [leido, setLeido] = useState<string | null>(null);
  const [otrosTels, setOtrosTels] = useState<DatoContacto[]>([]);
  const [otrosMails, setOtrosMails] = useState<DatoContacto[]>([]);

  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  /**
   * Lee el sitio y rellena lo que encuentre.
   *
   * Regla que importa: NUNCA pisa lo que ya escribiste. Si tipeaste el rubro a
   * mano y después pegas la web, tu texto gana. Lo del sitio es una propuesta,
   * no una corrección.
   */
  async function leerSitio() {
    const web = (f.web ?? "").trim();
    if (!web || leyendo) return;
    setLeyendo(true);
    setLeido(null);
    setMsg(null);
    try {
      const r = await fetch("/api/foco/leer-web", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ web }),
      });
      const j = await r.json();
      if (!j.ok) {
        setLeido(j.motivo ?? "No se pudo leer el sitio.");
        return;
      }
      const ficha = (j.ficha ?? {}) as Record<string, string>;
      const puestos: string[] = [];
      setF((prev) => {
        const sig = { ...prev };
        for (const [k, v] of Object.entries(ficha)) {
          if (!v) continue;
          if ((sig[k] ?? "").trim()) continue; // lo tuyo manda
          sig[k] = v;
          puestos.push(k);
        }
        return sig;
      });
      setLeido(
        puestos.length
          ? `Del sitio salieron: ${puestos.join(", ")}. Revísalos antes de guardar.`
          : "El sitio se leyó pero no aportó nada que no tuvieras ya.",
      );
    } catch (e) {
      setLeido(e instanceof Error ? e.message : String(e));
    } finally {
      setLeyendo(false);
    }
  }

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

    // Antes de mandar nada: ¿lo que hay en cada casilla corresponde a esa
    // casilla? Un nombre en el campo del teléfono se guardaba tal cual y
    // después había que descubrirlo llamando. No importa cómo llegó ahí
    // (autocompletar, la lectura del sitio, o un dedo apurado): no se guarda.
    const problemas = revisarContactos({
      telefono: f.telefono,
      email: f.email,
      otrosTels,
      otrosMails,
    });
    if (problemas.length) {
      setMsg({ tipo: "error", texto: problemas.join(" · ") });
      return;
    }

    setGuardando(true);
    setMsg(null);
    try {
      const r = await fetch("/api/foco/nuevo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...f,
          nota: f.nota ?? "",
          lista,
          telefonos: limpiarContactos(
            [
              ...(f.telefono?.trim() ? [{ valor: f.telefono.trim(), tipo: "otro", fuente: "alta manual" }] : []),
              ...otrosTels,
            ],
            (v) => v.replace(/\D/g, ""),
          ),
          emails: limpiarContactos(
            [
              ...(f.email?.trim() ? [{ valor: f.email.trim(), tipo: "trabajo", fuente: "alta manual" }] : []),
              ...otrosMails,
            ],
            (v) => v.toLowerCase(),
          ),
        }),
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
      setOtrosTels([]);
      setOtrosMails([]);
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
              Lo único obligatorio es la <b className="text-ink-soft">empresa</b>. Si tienes el
              sitio, pégalo y aprieta <b className="text-ink-soft">leer sitio</b>: rellena rubro,
              comuna y contacto solo. Nunca pisa lo que ya escribiste. Si el teléfono está en la
              lista de no contactar, el lead <b className="text-ink-soft">no se agrega</b> y te
              avisa por qué.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {CAMPOS.map((c) => (
                <label key={c.k} className="block">
                  <span className="lbl mb-1 flex items-center justify-between gap-2">
                    <span>
                      {c.label}
                      {"req" in c && c.req ? <span className="text-coral"> *</span> : null}
                    </span>
                    {c.k === "web" && (
                      <button
                        type="button"
                        className="btn-ghost !px-1.5 !py-0 text-[9.5px]"
                        disabled={leyendo || !(f.web ?? "").trim()}
                        onClick={leerSitio}
                      >
                        {leyendo ? "leyendo…" : "✨ leer sitio"}
                      </button>
                    )}
                  </span>
                  <input
                    className="input text-[12.5px]"
                    placeholder={c.ph}
                    // El autocompletar del navegador es el otro sospechoso de
                    // que un nombre aparezca en el teléfono: sin `name`, Chrome
                    // adivina qué es cada casilla por el texto de al lado y en
                    // un formulario en español se equivoca. Un token que no
                    // conoce lo deja fuera de todas.
                    name={`hq-${c.k}`}
                    autoComplete={`hq-nuevo-lead-${c.k}`}
                    value={f[c.k] ?? ""}
                    onChange={(e) => set(c.k, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" || guardando) return;
                      // En el campo de la web, Enter LEE el sitio en vez de
                      // guardar: es lo que uno espera después de pegar una URL,
                      // y guardar sin haberla leído desperdicia el viaje.
                      if (c.k === "web") leerSitio();
                      else guardar();
                    }}
                  />
                </label>
              ))}
            </div>

            {leido && (
              <div className="mt-2 rounded-md border border-line2 bg-surface-3/60 px-2.5 py-1.5 text-[11px] leading-snug text-ink-mut">
                {leido}
              </div>
            )}

            <div className="mt-2.5">
              <ContactosExtra
                titulo="Otros teléfonos"
                items={otrosTels}
                onChange={setOtrosTels}
                tipos={["movil", "corporativo", "otro"]}
                placeholder="+56 2 2222 8889"
                etiquetaAgregar="agregar otro teléfono"
              />
              <ContactosExtra
                titulo="Otros correos"
                items={otrosMails}
                onChange={setOtrosMails}
                tipos={["trabajo", "personal", "otro"]}
                placeholder="otro@empresa.cl"
                etiquetaAgregar="agregar otro correo"
              />
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
