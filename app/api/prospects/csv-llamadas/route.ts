import ExcelJS from "exceljs";
import { listaLlamadasDelDia } from "@/lib/llamadas";
import type { SenalesWeb } from "@/lib/enriquecimiento";

/**
 * GET /api/prospects/csv-llamadas — la lista de llamadas del día en Excel.
 *
 * Es un ESPEJO de la página /llamadas (misma selección, lib/llamadas.ts):
 * sirve de respaldo para llamar sin conexión o imprimir. NO marca nada:
 * el registro de resultados se hace en /llamadas con un clic (o a mano en
 * Prospección). Por lo mismo, descargarlo las veces que quieras da igual.
 */

function resumenSenales(s: SenalesWeb | null): string {
  if (!s) return "sin datos";
  if (s.solo_redes) return "ALTO | solo Instagram/Facebook (todo a mano)";
  if (s.celular_whatsapp) return "ALTO | sin web, atiende al celular (solo WhatsApp)";
  if (!s.visitada) return "sin web verificable";
  const partes: string[] = [];
  if (s.chatbot) partes.push(`chatbot: ${s.chatbot}`);
  if (s.reservas) partes.push(`reservas: ${s.reservas}`);
  if (s.formulario_hora) partes.push("pide hora por formulario (manual)");
  if (s.ecommerce) partes.push(`e-commerce: ${s.ecommerce}`);
  if (s.crm) partes.push(`CRM: ${s.crm}`);
  if (s.whatsapp_link) partes.push("usa WhatsApp");
  if (partes.length === 0) partes.push("web sin automatización");
  return `${(s.potencial ?? "?").toUpperCase()} | ${partes.join(", ")}`;
}

function telefonoLimpio(t: string | null): string {
  return (t ?? "").replace(/[^\d+]/g, "");
}

const COLOR = {
  header: "FF312E81",
  headerTexto: "FFFFFFFF",
  alto: "FFDCFCE7",
  altoTexto: "FF166534",
  anotar: "FFFFFBEB",
  zebra: "FFF8FAFC",
  borde: "FFE2E8F0",
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const scoreMin = Number(url.searchParams.get("score_min") ?? 70);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 40), 200);

    const filas = await listaLlamadasDelDia({ scoreMin, limit });

    const ahora = new Date();
    const fecha = ahora.toLocaleDateString("es-CL", {
      weekday: "long", day: "numeric", month: "long", timeZone: "America/Santiago",
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Llamadas", { views: [{ state: "frozen", ySplit: 3 }] });

    ws.mergeCells("A1:J1");
    const titulo = ws.getCell("A1");
    titulo.value = `RESPONDO — Llamadas del día · ${fecha} (respaldo del panel /llamadas)`;
    titulo.font = { bold: true, size: 14, color: { argb: COLOR.header } };
    ws.getRow(1).height = 24;

    ws.mergeCells("A2:J2");
    const sub = ws.getCell("A2");
    sub.value =
      "El registro oficial se hace en el panel Llamadas del día (un clic por llamada). Este Excel es solo respaldo/impresión.";
    sub.font = { size: 9, italic: true, color: { argb: "FF64748B" } };

    const CAB = [
      { t: "#", w: 4 }, { t: "Empresa", w: 36 }, { t: "Rubro", w: 15 },
      { t: "Comuna", w: 13 }, { t: "Teléfono", w: 14 }, { t: "Score", w: 7 },
      { t: "Señales", w: 30 }, { t: "Por qué llamar", w: 46 },
      { t: "Intento Nº", w: 9 }, { t: "Resultado ✍", w: 26 },
    ];
    const rowCab = ws.getRow(3);
    CAB.forEach((c, i) => {
      const cell = rowCab.getCell(i + 1);
      cell.value = c.t;
      cell.font = { bold: true, size: 10, color: { argb: COLOR.headerTexto } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.header } };
      ws.getColumn(i + 1).width = c.w;
    });
    rowCab.height = 20;
    ws.autoFilter = { from: "A3", to: "J3" };

    filas.forEach((p, idx) => {
      const r = ws.getRow(4 + idx);
      const sufijo = p.sucursales > 1 ? `  (${p.sucursales} sucursales, misma web)` : "";
      const valores: (string | number)[] = [
        idx + 1,
        `${p.nombre}${sufijo}`,
        p.rubro ?? "",
        (p.comuna ?? "").trim(),
        telefonoLimpio(p.telefono),
        p.score ?? 0,
        resumenSenales(p.senales_web),
        p.razon_score ?? "",
        (p.intentos_llamada ?? 0) + 1,
        "",
      ];
      valores.forEach((v, i) => {
        const cell = r.getCell(i + 1);
        cell.value = v;
        cell.font = { size: 10 };
        cell.alignment = {
          vertical: "top",
          horizontal: i === 0 || i === 5 || i === 8 ? "center" : "left",
          wrapText: i === 6 || i === 7 || i === 9,
        };
        cell.border = { bottom: { style: "thin", color: { argb: COLOR.borde } } };
        if (idx % 2 === 1)
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.zebra } };
      });
      r.getCell(2).font = { size: 10, bold: true };
      if (p.web) {
        r.getCell(2).value = { text: `${p.nombre}${sufijo}`, hyperlink: p.web, tooltip: p.web };
        r.getCell(2).font = { size: 10, bold: true, color: { argb: "FF1D4ED8" }, underline: true };
      }
      const cScore = r.getCell(6);
      cScore.font = {
        size: 11, bold: true,
        color: { argb: (p.score ?? 0) >= 85 ? COLOR.altoTexto : "FF334155" },
      };
      const cRes = r.getCell(10);
      cRes.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.anotar } };
    });

    const buffer = await wb.xlsx.writeBuffer();
    const fechaISO = ahora.toISOString().slice(0, 10);
    return new Response(buffer as ArrayBuffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="llamadas_${fechaISO}.xlsx"`,
      },
    });
  } catch (e: any) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}
