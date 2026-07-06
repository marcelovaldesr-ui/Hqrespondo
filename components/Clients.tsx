"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clp, timeAgo } from "@/lib/format";
import {
  PLANES,
  PLAN_LABEL,
  PLAN_PRECIOS,
  type ClientStats,
  type OnboardingTask,
  type Plan,
} from "@/lib/types";

function salud(c: ClientStats): {
  led: string;
  glow: string;
  texto: string;
  textoCls: string;
  borde: string;
} {
  if (!c.activo)
    return {
      led: "bg-ink-faint",
      glow: "",
      texto: "Inactivo",
      textoCls: "text-ink-faint",
      borde: "border-line opacity-70",
    };
  if (c.errores_24h > 0)
    return {
      led: "bg-danger",
      glow: "led-glow-red",
      texto: `${c.errores_24h} error${c.errores_24h === 1 ? "" : "es"} 24h`,
      textoCls: "text-danger",
      borde: "border-danger/35 bg-danger/[0.03]",
    };
  if (!c.ultimo_evento)
    return {
      led: "bg-warn",
      glow: "led-glow-amber",
      texto: "Sin eventos aún",
      textoCls: "text-warn",
      borde: "border-warn/25",
    };
  const horas = (Date.now() - new Date(c.ultimo_evento).getTime()) / 3600000;
  if (horas > 12)
    return {
      led: "bg-warn",
      glow: "led-glow-amber",
      texto: `Sin actividad ${Math.floor(horas)} h`,
      textoCls: "text-warn",
      borde: "border-warn/25",
    };
  return {
    led: "bg-ok",
    glow: "led-glow-green",
    texto: "Operativo",
    textoCls: "text-ok",
    borde: "border-line",
  };
}

/**
 * Checklist de instalación del cliente (tabla onboarding_tasks).
 * Se crea sola con cada cliente nuevo; para clientes antiguos hay
 * un botón que genera el checklist estándar.
 */
