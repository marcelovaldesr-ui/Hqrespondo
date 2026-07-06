import Link from "next/link";
import { db } from "@/lib/db";
import { clp, fechaHoy, hora } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import { ESTADO_CONFIG } from "@/lib/types";
import type { Deal, Prospect } from "@/lib/types";

export const dynamic = "force-dynamic";

const DOT: Record<string, string> = {
  mensaje: "bg-accent",
  heartbeat: "bg-brand",
  error: "bg-danger",
};

function eventoTexto(tipo: string, detalle: string | null): string {
  if (tipo === "error") return detalle ? detalle.slice(0, 48) : "error";
  if (tipo === "heartbeat") return "Heartbeat OK";
  return "Conversación atendida";
}

export default async function Dashboard() {
  const s = db();
  const hoy = new Date().toISOString().slice(0, 10);
  const hace24 = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const hace7d = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const [hotRes, segRes, dealsRes, clientsRes, errRes, msgRes, feedRes, sparkRes, roadmapHoyRes, dealsHoyRes] =
    await Promise.all([
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
  const errores = errRes.count ?? 0;
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

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Centro de operaciones"
        sub={fechaHoy()}
        right={
          <span className="flex items-center gap-4 font-mono text-[11px] text-ink-dim">
            <span
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 ${errores > 0 ? "border-danger/35 bg-danger/10 text-danger" : "border-ok/30 bg-ok/10 text-ok"}`}
            >
              <span
                className={`led ${errores > 0 ? "bg-danger" : "bg-ok"}`}
              />
              {errores > 0 ? `${errores} errores` : "Operativo"}
            </span>
            {hora(new Date().toISOString())}
          </span>
        }
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="metric-card">
          <div className="relative">
            <div className="lbl">MRR actual</div>
            <div className="mt-3 font-mono text-4xl font-medium leading-none text-ok">
              {clp(mrrActual)}
            </div>
          </div>
          <div className="relative mt-4 flex items-end justify-between">
            <span className="text-[11px] text-ink-mut">
              {activos.length} cliente{activos.length === 1 ? "" : "s"} activo
              {activos.length === 1 ? "" : "s"}
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
            <div className="mt-4 text-sm text-ink-mut">
              {deals.length} oportunidad{deals.length === 1 ? "" : "es"} activa
              {deals.length === 1 ? "" : "s"}
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

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Link href="/clientes" className="panel flex items-center gap-4 p-4 transition hover:border-danger/30 hover:bg-danger/[0.035]">
          <span
            className={`led h-2.5 w-2.5 ${errores > 0 ? "bg-danger" : "bg-ok"}`}
          />
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
        <Link href="/prospeccion" className="panel flex items-center gap-4 p-4 transition hover:border-warn/30 hover:bg-warn/[0.035]">
          <span className={`led h-2.5 w-2.5 ${(segRes.count ?? 0) > 0 ? "bg-warn" : "bg-ink-faint"}`} />
          <div>
            <div className={`font-mono text-xl ${(segRes.count ?? 0) > 0 ? "text-warn" : ""}`}>
              {segRes.count ?? 0}
            </div>
            <div className="lbl">Seguimientos hoy</div>
          </div>
        </Link>
      </div>

      <section className="panel mt-3 p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="lbl">Hoy — lo accionable</span>
          <span className="font-mono text-[11px] text-ink-dim">
            {totalHoy} pendiente{totalHoy === 1 ? "" : "s"}
          </span>
        </div>
        {totalHoy === 0 ? (
          <p className="text-sm text-ink-dim">
            Nada pendiente para hoy — todo al día. ✓
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
              vas a ver el flujo acá.
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
              Sin prospectos calientes. Anda a{" "}
              <Link href="/prospeccion" className="text-brand underline">
                prospección
              </Link>{" "}
              y busca un rubro + comuna.
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
