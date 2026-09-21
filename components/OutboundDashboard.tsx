"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import type {
  OutboundDomain,
  OutboundSender,
  Company,
  Contact,
  OutboxItem,
  ReplyEvent,
  Suppression,
  MailboxWatchStatus,
} from "@/lib/outbound/types";
import type { ReporteSaludDns } from "@/lib/outbound/dnsHealth";

interface OutboundDashboardProps {
  initialData: {
    config: {
      outboundEnabled: boolean;
      dryRun: boolean;
    };
    dominio: OutboundDomain | null;
    senders: OutboundSender[];
    companies: Company[];
    contacts: Contact[];
    outbox: OutboxItem[];
    replies: ReplyEvent[];
    suppressions: Suppression[];
    dnsHealth: ReporteSaludDns | null;
    mailboxWatches: MailboxWatchStatus[];
    oauthConfigured: Record<string, boolean>;
  };
}

export default function OutboundDashboard({ initialData }: OutboundDashboardProps) {
  const [tab, setTab] = useState<"cola" | "prospectos" | "respuestas" | "senders" | "supresiones">("cola");
  const [outboxItems, setOutboxItems] = useState<OutboxItem[]>(initialData.outbox);
  const [filtroEstado, setFiltroEstado] = useState<string>("pending_review");
  const [itemSeleccionado, setItemSeleccionado] = useState<OutboxItem | null>(null);
  const [killSwitchPausado, setKillSwitchPausado] = useState<boolean>(initialData.dominio?.paused ?? false);
  const [cargandoAccion, setCargandoAccion] = useState<boolean>(false);
  const [accionError, setAccionError] = useState<string | null>(null);

  async function exigirRespuestaOk(res: Response) {
    if (res.ok) return;
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `La acción falló (${res.status})`);
  }

  // Filtro de cola outbox
  const itemsFiltrados = outboxItems.filter((i) => {
    if (filtroEstado === "todos") return true;
    return i.estado === filtroEstado;
  });

  const pendientesCount = outboxItems.filter((i) => i.estado === "pending_review").length;
  const programadosCount = outboxItems.filter((i) => i.estado === "scheduled" || i.estado === "approved").length;
  const enviadosCount = outboxItems.filter((i) => i.estado === "sent").length;

  async function handleAprobar(id: string) {
    setCargandoAccion(true);
    setAccionError(null);
    try {
      const res = await fetch("/api/outbound/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", outboxId: id }),
      });
      await exigirRespuestaOk(res);
      if (res.ok) {
        setOutboxItems((prev) =>
          prev.map((item) => (item.id === id ? { ...item, estado: "approved" } : item)),
        );
        if (itemSeleccionado?.id === id) {
          setItemSeleccionado((prev) => (prev ? { ...prev, estado: "approved" } : null));
        }
      }
    } catch (error) {
      setAccionError(error instanceof Error ? error.message : "La acción falló");
    } finally {
      setCargandoAccion(false);
    }
  }

  async function handleRechazar(id: string) {
    setCargandoAccion(true);
    setAccionError(null);
    try {
      const res = await fetch("/api/outbound/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", outboxId: id }),
      });
      await exigirRespuestaOk(res);
      if (res.ok) {
        setOutboxItems((prev) =>
          prev.map((item) => (item.id === id ? { ...item, estado: "cancelled" } : item)),
        );
        if (itemSeleccionado?.id === id) {
          setItemSeleccionado((prev) => (prev ? { ...prev, estado: "cancelled" } : null));
        }
      }
    } catch (error) {
      setAccionError(error instanceof Error ? error.message : "La acción falló");
    } finally {
      setCargandoAccion(false);
    }
  }

  async function handleAprobarTodos() {
    const pendientesIds = outboxItems.filter((i) => i.estado === "pending_review").map((i) => i.id);
    if (pendientesIds.length === 0) return;
    setCargandoAccion(true);
    setAccionError(null);
    try {
      const res = await fetch("/api/outbound/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve_batch", outboxIds: pendientesIds }),
      });
      await exigirRespuestaOk(res);
      if (res.ok) {
        setOutboxItems((prev) =>
          prev.map((item) => (pendientesIds.includes(item.id) ? { ...item, estado: "approved" } : item)),
        );
      }
    } catch (error) {
      setAccionError(error instanceof Error ? error.message : "La acción falló");
    } finally {
      setCargandoAccion(false);
    }
  }

  async function handleToggleKillSwitch() {
    setCargandoAccion(true);
    setAccionError(null);
    const accion = killSwitchPausado ? "resume" : "pause_all";
    try {
      const res = await fetch("/api/outbound/killswitch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: accion }),
      });
      await exigirRespuestaOk(res);
      if (res.ok) {
        setKillSwitchPausado(!killSwitchPausado);
      }
    } catch (error) {
      setAccionError(error instanceof Error ? error.message : "La acción falló");
    } finally {
      setCargandoAccion(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6 sm:p-8">
      {/* Encabezado y Guardrails Globales */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <PageHeader
            title="Outbound Email V1"
            sub="Motor interno de prospección 1 a 1 para Respondo con reputación y evidencia protegidas."
          />
        </div>

        {/* Indicadores de Seguridad y Killswitch */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Banner DRY RUN */}
          <div
            className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-[11px] font-medium tracking-wide ${
              initialData.config.dryRun
                ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-current animate-pulse" />
            {initialData.config.dryRun ? "DRY RUN ACTIVO (SIN ENVÍOS REALES)" : "MODO PRODUCCIÓN (REAL)"}
          </div>

          {/* Kill Switch Button */}
          <button
            onClick={handleToggleKillSwitch}
            disabled={cargandoAccion}
            className={`flex items-center gap-2 rounded-lg border px-3.5 py-1.5 font-mono text-[12px] font-semibold transition ${
              killSwitchPausado
                ? "border-emerald-600/40 bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30"
                : "border-red-600/40 bg-red-600/20 text-red-300 hover:bg-red-600/30"
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 3h8v10H4z" />
            </svg>
            {killSwitchPausado ? "REANUDAR OUTBOUND" : "PAUSE ALL OUTBOUND"}
          </button>
        </div>
      </div>

      {accionError && (
        <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {accionError}
        </div>
      )}

      {/* Tarjetas de Salud del Dominio respon.do y Senders */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Dominio respon.do */}
        <div className="rounded-xl border border-line bg-surface-2 p-4">
          <div className="flex items-center justify-between text-ink-dim">
            <span className="font-mono text-[11px] uppercase tracking-wider">Dominio</span>
            <span className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[10px] text-brand">respon.do</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-ink">
              {initialData.dominio?.sent_today ?? 0}
            </span>
            <span className="font-mono text-[12px] text-ink-dim">
              / {initialData.dominio?.domain_daily_limit ?? 30} hoy
            </span>
          </div>
          <div className="mt-3 flex items-center gap-2 border-t border-line/60 pt-2 font-mono text-[10px]">
            <span className={initialData.dnsHealth?.spf.estado === "pass" ? "text-emerald-400" : "text-amber-400"}>
              SPF: {initialData.dnsHealth?.spf.estado?.toUpperCase() ?? "OK"}
            </span>
            <span>·</span>
            <span className={initialData.dnsHealth?.dkim.estado === "pass" ? "text-emerald-400" : "text-amber-400"}>
              DKIM: {initialData.dnsHealth?.dkim.estado?.toUpperCase() ?? "OK"}
            </span>
            <span>·</span>
            <span className={initialData.dnsHealth?.dmarc.estado === "pass" ? "text-emerald-400" : "text-amber-400"}>
              DMARC: {initialData.dnsHealth?.dmarc.estado?.toUpperCase() ?? "OK"}
            </span>
          </div>
        </div>

        {initialData.senders.map((sender) => {
          const watch = initialData.mailboxWatches.find((item) => item.mailbox_email === sender.email);
          return (
            <div key={sender.id} className="rounded-xl border border-line bg-surface-2 p-4">
              <div className="flex items-center justify-between gap-2 text-ink-dim">
                <span className="truncate font-mono text-[11px] uppercase tracking-wider">{sender.name}</span>
                <span className={`rounded px-1.5 py-0.5 font-mono text-[9px] ${sender.active ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}>
                  {sender.active ? "ACTIVO" : "PAUSADO"}
                </span>
              </div>
              <div className="mt-1 truncate font-mono text-[10px] text-ink-dim">{sender.email}</div>
              <div className="mt-2 font-mono text-2xl font-bold text-ink">
                {sender.sent_today}<span className="ml-1 text-[12px] font-normal text-ink-dim">/ {sender.total_messages_daily_limit} hoy</span>
              </div>
              <div className="mt-3 space-y-1 text-[11px] text-ink-dim">
                <div>Warmup: etapa {sender.warmup_stage} · nuevos {sender.new_leads_today}/{sender.new_leads_daily_limit}</div>
                <div>OAuth: {initialData.oauthConfigured[sender.email] ? "configurado" : "faltante"}</div>
                <div>Watch: {watch?.expiration ? `vence ${new Date(watch.expiration).toLocaleString("es-CL")}` : "sin configurar"}</div>
                {sender.last_error && <div className="text-red-300">Error: {sender.last_error}</div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Barra de Pestañas */}
      <div className="flex border-b border-line">
        <button
          onClick={() => setTab("cola")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 font-sans text-sm font-medium transition ${
            tab === "cola" ? "border-brand text-ink" : "border-transparent text-ink-dim hover:text-ink"
          }`}
        >
          Cola Outbox
          {pendientesCount > 0 && (
            <span className="rounded-full bg-brand/20 px-2 py-0.5 font-mono text-[10px] text-brand">
              {pendientesCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("prospectos")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 font-sans text-sm font-medium transition ${
            tab === "prospectos" ? "border-brand text-ink" : "border-transparent text-ink-dim hover:text-ink"
          }`}
        >
          Prospectos & Contactos ({initialData.contacts.length})
        </button>
        <button
          onClick={() => setTab("respuestas")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 font-sans text-sm font-medium transition ${
            tab === "respuestas" ? "border-brand text-ink" : "border-transparent text-ink-dim hover:text-ink"
          }`}
        >
          Respuestas ({initialData.replies.length})
        </button>
        <button
          onClick={() => setTab("senders")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 font-sans text-sm font-medium transition ${
            tab === "senders" ? "border-brand text-ink" : "border-transparent text-ink-dim hover:text-ink"
          }`}
        >
          Senders & Dominio
        </button>
        <button
          onClick={() => setTab("supresiones")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 font-sans text-sm font-medium transition ${
            tab === "supresiones" ? "border-brand text-ink" : "border-transparent text-ink-dim hover:text-ink"
          }`}
        >
          Supresiones Globales ({initialData.suppressions.length})
        </button>
      </div>

      {/* PESTAÑA 1: COLA OUTBOX */}
      {tab === "cola" && (
        <div className="flex flex-col gap-4">
          {/* Sub-filtros y acción masiva */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-mono text-xs">
              <button
                onClick={() => setFiltroEstado("pending_review")}
                className={`rounded px-2.5 py-1 ${
                  filtroEstado === "pending_review" ? "bg-surface-3 text-ink font-semibold" : "text-ink-dim"
                }`}
              >
                Por Revisar ({pendientesCount})
              </button>
              <button
                onClick={() => setFiltroEstado("approved")}
                className={`rounded px-2.5 py-1 ${
                  filtroEstado === "approved" ? "bg-surface-3 text-ink font-semibold" : "text-ink-dim"
                }`}
              >
                Aprobados ({outboxItems.filter((i) => i.estado === "approved").length})
              </button>
              <button
                onClick={() => setFiltroEstado("scheduled")}
                className={`rounded px-2.5 py-1 ${
                  filtroEstado === "scheduled" ? "bg-surface-3 text-ink font-semibold" : "text-ink-dim"
                }`}
              >
                Programados ({outboxItems.filter((i) => i.estado === "scheduled").length})
              </button>
              <button
                onClick={() => setFiltroEstado("sent")}
                className={`rounded px-2.5 py-1 ${
                  filtroEstado === "sent" ? "bg-surface-3 text-ink font-semibold" : "text-ink-dim"
                }`}
              >
                Enviados ({enviadosCount})
              </button>
              <button
                onClick={() => setFiltroEstado("todos")}
                className={`rounded px-2.5 py-1 ${
                  filtroEstado === "todos" ? "bg-surface-3 text-ink font-semibold" : "text-ink-dim"
                }`}
              >
                Todos ({outboxItems.length})
              </button>
            </div>

            {filtroEstado === "pending_review" && pendientesCount > 0 && (
              <button
                onClick={handleAprobarTodos}
                disabled={cargandoAccion}
                className="rounded-lg bg-brand px-3 py-1.5 font-sans text-xs font-medium text-white transition hover:bg-brand/90"
              >
                Aprobar Todo el Lote ({pendientesCount})
              </button>
            )}
          </div>

          {/* Tabla de Outbox */}
          <div className="overflow-hidden rounded-xl border border-line bg-surface-1">
            <table className="w-full text-left font-sans text-xs">
              <thead className="border-b border-line bg-surface-2 font-mono text-[11px] uppercase tracking-wider text-ink-dim">
                <tr>
                  <th className="px-4 py-3">Empresa / Contacto</th>
                  <th className="px-4 py-3">Paso</th>
                  <th className="px-4 py-3">Asunto</th>
                  <th className="px-4 py-3">Programado Para</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {itemsFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-ink-dim">
                      No hay mensajes en este estado.
                    </td>
                  </tr>
                ) : (
                  itemsFiltrados.map((item) => {
                    const company = initialData.companies.find((c) => c.id === item.company_id);
                    const contact = initialData.contacts.find((c) => c.id === item.contact_id);

                    return (
                      <tr key={item.id} className="hover:bg-surface-2/60 transition">
                        <td className="px-4 py-3">
                          <div className="font-medium text-ink">{company?.nombre ?? "Empresa"}</div>
                          <div className="font-mono text-[11px] text-ink-dim">
                            {contact?.nombre} ({contact?.email_normalizado})
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-ink-dim">
                          Paso {item.step_number}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setItemSeleccionado(item)}
                            className="text-left font-medium text-brand hover:underline"
                          >
                            {item.subject}
                          </button>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-ink-dim">
                          {new Date(item.scheduled_for).toLocaleDateString("es-CL", {
                            timeZone: "America/Santiago",
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block rounded px-2 py-0.5 font-mono text-[10px] uppercase ${
                              item.estado === "sent"
                                ? "bg-emerald-500/10 text-emerald-400"
                                : item.estado === "pending_review"
                                ? "bg-amber-500/10 text-amber-300"
                                : item.estado === "cancelled" || item.estado === "blocked"
                                ? "bg-red-500/10 text-red-400"
                                : "bg-surface-3 text-ink-dim"
                            }`}
                          >
                            {item.estado}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {item.estado === "pending_review" ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleAprobar(item.id)}
                                disabled={cargandoAccion}
                                className="rounded bg-emerald-600/20 px-2 py-1 font-mono text-[11px] text-emerald-300 hover:bg-emerald-600/30"
                              >
                                Aprobar
                              </button>
                              <button
                                onClick={() => handleRechazar(item.id)}
                                disabled={cargandoAccion}
                                className="rounded bg-red-600/20 px-2 py-1 font-mono text-[11px] text-red-300 hover:bg-red-600/30"
                              >
                                Rechazar
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setItemSeleccionado(item)}
                              className="font-mono text-[11px] text-ink-dim hover:text-ink"
                            >
                              Ver Detalle
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Modal / Vista de Detalle de Correo & Evidencia */}
          {itemSeleccionado && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-line bg-surface-1 shadow-2xl">
                <div className="flex items-center justify-between border-b border-line p-4">
                  <div>
                    <h3 className="font-display text-base font-semibold text-ink">Borrador de Outbox</h3>
                    <p className="font-mono text-[11px] text-ink-dim">ID: {itemSeleccionado.id}</p>
                  </div>
                  <button
                    onClick={() => setItemSeleccionado(null)}
                    className="rounded p-1 text-ink-dim hover:text-ink"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  <div>
                    <label className="font-mono text-[11px] uppercase tracking-wider text-ink-dim">Asunto</label>
                    <div className="mt-1 font-mono text-sm font-medium text-ink bg-surface-2 p-2 rounded-lg border border-line">
                      {itemSeleccionado.subject}
                    </div>
                  </div>

                  <div>
                    <label className="font-mono text-[11px] uppercase tracking-wider text-ink-dim">Cuerpo del Mensaje (Texto Plano)</label>
                    <pre className="mt-1 whitespace-pre-wrap font-sans text-xs text-ink bg-surface-2 p-3 rounded-lg border border-line leading-relaxed">
                      {itemSeleccionado.body_text}
                    </pre>
                  </div>

                  {itemSeleccionado.evidence_used && itemSeleccionado.evidence_used.length > 0 && (
                    <div className="rounded-xl border border-brand/20 bg-brand/5 p-3">
                      <div className="font-mono text-[11px] uppercase tracking-wider text-brand font-semibold">
                        Evidencia Observable Utilizada
                      </div>
                      <div className="mt-2 space-y-2 text-xs">
                        {itemSeleccionado.evidence_used.map((ev, idx) => (
                          <div key={idx} className="border-l-2 border-brand pl-2 text-ink-dim">
                            <span className="font-medium text-ink">{ev.insight}</span>
                            <div className="text-[11px] text-brand/80">Fuente: {ev.fuente_url}</div>
                            <div className="italic text-[11px]">"{ev.extracto}"</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-line p-4">
                  <button
                    onClick={() => setItemSeleccionado(null)}
                    className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink-dim hover:text-ink"
                  >
                    Cerrar
                  </button>
                  {itemSeleccionado.estado === "pending_review" && (
                    <>
                      <button
                        onClick={() => {
                          handleRechazar(itemSeleccionado.id);
                        }}
                        className="rounded-lg bg-red-600/20 px-3 py-1.5 text-xs text-red-300 hover:bg-red-600/30"
                      >
                        Rechazar
                      </button>
                      <button
                        onClick={() => {
                          handleAprobar(itemSeleccionado.id);
                        }}
                        className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand/90"
                      >
                        Aprobar para Envío
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA 2: PROSPECTOS & CONTACTOS */}
      {tab === "prospectos" && (
        <div className="overflow-hidden rounded-xl border border-line bg-surface-1">
          <table className="w-full text-left font-sans text-xs">
            <thead className="border-b border-line bg-surface-2 font-mono text-[11px] uppercase tracking-wider text-ink-dim">
              <tr>
                <th className="px-4 py-3">Empresa</th>
                <th className="px-4 py-3">Contacto</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Tipo Relación</th>
                <th className="px-4 py-3">Uso Copy Aprobado</th>
                <th className="px-4 py-3">Verificación</th>
                <th className="px-4 py-3">Secuencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {initialData.contacts.map((c) => {
                const comp = initialData.companies.find((comp) => comp.id === c.company_id);
                return (
                  <tr key={c.id} className="hover:bg-surface-2/60 transition">
                    <td className="px-4 py-3 font-medium text-ink">{comp?.nombre ?? "—"}</td>
                    <td className="px-4 py-3 text-ink">
                      {c.nombre} {c.apellido ?? ""}
                      {c.cargo && <span className="block text-[11px] text-ink-dim">{c.cargo}</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-ink-dim">{c.email_normalizado}</td>
                    <td className="px-4 py-3 font-mono text-[11px]">
                      <span
                        className={`rounded px-1.5 py-0.5 ${
                          c.tipo_relacion === "warm" ? "bg-amber-500/10 text-amber-300" : "bg-blue-500/10 text-blue-300"
                        }`}
                      >
                        {c.tipo_relacion.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px]">
                      {c.relationship_approved_for_copy ? (
                        <span className="text-emerald-400">SÍ (Autorizado)</span>
                      ) : (
                        <span className="text-ink-dim">NO (Tratar como cold)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px]">
                      <span
                        className={`rounded px-1.5 py-0.5 ${
                          c.verificacion_estado === "valid"
                            ? "text-emerald-400"
                            : c.verificacion_estado === "invalid"
                            ? "text-red-400"
                            : "text-ink-dim"
                        }`}
                      >
                        {c.verificacion_estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px]">
                      {c.secuencia_pausada ? (
                        <span className="text-red-400">Detenida ({c.secuencia_pausada_motivo})</span>
                      ) : c.hold_hasta ? (
                        <span className="text-amber-300">En Hold</span>
                      ) : (
                        <span className="text-emerald-400">Activa</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* PESTAÑA 3: RESPUESTAS */}
      {tab === "respuestas" && (
        <div className="overflow-hidden rounded-xl border border-line bg-surface-1">
          <table className="w-full text-left font-sans text-xs">
            <thead className="border-b border-line bg-surface-2 font-mono text-[11px] uppercase tracking-wider text-ink-dim">
              <tr>
                <th className="px-4 py-3">Remitente</th>
                <th className="px-4 py-3">Asunto</th>
                <th className="px-4 py-3">Clasificación IA</th>
                <th className="px-4 py-3">Extracto</th>
                <th className="px-4 py-3">Secuencia Detenida</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {initialData.replies.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-ink-dim">
                    Aún no se registran respuestas entrantes.
                  </td>
                </tr>
              ) : (
                initialData.replies.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-2/60 transition">
                    <td className="px-4 py-3 font-mono text-[11px] text-ink">{r.from_email}</td>
                    <td className="px-4 py-3 font-medium text-ink">{r.subject}</td>
                    <td className="px-4 py-3 font-mono text-[11px]">
                      <span
                        className={`rounded px-1.5 py-0.5 ${
                          r.clasificacion_ia === "positive"
                            ? "bg-emerald-500/10 text-emerald-400 font-semibold"
                            : r.clasificacion_ia === "opt_out"
                            ? "bg-red-500/10 text-red-400"
                            : "bg-surface-3 text-ink-dim"
                        }`}
                      >
                        {r.clasificacion_ia.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-dim max-w-xs truncate">{r.extracto}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-emerald-400">
                      {r.secuencia_detenida ? "✓ SÍ (Detenida)" : "No"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* PESTAÑA 4: SENDERS & DOMINIO */}
      {tab === "senders" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-line bg-surface-1 p-5">
            <h3 className="font-display text-base font-semibold text-ink">Diagnóstico DNS respon.do</h3>
            <p className="mt-1 text-xs text-ink-dim">
              Evaluación en vivo de los 4 pilares de autenticación. Requisito de entregabilidad estricto.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-line bg-surface-2 p-3">
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="text-ink">SPF</span>
                  <span className={initialData.dnsHealth?.spf.estado === "pass" ? "text-emerald-400" : "text-amber-400"}>
                    {initialData.dnsHealth?.spf.estado?.toUpperCase()}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-ink-dim">{initialData.dnsHealth?.spf.mensaje}</p>
              </div>

              <div className="rounded-lg border border-line bg-surface-2 p-3">
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="text-ink">DKIM</span>
                  <span className={initialData.dnsHealth?.dkim.estado === "pass" ? "text-emerald-400" : "text-amber-400"}>
                    {initialData.dnsHealth?.dkim.estado?.toUpperCase()}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-ink-dim">{initialData.dnsHealth?.dkim.mensaje}</p>
              </div>

              <div className="rounded-lg border border-line bg-surface-2 p-3">
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="text-ink">DMARC</span>
                  <span className={initialData.dnsHealth?.dmarc.estado === "pass" ? "text-emerald-400" : "text-amber-400"}>
                    {initialData.dnsHealth?.dmarc.estado?.toUpperCase()}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-ink-dim">{initialData.dnsHealth?.dmarc.mensaje}</p>
              </div>

              <div className="rounded-lg border border-line bg-surface-2 p-3">
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="text-ink">MX</span>
                  <span className={initialData.dnsHealth?.mx.estado === "pass" ? "text-emerald-400" : "text-amber-400"}>
                    {initialData.dnsHealth?.mx.estado?.toUpperCase()}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-ink-dim">{initialData.dnsHealth?.mx.mensaje}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-line bg-surface-1 p-5">
            <h3 className="font-display text-base font-semibold text-ink">Bandejas de Remitentes Configuradas</h3>
            <div className="mt-4 divide-y divide-line">
              {initialData.senders.map((s) => (
                <div key={s.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-medium text-ink">{s.name}</div>
                    <div className="font-mono text-[11px] text-ink-dim">{s.email}</div>
                  </div>
                  <div className="flex items-center gap-6 font-mono text-[11px]">
                    <div>
                      <span className="text-ink-dim">Tipo: </span>
                      <span className="text-ink font-semibold">{s.type}</span>
                    </div>
                    <div>
                      <span className="text-ink-dim">Cold enabled: </span>
                      <span className={s.cold_outreach_enabled ? "text-emerald-400" : "text-red-400"}>
                        {s.cold_outreach_enabled ? "SÍ" : "NO"}
                      </span>
                    </div>
                    <div>
                      <span className="text-ink-dim">Límites: </span>
                      <span className="text-ink">
                        {s.sent_today} / {s.total_messages_daily_limit} (nuevos: {s.new_leads_today}/{s.new_leads_daily_limit})
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA 5: SUPRESIONES */}
      {tab === "supresiones" && (
        <div className="overflow-hidden rounded-xl border border-line bg-surface-1">
          <table className="w-full text-left font-sans text-xs">
            <thead className="border-b border-line bg-surface-2 font-mono text-[11px] uppercase tracking-wider text-ink-dim">
              <tr>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Valor Suprimido</th>
                <th className="px-4 py-3">Motivo</th>
                <th className="px-4 py-3">Origen</th>
                <th className="px-4 py-3">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {initialData.suppressions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-ink-dim">
                    No hay registros en la lista de supresión.
                  </td>
                </tr>
              ) : (
                initialData.suppressions.map((sup) => (
                  <tr key={sup.id} className="hover:bg-surface-2/60 transition">
                    <td className="px-4 py-3 font-mono text-[11px] uppercase text-ink-dim">{sup.tipo}</td>
                    <td className="px-4 py-3 font-mono text-[11px] font-medium text-red-300">{sup.valor}</td>
                    <td className="px-4 py-3 font-mono text-[11px]">{sup.motivo}</td>
                    <td className="px-4 py-3 text-ink-dim">{sup.origen}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-ink-dim">
                      {new Date(sup.created_at).toLocaleDateString("es-CL")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
