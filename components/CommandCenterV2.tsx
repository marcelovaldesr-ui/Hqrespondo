"use client";

import { useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import Cohortes from "@/components/Cohortes";
import type { Cohorte } from "@/lib/actividades";
import { clp, fechaCorta, timeAgo } from "@/lib/format";
import {
  HqDeal,
  HqMeeting,
  HqPilot,
  HqProposal,
  REVENUE_STAGE_CONFIG,
  RevenueStage,
} from "@/lib/revenue/types";

interface CommandCenterV2Props {
  deals: HqDeal[];
  meetings: HqMeeting[];
  pilots: HqPilot[];
  proposals: HqProposal[];
  legacyOps?: {
    clientesActivos: number;
    mrrTotal: number;
    feed: Array<{ created_at: string; tipo: string; client_id: string | null; detalle: string | null }>;
    hot: Array<{ id: string; nombre: string; comuna: string; score: number }>;
    nombresMap: Record<string, string>;
    errores?: number;
    prioridades?: Array<{ texto: string; href: string; nivel: "danger" | "warn" | "brand" }>;
    mision?: { fase: string; hito: string; frase: string };
    objetivos?: Array<{ clave: string; label: string; meta: number; avance: number; estado: string; accion: string }>;
    cadencia?: { vencidos: number; huerfanos: number; agotados: number };
    finanzas?: { gastosMes: number; cobrosPendientes: number; mrrActual: number };
    roadmap?: { tareasHoy: Array<{ id: string; tarea: string; area: string | null; fecha_limite: string | null }> };
    seguimientosHoy?: Array<{ id: string; nombre: string; proxima_accion: string | null }>;
    focoPendientes?: number;
    supabaseErrors?: Array<{ query: string; message: string }>;
    contactosHoy?: number;
    metaDiariaContactos?: number;
    conversacionesHoy?: number;
    cohortes?: Cohorte[];
    dealsVencidos?: Array<{ id: string; nombre: string; accion: string; fecha: string | null; valor?: number }>;
  } | null;
}

export default function CommandCenterV2({
  deals,
  meetings,
  pilots,
  proposals,
  legacyOps,
}: CommandCenterV2Props) {
  const hoyStr = new Date().toISOString().slice(0, 10);
  const [vistaPrincipal, setVistaPrincipal] = useState<"revenue" | "operaciones">("revenue");

  // Cálculos de métricas operativas
  const dealsActivos = deals.filter(
    (d) => !["ganado", "perdido", "nurture"].includes(d.etapa)
  );
  const mrrActivo = dealsActivos.reduce((sum, d) => sum + (d.valor_mensual_neto ?? 0), 0);

  // Acciones pendientes para hoy o vencidas
  const accionesHoy = dealsActivos.filter((d) => {
    if (!d.next_action_at) return true;
    return d.next_action_at.slice(0, 10) <= hoyStr;
  });

  // Tratos estancados
  const tratosEstancados = dealsActivos.filter((d) => d.stalled);

  // Pilotos activos
  const pilotosActivos = pilots.filter(
    (p) => p.status === "activo" || p.status === "configuracion"
  );

  // Propuestas en decisión o revisión
  const propuestasPendientes = proposals.filter(
    (p) => p.status === "enviada" || p.status === "en_revision"
  );

  // Reuniones próximas (hoy o en el futuro)
  const reunionesProximas = meetings.filter((m) => {
    return m.status === "agendada" && m.scheduled_at >= new Date().toISOString();
  });

  const [filtroSeccion, setFiltroSeccion] = useState<"todas" | "stalled" | "pilotos" | "propuestas">("todas");

  return (
    <div className="mx-auto max-w-7xl pb-16 space-y-6">
      <PageHeader
        title="Command Center"
        sub="Revenue Operating System"
        right={
          <div className="flex items-center gap-2">
            {legacyOps?.errores !== undefined && (
              <span
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-mono ${
                  legacyOps.errores > 0
                    ? "border-danger/30 bg-danger/10 text-danger font-semibold"
                    : "border-ok/30 bg-ok/10 text-ok"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${legacyOps.errores > 0 ? "bg-danger animate-pulse" : "bg-ok"}`} />
                {legacyOps.errores > 0 ? `${legacyOps.errores} errores 24h` : "Bots OK"}
              </span>
            )}
            <Link
              href="/pipeline"
              className="btn-ghost"
            >
              Pipeline (Kanban)
            </Link>
            <Link
              href="/playbook"
              className="btn-primary"
            >
              Sales Playbook
            </Link>
          </div>
        }
      />

      {/* Alerta visible si hubo errores en consultas de base de datos Supabase (Fail-Visible) */}
      {legacyOps?.supabaseErrors && legacyOps.supabaseErrors.length > 0 && (
        <div className="rounded-xl border border-danger/30 bg-danger/[0.03] p-4 text-xs text-ink shadow-xs">
          <div className="flex items-center gap-2 font-bold text-danger">
            <span>⚠️ Consultas de Base de Datos con Errores (Fail-Visible):</span>
          </div>
          <p className="mt-1 text-[11px] text-ink-mut">
            Las siguientes consultas reportaron error en Supabase (no se silenciaron en arrays vacíos):
          </p>
          <ul className="mt-2 list-disc pl-5 space-y-1 font-mono text-[11px] text-danger/90">
            {legacyOps.supabaseErrors.map((err, idx) => (
              <li key={idx}><strong>{err.query}:</strong> {err.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Prioridades del Día (Focos de Urgencia) — Bandeja Protagónica */}
      {legacyOps?.prioridades && legacyOps.prioridades.length > 0 && (
        <div className="panel p-4 shadow-card">
          <div className="flex items-center justify-between pb-2.5 border-b border-line">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-brand" />
              <span className="lbl text-ink font-bold">
                Prioridades de Hoy (Focos de Urgencia)
              </span>
            </div>
            <span className="font-mono text-[10px] text-ink-dim">Acciones Inmediatas</span>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {legacyOps.prioridades.map((p, idx) => {
              const badgeStyle =
                p.nivel === "danger"
                  ? "border-danger/30 bg-danger/[0.04] text-danger hover:border-danger/60 hover:bg-danger/[0.08]"
                  : p.nivel === "warn"
                  ? "border-warn/30 bg-warn/[0.04] text-warn hover:border-warn/60 hover:bg-warn/[0.08]"
                  : "border-brand/30 bg-brand/[0.04] text-brand hover:border-brand/60 hover:bg-brand/[0.08]";
              const dot =
                p.nivel === "danger" ? "bg-danger" : p.nivel === "warn" ? "bg-warn" : "bg-brand";
              return (
                <Link
                  key={idx}
                  href={p.href}
                  className={`flex items-center gap-2.5 rounded-lg border p-3 text-xs transition-all ${badgeStyle}`}
                >
                  <span className={`h-2 w-2 rounded-full shrink-0 ${dot}`} />
                  <span className="font-medium truncate text-ink">{p.texto}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Selector de Vista: Segmented Control Moderno */}
      {legacyOps && (
        <div className="flex items-center gap-1 rounded-lg border border-line bg-surface-3 p-1 text-xs w-fit">
          <button
            onClick={() => setVistaPrincipal("revenue")}
            className={`rounded-md px-3 py-1.5 font-medium transition-all ${
              vistaPrincipal === "revenue"
                ? "bg-white text-ink shadow-card font-semibold"
                : "text-ink-mut hover:text-ink"
            }`}
          >
            📊 Revenue OS (Pipeline, Pilotos & Forecast)
          </button>
          <button
            onClick={() => setVistaPrincipal("operaciones")}
            className={`rounded-md px-3 py-1.5 font-medium transition-all ${
              vistaPrincipal === "operaciones"
                ? "bg-white text-ink shadow-card font-semibold"
                : "text-ink-mut hover:text-ink"
            }`}
          >
            ⚡ Operaciones & Bots ({legacyOps.clientesActivos} Clientes)
          </button>
        </div>
      )}

      {/* VISTA OPERACIONES PREVIAS (Integración Conservadora de Capacidades Operacionales) */}
      {vistaPrincipal === "operaciones" && legacyOps && (
        <div className="space-y-6">
          {/* 1. Finanzas, Clientes y Pulso Operativo */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="panel p-4 shadow-card hover:border-line2 transition-all">
              <p className="lbl">Clientes Activos</p>
              <p className="mt-1 font-mono text-2xl font-bold text-ink">{legacyOps.clientesActivos}</p>
              <p className="mt-0.5 font-mono text-[10px] text-ink-faint">Bots en producción</p>
            </div>
            <div className="panel p-4 shadow-card hover:border-line2 transition-all">
              <p className="lbl">MRR Facturado</p>
              <p className="mt-1 font-mono text-2xl font-bold text-ok">{clp(legacyOps.mrrTotal)}</p>
              <p className="mt-0.5 font-mono text-[10px] text-ink-faint">Mensualidad recurrente</p>
            </div>
            <div className="panel p-4 shadow-card hover:border-line2 transition-all">
              <p className="lbl">Cobros Pendientes</p>
              <p className="mt-1 font-mono text-2xl font-bold text-warn">{clp(legacyOps.finanzas?.cobrosPendientes ?? 0)}</p>
              <p className="mt-0.5 font-mono text-[10px] text-ink-faint">Por cobrar este mes</p>
            </div>
            <div className="panel p-4 shadow-card hover:border-line2 transition-all">
              <p className="lbl">Gastos Mes</p>
              <p className="mt-1 font-mono text-2xl font-bold text-ink">{clp(legacyOps.finanzas?.gastosMes ?? 0)}</p>
              <p className="mt-0.5 font-mono text-[10px] text-ink-faint">Costos operativos</p>
            </div>
            <div className="panel p-4 shadow-card hover:border-line2 transition-all">
              <div className="flex justify-between items-baseline">
                <p className="lbl">Contactos Hoy</p>
                <span className="font-mono text-[10px] text-ink-dim">Meta 15</span>
              </div>
              <p className="mt-1 font-mono text-2xl font-bold text-ink">
                {legacyOps.contactosHoy ?? 0}
                <span className="text-xs font-normal text-ink-mut"> / 15</span>
              </p>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                <div
                  className={`h-full transition-all ${
                    (legacyOps.contactosHoy ?? 0) >= 15 ? "bg-ok" : "bg-accent"
                  }`}
                  style={{
                    width: `${Math.min(100, Math.round(((legacyOps.contactosHoy ?? 0) / 15) * 100))}%`,
                  }}
                />
              </div>
            </div>
            <div className="panel p-4 shadow-card hover:border-line2 transition-all">
              <p className="lbl">Bots Hoy</p>
              <p className="mt-1 font-mono text-2xl font-bold text-brand">{legacyOps.conversacionesHoy ?? 0}</p>
              <p className="mt-0.5 font-mono text-[10px] text-ink-faint">Conversaciones atendidas</p>
            </div>
          </div>

          {/* 2. Higiene de Cadencia (Si hay prospectos vencidos o huérfanos) */}
          {legacyOps.cadencia && (legacyOps.cadencia.vencidos > 0 || legacyOps.cadencia.huerfanos > 0) && (
            <Link
              href="/metricas"
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warn/30 bg-warn/[0.04] p-3 text-xs text-ink hover:border-warn/50 transition-all shadow-xs"
            >
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-warn animate-pulse" />
                <span>
                  <strong className="font-mono text-ink">{legacyOps.cadencia.huerfanos}</strong> prospectos calificados nunca se tocaron y{" "}
                  <strong className="font-mono text-ink">{legacyOps.cadencia.vencidos}</strong> tienen el siguiente toque vencido.
                </span>
                <span className="hidden sm:inline text-ink-mut">— Cobertura y seguimiento prioritario.</span>
              </div>
              <span className="font-mono text-[11px] text-warn hover:underline font-semibold">Ver métricas de cadencia →</span>
            </Link>
          )}

          {/* 3. Estado de la Misión y Metas del Sprint */}
          {legacyOps.mision && (
            <div className="panel p-5 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span className="lbl font-bold">Estado de la Misión</span>
                  <div className="mt-1.5 flex items-baseline gap-2">
                    <span className="text-lg font-bold text-ink">Fase: {legacyOps.mision.fase}</span>
                    <span className="rounded bg-brand/10 px-2 py-0.5 text-[11px] font-mono text-brand font-medium">
                      Próximo hito: {legacyOps.mision.hito}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-ink-mut">{legacyOps.mision.frase}</p>
                </div>
              </div>
              {legacyOps.objetivos && legacyOps.objetivos.length > 0 && (
                <div className="mt-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-5 pt-3.5 border-t border-line/60">
                  {legacyOps.objetivos.map((obj, i) => (
                    <div key={i} className="rounded-lg border border-line bg-surface-3/50 p-2.5 text-xs">
                      <div className="flex justify-between text-[11px] text-ink-mut">
                        <span className="capitalize font-medium">{obj.label}</span>
                        <span className="font-mono font-semibold text-ink">{obj.avance}/{obj.meta}</span>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-4">
                        <div
                          className={`h-full transition-all ${obj.estado === "atrasado" ? "bg-danger" : obj.estado === "logrado" ? "bg-ok" : "bg-brand"}`}
                          style={{ width: `${Math.min(100, Math.round((obj.avance / (obj.meta || 1)) * 100))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 4. Tareas y Accionables Operativos de Hoy */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* Seguimientos de Prospección */}
            <div className="panel p-4 shadow-card text-xs">
              <div className="flex items-center justify-between pb-2.5 border-b border-line">
                <h4 className="font-bold text-ink flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-warn" />
                  Seguimientos de Prospección
                </h4>
                <Link href="/prospeccion" className="text-xs font-semibold text-accent hover:underline">Prospección →</Link>
              </div>
              <div className="mt-2.5 space-y-1.5">
                {(!legacyOps.seguimientosHoy || legacyOps.seguimientosHoy.length === 0) ? (
                  <p className="py-4 text-center text-ink-faint">Sin seguimientos vencidos para hoy.</p>
                ) : (
                  legacyOps.seguimientosHoy.slice(0, 5).map((s, idx) => (
                    <div key={idx} className="flex items-center justify-between py-1.5 border-b border-line/40">
                      <span className="font-medium text-ink truncate">{s.nombre}</span>
                      <span className="font-mono text-[10px] text-ink-dim">{s.proxima_accion || "Hoy"}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Tareas del Roadmap */}
            <div className="panel p-4 shadow-card text-xs">
              <div className="flex items-center justify-between pb-2.5 border-b border-line">
                <h4 className="font-bold text-ink flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                  Tareas del Roadmap
                </h4>
                <Link href="/roadmap" className="text-xs font-semibold text-accent hover:underline">Roadmap →</Link>
              </div>
              <div className="mt-2.5 space-y-1.5">
                {(!legacyOps.roadmap?.tareasHoy || legacyOps.roadmap.tareasHoy.length === 0) ? (
                  <p className="py-4 text-center text-ink-faint">Sin tareas del roadmap vencidas para hoy.</p>
                ) : (
                  legacyOps.roadmap.tareasHoy.slice(0, 5).map((t, idx) => (
                    <div key={idx} className="flex items-center justify-between py-1.5 border-b border-line/40">
                      <span className="font-medium text-ink truncate">{t.tarea}</span>
                      <span className="font-mono text-[10px] text-ink-dim">{t.area || "General"}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Pipeline con Vencimientos */}
            <div className="panel p-4 shadow-card text-xs">
              <div className="flex items-center justify-between pb-2.5 border-b border-line">
                <h4 className="font-bold text-ink flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-danger" />
                  Pipeline con Vencimientos
                </h4>
                <Link href="/pipeline" className="text-xs font-semibold text-accent hover:underline">Pipeline →</Link>
              </div>
              <div className="mt-2.5 space-y-1.5">
                {(!legacyOps.dealsVencidos || legacyOps.dealsVencidos.length === 0) ? (
                  <p className="py-4 text-center text-ink-faint">Sin tratos vencidos para hoy.</p>
                ) : (
                  legacyOps.dealsVencidos.slice(0, 5).map((d, idx) => (
                    <div key={idx} className="flex items-center justify-between py-1.5 border-b border-line/40">
                      <div className="truncate max-w-[150px]">
                        <span className="font-medium text-ink truncate block">{d.nombre}</span>
                        <span className="text-[10px] text-ink-mut">{d.accion}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono text-[10px] text-danger font-semibold">{d.fecha || "Vencido"}</span>
                        {d.valor ? (
                          <span className="block font-mono text-[10px] text-ink-dim">{clp(d.valor)}</span>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Feed de Actividad en Vivo */}
            <div className="panel p-5 shadow-card">
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-ok animate-pulse" />
                  Actividad de Bots en Vivo
                </h3>
              </div>
              <div className="mt-3 space-y-2 text-xs">
                {legacyOps.feed.length === 0 ? (
                  <p className="py-4 text-center text-ink-dim">Sin eventos recientes reportados.</p>
                ) : (
                  legacyOps.feed.map((e: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between border-b border-line/40 py-2">
                      <span className="text-ink font-medium">
                        {e.client_id ? legacyOps.nombresMap[e.client_id] || "Cliente" : "Sistema"}
                      </span>
                      <span className="text-ink-mut text-[11.5px] truncate max-w-xs">{e.detalle || e.tipo}</span>
                      <span className="font-mono text-[10.5px] text-ink-faint">{timeAgo(e.created_at)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Contactar Primero (Hot Leads) */}
            <div className="panel p-5 shadow-card">
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <h3 className="text-sm font-bold text-ink">Contactar Primero (Scoring Alto)</h3>
                <Link href="/prospeccion" className="text-xs font-semibold text-accent hover:underline">
                  Prospección →
                </Link>
              </div>
              <div className="mt-3 space-y-2 text-xs">
                {legacyOps.hot.length === 0 ? (
                  <p className="py-4 text-center text-ink-dim">Sin prospectos calientes en bandeja.</p>
                ) : (
                  legacyOps.hot.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between border-b border-line/40 py-2">
                      <div>
                        <span className="font-semibold text-ink">{p.nombre}</span>
                        <span className="ml-2 text-[10px] text-ink-dim">{p.comuna}</span>
                      </div>
                      <span className="rounded bg-accent/15 px-2 py-0.5 font-mono text-[11px] font-bold text-accent">
                        Score {p.score}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 5. Cohortes Semanales (Dónde está HOY cada camada) */}
          {legacyOps.cohortes && legacyOps.cohortes.length > 0 && (
            <div className="panel overflow-hidden shadow-card">
              <Cohortes filas={legacyOps.cohortes} />
            </div>
          )}
        </div>
      )}

      {/* VISTA REVENUE OS V1 */}
      {vistaPrincipal === "revenue" && (
        <div>

      {/* 1. KPIs Operativos de Revenue (Stripe Style) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <div className="panel p-4 shadow-card hover:border-line2 transition-all">
          <p className="lbl">Pipeline Activo (Neto)</p>
          <p className="mt-1 font-mono text-2xl font-bold text-ink">{clp(mrrActivo)}</p>
          <p className="mt-1 font-mono text-[10.5px] text-ink-faint">{dealsActivos.length} oportunidades en curso</p>
        </div>

        <div className="panel p-4 shadow-card hover:border-accent/40 transition-all border-l-2 border-l-accent">
          <p className="lbl text-accent font-bold">Acciones Para Hoy</p>
          <p className="mt-1 font-mono text-2xl font-bold text-accent">{accionesHoy.length}</p>
          <p className="mt-1 text-[10.5px] text-ink-mut">Llamadas y toques requeridos</p>
        </div>

        <div className="panel p-4 shadow-card hover:border-warn/40 transition-all border-l-2 border-l-warn">
          <p className="lbl text-warn font-bold">Pilotos 14 Días</p>
          <p className="mt-1 font-mono text-2xl font-bold text-warn">{pilotosActivos.length}</p>
          <p className="mt-1 text-[10.5px] text-ink-mut">Pruebas operativas activas</p>
        </div>

        <div className="panel p-4 shadow-card hover:border-line2 transition-all">
          <p className="lbl">Propuestas en Juego</p>
          <p className="mt-1 font-mono text-2xl font-bold text-ink">{propuestasPendientes.length}</p>
          <p className="mt-1 text-[10.5px] text-ink-faint">Esperando decisión</p>
        </div>

        <div className={`panel p-4 shadow-card col-span-2 sm:col-span-1 transition-all ${
          tratosEstancados.length > 0
            ? "border-l-2 border-l-danger bg-danger/[0.02]"
            : "border-l-2 border-l-ok bg-ok/[0.02]"
        }`}>
          <p className={`lbl font-bold ${tratosEstancados.length > 0 ? "text-danger" : "text-ok"}`}>
            Tratos Estancados
          </p>
          <p className={`mt-1 font-mono text-2xl font-bold ${tratosEstancados.length > 0 ? "text-danger" : "text-ok"}`}>
            {tratosEstancados.length}
          </p>
          <p className="mt-1 text-[10.5px] text-ink-faint">
            {tratosEstancados.length > 0 ? "Requieren acción urgente" : "Flujo comercial al día"}
          </p>
        </div>
      </div>

      {/* 2. ALERTA CRÍTICA: TRATOS ESTANCADOS */}
      {tratosEstancados.length > 0 && (
        <div className="rounded-xl border border-danger/30 bg-danger/[0.03] p-4 shadow-xs">
          <div className="flex items-center justify-between gap-3 pb-2 border-b border-danger/20">
            <div className="flex items-center gap-2 text-danger font-semibold text-xs">
              <span className="h-2 w-2 rounded-full bg-danger animate-pulse" />
              <span>Atención: {tratosEstancados.length} oportunidad(es) sin tracción o con Next Step vencido</span>
            </div>
            <span className="font-mono text-[10px] text-danger/80 uppercase tracking-wider font-medium">Regla Anti-Ghosting</span>
          </div>

          <div className="mt-3 space-y-2">
            {tratosEstancados.slice(0, 4).map((d) => (
              <div
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-danger/20 bg-white p-3 text-xs shadow-2xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-ink">{d.company_name}</span>
                    <span className="rounded bg-danger/10 px-1.5 py-0.5 text-[10px] font-mono text-danger font-medium">
                      {REVENUE_STAGE_CONFIG[d.etapa]?.label || d.etapa}
                    </span>
                  </div>
                  <p className="mt-0.5 text-danger text-[11px]">{d.stalled_reason || "Acción vencida"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-ink-faint">
                    Próxima: {d.next_action_at ? fechaCorta(d.next_action_at) : "Sin fecha"}
                  </span>
                  <Link
                    href={`/pipeline?dealId=${d.id}`}
                    className="rounded-md border border-danger/30 bg-danger/10 px-2.5 py-1 text-xs font-semibold text-danger hover:bg-danger/20 transition-colors"
                  >
                    Resolver Trato
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. BLOQUES PRINCIPALES DE TRABAJO DIARIO (Alta Densidad) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Columna Izquierda (2 cols): Acciones de Hoy + Reuniones */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card: Acciones y Llamadas de Hoy */}
          <div className="panel p-5 shadow-card">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div>
                <h2 className="text-sm font-bold text-ink">¿Qué hacemos hoy para vender?</h2>
                <p className="text-xs text-ink-mut">Cola operativa de llamadas, reuniones y seguimientos prioritarios</p>
              </div>
              <span className="rounded-full bg-accent/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-accent border border-accent/20">
                {accionesHoy.length} pendientes
              </span>
            </div>

            <div className="mt-3 divide-y divide-line/60">
              {accionesHoy.length === 0 ? (
                <div className="py-8 text-center text-xs text-ink-faint">
                  🎉 No hay acciones pendientes ni vencidas para hoy. ¡Todas las oportunidades tienen fecha futura!
                </div>
              ) : (
                accionesHoy.slice(0, 6).map((deal) => (
                  <div key={deal.id} className="py-3 flex items-center justify-between gap-3 data-row px-2 rounded-lg">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold text-sm text-ink">{deal.company_name}</p>
                        <span className="rounded border border-line bg-surface-3 px-1.5 py-0.5 text-[10px] font-mono text-ink-dim">
                          {deal.industry}
                        </span>
                        <span className="rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-medium text-brand">
                          {REVENUE_STAGE_CONFIG[deal.etapa]?.label || deal.etapa}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-ink-mut">
                        👉 <strong className="text-ink">{deal.next_action}</strong>
                      </p>
                      {deal.contact_phone && (
                        <p className="mt-0.5 text-[11px] font-mono text-ink-faint">
                          📞 {deal.contact_name || "Contacto"}: {deal.contact_phone}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="text-[11px] font-mono font-medium text-accent">
                        {deal.next_action_at ? fechaCorta(deal.next_action_at) : "Vencida"}
                      </span>
                      <Link
                        href={`/pipeline?dealId=${deal.id}`}
                        className="btn-ghost text-[11.5px] py-1 px-2.5"
                      >
                        Registrar Resultado
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>

            {accionesHoy.length > 6 && (
              <div className="mt-3 pt-2 text-center border-t border-line/60">
                <Link href="/pipeline" className="text-xs text-accent hover:underline font-medium">
                  Ver las {accionesHoy.length - 6} acciones restantes en Pipeline →
                </Link>
              </div>
            )}
          </div>

          {/* Card: Reuniones de Hoy y Próximas */}
          <div className="panel p-5 shadow-card">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div>
                <h2 className="text-sm font-bold text-ink">Reuniones y Discovery en Agenda</h2>
                <p className="text-xs text-ink-mut">Preparación previa y captura de diagnóstico</p>
              </div>
              <Link
                href="/reuniones"
                className="text-xs font-semibold text-accent hover:underline"
              >
                Módulo Reuniones →
              </Link>
            </div>

            <div className="mt-3 divide-y divide-line/60">
              {reunionesProximas.length === 0 ? (
                <div className="py-6 text-center text-xs text-ink-faint">
                  No hay reuniones agendadas próximas. Prospección activa requerida para llenar calendario.
                </div>
              ) : (
                reunionesProximas.slice(0, 4).map((m) => (
                  <div key={m.id} className="py-3 flex items-center justify-between gap-3 data-row px-2 rounded-lg">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-ink">{m.company_name}</span>
                        <span className="rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-mono text-brand capitalize font-medium">
                          {m.meeting_type}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-ink-mut">
                        Contacto: {m.contact_name || "Por confirmar"} · {m.pain_diagnosticado ? `Dolor: ${m.pain_diagnosticado}` : "Discovery pendiente"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-mono text-xs font-semibold text-ink">
                        {fechaCorta(m.scheduled_at)}
                      </span>
                      <p className="text-[10px] text-ink-faint font-mono">{timeAgo(m.scheduled_at)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Columna Derecha (1 col): Pilotos Activos + Propuestas + Accesos */}
        <div className="space-y-6">
          {/* Card: Pilotos Activos de 14 Días */}
          <div className="panel p-5 shadow-card">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <h2 className="text-sm font-bold text-ink">Pilotos de 14 Días</h2>
              <Link href="/pilotos" className="text-xs font-semibold text-accent hover:underline">
                Detalle →
              </Link>
            </div>

            <div className="mt-3 space-y-3">
              {pilotosActivos.length === 0 ? (
                <p className="py-4 text-center text-xs text-ink-faint">
                  Sin pilotos activos en este momento.
                </p>
              ) : (
                pilotosActivos.map((pilot) => (
                  <div
                    key={pilot.id}
                    className="rounded-lg border border-warn/25 bg-warn/[0.02] p-3 text-xs shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <strong className="text-ink font-semibold">{pilot.company_name}</strong>
                      <span className="rounded bg-warn/15 px-1.5 py-0.5 text-[10px] font-mono font-bold text-warn">
                        Día 14: {pilot.review_date ? fechaCorta(pilot.review_date) : "Sin fecha"}
                      </span>
                    </div>
                    <p className="mt-1 text-ink-mut text-[11px]">
                      🎯 KPI: {pilot.kpi_primario}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-[10.5px] font-mono text-ink-faint border-t border-line/40 pt-1.5">
                      <span>Atendidos: <strong className="text-ink">{pilot.casos_totales_atendidos}</strong></span>
                      <span>Derivados: <strong className="text-ink">{pilot.casos_derivados_humano}</strong></span>
                      <span>Beto: <strong className="text-ink">{pilot.seguimientos_beto_respuestas}</strong></span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Card: Propuestas en Espera de Decisión */}
          <div className="panel p-5 shadow-card">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <h2 className="text-sm font-bold text-ink">Propuestas Activas</h2>
              <Link href="/propuestas" className="text-xs font-semibold text-accent hover:underline">
                Ver todas →
              </Link>
            </div>

            <div className="mt-3 space-y-3">
              {propuestasPendientes.length === 0 ? (
                <p className="py-4 text-center text-xs text-ink-faint">
                  No hay propuestas pendientes de decisión.
                </p>
              ) : (
                propuestasPendientes.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-lg border border-line p-3 text-xs flex items-center justify-between gap-2 shadow-2xs bg-surface"
                  >
                    <div>
                      <p className="font-semibold text-ink">{p.company_name}</p>
                      <p className="text-[11px] text-ink-mut">
                        Plan {p.plan} · <strong className="font-mono text-ink">{clp(p.valor_mensual_neto)}</strong>
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-mono text-[10.5px] text-accent font-semibold">
                        Decisión: {p.decision_date ? fechaCorta(p.decision_date) : "Sin fecha"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Card: Accesos Rápidos de Venta */}
          <div className="panel p-4 shadow-card space-y-2.5">
            <p className="lbl">
              Herramientas Comerciales
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Link
                href="/llamadas"
                className="btn-ghost py-2 text-center block text-xs"
              >
                📞 Cola Llamadas
              </Link>
              <Link
                href="/prospeccion"
                className="btn-ghost py-2 text-center block text-xs"
              >
                🎯 Prospección
              </Link>
              <Link
                href="/playbook"
                className="btn-ghost py-2 text-center block text-xs"
              >
                🛡️ Playbook
              </Link>
            </div>
          </div>
        </div>
      </div>
      </div>
      )}
    </div>
  );
}
