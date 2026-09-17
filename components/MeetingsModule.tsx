"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { fechaCorta, hora } from "@/lib/format";
import { HqMeeting, HqDeal, MeetingType, MeetingStatus } from "@/lib/revenue/types";
import { createMeetingAction, updateMeetingAction } from "@/app/actions/revenue";

interface MeetingsModuleProps {
  initialMeetings: HqMeeting[];
  deals?: HqDeal[];
}

export default function MeetingsModule({
  initialMeetings,
  deals = [],
}: MeetingsModuleProps) {
  const [meetings, setMeetings] = useState<HqMeeting[]>(initialMeetings);
  const [showCaptureModal, setShowCaptureModal] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<HqMeeting | null>(null);
  const [activeTab, setActiveTab] = useState<"todas" | "discovery" | "demo">("todas");

  // Estados de mutación
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Campos para captura rápida de discovery (≤2 min)
  const [selectedDealId, setSelectedDealId] = useState<string>(deals[0]?.id || "");
  const [companyName, setCompanyName] = useState(deals[0]?.company_name || "");
  const [contactName, setContactName] = useState(deals[0]?.contact_name || "");
  const [scheduledAt, setScheduledAt] = useState(new Date().toISOString().slice(0, 16));
  const [meetingType, setMeetingType] = useState<MeetingType>("discovery");
  const [interestScore, setInterestScore] = useState<number>(3);
  const [painDiagnosticado, setPainDiagnosticado] = useState("");
  const [volumenMensual, setVolumenMensual] = useState<number>(1000);
  const [procesoActual, setProcesoActual] = useState("");
  const [herramientasActuales, setHerramientasActuales] = useState("");
  const [urgencia, setUrgencia] = useState<"alta" | "media" | "baja">("media");
  const [decisorInvolucrado, setDecisorInvolucrado] = useState(true);
  const [objeciones, setObjeciones] = useState("");
  const [siguientePaso, setSiguientePaso] = useState("");
  const [siguientePasoAt, setSiguientePasoAt] = useState(
    new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  );

  const handleSelectDeal = (dealId: string) => {
    setSelectedDealId(dealId);
    const found = deals.find((d) => d.id === dealId);
    if (found) {
      setCompanyName(found.company_name);
      setContactName(found.contact_name);
    }
  };

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDealId || !companyName.trim() || !siguientePaso.trim()) {
      setActionError("Debe seleccionar una oportunidad comercial válida y definir el siguiente paso.");
      return;
    }

    setActionLoading(true);
    setActionError(null);

    const res = await createMeetingAction({
      deal_id: selectedDealId,
      company_name: companyName,
      contact_name: contactName,
      scheduled_at: `${scheduledAt}:00Z`,
      status: "agendada",
      meeting_type: meetingType,
      interest_score: interestScore,
      pain_diagnosticado: painDiagnosticado,
      volumen_mensual: volumenMensual,
      proceso_actual: procesoActual,
      herramientas_actuales: herramientasActuales,
      urgencia: urgencia,
      decisor_involucrado: decisorInvolucrado,
      proceso_decision: "Dueño con socio",
      objeciones: objeciones,
      demo_mostrada: "Tino respondiendo catálogo + Beto reactivando",
      siguiente_paso: siguientePaso,
      siguiente_paso_at: `${siguientePasoAt}T10:00:00Z`,
      notas: "Registrado en módulo de reuniones",
    });

    setActionLoading(false);

    if (res.success && res.data) {
      setMeetings([res.data, ...meetings]);
      setShowCaptureModal(false);
      setPainDiagnosticado("");
      setSiguientePaso("");
      setActionSuccess("Reunión registrada exitosamente en Supabase.");
      setTimeout(() => setActionSuccess(null), 3000);
    } else {
      setActionError(res.error || "Error al crear la reunión");
    }
  };

  const handleStatusChange = async (meetingId: string, newStatus: MeetingStatus) => {
    setActionLoading(true);
    setActionError(null);
    const res = await updateMeetingAction(meetingId, { status: newStatus });
    setActionLoading(false);

    if (res.success && res.data) {
      setMeetings((prev) =>
        prev.map((m) => (m.id === meetingId ? (res.data as HqMeeting) : m))
      );
      if (selectedMeeting?.id === meetingId) {
        setSelectedMeeting(res.data);
      }
      setActionSuccess(`Estado de reunión actualizado a '${newStatus}'`);
      setTimeout(() => setActionSuccess(null), 3000);
    } else {
      setActionError(res.error || "Error al actualizar estado de la reunión");
    }
  };

  const filteredMeetings = meetings.filter((m) => {
    if (activeTab !== "todas" && m.meeting_type !== activeTab) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-7xl pb-16">
      <PageHeader
        title="Reuniones & Discovery"
        sub="Control Comercial de Encuentros"
        right={
          <button
            onClick={() => {
              if (deals.length === 0) {
                setActionError("No hay oportunidades en el Pipeline para vincular. Cree un Deal primero en /pipeline.");
                return;
              }
              setShowCaptureModal(true);
            }}
            className="btn-primary"
          >
            + Captura Rápida de Reunión
          </button>
        }
      />

      {/* Banners de estado */}
      {actionError && (
        <div className="mb-4 rounded-xl border border-danger/30 bg-danger/[0.04] p-3.5 text-xs text-danger flex items-center justify-between shadow-xs">
          <span><b>Error:</b> {actionError}</span>
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
          Sincronizando con base de datos...
        </div>
      )}

      {/* Selector de pestañas — Segmented Control */}
      <div className="mb-6 flex items-center gap-1 rounded-lg border border-line bg-surface-3 p-1 text-xs w-fit">
        {(["todas", "discovery", "demo"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-md px-3.5 py-1.5 font-medium capitalize transition-all ${
              activeTab === tab
                ? "bg-white text-ink shadow-card font-semibold"
                : "text-ink-mut hover:text-ink"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Lista de reuniones en Grid */}
      {filteredMeetings.length === 0 ? (
        <div className="panel border-dashed p-10 text-center text-xs text-ink-dim shadow-xs">
          Sin reuniones registradas en esta vista.
        </div>
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredMeetings.map((m) => {
            const statusStyle =
              m.status === "completada"
                ? "bg-ok/10 text-ok border-ok/20"
                : m.status === "no_show"
                ? "bg-warn/10 text-warn border-warn/20"
                : m.status === "cancelada"
                ? "bg-danger/10 text-danger border-danger/20"
                : "bg-accent/10 text-accent border-accent/20";

            return (
              <div
                key={m.id}
                onClick={() => setSelectedMeeting(m)}
                className="cursor-pointer panel p-4 shadow-card hover:border-brand/40 hover:shadow-raise transition-all space-y-2.5"
              >
                <div className="flex items-center justify-between text-xs gap-2">
                  <span className="font-bold text-ink truncate text-sm leading-snug">{m.company_name}</span>
                  <span className="rounded-md bg-brand/10 px-2 py-0.5 font-mono text-[10px] font-medium text-brand border border-brand/20 capitalize shrink-0">
                    {m.meeting_type}
                  </span>
                </div>
                <p className="text-xs text-ink-mut truncate">
                  {m.contact_name || "Sin contacto registrado"}
                </p>
                <div className="flex items-center justify-between text-[11px] text-ink-dim border-t border-line/60 pt-2 font-mono">
                  <span>{fechaCorta(m.scheduled_at)} {hora(m.scheduled_at)}</span>
                  <span className={`rounded-md px-2 py-0.5 font-semibold text-[10px] border capitalize ${statusStyle}`}>
                    {m.status}
                  </span>
                </div>
                {m.interest_score && (
                  <div className="text-[11px] text-ink-dim flex items-center justify-between pt-1">
                    <span className="lbl">Interés:</span>
                    <span className="font-bold text-amber-500 tracking-wider">{"★".repeat(m.interest_score)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* DRAWER DETALLE DE REUNIÓN */}
      {selectedMeeting && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-2xs">
          <div className="w-full max-w-lg bg-white border-l border-line p-6 shadow-pop overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div>
                <h3 className="font-bold text-base text-ink">{selectedMeeting.company_name}</h3>
                <span className="text-xs font-mono text-ink-dim">
                  {fechaCorta(selectedMeeting.scheduled_at)} · {selectedMeeting.meeting_type}
                </span>
              </div>
              <button
                onClick={() => setSelectedMeeting(null)}
                className="rounded-md p-1.5 text-ink-dim hover:bg-surface-3 hover:text-ink text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="panel p-3.5 bg-surface-3/50 border border-line">
                <p className="lbl">Estado de la Cita:</p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {(["agendada", "completada", "no_show", "cancelada"] as MeetingStatus[]).map((st) => (
                    <button
                      key={st}
                      disabled={actionLoading}
                      onClick={() => handleStatusChange(selectedMeeting.id, st)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-all ${
                        selectedMeeting.status === st
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
                <h4 className="lbl">Diagnóstico Registrado</h4>
                <p className="text-ink font-medium">{selectedMeeting.pain_diagnosticado || "Sin dolor registrado"}</p>
                <p className="text-ink-dim font-mono">Volumen: {selectedMeeting.volumen_mensual} mensajes/mes</p>
                <p className="text-ink-dim">Urgencia: <span className="capitalize font-medium text-ink">{selectedMeeting.urgencia}</span></p>
              </div>

              <div className="rounded-lg border border-brand/20 bg-brand/[0.03] p-3.5">
                <h4 className="lbl text-brand">Siguiente Paso Comprometido</h4>
                <p className="font-semibold text-ink mt-1">{selectedMeeting.siguiente_paso}</p>
                <p className="mt-1 font-mono text-[11px] text-brand font-medium">
                  Fecha: {selectedMeeting.siguiente_paso_at ? fechaCorta(selectedMeeting.siguiente_paso_at) : "Vencida"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CAPTURA RÁPIDA DISCOVERY */}
      {showCaptureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg panel p-6 shadow-pop text-xs space-y-3.5">
            <h3 className="text-sm font-bold text-ink">Formulario Rápido de Captura (≤2 minutos)</h3>
            <p className="text-ink-mut">
              Registra la reunión y vincula al Deal correspondiente para mantener la trazabilidad.
            </p>

            <form onSubmit={handleCreateMeeting} className="space-y-3.5">
              <div>
                <label className="block text-ink-mut mb-1 font-medium">Oportunidad / Deal Vinculado *</label>
                <select
                  value={selectedDealId}
                  onChange={(e) => handleSelectDeal(e.target.value)}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-xs text-ink font-medium focus:border-brand"
                >
                  {deals.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.company_name} ({d.industry}) — {d.etapa}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
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
                  <label className="block text-ink-mut mb-1 font-medium">Contacto / Cargo</label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-ink-mut mb-1 font-medium">Dolor Principal Diagnosticado *</label>
                <input
                  type="text"
                  required
                  value={painDiagnosticado}
                  onChange={(e) => setPainDiagnosticado(e.target.value)}
                  className="input"
                  placeholder="Ej: Pierden citas los fines de semana"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-ink-mut mb-1 font-medium">Nivel Interés (1-5)</label>
                  <select
                    value={interestScore}
                    onChange={(e) => setInterestScore(Number(e.target.value))}
                    className="w-full rounded-lg border border-line bg-white px-3 py-2 text-xs text-ink"
                  >
                    <option value={5}>5 - Altísimo (listo para piloto)</option>
                    <option value={4}>4 - Alto</option>
                    <option value={3}>3 - Medio</option>
                    <option value={2}>2 - Bajo</option>
                    <option value={1}>1 - Nulo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-ink-mut mb-1 font-medium">Urgencia</label>
                  <select
                    value={urgencia}
                    onChange={(e) => setUrgencia(e.target.value as any)}
                    className="w-full rounded-lg border border-line bg-white px-3 py-2 text-xs text-ink"
                  >
                    <option value="alta">Alta</option>
                    <option value="media">Media</option>
                    <option value="baja">Baja</option>
                  </select>
                </div>
                <div>
                  <label className="block text-ink-mut mb-1 font-medium">Tipo de Cita</label>
                  <select
                    value={meetingType}
                    onChange={(e) => setMeetingType(e.target.value as any)}
                    className="w-full rounded-lg border border-line bg-white px-3 py-2 text-xs text-ink"
                  >
                    <option value="discovery">Discovery</option>
                    <option value="demo">Demo</option>
                    <option value="pilot_review">Revisión Piloto</option>
                    <option value="decision">Decisión</option>
                  </select>
                </div>
              </div>

              <div className="rounded-lg border border-brand/20 bg-brand/[0.03] p-3 space-y-2">
                <p className="font-semibold text-brand text-[11px]">Siguiente Paso Comprometido (Obligatorio)</p>
                <div>
                  <label className="block text-ink-dim text-[10px]">Acción acordada</label>
                  <input
                    type="text"
                    required
                    value={siguientePaso}
                    onChange={(e) => setSiguientePaso(e.target.value)}
                    placeholder="Ej: Enviar propuesta con llamada el jueves"
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-ink-dim text-[10px]">Fecha comprometida</label>
                  <input
                    type="date"
                    required
                    value={siguientePasoAt}
                    onChange={(e) => setSiguientePasoAt(e.target.value)}
                    className="input font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCaptureModal(false)}
                  className="btn-ghost"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn-primary"
                >
                  Guardar en Base de Datos
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
