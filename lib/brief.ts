import { db } from "./db";
import { gemini } from "./gemini";
import { ESTADO_CONFIG } from "./types";
import type { HorarioAtencion } from "./types";

/**
 * Junta el estado del negocio (prospectos, pipeline, bots) y genera
 * el brief diario con Gemini. Lo guarda en la tabla briefs (tipo 'diario').
 * Si Gemini falla, arma un brief básico sin IA (nunca falla completo).
 */
export async function generarBrief(): Promise<string> {
  const s = db();
  const hoy = new Date().toISOString().slice(0, 10);
  const hace24 = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const hace5d = new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString();

  const [hotRes, vencRes, staleRes, errRes, cliRes, msgRes] = await Promise.all([
    s
      .from("prospects")
      .select("nombre,rubro,comuna,score")
      .eq("estado", ESTADO_CONFIG.nuevo.value)
      .gte("score", 70)
      .order("score", { ascending: false })
      .limit(8),
    s
      .from("prospects")
      .select("nombre,estado,proxima_accion")
      .lte("proxima_accion", hoy)
      .not(
        "estado",
        "in",
        `("${ESTADO_CONFIG.descartado.value}","${ESTADO_CONFIG.en_pipeline.value}")`,
      ),
    s
      .from("deals")
      .select("nombre_negocio,etapa,updated_at")
      .in("etapa", ["contactado", "demo", "propuesta"])
      .lt("updated_at", hace5d),
    s
      .from("bot_events")
      .select("client_id,detalle,created_at")
      .eq("tipo", "error")
      .gte("created_at", hace24),
    s.from("clients").select("id,nombre").eq("activo", true),
    s
      .from("bot_events")
      .select("client_id")
      .eq("tipo", "mensaje")
      .gte("created_at", hace24),
  ]);

  const nombreCliente = new Map<string, string>(
    (cliRes.data ?? []).map((c: any) => [c.id, c.nombre]),
  );

  const mensajesPorCliente: Record<string, number> = {};
  for (const e of msgRes.data ?? []) {
    const nombre = nombreCliente.get((e as any).client_id) ?? "desconocido";
    mensajesPorCliente[nombre] = (mensajesPorCliente[nombre] ?? 0) + 1;
  }

  const datos = {
    fecha: hoy,
    prospectos_calientes_sin_contactar: hotRes.data ?? [],
    seguimientos_vencidos_o_de_hoy: vencRes.data ?? [],
    pipeline_sin_movimiento_5_dias: staleRes.data ?? [],
    errores_bots_24h: (errRes.data ?? []).map((e: any) => ({
      cliente: nombreCliente.get(e.client_id) ?? "desconocido",
      detalle: e.detalle,
    })),
    conversaciones_24h_por_cliente: mensajesPorCliente,
  };

  let contenido: string;
  try {
    contenido = await gemini(
      `Eres el asistente de operaciones de Respondo (bots de WhatsApp para pymes chilenas). Genera el brief diario de Marcelo para hoy ${hoy}.

Formato: texto plano para WhatsApp (NADA de markdown). Secciones con estos encabezados, solo si tienen datos:
🔥 CONTACTAR HOY (prospectos calientes, máx 5, con score)
⏰ SEGUIMIENTOS (vencidos o para hoy)
📋 PIPELINE DETENIDO (deals sin movimiento hace 5+ días)
⚠️ BOTS CON PROBLEMAS (errores últimas 24 h)
🤖 ACTIVIDAD (conversaciones por cliente, 1 línea)

Estilo: español de Chile, directo, accionable, máximo 220 palabras. Cierra con UNA prioridad clara del día.

Datos:
${JSON.stringify(datos, null, 2)}`,
    );
  } catch {
    // Fallback sin IA: brief básico pero útil
    const hot = (hotRes.data ?? [])
      .map((p: any) => `- ${p.nombre} (${p.comuna}, score ${p.score})`)
      .join("\n");
    const errores = datos.errores_bots_24h
      .map((e) => `- ${e.cliente}: ${e.detalle ?? "error"}`)
      .join("\n");
    contenido = `Brief ${hoy} (modo básico)\n\n🔥 Contactar hoy:\n${hot || "- nada pendiente"}\n\n⏰ Seguimientos: ${datos.seguimientos_vencidos_o_de_hoy.length}\n📋 Pipeline detenido: ${datos.pipeline_sin_movimiento_5_dias.length}\n⚠️ Errores bots:\n${errores || "- sin errores"}`;
  }

  await s.from("briefs").insert({ contenido, tipo: "diario" });
  return contenido;
}

