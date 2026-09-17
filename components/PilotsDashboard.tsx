"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { fechaCorta } from "@/lib/format";
import { HqPilot, HqDeal, PilotStatus } from "@/lib/revenue/types";
import { createPilotAction, updatePilotAction } from "@/app/actions/revenue";

interface PilotsDashboardProps {
  initialPilots: HqPilot[];
  deals?: HqDeal[];
}

export default function PilotsDashboard({
  initialPilots,
  deals = [],
}: PilotsDashboardProps) {
  const [pilots, setPilots] = useState<HqPilot[]>(initialPilots);
  const [selectedPilot, setSelectedPilot] = useState<HqPilot | null>(null);
  const [showNewPilotModal, setShowNewPilotModal] = useState(false);

  // Estados de mutación
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Formulario nuevo piloto
  const [selectedDealId, setSelectedDealId] = useState(deals[0]?.id || "");
  const [companyName, setCompanyName] = useState(deals[0]?.company_name || "");
  const [hipotesis, setHipotesis] = useState(
    "Tino responde al instante y Beto reactiva cotizaciones huérfanas"
  );
  const [kpiPrimario, setKpiPrimario] = useState(
    "Tiempo de respuesta < 60 segundos y ≥ 80% resuelto sin derivar"
  );
  const [reviewDate, setReviewDate] = useState(
    new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
  );

  const handleSelectDeal = (dealId: string) => {
    setSelectedDealId(dealId);
    const found = deals.find((d) => d.id === dealId);
    if (found) {
      setCompanyName(found.company_name);
    }
  };

  const handleCreatePilot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDealId || !companyName.trim() || !reviewDate) {
      setActionError("Debe seleccionar una oportunidad válida y fijar la fecha de reunión del Día 14.");
      return;
    }

    setActionLoading(true);
    setActionError(null);

    const startDate = new Date().toISOString().slice(0, 10);
    const endDate = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

    const res = await createPilotAction({
      deal_id: selectedDealId,
      company_name: companyName,
      status: "activo",
      start_date: startDate,
      end_date: endDate,
      review_date: reviewDate,
      hipotesis: hipotesis,
      metricas_base: "Atención manual por vendedores en horario hábil; sin atención nocturna",
      resuelve_vs_deriva: {
        catalogo_precios_base: "resuelve",
        disponibilidad_stock: "deriva",
        agendamiento_horas: "resuelve",
        cotizaciones_especiales: "deriva",
        pedidos_despacho: "resuelve",
        reclamos_postventa: "deriva",
        umbral_monto_derivacion_clp: 300000,
        palabras_clave_escalacion: ["reclamo", "urgente", "abogado", "sernac"],
      },
      kpi_primario: kpiPrimario,
      kpis_secundarios: "Horas agendadas y encuestas de satisfacción",
      meta_kpi: "≥ 80% atendido de forma autónoma",
      criterio_exito: "Día 14 se decide con números objetivos",
      decision_si_exito: "Contratación de Plan Inicial $149.990 netos",
      casos_totales_atendidos: 0,
      casos_derivados_humano: 0,
      seguimientos_beto_enviados: 0,
      seguimientos_beto_respuestas: 0,
    });

    setActionLoading(false);

    if (res.success && res.data) {
      setPilots([res.data, ...pilots]);
      setShowNewPilotModal(false);
      setActionSuccess("Piloto activado y persistido en Supabase con fecha firme Día 14.");
      setTimeout(() => setActionSuccess(null), 3000);
    } else {
      setActionError(res.error || "Error al crear el piloto");
    }
  };

  const handleStatusChange = async (pilotId: string, newStatus: PilotStatus) => {
    setActionLoading(true);
    setActionError(null);
    const res = await updatePilotAction(pilotId, { status: newStatus });
    setActionLoading(false);

    if (res.success && res.data) {
      setPilots((prev) =>
        prev.map((p) => (p.id === pilotId ? (res.data as HqPilot) : p))
      );
      if (selectedPilot?.id === pilotId) {
        setSelectedPilot(res.data);
      }
      setActionSuccess(`Estado de piloto actualizado a '${newStatus}'`);
      setTimeout(() => setActionSuccess(null), 3000);
    } else {
      setActionError(res.error || "Error al actualizar estado del piloto");
    }
  };

  const pilotosActivos = pilots.filter(
    (p) => p.status === "activo" || p.status === "revision_pendiente"
  );
  const pilotosHistoricos = pilots.filter(
    (p) => p.status !== "activo" && p.status !== "revision_pendiente"
  );

  return (
    <div className="mx-auto max-w-7xl pb-16 space-y-6">
      <PageHeader
        title="Pilotos de 14 Días"
        sub="Success Plan & Medición de Resultados"
        right={
          <button
            onClick={() => {
              if (deals.length === 0) {
                setActionError("No hay oportunidades en el Pipeline para vincular un piloto. Cree un Deal primero.");
                return;
              }
              setShowNewPilotModal(true);
            }}
            className="btn-primary"
          >
            + Nuevo Piloto de 14 Días
          </button>
        }
      />

      {/* Banners de Feedback */}
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

      {/* Sección 1: Pilotos Activos en Curso */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-warn animate-pulse" />
            <h2 className="text-sm font-bold text-ink">Pilotos Activos en Marcha ({pilotosActivos.length})</h2>
          </div>
          <span className="lbl text-ink-dim">Checkpoint Día 14 Firme</span>
        </div>

        {pilotosActivos.length === 0 ? (
          <div className="panel border-dashed p-8 text-center text-xs text-ink-dim shadow-xs">
            No hay pilotos en ejecución en este momento. Active uno nuevo desde una oportunidad calificada.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pilotosActivos.map((p) => {
              const diasRestantes = p.end_date
                ? Math.ceil((new Date(p.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                : 0;

              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPilot(p)}
                  className="cursor-pointer panel p-4 shadow-card hover:border-brand/40 hover:shadow-raise transition-all space-y-3 border-l-3 border-l-warn"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-ink truncate">{p.company_name}</h3>
                    <span className="rounded-md bg-warn/15 px-2 py-0.5 text-[10px] font-mono font-bold text-warn border border-warn/25 capitalize">
                      {p.status}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-ink-mut border-t border-line/60 pt-2 font-mono">
                    <div className="flex justify-between">
                      <span className="text-[11px] font-sans">Días restantes:</span>
                      <span className="font-bold text-ink">{diasRestantes > 0 ? `${diasRestantes}d` : "Vencido"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[11px] font-sans">Reunión Día 14:</span>
                      <span className="text-[11px] text-brand font-bold">
                        {p.review_date ? fechaCorta(p.review_date) : "Sin fecha pactada"}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-lg bg-surface-3 p-2.5 text-[11px] text-ink-soft border border-line/60">
                    <span className="lbl text-ink block mb-0.5">KPI Primario:</span>
                    <span className="text-ink-mut leading-snug">{p.kpi_primario}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sección 2: Historial de Pilotos (Cerrados / Concluidos) */}
      {pilotosHistoricos.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-line">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-ink">Historial de Pilotos Concluidos ({pilotosHistoricos.length})</h2>
            <span className="lbl text-ink-dim">Resultados Previos</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pilotosHistoricos.map((p) => (
              <div
                key={p.id}
                onClick={() => setSelectedPilot(p)}
                className="cursor-pointer panel p-3.5 shadow-xs hover:border-line2 transition-all space-y-2 bg-surface-3/30"
              >
                <div className="flex items-center justify-between text-xs">
                  <h3 className="font-bold text-ink truncate">{p.company_name}</h3>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-mono font-medium capitalize ${
                    p.status === "exitoso"
                      ? "bg-ok/10 text-ok"
                      : "bg-ink-faint/10 text-ink-mut"
                  }`}>
                    {p.status}
                  </span>
                </div>
                <p className="text-[11px] text-ink-dim truncate">
                  KPI: {p.kpi_primario}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DRAWER DETALLE DE PILOTO */}
      {selectedPilot && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-2xs">
          <div className="w-full max-w-lg bg-white border-l border-line p-6 shadow-pop overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div>
                <h3 className="font-bold text-base text-ink">{selectedPilot.company_name}</h3>
                <span className="text-xs font-mono text-ink-dim">
                  Piloto 14 Días · Estado: {selectedPilot.status}
                </span>
              </div>
              <button
                onClick={() => setSelectedPilot(null)}
                className="rounded-md p-1.5 text-ink-dim hover:bg-surface-3 hover:text-ink text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="panel p-3.5 bg-surface-3/50 border border-line">
                <p className="lbl">Actualizar Estado del Piloto:</p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {(["activo", "revision_pendiente", "exitoso", "fallido", "cancelado"] as PilotStatus[]).map((st) => (
                    <button
                      key={st}
                      disabled={actionLoading}
                      onClick={() => handleStatusChange(selectedPilot.id, st)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-all ${
                        selectedPilot.status === st
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
                <h4 className="lbl">Hipótesis Operativa</h4>
                <p className="text-ink leading-relaxed">{selectedPilot.hipotesis}</p>
              </div>

              <div className="rounded-lg border border-brand/20 bg-brand/[0.03] p-3.5 text-xs space-y-1.5">
                <strong className="lbl text-brand">Criterio de Cierre del Día 14:</strong>
                <p className="text-ink-mut leading-relaxed">
                  «El día 14 se decide con números, no con impresiones.» Si el asistente resolvió al menos el 80% de las consultas y redujo el tiempo de espera a menos de 2 minutos, se suscribe el Plan Inicial sin costo de instalación.
                </p>
                <p className="mt-2 font-mono text-[11px] text-brand font-medium">
                  Fecha fijada: {selectedPilot.review_date ? fechaCorta(selectedPilot.review_date) : "Sin fecha"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVO PILOTO */}
      {showNewPilotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md panel p-6 shadow-pop text-xs space-y-3.5">
            <h3 className="text-sm font-bold text-ink">Activar Nuevo Piloto de 14 Días</h3>
            <p className="text-xs text-ink-mut">
              Configura el Success Plan con fecha firme de reunión para el Día 14 vinculada al Deal.
            </p>

            <form onSubmit={handleCreatePilot} className="space-y-3.5">
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
                <label className="block text-ink-mut mb-1 font-medium">Empresa del Piloto *</label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Ej: RS-Shop Chillán"
                  className="input"
                />
              </div>

              <div>
                <label className="block text-ink-mut mb-1 font-medium">Hipótesis a Validar</label>
                <input
                  type="text"
                  value={hipotesis}
                  onChange={(e) => setHipotesis(e.target.value)}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-ink-mut mb-1 font-medium">Fecha de Reunión Día 14 *</label>
                <input
                  type="date"
                  required
                  value={reviewDate}
                  onChange={(e) => setReviewDate(e.target.value)}
                  className="input font-mono"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewPilotModal(false)}
                  className="btn-ghost"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn-primary"
                >
                  Iniciar Piloto en Base de Datos
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
