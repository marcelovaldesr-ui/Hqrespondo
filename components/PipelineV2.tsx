"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { clp, fechaCorta } from "@/lib/format";
import {
  HqDeal,
  REVENUE_STAGES,
  REVENUE_STAGE_CONFIG,
  RevenueStage,
  LOST_REASONS,
  LOST_REASON_LABEL,
  LostReason,
} from "@/lib/revenue/types";
import { PLAN_LABEL, PLAN_PRECIOS, Plan } from "@/lib/types";

import {
  createDealAction,
  updateDealStageAction,
  closeDealLostAction,
  closeDealWonAction,
  updateDealNextActionAction,
} from "@/app/actions/revenue";

interface PipelineV2Props {
  initialDeals: HqDeal[];
}

export default function PipelineV2({ initialDeals }: PipelineV2Props) {
  const [deals, setDeals] = useState<HqDeal[]>(initialDeals);
  const [search, setSearch] = useState("");
  const [filterStalled, setFilterStalled] = useState(false);
  const [selectedIndustry, setSelectedIndustry] = useState<string>("todos");
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");

  // Estados de mutación del servidor
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modal para nuevo Deal
  const [showModal, setShowModal] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<HqDeal | null>(null);

  // Formulario nuevo deal
  const [empresa, setEmpresa] = useState("");
  const [contacto, setContacto] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [industria, setIndustria] = useState("general");
  const [plan, setPlan] = useState<Plan>("inicial");
  const [etapa, setEtapa] = useState<RevenueStage>("nuevo");
  const [nextAction, setNextAction] = useState("Llamar para primer contacto");
  const [nextActionAt, setNextActionAt] = useState(
    new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  );

  // Modal de marcar como perdido
  const [lostModalDeal, setLostModalDeal] = useState<HqDeal | null>(null);
  const [lostReason, setLostReason] = useState<LostReason>("no_response");
  const [lostNotes, setLostNotes] = useState("");

  // Filtrado
  const filteredDeals = deals.filter((d) => {
    if (search && !d.company_name.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (filterStalled && !d.stalled) {
      return false;
    }
    if (selectedIndustry !== "todos" && d.industry !== selectedIndustry) {
      return false;
    }
    return true;
  });

  // Métricas de cabecera
  const activos = filteredDeals.filter(
    (d) => !["ganado", "perdido", "nurture"].includes(d.etapa)
  );
  const totalMrr = activos.reduce((acc, d) => acc + (d.valor_mensual_neto ?? 0), 0);
  const stalledCount = activos.filter((d) => d.stalled).length;

  const industrias = Array.from(new Set(deals.map((d) => d.industry || "general")));

  // Manejador de cambio rápido de etapa con Server Actions
  const handleStageChange = async (dealId: string, newStage: RevenueStage) => {
    setActionError(null);
    if (newStage === "perdido") {
      const target = deals.find((d) => d.id === dealId);
      if (target) setLostModalDeal(target);
      return;
    }

    setActionLoading(true);
    let res;
    if (newStage === "ganado") {
      res = await closeDealWonAction(dealId);
    } else {
      res = await updateDealStageAction(dealId, newStage);
    }
    setActionLoading(false);

    if (res.success && res.data) {
      const updatedDeal = res.data;
      setDeals((prev) => prev.map((d) => (d.id === dealId ? updatedDeal : d)));
      setActionSuccess(`Etapa actualizada a ${REVENUE_STAGE_CONFIG[newStage]?.label || newStage}`);
      setTimeout(() => setActionSuccess(null), 3000);
    } else {
      setActionError(res.error || "Error al actualizar la etapa del trato");
    }
  };

  const handleCreateDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresa.trim()) return;

    setActionLoading(true);
    setActionError(null);

    const valorMensual = PLAN_PRECIOS[plan].mensual;

    const res = await createDealAction({
      company_name: empresa,
      contact_name: contacto,
      contact_role: "Decisor",
      contact_phone: telefono,
      contact_email: email,
      contact_whatsapp: telefono,
      industry: industria,
      city: "Santiago",
      etapa: etapa,
      plan: plan,
      valor_mensual_neto: valorMensual,
      valor_setup_neto: 0,
      pain_primary: "Pérdida de cotizaciones por WhatsApp",
      use_case: "Atención comercial inteligente",
      competidor: "WhatsApp Business manual",
      next_action: nextAction,
      next_action_at: `${nextActionAt}T10:00:00Z`,
      next_action_owner: "Fundador",
      lost_reason: etapa === "perdido" ? "no_response" : null,
      lost_notes: null,
      won_notes: null,
    });

    setActionLoading(false);

    if (res.success && res.data) {
      setDeals([res.data, ...deals]);
      setShowModal(false);
      setEmpresa("");
      setContacto("");
      setTelefono("");
      setEmail("");
      setActionSuccess("Oportunidad creada exitosamente en Supabase.");
      setTimeout(() => setActionSuccess(null), 3000);
    } else {
      setActionError(res.error || "Error al crear el trato comercial");
    }
  };

  const handleConfirmLost = async () => {
    if (!lostModalDeal) return;
    setActionLoading(true);
    setActionError(null);

    const res = await closeDealLostAction(lostModalDeal.id, lostReason, lostNotes);
    setActionLoading(false);

    if (res.success && res.data) {
      const updatedDeal = res.data;
      setDeals((prev) => prev.map((d) => (d.id === lostModalDeal.id ? updatedDeal : d)));
      setLostModalDeal(null);
      setLostNotes("");
      setActionSuccess("Trato marcado como perdido con motivo estructurado registrado.");
      setTimeout(() => setActionSuccess(null), 3000);
    } else {
      setActionError(res.error || "Error al registrar la pérdida del trato");
    }
  };

  return (
    <div className="mx-auto max-w-7xl pb-16">
      <PageHeader
        title="Pipeline Comercial"
        sub="Revenue Operating System"
        right={
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1 rounded-lg border border-line bg-surface-3 p-1 text-xs">
              <button
                onClick={() => setViewMode("kanban")}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                  viewMode === "kanban" ? "bg-white text-ink shadow-card font-semibold" : "text-ink-mut hover:text-ink"
                }`}
              >
                Kanban
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                  viewMode === "table" ? "bg-white text-ink shadow-card font-semibold" : "text-ink-mut hover:text-ink"
                }`}
              >
                Tabla
              </button>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="btn-primary"
            >
              + Nueva Oportunidad
            </button>
          </div>
        }
      />

      {/* Banner de Feedback de Mutación en Servidor */}
      {actionError && (
        <div className="mb-4 rounded-xl border border-danger/30 bg-danger/[0.04] p-3.5 text-xs text-danger flex items-center justify-between shadow-xs">
          <span><b>Error en servidor:</b> {actionError}</span>
          <button onClick={() => setActionError(null)} className="font-bold text-danger hover:opacity-80">✕</button>
        </div>
      )}
      {actionSuccess && (
        <div className="mb-4 rounded-xl border border-ok/30 bg-ok/[0.04] p-3.5 text-xs text-ok flex items-center justify-between shadow-xs">
          <span>✓ {actionSuccess}</span>
          <button onClick={() => setActionSuccess(null)} className="font-bold text-ok hover:opacity-80">✕</button>
        </div>
      )}
      {actionLoading && (
        <div className="mb-4 rounded-xl border border-accent/20 bg-accent/[0.03] p-2.5 text-xs text-accent flex items-center gap-2 animate-pulse shadow-xs">
          <span className="h-2 w-2 rounded-full bg-accent animate-ping" />
          Sincronizando cambios con Supabase...
        </div>
      )}

      {/* Barra de Filtros y Resumen Operativo */}
      <div className="mb-5 panel p-3.5 shadow-card flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Buscar por empresa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input w-52 py-1.5"
          />

          <select
            value={selectedIndustry}
            onChange={(e) => setSelectedIndustry(e.target.value)}
            className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs text-ink focus:border-brand"
          >
            <option value="todos">Todos los rubros</option>
            {industrias.map((ind) => (
              <option key={ind} value={ind}>
                {ind}
              </option>
            ))}
          </select>

          <button
            onClick={() => setFilterStalled(!filterStalled)}
            className={`rounded-lg border px-3 py-1.5 font-medium transition-all ${
              filterStalled
                ? "border-danger/40 bg-danger/10 text-danger font-semibold"
                : "border-line bg-surface text-ink-mut hover:border-line2 hover:text-ink"
            }`}
          >
            Solo Estancados ({stalledCount})
          </button>
        </div>

        <div className="flex items-center gap-4 font-mono text-xs text-ink-dim">
          <span>
            Activos: <strong className="text-ink">{activos.length}</strong>
          </span>
          <span className="border-l border-line pl-3">
            MRR Activo: <strong className="text-ink">{clp(totalMrr)}</strong>
          </span>
        </div>
      </div>

      {/* VISTA KANBAN (Linear Style) */}
      {viewMode === "kanban" ? (
        <div className="flex gap-3.5 overflow-x-auto pb-4 pt-1">
          {REVENUE_STAGES.map((stage) => {
            const cfg = REVENUE_STAGE_CONFIG[stage];
            const dealsInStage = filteredDeals.filter((d) => d.etapa === stage);
            const stageMrr = dealsInStage.reduce((s, d) => s + (d.valor_mensual_neto ?? 0), 0);

            return (
              <div
                key={stage}
                className="w-72 shrink-0 rounded-xl border border-line bg-slate-100/60 p-3 flex flex-col max-h-[80vh] shadow-2xs"
              >
                {/* Cabecera de Columna */}
                <div className="mb-3 flex items-center justify-between border-b border-line pb-2.5 px-0.5">
                  <div>
                    <h3 className="font-bold text-xs text-ink">{cfg.label}</h3>
                    <p className="font-mono text-[10.5px] text-ink-faint">{clp(stageMrr)}</p>
                  </div>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-mono text-ink-dim border border-line shadow-2xs">
                    {dealsInStage.length}
                  </span>
                </div>

                {/* Tarjetas del Kanban */}
                <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
                  {dealsInStage.length === 0 ? (
                    <p className="py-8 text-center text-[11px] text-ink-faint">Sin oportunidades</p>
                  ) : (
                    dealsInStage.map((deal) => (
                      <div
                        key={deal.id}
                        onClick={() => setSelectedDeal(deal)}
                        className={`cursor-pointer rounded-lg border p-3.5 bg-white shadow-card hover:border-brand/40 hover:shadow-raise transition-all space-y-2 ${
                          deal.stalled
                            ? "border-danger/40 bg-danger/[0.015] hover:border-danger/60"
                            : "border-line"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-bold text-xs text-ink leading-snug">{deal.company_name}</p>
                          <span className="text-[11px] font-mono font-bold text-ink shrink-0">
                            {clp(deal.valor_mensual_neto)}
                          </span>
                        </div>

                        <p className="text-[11px] text-ink-mut truncate">
                          {deal.contact_name ? `${deal.contact_name} · ` : ""}
                          {deal.industry}
                        </p>

                        {/* Next Action y Alerta */}
                        <div className="pt-2 border-t border-line/60">
                          <p className="text-[11px] font-medium text-ink truncate">
                            👉 {deal.next_action || "Sin próxima acción"}
                          </p>
                          <div className="mt-1.5 flex items-center justify-between text-[10px]">
                            <span
                              className={`font-mono ${
                                deal.stalled ? "text-danger font-semibold" : "text-ink-faint"
                              }`}
                            >
                              {deal.next_action_at ? fechaCorta(deal.next_action_at) : "Vencida"}
                            </span>
                            {deal.stalled && (
                              <span className="rounded bg-danger/10 px-1.5 py-0.5 text-danger font-mono text-[9px] font-bold border border-danger/20">
                                STALLED
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Selector Rápido de Etapa */}
                        <div
                          className="flex items-center justify-between pt-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <select
                            value={deal.etapa}
                            onChange={(e) => handleStageChange(deal.id, e.target.value as RevenueStage)}
                            className="w-full rounded-md border border-line bg-surface-3 px-2 py-1 text-[10.5px] text-ink font-medium focus:border-brand"
                          >
                            {REVENUE_STAGES.map((s) => (
                              <option key={s} value={s}>
                                → {REVENUE_STAGE_CONFIG[s].label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* VISTA TABLA (Linear Style) */
        <div className="panel overflow-hidden shadow-card">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-line bg-surface-3 font-mono text-[10.5px] uppercase tracking-wider text-ink-dim">
              <tr>
                <th className="p-3 font-semibold">Empresa</th>
                <th className="p-3 font-semibold">Contacto</th>
                <th className="p-3 font-semibold">Rubro</th>
                <th className="p-3 font-semibold">Etapa</th>
                <th className="p-3 font-semibold">Plan / MRR</th>
                <th className="p-3 font-semibold">Próxima Acción</th>
                <th className="p-3 font-semibold">Fecha</th>
                <th className="p-3 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {filteredDeals.map((deal) => (
                <tr
                  key={deal.id}
                  onClick={() => setSelectedDeal(deal)}
                  className="cursor-pointer hover:bg-surface-3 transition-colors data-row"
                >
                  <td className="p-3 font-semibold text-ink">{deal.company_name}</td>
                  <td className="p-3 text-ink-mut">{deal.contact_name || "—"}</td>
                  <td className="p-3 text-ink-dim">{deal.industry}</td>
                  <td className="p-3">
                    <span className="rounded bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand">
                      {REVENUE_STAGE_CONFIG[deal.etapa]?.label || deal.etapa}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-ink">
                    <span className="text-ink-mut">{PLAN_LABEL[deal.plan]} ·</span> <strong>{clp(deal.valor_mensual_neto)}</strong>
                  </td>
                  <td className="p-3 text-ink truncate max-w-xs">{deal.next_action}</td>
                  <td className="p-3 font-mono text-ink-dim">
                    {deal.next_action_at ? fechaCorta(deal.next_action_at) : "—"}
                  </td>
                  <td className="p-3">
                    {deal.stalled ? (
                      <span className="rounded bg-danger/10 px-1.5 py-0.5 text-[9.5px] font-mono text-danger font-bold border border-danger/20">
                        ESTANCADO
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-mono text-ok">
                        <span className="h-1.5 w-1.5 rounded-full bg-ok" />
                        Activo
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL CREAR NUEVA OPORTUNIDAD */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md panel p-6 shadow-pop">
            <h3 className="text-sm font-bold text-ink">Nueva Oportunidad Comercial</h3>
            <p className="text-xs text-ink-mut mb-4">Ingresa los datos para iniciar seguimiento con Regla de Oro</p>

            <form onSubmit={handleCreateDeal} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-ink-mut mb-1 font-medium">Nombre de la Empresa *</label>
                <input
                  type="text"
                  required
                  value={empresa}
                  onChange={(e) => setEmpresa(e.target.value)}
                  className="input"
                  placeholder="Ej: Imprenta Los Andes"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-ink-mut mb-1 font-medium">Contacto / Decisor</label>
                  <input
                    type="text"
                    value={contacto}
                    onChange={(e) => setContacto(e.target.value)}
                    className="input"
                    placeholder="Ej: Cristián Muñoz"
                  />
                </div>
                <div>
                  <label className="block text-ink-mut mb-1 font-medium">Teléfono / WhatsApp</label>
                  <input
                    type="text"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    className="input font-mono"
                    placeholder="+569..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-ink-mut mb-1 font-medium">Rubro</label>
                  <input
                    type="text"
                    value={industria}
                    onChange={(e) => setIndustria(e.target.value)}
                    className="input"
                    placeholder="Ej: imprenta, dental, taller"
                  />
                </div>
                <div>
                  <label className="block text-ink-mut mb-1 font-medium">Plan Recomendado</label>
                  <select
                    value={plan}
                    onChange={(e) => setPlan(e.target.value as Plan)}
                    className="w-full rounded-lg border border-line bg-white px-3 py-2 text-xs text-ink"
                  >
                    <option value="inicial">Inicial ($149.990)</option>
                    <option value="crecimiento">Crecimiento ($269.990)</option>
                    <option value="empresa">Empresa ($449.990)</option>
                    <option value="tino_solo">Tino solo ($120.000)</option>
                  </select>
                </div>
              </div>

              <div className="rounded-lg border border-brand/20 bg-brand/[0.03] p-3 space-y-2">
                <p className="font-semibold text-brand text-[11px]">Next Action Mandatorio (Regla de Oro)</p>
                <div>
                  <label className="block text-ink-dim text-[10px]">¿Qué haremos exactamente?</label>
                  <input
                    type="text"
                    required
                    value={nextAction}
                    onChange={(e) => setNextAction(e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-ink-dim text-[10px]">Fecha comprometida</label>
                  <input
                    type="date"
                    required
                    value={nextActionAt}
                    onChange={(e) => setNextActionAt(e.target.value)}
                    className="input font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-ghost"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                >
                  Crear Oportunidad
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL REGISTRO DE TRATO PERDIDO */}
      {lostModalDeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md panel p-6 shadow-pop border-danger/30">
            <h3 className="text-sm font-bold text-danger">Marcar Oportunidad como Perdida</h3>
            <p className="text-xs text-ink-mut mb-3">
              Registra el motivo estructurado para alimentar el aprendizaje comercial de Respondo.
            </p>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-ink-mut mb-1 font-medium">Motivo Principal de Pérdida *</label>
                <select
                  value={lostReason}
                  onChange={(e) => setLostReason(e.target.value as LostReason)}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-xs text-ink"
                >
                  {LOST_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {LOST_REASON_LABEL[r]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-ink-mut mb-1 font-medium">Notas / Qué aprendimos de este caso</label>
                <textarea
                  rows={3}
                  value={lostNotes}
                  onChange={(e) => setLostNotes(e.target.value)}
                  placeholder="Detalles sobre por qué se cayó, qué competidor eligieron o qué objeción fue insalvable..."
                  className="input"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setLostModalDeal(null)}
                  className="btn-ghost"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmLost}
                  className="rounded-lg bg-danger px-3.5 py-2 text-xs font-semibold text-white hover:bg-danger/90 transition-all shadow-xs"
                >
                  Confirmar Pérdida
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DRAWER DETALLE DE OPORTUNIDAD */}
      {selectedDeal && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-2xs">
          <div className="w-full max-w-lg bg-white border-l border-line p-6 shadow-pop overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div>
                <h3 className="font-bold text-base text-ink">{selectedDeal.company_name}</h3>
                <span className="text-xs font-mono text-ink-dim">
                  {selectedDeal.industry} · {clp(selectedDeal.valor_mensual_neto)} + IVA
                </span>
              </div>
              <button
                onClick={() => setSelectedDeal(null)}
                className="rounded-md p-1.5 text-ink-dim hover:bg-surface-3 hover:text-ink text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="panel p-3.5 bg-surface-3/50 border border-line">
                <p className="lbl">Etapa Actual:</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="rounded bg-brand/10 px-2 py-0.5 font-medium text-brand">
                    {REVENUE_STAGE_CONFIG[selectedDeal.etapa]?.label || selectedDeal.etapa}
                  </span>
                  {selectedDeal.stalled && (
                    <span className="rounded bg-danger/10 px-2 py-0.5 font-mono text-danger font-bold border border-danger/20">
                      ESTANCADO
                    </span>
                  )}
                </div>
                {selectedDeal.stalled_reason && (
                  <p className="mt-2 text-danger font-medium">{selectedDeal.stalled_reason}</p>
                )}
              </div>

              <div className="space-y-1">
                <h4 className="lbl">Contacto del Decisor</h4>
                <p className="text-ink font-medium">
                  {selectedDeal.contact_name || "Nombre no registrado"} ({selectedDeal.contact_role || "Decisor"})
                </p>
                <p className="text-ink-dim font-mono">Teléfono: {selectedDeal.contact_phone || "—"}</p>
                <p className="text-ink-dim font-mono">Email: {selectedDeal.contact_email || "—"}</p>
              </div>

              <div className="space-y-1">
                <h4 className="lbl">Diagnóstico Comercial</h4>
                <p className="text-ink-mut">Dolor Principal: <strong className="text-ink">{selectedDeal.pain_primary || "No registrado"}</strong></p>
                <p className="text-ink-mut">Caso de Uso: <strong className="text-ink">{selectedDeal.use_case || "No registrado"}</strong></p>
                <p className="text-ink-mut">Competidor Presente: <strong className="text-ink">{selectedDeal.competidor || "Ninguno"}</strong></p>
              </div>

              <div className="rounded-lg border border-brand/20 bg-brand/[0.03] p-3.5">
                <h4 className="lbl text-brand">Próxima Acción Comprometida</h4>
                <p className="font-semibold text-ink mt-1">{selectedDeal.next_action}</p>
                <p className="mt-1 font-mono text-[11px] text-brand font-medium">
                  Fecha: {selectedDeal.next_action_at ? fechaCorta(selectedDeal.next_action_at) : "Vencida"}
                </p>
              </div>

              <div className="pt-4 border-t border-line flex gap-2.5">
                <button
                  onClick={() => {
                    const nextStageIdx = REVENUE_STAGES.indexOf(selectedDeal.etapa) + 1;
                    if (nextStageIdx < REVENUE_STAGES.length - 2) {
                      handleStageChange(selectedDeal.id, REVENUE_STAGES[nextStageIdx]);
                    }
                    setSelectedDeal(null);
                  }}
                  className="flex-1 btn-primary py-2.5"
                >
                  Avanzar Siguiente Etapa →
                </button>
                <button
                  onClick={() => {
                    setLostModalDeal(selectedDeal);
                    setSelectedDeal(null);
                  }}
                  className="rounded-lg border border-danger/30 text-danger px-3.5 py-2 text-xs font-semibold hover:bg-danger/10 transition-all"
                >
                  Marcar Perdido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
