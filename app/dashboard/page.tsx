import Link from "next/link";
import { db } from "@/lib/db";
import { clp, fechaHoy, hora } from "@/lib/format";
import { calcularObjetivos, META_DIARIA_CONTACTOS } from "@/lib/objetivos";
import PageHeader from "@/components/PageHeader";
import { ESTADO_CONFIG, TIPO_EVENTO_LABEL, type TipoEvento } from "@/lib/types";
import type { Deal, Prospect } from "@/lib/types";

export const dynamic = "force-dynamic";

const DOT: Record<string, string> = {
  mensaje: "bg-accent",
  heartbeat: "bg-brand",
  error: "bg-danger",
  lead_captured: "bg-ok",
  quote_generated: "bg-ok",
  meeting_booked: "bg-ok",
  human_handoff: "bg-warn",
};

function eventoTexto(tipo: string, detalle: string | null): string {
  if (tipo === "error") return detalle ? detalle.slice(0, 48) : "error";
  return TIPO_EVENTO_LABEL[tipo as TipoEvento] ?? tipo;
}

/** Fase de Respondo derivada del estado real (sin config extra). */
function faseActual(clientesActivos: number): {
  fase: string;
  hito: string;
  frase: string;
} {
  if (clientesActivos === 0)
    return {
      fase: "Validación comercial",
      hito: "Primer cliente piloto",
      frase: "La validación se gana hablando con clientes.",
    };
  if (clientesActivos < 5)
    return {
      fase: "Primeros pilotos",
      hito: "5 clientes y 2 casos de éxito",
      frase: "Cada cliente implementado es un caso de éxito en construcción.",
    };
  return {
    fase: "Crecimiento",
    hito: "10 clientes activos y estructura B de precios",
    frase: "El momentum se construye contacto a contacto.",
  };
}