function OnboardingPanel({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const [tasks, setTasks] = useState<OnboardingTask[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [nuevoPaso, setNuevoPaso] = useState("");

  async function cargar() {
    const res = await fetch(`/api/clients/${clientId}/onboarding`);
    const data = await res.json().catch(() => ({}));
    setTasks(data.tasks ?? []);
  }

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (tasks === null) await cargar();
  }

  async function crearEstandar() {
    setBusy(true);
    await fetch(`/api/clients/${clientId}/onboarding`, { method: "POST" });
    await cargar();
    setBusy(false);
  }

  async function marcar(t: OnboardingTask) {
    setTasks((ts) =>
      (ts ?? []).map((x) => (x.id === t.id ? { ...x, hecho: !t.hecho } : x)),
    );
    const res = await fetch(`/api/clients/${clientId}/onboarding`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: t.id, hecho: !t.hecho }),
    });
    if (!res.ok) {
      alert("No se pudo actualizar el paso");
    }
    await cargar();
  }

  async function agregarPaso(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevoPaso.trim() || busy) return;
    setBusy(true);
    await fetch(`/api/clients/${clientId}/onboarding`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paso: nuevoPaso }),
    });
    setNuevoPaso("");
    await cargar();
    setBusy(false);
  }

  const hechos = (tasks ?? []).filter((t) => t.hecho).length;
  const total = (tasks ?? []).length;

  return (
    <div className="relative mt-3 border-t border-line pt-3">
      <button onClick={toggle} className="btn-ghost w-full justify-between px-2 py-1">
        <span>
          Onboarding
          {tasks !== null && total > 0 && (
            <span className={`ml-2 font-mono text-[10px] ${hechos === total ? "text-ok" : "text-ink-dim"}`}>
              {hechos}/{total}
            </span>
          )}
        </span>
        <span className="font-mono">{open ? "−" : "+"}</span>
      </button>

      {open && tasks !== null && (
        <div className="mt-3 flex flex-col gap-1">
          {total === 0 ? (
            <button onClick={crearEstandar} disabled={busy} className="btn-ghost py-2">
              {busy ? "Creando…" : "Crear checklist estándar (7 pasos)"}
            </button>
          ) : (
            <>
              <div className="mb-1 h-[5px] overflow-hidden rounded-full bg-surface-3">
                <div
                  className="h-full rounded-full bg-ok transition-all"
                  style={{ width: total ? `${(hechos / total) * 100}%` : 0 }}
                />
              </div>
              {tasks.map((t) => (
                <label
                  key={t.id}
                  className="flex cursor-pointer items-start gap-2 rounded-lg px-1.5 py-1 text-[12.5px] leading-snug transition hover:bg-surface-3/60"
                >
                  <input
                    type="checkbox"
                    checked={t.hecho}
                    onChange={() => marcar(t)}
                    className="mt-0.5 accent-[#16A34A]"
                  />
                  <span className={t.hecho ? "text-ink-faint line-through" : "text-ink-soft"}>
                    {t.paso}
                  </span>
                  {t.hecho && t.hecho_por && (
                    <span className="ml-auto shrink-0 font-mono text-[9.5px] text-ink-faint">
                      {t.hecho_por}
                    </span>
                  )}
                </label>
              ))}
              <form onSubmit={agregarPaso} className="mt-1 flex gap-1.5">
                <input
                  value={nuevoPaso}
                  onChange={(e) => setNuevoPaso(e.target.value)}
                  placeholder="Agregar paso…"
                  className="input flex-1 px-2 py-1 text-xs"
                />
                <button type="submit" disabled={!nuevoPaso.trim() || busy} className="btn-ghost px-2.5">
                  +
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Edición de los datos del cliente + eliminación.
 */
function EditClientPanel({ c }: { c: ClientStats }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nombre, setNombre] = useState(c.nombre);
  const [rubro, setRubro] = useState(c.rubro ?? "");
  const [plan, setPlan] = useState<Plan>(c.plan);
  const [mensualidad, setMensualidad] = useState(String(c.mensualidad));
  const [telefonoBot, setTelefonoBot] = useState(c.telefono_bot ?? "");
  const [workflowId, setWorkflowId] = useState(c.workflow_id ?? "");

  async function guardar() {
    if (saving || !nombre.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          rubro: rubro || null,
          plan,
          mensualidad: Number(mensualidad) || 0,
          telefono_bot: telefonoBot || null,
          workflow_id: workflowId || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Error ${res.status}`);
      }
      setOpen(false);
    } catch (e: any) {
      alert(`No se pudo guardar: ${e.message}`);
    } finally {
      setSaving(false);
    }
    router.refresh();
  }

  async function eliminar() {
    if (
      !confirm(
        `¿Eliminar el cliente "${c.nombre}"? Su historial de eventos queda sin cliente asociado. Esto no se puede deshacer.`,
      )
    )
      return;
    try {
      const res = await fetch(`/api/clients/${c.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Error ${res.status}`);
      }
    } catch (e: any) {
      alert(`No se pudo eliminar: ${e.message}`);
    }
    router.refresh();
  }

  return (
    <div className="relative mt-3 border-t border-line pt-3">
      <button onClick={() => setOpen(!open)} className="btn-ghost w-full justify-between px-2 py-1">
        <span>Editar cliente</span>
        <span className="font-mono">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-2.5">
          <div className="grid grid-cols-2 gap-2">
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" className="input text-xs" aria-label="Nombre" />
            <input value={rubro} onChange={(e) => setRubro(e.target.value)} placeholder="Rubro" className="input text-xs" aria-label="Rubro" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select value={plan} onChange={(e) => setPlan(e.target.value as Plan)} className="input px-2 text-xs" aria-label="Plan">
              {PLANES.map((pl) => (
                <option key={pl} value={pl}>{PLAN_LABEL[pl]}</option>
              ))}
            </select>
            <input type="number" value={mensualidad} onChange={(e) => setMensualidad(e.target.value)} placeholder="Mensualidad CLP" className="input px-2 text-xs" aria-label="Mensualidad" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input value={telefonoBot} onChange={(e) => setTelefonoBot(e.target.value)} placeholder="Teléfono del bot" className="input px-2 font-mono text-xs" aria-label="Teléfono del bot" />
            <input value={workflowId} onChange={(e) => setWorkflowId(e.target.value)} placeholder="Workflow ID (n8n)" className="input px-2 font-mono text-xs" aria-label="Workflow ID" />
          </div>
          <div className="flex items-center justify-between">
            <button onClick={eliminar} className="btn-ghost hover:border-danger/40 hover:bg-danger/10 hover:text-danger">
              Eliminar cliente
            </button>
            <button onClick={guardar} disabled={saving || !nombre.trim()} className="btn-primary px-4 py-1 text-xs">
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Configuración operativa del bot (tabla bot_configs): tono, horarios
 * y reglas de derivación a humano. Se carga al expandir y se guarda
 * con upsert — n8n la lee vía GET /api/hooks/bot-config.
 */
function BotConfigPanel({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [tono, setTono] = useState("");
  const [lunVie, setLunVie] = useState("");
  const [sab, setSab] = useState("");
  const [dom, setDom] = useState("");
  const [reglas, setReglas] = useState("");
  const [contacto, setContacto] = useState("");

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (loaded) return;
    try {
      const res = await fetch(`/api/clients/${clientId}/config`);
      const data = await res.json();
      const c = data.config;
      if (c) {
        setTono(c.tono ?? "");
        setLunVie(c.horario_atencion?.lun_vie ?? "");
        setSab(c.horario_atencion?.sab ?? "");
        setDom(c.horario_atencion?.dom ?? "");
        setReglas(c.derivacion_reglas ?? "");
        setContacto(c.derivacion_contacto ?? "");
      }
    } catch {
      setMsg("No se pudo cargar la config");
    } finally {
      setLoaded(true);
    }
  }

  async function guardar() {
    if (saving) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tono: tono || null,
          horario_atencion: {
            lun_vie: lunVie || null,
            sab: sab || null,
            dom: dom || null,
          },
          derivacion_reglas: reglas || null,
          derivacion_contacto: contacto || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al guardar");
      setMsg("Guardado ✓");
      setTimeout(() => setMsg(null), 2500);
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative mt-3 border-t border-line pt-3">
      <button onClick={toggle} className="btn-ghost w-full justify-between px-2 py-1">
        <span>Config bot · Tono / Horarios / Derivación</span>
        <span className="font-mono">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-2.5">
          <div>
            <label className="lbl mb-1 block">Tono del bot</label>
            <input
              value={tono}
              onChange={(e) => setTono(e.target.value)}
              placeholder="cercano y profesional, trato de tú, sin emojis"
              className="input text-xs"
            />
          </div>
          <div>
            <label className="lbl mb-1 block">Horarios de atención (vacío = cerrado)</label>
            <div className="grid grid-cols-3 gap-2">
              <input
                value={lunVie}
                onChange={(e) => setLunVie(e.target.value)}
                placeholder="L-V 09:00-19:00"
                className="input px-2 text-xs"
                aria-label="horario lunes a viernes"
              />
              <input
                value={sab}
                onChange={(e) => setSab(e.target.value)}
                placeholder="Sáb 10:00-14:00"
                className="input px-2 text-xs"
                aria-label="horario sábado"
              />
              <input
                value={dom}
                onChange={(e) => setDom(e.target.value)}
                placeholder="Dom"
                className="input px-2 text-xs"
                aria-label="horario domingo"
              />
            </div>
          </div>
          <div>
            <label className="lbl mb-1 block">Cuándo derivar a humano</label>
            <textarea
              value={reglas}
              onChange={(e) => setReglas(e.target.value)}
              placeholder="Si piden hablar con una persona, si hay un reclamo, si preguntan por un pedido ya pagado…"
              rows={3}
              className="input resize-y text-xs"
            />
          </div>
          <div>
            <label className="lbl mb-1 block">Derivar a (nombre / WhatsApp)</label>
            <input
              value={contacto}
              onChange={(e) => setContacto(e.target.value)}
              placeholder="Marcelo · +569XXXXXXXX"
              className="input text-xs"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] text-ink-dim">{msg}</span>
            <button onClick={guardar} disabled={saving} className="btn-primary px-4 py-1 text-xs">
              {saving ? "Guardando…" : "Guardar config"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Clients({ clients }: { clients: ClientStats[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [nombre, setNombre] = useState("");
  const [rubro, setRubro] = useState("");
  const [plan, setPlan] = useState<Plan>("cotizador");
  const [workflowId, setWorkflowId] = useState("");
  const [saving, setSaving] = useState(false);

  const activos = clients.filter((c) => c.activo);
  const mrr = activos.reduce((a, c) => a + c.mensualidad, 0);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre || saving) return;
    setSaving(true);
    await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre,
        rubro: rubro || null,
        plan,
        workflow_id: workflowId || null,
      }),
    });
    setNombre("");
    setRubro("");
    setWorkflowId("");
    setShowForm(false);
    setSaving(false);
    router.refresh();
  }

  async function toggleActivo(c: ClientStats) {
    await fetch(`/api/clients/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !c.activo }),
    });
    router.refresh();
  }

  const maxUp = Math.max(
    1,
    ...clients.flatMap((c) => c.uptime.map((b) => b.n)),
  );

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="metric-card px-5 py-4">
          <span className="lbl">MRR actual </span>
          <span className="ml-3 font-mono text-2xl text-ok">{clp(mrr)}</span>
        </div>
        <div className="metric-card px-5 py-4">
          <span className="lbl">Activos </span>
          <span className="ml-3 font-mono text-2xl">{activos.length}</span>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary ml-auto text-xs"
        >
          + Cliente
        </button>
      </div>

      {showForm && (
        <form onSubmit={crear} className="panel-hot mb-5 flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-44 flex-1">
            <label className="lbl mb-1.5 block">Nombre</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Imprenta Familiar"
              className="input"
            />
          </div>
          <div className="min-w-36">
            <label className="lbl mb-1.5 block">Rubro</label>
            <input
              value={rubro}
              onChange={(e) => setRubro(e.target.value)}
              placeholder="imprenta"
              className="input"
            />
          </div>
          <div>
            <label className="lbl mb-1.5 block">Plan</label>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value as Plan)}
              className="input"
            >
              {PLANES.map((p) => (
                <option key={p} value={p}>
                  {PLAN_LABEL[p]} — {clp(PLAN_PRECIOS[p].mensual)}/mes
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-40">
            <label className="lbl mb-1.5 block">Workflow ID (n8n)</label>
            <input
              value={workflowId}
              onChange={(e) => setWorkflowId(e.target.value)}
              placeholder="id del workflow del bot"
              className="input font-mono text-xs"
            />
          </div>
          <button type="submit" disabled={!nombre || saving} className="btn-primary text-xs">
            Crear
          </button>
        </form>
      )}

      {clients.length === 0 && (
        <div className="panel mb-3 border-dashed border-line2 p-8 text-center">
          <p className="text-sm font-medium text-ink-soft">
            Aún no hay clientes activos — y eso está bien: es la fase de validación.
          </p>
          <p className="mx-auto mt-2 max-w-xl text-xs leading-relaxed text-ink-dim">
            Cuando cierres el primer piloto, agrégalo aquí con su plan, mensualidad
            y workflow de n8n. Se creará solo el checklist de instalación (7 pasos)
            y este módulo pasará a monitorear su bot: conversaciones, errores, costo
            y salud en vivo. Mientras tanto, el camino al primer cliente está en{" "}
            <a href="/prospeccion" className="text-brand underline">Prospección</a>.
          </p>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {clients.map((c) => {
          const st = salud(c);
          const margen =
            c.mensualidad > 0
              ? Math.max(0, Math.round((1 - c.costo_mes / c.mensualidad) * 100))
              : null;
          return (
            <div key={c.id} className={`panel-hot border p-4 transition ${st.borde}`}>
              <div className="flex items-center gap-2">
                <span className={`led ${st.led} ${st.glow}`} />
                <span className="flex-1 truncate text-[15px] font-semibold">
                  {c.nombre}
                </span>
                <span className="chip px-2 py-0 text-[10px]">{PLAN_LABEL[c.plan]}</span>
              </div>

              <div className="relative mb-2 mt-4 flex items-center justify-between">
                <span className="lbl">Actividad 24h</span>
                <span className={`font-mono text-[10px] ${st.textoCls}`}>
                  {st.texto}
                </span>
              </div>
              <div className="relative flex h-5 items-end gap-[3px]" aria-hidden="true">
                {c.uptime.map((b, i) => {
                  const cls = b.err
                    ? "bg-danger"
                    : b.n > 0
                      ? "bg-ok"
                      : "bg-surface-3";
                  const h = b.err
                    ? 20
                    : b.n > 0
                      ? 7 + Math.round((b.n / maxUp) * 13)
                      : 4;
                  return (
                    <span
                      key={i}
                      className={`w-[7px] rounded-[2px] ${cls}`}
                      style={{ height: h }}
                    />
                  );
                })}
              </div>

              <div className="relative mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="subpanel px-1 py-2">
                  <div className="font-mono text-sm">{c.mensajes_hoy}</div>
                  <div className="text-[9.5px] text-ink-dim">Msjs hoy</div>
                </div>
                <div className="subpanel px-1 py-2">
                  <div className={`font-mono text-sm ${st.textoCls === "text-ok" ? "" : st.textoCls}`}>
                    {c.ultimo_evento ? timeAgo(c.ultimo_evento) : "—"}
                  </div>
                  <div className="text-[9.5px] text-ink-dim">Últ. evento</div>
                </div>
                <div className="subpanel px-1 py-2">
                  <div className="font-mono text-sm">{clp(c.costo_mes)}</div>
                  <div className="text-[9.5px] text-ink-dim">Costo mes</div>
                </div>
              </div>

              <div className="relative mt-4 flex items-center justify-between text-[11px]">
                <span className="text-ink-mut">
                  Mensualidad{" "}
                  <span className="font-mono text-ok">{clp(c.mensualidad)}</span>
                </span>
                <span className="flex items-center gap-2">
                  {margen != null && (
                    <span className="font-mono text-[10px] text-ink-dim">
                      Margen {margen}%
                    </span>
                  )}
                  <button onClick={() => toggleActivo(c)} className="btn-ghost px-2 py-0.5">
                    {c.activo ? "Pausar" : "Reactivar"}
                  </button>
                </span>
              </div>

              <OnboardingPanel clientId={c.id} />
              <EditClientPanel c={c} />
              <BotConfigPanel clientId={c.id} />
            </div>
          );
        })}

        <button
          onClick={() => setShowForm(true)}
          className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-line2 bg-surface-3/30 text-xs text-ink-faint transition hover:border-brand/40 hover:bg-brand/10 hover:text-brand"
        >
          + Nuevo cliente
        </button>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-ink-dim">
        El estado se alimenta de los eventos que envía n8n a{" "}
        <code className="rounded bg-surface-3 px-1">/api/hooks/bot-events</code>.
        Importa los workflows de la carpeta{" "}
        <code className="rounded bg-surface-3 px-1">n8n/</code> y asigna el
        workflow id a cada cliente.
      </p>
    </div>
  );
}
