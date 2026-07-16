import { db } from "@/lib/db";
import type { SenalesWeb } from "@/lib/enriquecimiento";

/**
 * GET /api/prospects/csv-llamadas?score_min=70&limit=40
 *
 * Genera el CSV DIARIO de llamadas y lo descarga directo del navegador
 * (con la sesión del panel). Reglas:
 *  - Solo estado "nuevo", con teléfono y score >= score_min.
 *  - No repite un prospecto hasta 7 días después del último intento.
 *  - Máximo 3 rondas por prospecto (después: descartar a mano).
 *  - Idempotente por día: si lo descargas dos veces hoy, sale la misma lista.
 *
 * Uso diario: abrir en el navegador
 *   https://<tu-hq>.vercel.app/api/prospects/csv-llamadas
 */

function resumenSenales(s: SenalesWeb | null): string {
  if (!s) return "sin datos";
  if (!s.visitada) return "sin web verificable (prob. manual)";
  const partes: string[] = [];
  if (s.chatbot) partes.push(`chatbot:${s.chatbot}`);
  if (s.reservas) partes.push(`reservas:${s.reservas}`);
  if (s.ecommerce) partes.push(`ecommerce:${s.ecommerce}`);
  if (s.crm) partes.push(`crm:${s.crm}`);
  if (s.whatsapp_link) partes.push("usa WhatsApp");
  if (partes.length === 0) partes.push("web SIN automatización");
  return `${s.potencial.toUpperCase()} | ${partes.join(", ")}`;
}

function csvCampo(v: unknown): string {
  const s = String(v ?? "").replace(/"/g, '""');
  return `"${s}"`;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const scoreMin = Number(url.searchParams.get("score_min") ?? 70);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 40), 200);
    // ?preview=1 → solo mirar la lista, SIN marcar la ronda del día.
    const preview = url.searchParams.get("preview") === "1";

    const ahora = new Date();
    const hoy = new Date(ahora);
    hoy.setHours(0, 0, 0, 0);
    const hace7d = new Date(ahora.getTime() - 7 * 24 * 3600 * 1000);

    const s = db();
    const { data, error } = await s
      .from("prospects")
      .select(
        "id,nombre,rubro,comuna,telefono,web,direccion,score,razon_score,senales_web,mensaje,ultimo_intento_llamada,intentos_llamada",
      )
      .eq("estado", "nuevo")
      .gte("score", scoreMin)
      .not("telefono", "is", null)
      .lt("intentos_llamada", 3)
      .or(
        `ultimo_intento_llamada.is.null,ultimo_intento_llamada.lt.${hace7d.toISOString()},ultimo_intento_llamada.gte.${hoy.toISOString()}`,
      )
      .order("score", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);

    const filas = data ?? [];

    // Marca SOLO los que aún no salieron hoy (idempotente por día).
    const porMarcar = preview
      ? []
      : filas.filter(
          (p) =>
            !p.ultimo_intento_llamada || new Date(p.ultimo_intento_llamada) < hoy,
        );
    await Promise.all(
      porMarcar.map((p) =>
        s
          .from("prospects")
          .update({
            ultimo_intento_llamada: ahora.toISOString(),
            intentos_llamada: (p.intentos_llamada ?? 0) + 1,
          })
          .eq("id", p.id),
      ),
    );

    const cab = [
      "nombre_empresa", "rubro", "comuna", "telefono_fijo", "web",
      "score", "senales_web", "razon_score", "ronda",
      "dueño (anotar)", "celular/correo (anotar)", "resultado (anotar)",
    ];
    const lineas = filas.map((p) =>
      [
        p.nombre, p.rubro, p.comuna, p.telefono, p.web ?? "",
        p.score, resumenSenales(p.senales_web), p.razon_score,
        (p.intentos_llamada ?? 0) + (p.ultimo_intento_llamada && new Date(p.ultimo_intento_llamada) >= hoy ? 0 : 1),
        "", "", "",
      ]
        .map(csvCampo)
        .join(";"),
    );

    // BOM + ";" para que Excel en español lo abra bien de un doble clic.
    const csv = "﻿" + [cab.map(csvCampo).join(";"), ...lineas].join("\r\n");
    const fecha = ahora.toISOString().slice(0, 10);
    const nombre = preview ? `preview_llamadas_${fecha}.csv` : `llamadas_${fecha}.csv`;

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nombre}"`,
      },
    });
  } catch (e: any) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}
