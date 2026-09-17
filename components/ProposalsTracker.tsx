"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { clp, fechaCorta } from "@/lib/format";
import { HqProposal, HqDeal, ProposalStatus } from "@/lib/revenue/types";
import { Plan, PLAN_LABEL, PLAN_PRECIOS } from "@/lib/types";
import { createProposalAction, updateProposalAction } from "@/app/actions/revenue";

interface ProposalsTrackerProps {
  initialProposals: HqProposal[];
  deals?: HqDeal[];
}

export default function ProposalsTracker({
  initialProposals,
  deals = [],
}: ProposalsTrackerProps) {
  const [proposals, setProposals] = useState<HqProposal[]>(initialProposals);
  const [showModal, setShowModal] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<HqProposal | null>(null);

  // Estados de mutación
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Formulario nueva propuesta
  const [selectedDealId, setSelectedDealId] = useState(deals[0]?.id || "");
  const [companyName, setCompanyName] = useState(deals[0]?.company_name || "");
  const [plan, setPlan] = useState<Plan>("inicial");
  const [reviewDate, setReviewDate] = useState(
    new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10)
  );
  const [decisionDate, setDecisionDate] = useState(
    new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10)
  );

  const handleSelectDeal = (dealId: string) => {
    setSelectedDealId(dealId);
    const found = deals.find((d) => d.id === dealId);
    if (found) {
      setCompanyName(found.company_name);
      if (found.plan) setPlan(found.plan);
    }
  };

  const handleCreateProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDealId || !companyName.trim()) {
      setActionError("Debe seleccionar una oportunidad comercial válida.");
      return;
    }

    setActionLoading(true);
    setActionError(null);

    const netPrice = PLAN_PRECIOS[plan].mensual;

    const res = await createProposalAction({
      deal_id: selectedDealId,
      company_name: companyName,
      version: 1,
      plan: plan,
      valor_mensual_neto: netPrice,
      valor_setup_neto: 0,
      condiciones_prueba: "14 días de prueba gratis. Sin contrato de permanencia.",
      alcance_resumen: "Tino, Beto y Vera con portal completo y hasta 1.200 conversaciones mensuales.",
      sent_at: new Date().toISOString(),
      review_date: reviewDate || null,
      decision_date: decisionDate || null,
      status: "enviada",
      notas: "Propuesta generada bajo estándar V2",
    });

    setActionLoading(false);

    if (res.success && res.data) {
      setProposals([res.data, ...proposals]);
      setShowModal(false);
      setActionSuccess("Propuesta registrada exitosamente en Supabase.");
      setTimeout(() => setActionSuccess(null), 3000);
    } else {
      setActionError(res.error || "Error al registrar la propuesta");
    }
  };

  const handleStatusChange = async (proposalId: string, newStatus: ProposalStatus) => {
    setActionLoading(true);
    setActionError(null);

    const res = await updateProposalAction(proposalId, { status: newStatus });
    setActionLoading(false);

    if (res.success && res.data) {
      setProposals((prev) =>
        prev.map((p) => (p.id === proposalId ? (res.data as HqProposal) : p))
      );
      if (selectedProposal?.id === proposalId) {
        setSelectedProposal(res.data);
      }
      setActionSuccess(`Estado de propuesta actualizado a '${newStatus}'`);
      setTimeout(() => setActionSuccess(null), 3000);
    } else {
      setActionError(res.error || "Error al actualizar estado de la propuesta");
    }
  };

  // Identificar propuestas sin fechas fijadas (Problema Aleta)
  const propuestasAlerta = proposals.filter(
    (p) =>
      (p.status === "enviada" || p.status === "en_revision") &&
      !p.review_date &&
      !p.decision_date
  );

  return (
    <div className="mx-auto max-w-7xl pb-16 space-y-6">
      <PageHeader
        title="Propuestas & Cierres"
        sub="Trazabilidad y Control Anti-Ghosting"
        right={
          <button
            onClick={() => {
              if (deals.length === 0) {
                setActionError("No hay oportunidades en el Pipeline para vincular una propuesta. Cree un Deal primero.");
                return;
              }
              setShowModal(true);
            }}
            className="btn-primary"
          >
            + Nueva Propuesta V2
          </button>
        }
      />

      {/* Banners de estado */}
      {actionError && (
        <div className="rounded-xl border border-danger/30 bg-danger/[0.04] p-3.5 text-xs text-danger flex items-center justify-between shadow-xs">
          <span><b>Error:</b> {actionError}</span>
          <button onClick={() => setActionError(null)} className="font-bold text-danger hover:opacity-80">✕</button>
        </div>
      )}
      {actionSuccess && (
        <div className="rounded-xl border border-ok/30 bg-ok/[0.04] p-3.5 text-xs text-ok flex items-center justify-between shadow-xs">
          <span>✓ {actionSuccess}</span>
          <button onClick={() => setActionSuccess(null)} className="font-bold text-ok hover:opacity-80">✕</button>
        </div>
      )}
      {actionLoading && (
        <div className="rounded-xl border border-accent/20 bg-accent/[0.03] p-2.5 text-xs text-accent flex items-center gap-2 animate-pulse shadow-xs">
          <span className="h-2 w-2 rounded-full bg-accent animate-ping" />
          Sincronizando con base de datos...
        </div>
      )}

      {/* Alerta Síndrome Aleta */}
      {propuestasAlerta.length > 0 && (
        <div className="rounded-xl border border-warn/30 bg-warn/[0.04] p-4 text-xs shadow-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-warn">
            <span className="h-2 w-2 rounded-full bg-warn animate-pulse" />
            <span>Alerta Anti-Ghosting: Propuestas sin Fechas de Control ({propuestasAlerta.length})</span>
          </div>
          <p className="text-ink-mut text-[11.5px]">
            Las siguientes propuestas fueron enviadas sin fecha de revisión o decisión comprometida. Requieren fijar reunión de dudas para evitar estancamiento:
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {propuestasAlerta.map((p) => (
              <span
                key={p.id}
                onClick={() => setSelectedProposal(p)}
                className="cursor-pointer rounded-lg border border-warn/40 bg-white px-2.5 py-1 font-mono text-[11px] text-ink hover:border-warn hover:bg-warn/[0.05] transition-all shadow-2xs"
              >
                {p.company_name} ({clp(p.valor_mensual_neto)}) →
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Lista de propuestas */}
      {proposals.length === 0 ? (
        <div className="panel border-dashed p-10 text-center text-xs text-ink-dim shadow-xs">
          No hay propuestas enviadas registradas. Cree una nueva para vincularla a un deal en pipeline.
        </div>
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {proposals.map((p) => {
            const statusStyle =
              p.status === "aceptada"
                ? "bg-ok/10 text-ok border-ok/20"
                : p.status === "rechazada"
                ? "bg-danger/10 text-danger border-danger/20"
                : p.status === "en_revision"
                ? "bg-brand/10 text-brand border-brand/20"
                : "bg-accent/10 text-accent border-accent/20";

            return (
              <div
                key={p.id}
                onClick={() => setSelectedProposal(p)}
                className="cursor-pointer panel p-4 shadow-card hover:border-brand/40 hover:shadow-raise transition-all space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-sm text-ink truncate">{p.company_name}</h3>
                  <span className="font-mono text-xs font-bold text-ink shrink-0">
                    {clp(p.valor_mensual_neto)} <span className="text-[9.5px] font-normal text-ink-dim">+IVA</span>
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-ink-mut border-t border-line/60 pt-2 font-mono">
                  <div className="flex justify-between">
                    <span className="text-[11px] font-sans">Plan:</span>
                    <span className="font-medium text-ink">{PLAN_LABEL[p.plan] || p.plan}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[11px] font-sans">Revisión de Dudas:</span>
                    <span className="text-ink-soft font-semibold">
                      {p.review_date ? fechaCorta(p.review_date) : "Sin fecha"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[11px] font-sans">Límite Decisión:</span>
                    <span className="text-accent font-bold">
                      {p.decision_date ? fechaCorta(p.decision_date) : "Sin fecha"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] border-t border-line/40 pt-2">
                  <span className={`rounded-md px-2 py-0.5 font-semibold text-[10px] border capitalize ${statusStyle}`}>
                    {p.status}
                  </span>
                  <span className="text-ink-dim font-mono text-[10.5px]">v{p.version}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DRAWER DETALLE DE PROPUESTA */}
      {selectedProposal && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-2xs">
          <div className="w-full max-w-lg bg-white border-l border-line p-6 shadow-pop overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div>
                <h3 className="font-bold text-base text-ink">{selectedProposal.company_name}</h3>
                <span className="text-xs font-mono text-ink-dim">
                  Propuesta Comercial v{selectedProposal.version} · {clp(selectedProposal.valor_mensual_neto)} + IVA
                </span>
              </div>
              <button
                onClick={() => setSelectedProposal(null)}
                className="rounded-md p-1.5 text-ink-dim hover:bg-surface-3 hover:text-ink text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="panel p-3.5 bg-surface-3/50 border border-line">
                <p className="lbl">Actualizar Estado de la Propuesta:</p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {(["enviada", "en_revision", "aceptada", "rechazada", "sin_decision"] as ProposalStatus[]).map((st) => (
                    <button
                      key={st}
                      disabled={actionLoading}
                      onClick={() => handleStatusChange(selectedProposal.id, st)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-all ${
                        selectedProposal.status === st
                          ? "bg-brand text-white shadow-xs font-semibold"
                          : "border border-line bg-white text-ink-dim hover:bg-surface-3 hover:text-ink"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <h4 className="lbl">Alcance y Condiciones</h4>
                <p className="text-ink leading-relaxed">{selectedProposal.alcance_resumen}</p>
                <p className="text-ink-dim text-[11px] mt-1">{selectedProposal.condiciones_prueba}</p>
              </div>

              <div className="rounded-lg border border-brand/20 bg-brand/[0.03] p-3.5 text-xs space-y-1.5 font-mono">
                <strong className="lbl text-brand">Fechas Críticas de Control:</strong>
                <p className="text-ink-dim">
                  Reunión de Dudas: <b className="text-ink">{selectedProposal.review_date ? fechaCorta(selectedProposal.review_date) : "Sin fecha"}</b>
                </p>
                <p className="text-ink-dim">
                  Fecha Fatal Decisión: <b className="text-brand">{selectedProposal.decision_date ? fechaCorta(selectedProposal.decision_date) : "Sin fecha"}</b>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVA PROPUESTA */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md panel p-6 shadow-pop text-xs space-y-3.5">
            <h3 className="text-sm font-bold text-ink">Registrar Nueva Propuesta V2</h3>
            <p className="text-xs text-ink-mut">
              Asegura fechas fijas de revisión y decisión vinculadas a la oportunidad.
            </p>

            <form onSubmit={handleCreateProposal} className="space-y-3.5">
              <div>
                <label className="block text-ink-mut mb-1 font-medium">Oportunidad / Deal Vinculado *</label>
                <select
                  value={selectedDealId}
                  onChange={(e) => handleSelectDeal(e.target.value)}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-xs text-ink font-medium focus:border-brand"
                >
                  {deals.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.company_name} ({d.industry})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-ink-mut mb-1 font-medium">Empresa *</label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-ink-mut mb-1 font-medium">Plan Comercial *</label>
                <select
                  value={plan}
                  onChange={(e) => setPlan(e.target.value as any)}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-xs text-ink focus:border-brand"
                >
                  <option value="inicial">Plan Inicial ($149.990 + IVA / mes)</option>
                  <option value="crecimiento">Plan Crecimiento ($269.990 + IVA / mes)</option>
                  <option value="empresa">Plan Empresa ($449.990 + IVA / mes)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-ink-mut mb-1 font-medium">Revisión de Dudas</label>
                  <input
                    type="date"
                    value={reviewDate}
                    onChange={(e) => setReviewDate(e.target.value)}
                    className="input font-mono"
                  />
                </div>
                <div>
                  <label className="block text-ink-mut mb-1 font-medium">Fecha Decisión *</label>
                  <input
                    type="date"
                    required
                    value={decisionDate}
                    onChange={(e) => setDecisionDate(e.target.value)}
                    className="input font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-ghost"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn-primary"
                >
                  Registrar Propuesta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
