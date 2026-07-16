import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import type { SenalesWeb } from "@/lib/enriquecimiento";

/**
 * GET /api/prospects/csv-llamadas?score_min=70&limit=40&preview=1
 *
 * Genera el EXCEL DIARIO de llamadas (.xlsx con formato) y lo descarga
 * directo del navegador con la sesión del panel. Reglas:
 *  - Solo estado "nuevo", con teléfono y score >= score_min.
 *  - No repite un prospecto hasta 7 días después del último intento.
 *  - Máximo 3 rondas por prospecto (después: descartar a mano).
 *  - Idempotente por día: descargarlo dos veces hoy da la misma lista.
 *  - ?preview=1 → solo mirar, SIN marcar la ronda.
 */

// ---------- helpers ----------

function resumenSenales(s: SenalesWeb | null): string {
  if (!s) return "sin datos";
  if (!s.visitada) return "sin web verificable";
  const partes: string[] = [];
  if (s.chatbot) partes.push(`chatbot: ${s.chatbot}`);
  if (s.reservas) partes.push(`reservas: ${s.reservas}`);
  if (s.formulario_hora) partes.push("pide hora por formulario (manual)");
  if (s.ecommerce) partes.push(`e-commerce: ${s.ecommerce}`);
  if (s.crm) partes.push(`CRM: ${s.crm}`);
  if (s.whatsapp_link) partes.push("usa WhatsApp");
  if (partes.length === 0) partes.push("web sin automatización");
  return partes.join(", ");
}

function potencialDe(s: SenalesWeb | null): string {
  return (s?.potencial ?? "desconocido").toUpperCase();
}

/** Limpia el teléfono para que Excel no lo rompa y se pueda marcar. */
function telefonoLimpio(t: string | null): string {
  return (t ?? "").replace(/[^\d+]/g, "");
}

const COLOR = {
  header: "FF312E81", // índigo marca
  headerTexto: "FFFFFFFF",
  alto: "FFDCFCE7", // verde suave
  altoTexto: "FF166534",
  medio: "FFFEF9C3", // ámbar suave
  medioTexto: "FF854D0E",
  bajo: "FFFEE2E2", // rojo suave
  bajoTexto: "FF991B1B",
  desconocido: "FFF1F5F9", // gris
  desconocidoTexto: "FF475569",
  anotar: "FFFFFBEB", // crema para columnas a llenar
  zebra: "FFF8FAFC",
  borde: "FFE2E8F0",
};