export default async function Dashboard() {
  const s = db();
  const hoy = new Date().toISOString().slice(0, 10);
  const inicioMes = `${hoy.slice(0, 7)}-01`;
  const hace24 = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const hace5d = new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString();
  const hace7d = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const [
    hotRes,
    segRes,
    dealsRes,
    clientsRes,
    errRes,
    msgRes,
    feedRes,
    sparkRes,
    roadmapHoyRes,
    dealsHoyRes,
    gastosMesRes,
    cobrosPendRes,
    trabajadosHoyRes,
    objetivos,
  ] = await Promise.all([
    s
      .from("prospects")
      .select("*")
      .eq("estado", ESTADO_CONFIG.nuevo.value)
      .gte("score", 70)
      .order("score", { ascending: false }),
    s
      .from("prospects")
      .select("id,nombre,estado,proxima_accion", { count: "exact" })
      .lte("proxima_accion", hoy)
      .not(
        "estado",
        "in",
        `("${ESTADO_CONFIG.descartado.value}","${ESTADO_CONFIG.en_pipeline.value}")`,
      )
      .order("proxima_accion", { ascending: true })
      .limit(8),
    s.from("deals").select("*").in("etapa", ["contactado", "demo", "propuesta"]),
    s.from("clients").select("id,nombre,mensualidad,activo"),
    s
      .from("bot_events")
      .select("*", { count: "exact", head: true })
      .eq("tipo", "error")
      .gte("created_at", hace24),
    s
      .from("bot_events")
      .select("*", { count: "exact", head: true })
      .eq("tipo", "mensaje")
      .gte("created_at", `${hoy}T00:00:00`),
    s
      .from("bot_events")
      .select("client_id,tipo,detalle,created_at")
      .order("created_at", { ascending: false })
      .limit(8),
    s
      .from("bot_events")
      .select("created_at")
      .eq("tipo", "mensaje")
      .gte("created_at", hace7d),
    s
      .from("roadmap_items")
      .select("id,tarea,area,fecha_limite")
      .neq("estado", "Hecho")
      .lte("fecha_limite", hoy)
      .order("fecha_limite", { ascending: true })
      .limit(8),
    s
      .from("deals")
      .select("id,nombre_negocio,proxima_accion,fecha_proxima")
      .in("etapa", ["contactado", "demo", "propuesta"])
      .lte("fecha_proxima", hoy)
      .order("fecha_proxima", { ascending: true })
      .limit(8),
    s.from("gastos").select("monto").gte("fecha", inicioMes),
    s
      .from("cobros")
      .select("monto")
      .eq("mes", inicioMes)
      .eq("estado", "pendiente"),
    s
      .from("prospects")
      .select("id", { count: "exact", head: true })
      .gte("updated_at", `${hoy}T00:00:00`)
      .not("estado", "in", `("nuevo","descartado")`),
    calcularObjetivos(),
  ]);

  const hot = (hotRes.data ?? []) as Prospect[];
  const deals = (dealsRes.data ?? []) as Deal[];
  const clientes = (clientsRes.data ?? []) as {
    id: string;
    nombre: string;
    mensualidad: number;
    activo: boolean;
  }[];
  const nombres = new Map(clientes.map((c) => [c.id, c.nombre]));
  const activos = clientes.filter((c) => c.activo);

  const mrrProyectado = deals.reduce((a, d) => a + (d.valor_mensual || 0), 0);
  const mrrActual = activos.reduce((a, c) => a + (c.mensualidad || 0), 0);
  const PROB: Record<string, number> = { contactado: 0.1, demo: 0.3, propuesta: 0.5 };
  const mrrProbable = Math.round(
    deals.reduce((a, d) => a + (d.valor_mensual || 0) * (PROB[d.etapa] ?? 0), 0),
  );
  const errores = errRes.count ?? 0;
  const trabajadosHoy = trabajadosHoyRes.count ?? 0;
  const gastosMes = ((gastosMesRes.data ?? []) as { monto: number }[]).reduce(
    (a, g) => a + g.monto,
    0,
  );
  const cobrosPendientes = ((cobrosPendRes.data ?? []) as { monto: number }[]).reduce(
    (a, c) => a + c.monto,
    0,
  );
  const detenidas = deals.filter((d) => d.updated_at < hace5d);
  const feed = (feedRes.data ?? []) as {
    client_id: string | null;
    tipo: string;
    detalle: string | null;
    created_at: string;
  }[];

  const spark = Array(7).fill(0) as number[];
  for (const e of (sparkRes.data ?? []) as { created_at: string }[]) {
    const idx =
      6 - Math.floor((Date.now() - new Date(e.created_at).getTime()) / 86400000);
    if (idx >= 0 && idx < 7) spark[idx]++;
  }
  const sparkMax = Math.max(1, ...spark);

  const segHoy = (segRes.data ?? []) as {
    id: string;
    nombre: string;
    estado: string;
    proxima_accion: string | null;
  }[];
  const tareasHoy = (roadmapHoyRes.data ?? []) as {
    id: string;
    tarea: string;
    area: string | null;
    fecha_limite: string | null;
  }[];
  const dealsHoy = (dealsHoyRes.data ?? []) as {
    id: string;
    nombre_negocio: string;
    proxima_accion: string | null;
    fecha_proxima: string | null;
  }[];
  const totalHoy = segHoy.length + tareasHoy.length + dealsHoy.length;

  const mision = faseActual(activos.length);
  const metaClientes = objetivos.find((o) => o.clave === "clientes");

  // ---- 3 prioridades del día (reglas simples, en orden de urgencia) ----
  const prioridades: { texto: string; href: string; nivel: "danger" | "warn" | "brand" }[] = [];
  if (errores > 0)
    prioridades.push({
      texto: `Revisar ${errores} error${errores === 1 ? "" : "es"} de bots (últimas 24 h)`,
      href: "/clientes",
      nivel: "danger",
    });
  if ((segRes.count ?? 0) > 0)
    prioridades.push({
      texto: `Hacer ${segRes.count} seguimiento${segRes.count === 1 ? "" : "s"} vencido${segRes.count === 1 ? "" : "s"} de prospección`,
      href: "/prospeccion",
      nivel: "warn",
    });
  if (cobrosPendientes > 0)
    prioridades.push({
      texto: `Cobrar ${clp(cobrosPendientes)} pendientes del mes`,
      href: "/finanzas",
      nivel: "warn",
    });
  if (detenidas.length > 0)
    prioridades.push({
      texto: `Mover ${detenidas.length} oportunidad${detenidas.length === 1 ? "" : "es"} sin movimiento hace 5+ días`,
      href: "/pipeline",
      nivel: "warn",
    });
  if (hot.length > 0)
    prioridades.push({
      texto: `Contactar ${Math.min(hot.length, 10)} prospecto${hot.length === 1 ? "" : "s"} caliente${hot.length === 1 ? "" : "s"} (score ≥ 70)`,
      href: "/prospeccion",
      nivel: "brand",
    });
  if (tareasHoy.length > 0)
    prioridades.push({
      texto: `Cerrar ${tareasHoy.length} tarea${tareasHoy.length === 1 ? "" : "s"} atrasada${tareasHoy.length === 1 ? "" : "s"} del roadmap`,
      href: "/roadmap",
      nivel: "brand",
    });
  if (prioridades.length === 0)
    prioridades.push({
      texto: "Buscar prospectos nuevos: ferreterías, corredoras o clínicas por comuna",
      href: "/prospeccion",
      nivel: "brand",
    });
  const top3 = prioridades.slice(0, 3);
  const PRIO_LED: Record<string, string> = {
    danger: "bg-danger",
    warn: "bg-warn",
    brand: "bg-brand",
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Centro de mando"
        sub={fechaHoy()}
        right={
          <span className="flex items-center gap-4 font-mono text-[11px] text-ink-dim">
            <span
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 ${errores > 0 ? "border-danger/35 bg-danger/10 text-danger" : "border-ok/30 bg-ok/10 text-ok"}`}
            >
              <span className={`led ${errores > 0 ? "bg-danger" : "bg-ok"}`} />
              {errores > 0 ? `${errores} errores` : "Sistema operativo"}
            </span>
            {hora(new Date().toISOString())}
          </span>
        }
      />

      {/* ---- Estado de la misión ---- */}
      <section
        className="panel relative overflow-hidden p-5"
        style={{
          backgroundImage:
            "linear-gradient(120deg, rgba(123,91,240,0.06), rgba(37,99,235,0.04) 55%, rgba(236,106,86,0.05))",
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="lbl">Estado de la misión</div>
            <div className="mt-2 flex flex-wrap items-baseline gap-3">
              <span className="text-xl font-semibold tracking-tight">
                Fase: {mision.fase}
              </span>
              <span className="chip border-brand/30 bg-brand/[0.07] px-2.5 py-0.5 text-[11px] text-brand">
                Próximo hito: {mision.hito}
              </span>
            </div>
            <p className="mt-2 text-[12.5px] text-ink-mut">{mision.frase}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="lbl">Meta del mes</div>
            {metaClientes && (
              <>
                <div className="font-mono text-2xl leading-none">
                  {metaClientes.avance}
                  <span className="text-ink-dim">/{metaClientes.meta}</span>{" "}
                  <span className="text-sm text-ink-mut">clientes cerrados</span>
                </div>
                <span className="h-[5px] w-40 overflow-hidden rounded-full bg-surface-3">
                  <span
                    className="block h-full rounded-full bg-gradient-to-r from-brand to-coral"
                    style={{
                      width: `${Math.min(100, (metaClientes.avance / metaClientes.meta) * 100)}%`,
                    }}
                  />
                </span>
              </>
            )}
          </div>
        </div>

        <div className="relative mt-4 border-t border-line pt-4">
          <div className="lbl mb-2.5">Las 3 prioridades de hoy</div>
          <div className="grid gap-2 md:grid-cols-3">
            {top3.map((p, i) => (
              <Link
                key={i}
                href={p.href}
                className="group flex items-center gap-2.5 rounded-lg border border-line bg-surface-2/80 px-3 py-2.5 text-[13px] transition hover:border-brand/35 hover:bg-brand/[0.04]"
              >
                <span className="font-mono text-[11px] text-ink-faint">{i + 1}</span>
                <span className={`led ${PRIO_LED[p.nivel]}`} />
                <span className="flex-1 leading-snug text-ink-soft group-hover:text-ink">
                  {p.texto}
                </span>
                <span className="text-ink-faint transition group-hover:translate-x-0.5 group-hover:text-brand">
                  →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Meta de venta de hoy ---- */}
      <section className="panel mt-3 flex flex-wrap items-center gap-4 p-4">
        <div className="min-w-0 flex-1">
          <div className="lbl">Ritmo de venta — hoy</div>
          <p className="mt-1 text-[13px] text-ink-soft">
            Meta del día:{" "}
            <strong className="text-ink">
              {META_DIARIA_CONTACTOS} negocios contactados
            </strong>{" "}
            (entre los dos). Vas{" "}
            <strong className={trabajadosHoy >= META_DIARIA_CONTACTOS ? "text-ok" : "text-ink"}>
              {trabajadosHoy}
            </strong>
            .{" "}
            {trabajadosHoy >= META_DIARIA_CONTACTOS
              ? "¡Meta cumplida! 🎯"
              : "El próximo cliente está en la lista."}
          </p>
          <span className="mt-2 block h-[5px] w-full max-w-sm overflow-hidden rounded-full bg-surface-3">
            <span
              className="block h-full rounded-full bg-gradient-to-r from-brand to-coral"
              style={{
                width: `${Math.min(100, (trabajadosHoy / META_DIARIA_CONTACTOS) * 100)}%`,
              }}
            />
          </span>
        </div>
        <Link href="/prospeccion" className="btn-primary text-xs">
          Prospectar ahora
        </Link>
      </section>

      {/* ---- Métricas principales ---- */}
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="metric-card">
          <div className="relative">
            <div className="lbl">MRR actual</div>
            <div className="mt-3 font-mono text-4xl font-medium leading-none text-ok">
              {clp(mrrActual)}
            </div>
          </div>
          <div className="relative mt-4 flex items-end justify-between">
            <span className="text-[11px] text-ink-mut">
              {activos.length === 0
                ? "Fase inicial — el primer cliente está en la lista"
                : `${activos.length} cliente${activos.length === 1 ? "" : "s"} activo${activos.length === 1 ? "" : "s"}`}
            </span>
            <span className="flex items-end gap-[3px]" aria-hidden="true">
              {spark.map((n, i) => (
                <span
                  key={i}
                  className={n > 0 ? "bg-brand" : "bg-brand/20"}
                  style={{
                    width: 6,
                    height: 7 + Math.round((n / sparkMax) * 20),
                    display: "inline-block",
                  }}
                />
              ))}
            </span>
          </div>
        </div>
        <div className="metric-card">
          <div className="relative">
            <div className="lbl">MRR en pipeline</div>
            <div className="mt-3 font-mono text-4xl font-medium leading-none">
              {clp(mrrProyectado)}
            </div>
            <div className="mt-4 flex items-center justify-between text-sm text-ink-mut">
              <span>
                {deals.length} oportunidad{deals.length === 1 ? "" : "es"} activa
                {deals.length === 1 ? "" : "s"}
              </span>
              <span className="font-mono text-[11px] text-ink-dim">
                probable {clp(mrrProbable)}
              </span>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="relative">
            <div className="lbl">Calientes sin contactar</div>
            <div className="mt-3 font-mono text-4xl font-medium leading-none text-accent">
              {hot.length}
            </div>
            <div className="mt-4 text-sm text-ink-mut">score ≥ 70</div>
          </div>
        </div>
      </div>

      {/* ---- Fila operativa: bots + finanzas ---- */}
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Link href="/clientes" className="panel flex items-center gap-4 p-4 transition hover:border-danger/30 hover:bg-danger/[0.035]">
          <span className={`led h-2.5 w-2.5 ${errores > 0 ? "bg-danger" : "bg-ok"}`} />
          <div>
            <div className={`font-mono text-xl ${errores > 0 ? "text-danger" : ""}`}>
              {errores}
            </div>
            <div className="lbl">Errores bots 24h</div>
          </div>
        </Link>
        <Link href="/clientes" className="panel flex items-center gap-4 p-4 transition hover:border-accent/30 hover:bg-accent/[0.035]">
          <span className="led h-2.5 w-2.5 bg-accent" />
          <div>
            <div className="font-mono text-xl">{msgRes.count ?? 0}</div>
            <div className="lbl">Conversaciones hoy</div>
          </div>
        </Link>
        <Link href="/finanzas" className="panel flex items-center gap-4 p-4 transition hover:border-warn/30 hover:bg-warn/[0.035]">
          <span className={`led h-2.5 w-2.5 ${cobrosPendientes > 0 ? "bg-warn" : "bg-ink-faint"}`} />
          <div>
            <div className={`font-mono text-xl ${cobrosPendientes > 0 ? "text-warn" : ""}`}>
              {clp(cobrosPendientes)}
            </div>
            <div className="lbl">Por cobrar (mes)</div>
          </div>
        </Link>
        <Link
          href="/finanzas"
          className={`panel flex items-center gap-4 p-4 transition hover:border-warn/30 hover:bg-warn/[0.035] ${gastosMes > mrrActual ? "border-warn/30" : ""}`}
        >
          <span className={`led h-2.5 w-2.5 ${gastosMes > mrrActual ? "bg-warn" : "bg-ink-faint"}`} />
          <div>
            <div className="font-mono text-xl text-danger">{clp(gastosMes)}</div>
            <div className="lbl">
              Gastos mes{gastosMes > mrrActual ? " · sobre MRR" : ""}
            </div>
          </div>
        </Link>
      </div>

      {/* ---- Objetivos del mes ---- */}
      <section className="panel mt-3 p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="lbl">Objetivos de julio — camino al primer hito</span>
          <span className="font-mono text-[11px] text-ink-dim">
            metas del roadmap comercial 30 días
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {objetivos.map((o) => {
            const pct = Math.min(100, Math.round((o.avance / o.meta) * 100));
            const color =
              o.estado === "logrado"
                ? "text-ok"
                : o.estado === "atrasado"
                  ? "text-warn"
                  : "text-ink";
            const bar =
              o.estado === "logrado"
                ? "bg-ok"
                : o.estado === "atrasado"
                  ? "bg-warn"
                  : "bg-brand";
            return (
              <div key={o.clave} className="subpanel px-3 py-2.5" title={o.accion}>
                <div className="text-[10.5px] leading-tight text-ink-dim">{o.label}</div>
                <div className={`mt-1.5 font-mono text-lg leading-none ${color}`}>
                  {o.avance}
                  <span className="text-[12px] text-ink-faint">/{o.meta}</span>
                </div>
                <span className="mt-2 block h-[4px] overflow-hidden rounded-full bg-surface-4">
                  <span className={`block h-full ${bar}`} style={{ width: `${pct}%` }} />
                </span>
              </div>
            );
          })}
        </div>
        {objetivos.some((o) => o.estado === "atrasado") && (
          <p className="mt-3 text-[12px] text-ink-mut">
            →{" "}
            {objetivos.find((o) => o.estado === "atrasado")?.accion ??
              "Aumentar ritmo de prospección"}
          </p>
        )}
      </section>

      {/* ---- Hoy — lo accionable ---- */}
      <section className="panel mt-3 p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="lbl">Hoy — lo accionable</span>
          <span className="font-mono text-[11px] text-ink-dim">
            {totalHoy} pendiente{totalHoy === 1 ? "" : "s"}
          </span>
        </div>
        {totalHoy === 0 ? (
          <p className="text-sm text-ink-dim">
            Sin fechas comprometidas para hoy. Hoy se construye pipeline:{" "}
            <Link href="/prospeccion" className="text-brand underline">
              busca un rubro + comuna
            </Link>{" "}
            o contacta a los calientes de abajo.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Link href="/prospeccion" className="lbl mb-2 block text-[10px] hover:text-brand">
                Seguimientos de prospección ({segHoy.length})
              </Link>
              <div className="flex flex-col gap-1.5 text-[13px]">
                {segHoy.length === 0 && <span className="text-xs text-ink-faint">—</span>}
                {segHoy.map((s2) => (
                  <Link key={s2.id} href="/prospeccion" className="group flex items-center gap-2">
                    <span className="led bg-warn" />
                    <span className="flex-1 truncate text-ink-soft group-hover:text-ink">{s2.nombre}</span>
                    <span className="font-mono text-[10px] text-ink-dim">{s2.proxima_accion ?? ""}</span>
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <Link href="/roadmap" className="lbl mb-2 block text-[10px] hover:text-brand">
                Tareas del roadmap ({tareasHoy.length})
              </Link>
              <div className="flex flex-col gap-1.5 text-[13px]">
                {tareasHoy.length === 0 && <span className="text-xs text-ink-faint">—</span>}
                {tareasHoy.map((t) => (
                  <Link key={t.id} href="/roadmap" className="group flex items-center gap-2">
                    <span className="led bg-brand" />
                    <span className="flex-1 truncate text-ink-soft group-hover:text-ink">{t.tarea}</span>
                    <span className="font-mono text-[10px] text-ink-dim">{t.fecha_limite ?? ""}</span>
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <Link href="/pipeline" className="lbl mb-2 block text-[10px] hover:text-brand">
                Pipeline con fecha ({dealsHoy.length})
              </Link>
              <div className="flex flex-col gap-1.5 text-[13px]">
                {dealsHoy.length === 0 && <span className="text-xs text-ink-faint">—</span>}
                {dealsHoy.map((d) => (
                  <Link key={d.id} href="/pipeline" className="group flex items-center gap-2">
                    <span className="led bg-accent" />
                    <span className="flex-1 truncate text-ink-soft group-hover:text-ink">{d.nombre_negocio}</span>
                    <span className="truncate font-mono text-[10px] text-ink-dim">{d.proxima_accion ?? d.fecha_proxima ?? ""}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.15fr_1fr]">
        <section className="panel-hot scanline p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="lbl">Actividad en vivo</span>
            <span className="led bg-accent" />
          </div>
          {feed.length === 0 ? (
            <p className="text-xs text-ink-dim">
              Sin eventos aún. Cuando tus bots reporten a{" "}
              <code className="rounded bg-surface-3 px-1">/api/hooks/bot-events</code>{" "}
              vas a ver el flujo acá — mientras tanto, el flujo lo generas tú
              prospectando.
            </p>
          ) : (
            <div className="relative font-mono text-[12px] leading-[2.7] text-ink-mut">
              {feed.map((e, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-ink-faint">{hora(e.created_at)}</span>
                  <span className={`led ${DOT[e.tipo] ?? "bg-ink-faint"}`} />
                  <span className="truncate">
                    <span className="text-ink-soft">
                      {e.client_id ? nombres.get(e.client_id) ?? "sistema" : "sistema"}
                    </span>{" "}
                    — {eventoTexto(e.tipo, e.detalle)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel-hot p-5">
          <div className="lbl mb-3">Contactar primero</div>
          {hot.length === 0 ? (
            <p className="text-xs text-ink-dim">
              Sin prospectos calientes en la bandeja. El próximo cliente está en
              la lista:{" "}
              <Link href="/prospeccion" className="text-brand underline">
                busca un rubro + comuna
              </Link>{" "}
              y deja que el scoring priorice.
            </p>
          ) : (
            <div className="relative flex flex-col gap-3 text-sm">
              {hot.slice(0, 6).map((p) => (
                <div key={p.id} className="flex items-center gap-2.5">
                  <span
                    className={`w-9 font-mono text-base ${p.score >= 70 ? "text-ok" : "text-warn"}`}
                  >
                    {p.score}
                  </span>
                  <span className="flex-1 truncate font-medium text-ink-soft">{p.nombre}</span>
                  <span className="hidden text-[10.5px] text-ink-dim sm:inline">
                    {p.comuna}
                  </span>
                  <span className="h-[5px] w-16 overflow-hidden rounded-full bg-surface-3">
                    <span
                      className={`block h-full ${p.score >= 70 ? "bg-ok" : "bg-warn"}`}
                      style={{ width: `${p.score}%` }}
                    />
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