/**
 * Reporte mensual EN LENGUAJE DE CLIENTE (sin jerga interna, sin costos
 * ni datos de otros clientes). Por ahora es de uso interno: queda guardado
 * en briefs (tipo 'mensual_cliente') y visible solo en el panel.
 * Cubre los últimos 30 días de actividad del bot del cliente.
 */
export async function generarReporteMensual(clientId: string): Promise<string> {
  const s = db();
  const hoy = new Date().toISOString().slice(0, 10);
  const hace30 = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

  const [cliRes, evRes, cfgRes] = await Promise.all([
    s.from("clients").select("id,nombre,rubro,fecha_inicio").eq("id", clientId).single(),
    s
      .from("bot_events")
      .select("tipo,created_at")
      .eq("client_id", clientId)
      .gte("created_at", hace30),
    s
      .from("bot_configs")
      .select("horario_atencion,derivacion_contacto")
      .eq("client_id", clientId)
      .maybeSingle(),
  ]);

  if (cliRes.error || !cliRes.data) {
    throw new Error("Cliente no encontrado");
  }
  const cliente = cliRes.data;
  const eventos = evRes.data ?? [];

  const mensajes = eventos.filter((e) => e.tipo === "mensaje");
  const errores = eventos.filter((e) => e.tipo === "error");

  // Conversaciones por semana (4 buckets, la más antigua primero)
  const porSemana = [0, 0, 0, 0];
  const ahora = Date.now();
  for (const m of mensajes) {
    const dias = (ahora - new Date(m.created_at).getTime()) / 86400000;
    const idx = 3 - Math.min(3, Math.floor(dias / 7.5));
    porSemana[idx]++;
  }

  // Día con más conversaciones
  const porDia: Record<string, number> = {};
  for (const m of mensajes) {
    const d = m.created_at.slice(0, 10);
    porDia[d] = (porDia[d] ?? 0) + 1;
  }
  const diaPico = Object.entries(porDia).sort((a, b) => b[1] - a[1])[0] ?? null;

  const horario = (cfgRes.data?.horario_atencion ?? {}) as HorarioAtencion;

  const datos = {
    cliente: cliente.nombre,
    rubro: cliente.rubro,
    periodo: `últimos 30 días (al ${hoy})`,
    conversaciones_atendidas: mensajes.length,
    conversaciones_por_semana: porSemana,
    dia_con_mas_actividad: diaPico ? { fecha: diaPico[0], conversaciones: diaPico[1] } : null,
    interrupciones_breves_resueltas: errores.length,
    horario_configurado: horario,
  };

  let contenido: string;
  try {
    contenido = await gemini(
      `Eres el asistente de Respondo (asistentes de venta con IA para WhatsApp, Chile). Redacta el reporte mensual para el cliente "${cliente.nombre}" — es el dueño de una pyme, NO es técnico.

Reglas estrictas:
- Lenguaje simple y cercano (español de Chile), CERO jerga técnica (nada de "bot_events", "workflows", "API", "uptime").
- NO menciones costos internos de Respondo, otros clientes, ni detalles de infraestructura.
- Los errores preséntalos como "interrupciones breves ya resueltas por nuestro equipo" solo si hubo (${errores.length}); si no hubo, destaca que el asistente funcionó sin interrupciones.
- Texto plano (sin markdown). Máximo 250 palabras.

Estructura:
1. Saludo breve y resumen del mes en una frase.
2. ACTIVIDAD: cuántas conversaciones atendió el asistente, cómo se repartieron por semana, y el día de mayor actividad.
3. DISPONIBILIDAD: que el asistente atendió (según horario configurado si existe).
4. RECOMENDACIÓN: una sola sugerencia simple y accionable para aprovechar mejor el asistente.
5. Despedida cordial firmada "Equipo Respondo".

Datos reales:
${JSON.stringify(datos, null, 2)}`,
    );
  } catch {
    // Fallback sin IA
    contenido = `Reporte mensual — ${cliente.nombre} (${datos.periodo})

Hola, les compartimos el resumen del mes de su asistente de WhatsApp.

ACTIVIDAD: el asistente atendió ${mensajes.length} conversaciones en los últimos 30 días.${diaPico ? ` El día de mayor actividad fue el ${diaPico[0]} con ${diaPico[1]} conversaciones.` : ""}

DISPONIBILIDAD: ${errores.length === 0 ? "el asistente funcionó sin interrupciones durante todo el período." : `hubo ${errores.length} interrupción${errores.length === 1 ? "" : "es"} breve${errores.length === 1 ? "" : "s"}, ya resuelta${errores.length === 1 ? "" : "s"} por nuestro equipo.`}

Cualquier duda, estamos disponibles por este mismo canal.

Equipo Respondo`;
  }

  await s.from("briefs").insert({
    contenido,
    tipo: "mensual_cliente",
    client_id: clientId,
  });
  return contenido;
}
