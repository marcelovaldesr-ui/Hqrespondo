import { db } from "./db";
import { gemini } from "./gemini";
import { ESTADO_CONFIG } from "./types";

/**
 * Junta el estado del negocio (prospectos, pipeline, bots) y genera
 * el brief diario con Gemini. Lo guarda en la tabla briefs.
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

  await s.from("briefs").insert({ contenido });
  return contenido;
}