// ---------- handler ----------

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const scoreMin = Number(url.searchParams.get("score_min") ?? 70);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 40), 200);
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

    // Dedupe por dominio: cadenas con varias sucursales y la misma web
    // salen UNA vez (una llamada cubre todas). Se queda la de mayor score.
    const porDominio = new Map<string, any>();
    const sinWeb: any[] = [];
    for (const p of data ?? []) {
      let host: string | null = null;
      try {
        host = p.web ? new URL(/^https?:\/\//i.test(p.web) ? p.web : `https://${p.web}`).hostname.replace(/^www\./, "") : null;
      } catch {
        host = null;
      }
      if (!host) {
        sinWeb.push(p);
        continue;
      }
      const previo = porDominio.get(host);
      if (!previo) porDominio.set(host, { ...p, sucursales: 1 });
      else previo.sucursales += 1;
    }
    const filas = [...porDominio.values(), ...sinWeb].sort(
      (a, b) => (b.score ?? 0) - (a.score ?? 0),
    );

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

    // ---------- Excel ----------
    const fecha = ahora.toLocaleDateString("es-CL", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Llamadas", {
      views: [{ state: "frozen", ySplit: 3 }],
    });

    // Título
    ws.mergeCells("A1:L1");
    const titulo = ws.getCell("A1");
    titulo.value = `RESPONDO — Llamadas del día · ${fecha}${preview ? "  (VISTA PREVIA, no cuenta ronda)" : ""}`;
    titulo.font = { bold: true, size: 14, color: { argb: COLOR.header } };
    ws.getRow(1).height = 24;

    ws.mergeCells("A2:L2");
    const sub = ws.getCell("A2");
    sub.value =
      "Orden = mejores primero. Verde = potencial ALTO (gestiona manual, prioridad). Llenar las 3 columnas amarillas durante la llamada y traspasar el estado a Respondo HQ.";
    sub.font = { size: 9, italic: true, color: { argb: "FF64748B" } };

    // Encabezado
    const CABECERA = [
      { k: "n", t: "#", w: 4 },
      { k: "empresa", t: "Empresa", w: 34 },
      { k: "rubro", t: "Rubro", w: 15 },
      { k: "comuna", t: "Comuna", w: 13 },
      { k: "telefono", t: "Teléfono", w: 14 },
      { k: "score", t: "Score", w: 7 },
      { k: "potencial", t: "Potencial", w: 12 },
      { k: "senales", t: "Señales detectadas", w: 26 },
      { k: "razon", t: "Por qué llamar", w: 46 },
      { k: "dueno", t: "Dueño ✍", w: 18 },
      { k: "contacto", t: "Celular / correo ✍", w: 20 },
      { k: "resultado", t: "Resultado ✍", w: 26 },
    ];
    const rowCab = ws.getRow(3);
    CABECERA.forEach((c, i) => {
      const cell = rowCab.getCell(i + 1);
      cell.value = c.t;
      cell.font = { bold: true, size: 10, color: { argb: COLOR.headerTexto } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.header } };
      cell.alignment = { vertical: "middle", horizontal: i <= 0 || c.k === "score" ? "center" : "left" };
      ws.getColumn(i + 1).width = c.w;
    });
    rowCab.height = 20;
    ws.autoFilter = { from: "A3", to: "L3" };

    // Filas
    filas.forEach((p, idx) => {
      const pot = potencialDe(p.senales_web);
      const r = ws.getRow(4 + idx);
      const ronda =
        (p.intentos_llamada ?? 0) +
        (p.ultimo_intento_llamada && new Date(p.ultimo_intento_llamada) >= hoy ? 0 : preview ? 1 : 0);

      const valores: (string | number)[] = [
        idx + 1,
        p.nombre ?? "",
        p.rubro ?? "",
        (p.comuna ?? "").trim(),
        telefonoLimpio(p.telefono),
        p.score ?? 0,
        pot,
        resumenSenales(p.senales_web),
        p.razon_score ?? "",
        "",
        "",
        "",
      ];
      valores.forEach((v, i) => {
        const cell = r.getCell(i + 1);
        cell.value = v;
        cell.font = { size: 10 };
        cell.alignment = {
          vertical: "top",
          horizontal: i === 0 || i === 5 ? "center" : "left",
          wrapText: i === 7 || i === 8 || i === 11,
        };
        cell.border = {
          bottom: { style: "thin", color: { argb: COLOR.borde } },
        };
        // zebra
        if (idx % 2 === 1) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.zebra } };
        }
      });

      // Empresa en negrita; anota ronda y sucursales agrupadas
      const extras: string[] = [];
      if (ronda > 1) extras.push(`ronda ${ronda}`);
      if ((p as any).sucursales > 1) extras.push(`${(p as any).sucursales} sucursales, misma web`);
      const sufijo = extras.length ? `  (${extras.join(" · ")})` : "";
      r.getCell(2).font = { size: 10, bold: true };
      r.getCell(2).value = `${p.nombre}${sufijo}`;

      // Score con color
      const cScore = r.getCell(6);
      cScore.font = { size: 11, bold: true, color: { argb: (p.score ?? 0) >= 85 ? COLOR.altoTexto : "FF334155" } };

      // Potencial como chip de color
      const cPot = r.getCell(7);
      const mapa: Record<string, [string, string]> = {
        ALTO: [COLOR.alto, COLOR.altoTexto],
        MEDIO: [COLOR.medio, COLOR.medioTexto],
        BAJO: [COLOR.bajo, COLOR.bajoTexto],
        DESCONOCIDO: [COLOR.desconocido, COLOR.desconocidoTexto],
      };
      const [fondo, texto] = mapa[pot] ?? mapa.DESCONOCIDO;
      cPot.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fondo } };
      cPot.font = { size: 10, bold: true, color: { argb: texto } };
      cPot.alignment = { vertical: "middle", horizontal: "center" };

      // Columnas para anotar en crema
      for (const i of [10, 11, 12]) {
        const cell = r.getCell(i);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.anotar } };
        cell.border = {
          bottom: { style: "thin", color: { argb: "FFE7D8A1" } },
          left: { style: "thin", color: { argb: "FFE7D8A1" } },
        };
      }

      // Web como hipervínculo en la empresa (clic para revisar antes de llamar)
      if (p.web) {
        r.getCell(2).value = {
          text: `${p.nombre}${sufijo}`,
          hyperlink: p.web,
          tooltip: p.web,
        };
        r.getCell(2).font = { size: 10, bold: true, color: { argb: "FF1D4ED8" }, underline: true };
      }
    });

    const buffer = await wb.xlsx.writeBuffer();
    const fechaISO = ahora.toISOString().slice(0, 10);
    const nombre = preview
      ? `preview_llamadas_${fechaISO}.xlsx`
      : `llamadas_${fechaISO}.xlsx`;

    return new Response(buffer as ArrayBuffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${nombre}"`,
      },
    });
  } catch (e: any) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}
