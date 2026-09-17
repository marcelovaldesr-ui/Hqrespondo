import { db } from "@/lib/db";
import { getRevenueStore } from "@/lib/revenue/store";
import { calcularObjetivos, META_DIARIA_CONTACTOS } from "@/lib/objetivos";
import { conteosCadencia } from "@/lib/cadencia";
import { cohortesSemanales, type Cohorte } from "@/lib/actividades";
import CommandCenterV2 from "@/components/CommandCenterV2";
import RevenueErrorState from "@/components/RevenueErrorState";

export const dynamic = "force-dynamic";

/** Fase de Respondo derivada del estado real */
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
  try {
    const store = getRevenueStore();
    const [deals, meetings, pilots, proposals] = await Promise.all([
      store.getDeals(),
      store.getMeetings(),
      store.getPilots(),
      store.getProposals(),
    ]);

    // Registro estructurado de errores de Supabase (NO se silencian en [])
    const supabaseErrors: { query: string; message: string }[] = [];

    const hoy = new Date().toISOString().slice(0, 10);
    const inicioMes = `${hoy.slice(0, 7)}-01`;
    const hace24 = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    const supabase = db();

    // Consultas operacionales con control visible de errores
    const [
      clientsRes,
      errEventsRes,
      msgEventsRes,
      feedEventsRes,
      hotRes,
      segRes,
      roadmapRes,
      gastosRes,
      cobrosRes,
      focoRes,
      trabajadosHoyRes,
      legacyDealsVencidosRes,
      objetivosRes,
      cadenciaRes,
      cohortesRes,
    ] = await Promise.allSettled([
      supabase.from("clients").select("id, nombre, mensualidad, activo"),
      supabase
        .from("bot_events")
        .select("*", { count: "exact", head: true })
        .eq("tipo", "error")
        .gte("created_at", hace24),
      supabase
        .from("bot_events")
        .select("*", { count: "exact", head: true })
        .eq("tipo", "mensaje")
        .gte("created_at", `${hoy}T00:00:00`),
      supabase
        .from("bot_events")
        .select("client_id, tipo, detalle, created_at")
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("prospects")
        .select("id, nombre, comuna, score")
        .gte("score", 70)
        .order("score", { ascending: false })
        .limit(6),
      supabase
        .from("prospects")
        .select("id, nombre, estado, proxima_accion", { count: "exact" })
        .lte("proxima_accion", hoy)
        .not("estado", "in", '("descartado","en_pipeline")')
        .order("proxima_accion", { ascending: true })
        .limit(8),
      supabase
        .from("roadmap_items")
        .select("id, tarea, area, fecha_limite")
        .neq("estado", "Hecho")
        .lte("fecha_limite", hoy)
        .order("fecha_limite", { ascending: true })
        .limit(8),
      supabase.from("gastos").select("monto").gte("fecha", inicioMes),
      supabase
        .from("cobros")
        .select("monto")
        .eq("mes", inicioMes)
        .eq("estado", "pendiente"),
      supabase
        .from("leads_foco")
        .select("id", { count: "exact", head: true })
        .in("estado", ["nuevo", "contactando"])
        .in("encaje", ["alto", "medio"])
        .gte("contactabilidad", 3)
        .or(`recordatorio.is.null,recordatorio.lte.${new Date().toISOString()}`),
      supabase
        .from("prospects")
        .select("id", { count: "exact", head: true })
        .gte("updated_at", `${hoy}T00:00:00`)
        .not("estado", "in", '("nuevo","descartado")'),
      supabase
        .from("deals")
        .select("id, nombre_negocio, proxima_accion, fecha_proxima, valor_mensual, etapa")
        .lte("fecha_proxima", hoy)
        .not("etapa", "in", '("ganado","perdido")')
        .order("fecha_proxima", { ascending: true })
        .limit(8),
      calcularObjetivos(),
      conteosCadencia(),
      cohortesSemanales(6),
    ]);

    // Procesar clients
    let clientes: Array<{ id: string; nombre: string; mensualidad: number; activo: boolean }> = [];
    if (clientsRes.status === "fulfilled" && !clientsRes.value.error) {
      clientes = (clientsRes.value.data ?? []) as any;
    } else {
      const err = clientsRes.status === "rejected" ? clientsRes.reason?.message : clientsRes.value?.error?.message;
      if (err) supabaseErrors.push({ query: "clients", message: err });
    }

    const activos = clientes.filter((c) => c.activo);
    const mrrActual = activos.reduce((acc, c) => acc + (c.mensualidad || 0), 0);
    const nombresMap = Object.fromEntries(clientes.map((c) => [c.id, c.nombre]));

    // Procesar errores de bot 24h
    let errores = 0;
    if (errEventsRes.status === "fulfilled" && !errEventsRes.value.error) {
      errores = errEventsRes.value.count ?? 0;
    } else {
      const err = errEventsRes.status === "rejected" ? errEventsRes.reason?.message : errEventsRes.value?.error?.message;
      if (err) supabaseErrors.push({ query: "bot_events (errores)", message: err });
    }

    // Procesar feed de eventos
    let feed: Array<{ client_id: string | null; tipo: string; detalle: string | null; created_at: string }> = [];
    if (feedEventsRes.status === "fulfilled" && !feedEventsRes.value.error) {
      feed = (feedEventsRes.value.data ?? []) as any;
    } else {
      const err = feedEventsRes.status === "rejected" ? feedEventsRes.reason?.message : feedEventsRes.value?.error?.message;
      if (err) supabaseErrors.push({ query: "bot_events (feed)", message: err });
    }

    // Procesar hot leads
    let hot: Array<{ id: string; nombre: string; comuna: string; score: number }> = [];
    if (hotRes.status === "fulfilled" && !hotRes.value.error) {
      hot = (hotRes.value.data ?? []) as any;
    } else {
      const err = hotRes.status === "rejected" ? hotRes.reason?.message : hotRes.value?.error?.message;
      if (err) supabaseErrors.push({ query: "prospects (hot)", message: err });
    }

    // Procesar seguimientos de prospección
    let segHoy: Array<{ id: string; nombre: string; estado: string; proxima_accion: string | null }> = [];
    if (segRes.status === "fulfilled" && !segRes.value.error) {
      segHoy = (segRes.value.data ?? []) as any;
    } else {
      const err = segRes.status === "rejected" ? segRes.reason?.message : segRes.value?.error?.message;
      if (err) supabaseErrors.push({ query: "prospects (seguimientos)", message: err });
    }

    // Procesar tareas de roadmap
    let tareasHoy: Array<{ id: string; tarea: string; area: string | null; fecha_limite: string | null }> = [];
    if (roadmapRes.status === "fulfilled" && !roadmapRes.value.error) {
      tareasHoy = (roadmapRes.value.data ?? []) as any;
    } else {
      const err = roadmapRes.status === "rejected" ? roadmapRes.reason?.message : roadmapRes.value?.error?.message;
      if (err) supabaseErrors.push({ query: "roadmap_items", message: err });
    }

    // Procesar gastos
    let gastosMes = 0;
    if (gastosRes.status === "fulfilled" && !gastosRes.value.error) {
      gastosMes = ((gastosRes.value.data ?? []) as { monto: number }[]).reduce((a, g) => a + (g.monto || 0), 0);
    } else {
      const err = gastosRes.status === "rejected" ? gastosRes.reason?.message : gastosRes.value?.error?.message;
      if (err) supabaseErrors.push({ query: "gastos", message: err });
    }

    // Procesar cobros pendientes
    let cobrosPendientes = 0;
    if (cobrosRes.status === "fulfilled" && !cobrosRes.value.error) {
      cobrosPendientes = ((cobrosRes.value.data ?? []) as { monto: number }[]).reduce((a, c) => a + (c.monto || 0), 0);
    } else {
      const err = cobrosRes.status === "rejected" ? cobrosRes.reason?.message : cobrosRes.value?.error?.message;
      if (err) supabaseErrors.push({ query: "cobros", message: err });
    }

    // Procesar leads foco
    let focoPendientes = 0;
    if (focoRes.status === "fulfilled" && !focoRes.value.error) {
      focoPendientes = focoRes.value.count ?? 0;
    } else {
      const err = focoRes.status === "rejected" ? focoRes.reason?.message : focoRes.value?.error?.message;
      if (err) supabaseErrors.push({ query: "leads_foco", message: err });
    }

    // Objetivos
    let objetivos: any[] = [];
    if (objetivosRes.status === "fulfilled") {
      objetivos = objetivosRes.value;
    } else {
      supabaseErrors.push({ query: "objetivos", message: String(objetivosRes.reason) });
    }

    // Cadencia
    let cadencia = { vencidos: 0, huerfanos: 0, agotados: 0 };
    if (cadenciaRes.status === "fulfilled") {
      cadencia = cadenciaRes.value;
    } else {
      supabaseErrors.push({ query: "cadencia", message: String(cadenciaRes.reason) });
    }

    // Construir 3 prioridades del día basadas en urgencia
    const prioridades: { texto: string; href: string; nivel: "danger" | "warn" | "brand" }[] = [];
    if (errores > 0) {
      prioridades.push({
        texto: `Revisar ${errores} error${errores === 1 ? "" : "es"} de bots (últimas 24 h)`,
        href: "/clientes",
        nivel: "danger",
      });
    }
    if (segHoy.length > 0) {
      prioridades.push({
        texto: `Hacer ${segHoy.length} seguimiento${segHoy.length === 1 ? "" : "s"} vencido${segHoy.length === 1 ? "" : "s"} de prospección`,
        href: "/prospeccion",
        nivel: "warn",
      });
    }
    if (cobrosPendientes > 0) {
      prioridades.push({
        texto: `Cobrar $${cobrosPendientes.toLocaleString("es-CL")} pendientes del mes`,
        href: "/finanzas",
        nivel: "warn",
      });
    }
    const tratosEstancados = deals.filter((d) => d.stalled);
    if (tratosEstancados.length > 0) {
      prioridades.push({
        texto: `Mover ${tratosEstancados.length} oportunidad${tratosEstancados.length === 1 ? "" : "es"} estancada(s)`,
        href: "/pipeline",
        nivel: "warn",
      });
    }
    if (focoPendientes > 0) {
      prioridades.push({
        texto: `Trabajar ${focoPendientes} lead${focoPendientes === 1 ? "" : "s"} Foco con decisor (cola de hoy)`,
        href: "/foco",
        nivel: "brand",
      });
    }
    if (hot.length > 0) {
      prioridades.push({
        texto: `Contactar ${Math.min(hot.length, 10)} prospecto${hot.length === 1 ? "" : "s"} caliente${hot.length === 1 ? "" : "s"} (score ≥ 70)`,
        href: "/prospeccion",
        nivel: "brand",
      });
    }
    if (tareasHoy.length > 0) {
      prioridades.push({
        texto: `Cerrar ${tareasHoy.length} tarea${tareasHoy.length === 1 ? "" : "s"} atrasada${tareasHoy.length === 1 ? "" : "s"} del roadmap`,
        href: "/roadmap",
        nivel: "brand",
      });
    }
    if (prioridades.length === 0) {
      prioridades.push({
        texto: "Buscar prospectos nuevos: ferreterías, corredoras o clínicas por comuna",
        href: "/prospeccion",
        nivel: "brand",
      });
    }

    const mision = faseActual(activos.length);

    // Conversaciones del día atendidas por bots
    let conversacionesHoy = 0;
    if (msgEventsRes.status === "fulfilled" && !msgEventsRes.value.error) {
      conversacionesHoy = msgEventsRes.value.count ?? 0;
    } else {
      const err = msgEventsRes.status === "rejected" ? msgEventsRes.reason?.message : msgEventsRes.value?.error?.message;
      if (err) supabaseErrors.push({ query: "bot_events (mensajes)", message: err });
    }

    // Meta diaria de contactos (prospectos trabajados hoy)
    let contactosHoy = 0;
    if (trabajadosHoyRes.status === "fulfilled" && !trabajadosHoyRes.value.error) {
      contactosHoy = trabajadosHoyRes.value.count ?? 0;
    } else {
      const err = trabajadosHoyRes.status === "rejected" ? trabajadosHoyRes.reason?.message : trabajadosHoyRes.value?.error?.message;
      if (err) supabaseErrors.push({ query: "prospects (contactos hoy)", message: err });
    }

    // Cohortes semanales
    let cohortes: Cohorte[] = [];
    if (cohortesRes.status === "fulfilled") {
      cohortes = cohortesRes.value;
    } else {
      const err = cohortesRes.reason?.message || String(cohortesRes.reason);
      supabaseErrors.push({ query: "cohortes (actividades)", message: err });
    }

    // Pipeline con vencimientos (deals con acción para hoy o vencida)
    const dealsVencidosRevenue = deals
      .filter((d) => !["ganado", "perdido", "nurture"].includes(d.etapa) && d.next_action_at && d.next_action_at.slice(0, 10) <= hoy)
      .map((d) => ({
        id: d.id,
        nombre: d.company_name,
        accion: d.next_action,
        fecha: d.next_action_at,
        valor: d.valor_mensual_neto,
      }));

    let legacyDealsVencidos: Array<{ id: string; nombre: string; accion: string; fecha: string | null; valor?: number }> = [];
    if (legacyDealsVencidosRes.status === "fulfilled" && !legacyDealsVencidosRes.value.error) {
      legacyDealsVencidos = ((legacyDealsVencidosRes.value.data ?? []) as any[]).map((d) => ({
        id: d.id,
        nombre: d.nombre_negocio,
        accion: d.proxima_accion || "Seguimiento pendiente",
        fecha: d.fecha_proxima,
        valor: d.valor_mensual,
      }));
    } else {
      const err = legacyDealsVencidosRes.status === "rejected" ? legacyDealsVencidosRes.reason?.message : legacyDealsVencidosRes.value?.error?.message;
      if (err) supabaseErrors.push({ query: "deals (legacy vencidos)", message: err });
    }
    const dealsVencidos = [...dealsVencidosRevenue, ...legacyDealsVencidos].slice(0, 8);

    const legacyOps = {
      clientesActivos: activos.length,
      mrrTotal: mrrActual,
      feed,
      hot,
      nombresMap,
      errores,
      prioridades: prioridades.slice(0, 3),
      mision,
      objetivos,
      cadencia,
      finanzas: {
        gastosMes,
        cobrosPendientes,
        mrrActual,
      },
      roadmap: {
        tareasHoy,
      },
      seguimientosHoy: segHoy,
      focoPendientes,
      supabaseErrors,
      contactosHoy,
      metaDiariaContactos: META_DIARIA_CONTACTOS,
      conversacionesHoy,
      cohortes,
      dealsVencidos,
    };

    return (
      <CommandCenterV2
        deals={deals}
        meetings={meetings}
        pilots={pilots}
        proposals={proposals}
        legacyOps={legacyOps}
      />
    );
  } catch (err: any) {
    console.error("[Dashboard] Error cargando datos:", err);
    return (
      <RevenueErrorState
        error={err?.message || "Error al conectar con la base de datos"}
        route="/dashboard"
      />
    );
  }
}
