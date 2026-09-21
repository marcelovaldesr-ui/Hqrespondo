/**
 * CHEQUEO DE AUTENTICACIÓN DNS — Outbound V1 (respon-do.com)
 *
 * Correcciones y reglas mandatorias:
 * 1. DKIM Selector configurable: `${DKIM_SELECTOR}._domainkey.respon-do.com` (default "google" o leído de env/settings).
 * 2. SPF: Validación semántica y sintáctica, NO comparación contra string exacta.
 *    - Detecta presencia de `v=spf1`.
 *    - Advierte si existen múltiples registros SPF (violación RFC 7208).
 *    - Comprueba si Google Workspace está autorizado (`include:_spf.google.com`).
 *    - Permite otros includes legítimos sin fallar.
 * 3. DMARC: Consulta `_dmarc.respon-do.com`, valida `v=DMARC1` y extrae política `p=none|quarantine|reject`.
 * 4. MX: Comprueba existencia de registros MX y si apuntan a Google.
 * 5. Reporte con estados: PASS / WARNING / FAIL con diagnóstico detallado.
 */

import dns from "node:dns/promises";
import { OUTBOUND_DOMAIN } from "./config";
import { type DnsCheckStatus } from "./types";

export interface DiagnosticoDnsItem {
  estado: DnsCheckStatus;
  registroEncontrado: string | null;
  mensaje: string;
}

export interface ReporteSaludDns {
  dominio: string;
  timestamp: string;
  estadoGeneral: DnsCheckStatus;
  spf: DiagnosticoDnsItem;
  dkim: DiagnosticoDnsItem;
  dmarc: DiagnosticoDnsItem;
  mx: DiagnosticoDnsItem;
}

export interface OpcionesChequeoDns {
  dominio?: string; // default OUTBOUND_DOMAIN
  dkimSelector?: string; // default process.env.DKIM_SELECTOR || "google"
  dnsResolver?: typeof dns;
}

/**
 * Evalúa registro SPF de manera defensiva y semántica
 */
export function evaluarSpf(registrosTxt: string[][]): DiagnosticoDnsItem {
  const spfRecords = registrosTxt
    .map((r) => r.join(""))
    .filter((txt) => txt.startsWith("v=spf1"));

  if (spfRecords.length === 0) {
    return {
      estado: "fail",
      registroEncontrado: null,
      mensaje: "No existe registro TXT con SPF (v=spf1). Los correos caerán en spam.",
    };
  }

  if (spfRecords.length > 1) {
    return {
      estado: "fail",
      registroEncontrado: spfRecords.join(" | "),
      mensaje: "Error crítico RFC 7208: Se encontraron múltiples registros SPF. Solo debe existir uno.",
    };
  }

  const spf = spfRecords[0];

  // Comprueba que Google Workspace esté incluido si enviamos por Gmail
  const incluyeGoogle = /include:_spf\.google\.com/i.test(spf);
  const terminaAll = /(?:~|-|\?)all/i.test(spf);

  if (!incluyeGoogle) {
    return {
      estado: "warning",
      registroEncontrado: spf,
      mensaje: "Registro SPF existe pero no incluye '_spf.google.com'. Google Workspace no está autorizado explícitamente.",
    };
  }

  if (!terminaAll) {
    return {
      estado: "warning",
      registroEncontrado: spf,
      mensaje: "Registro SPF existe pero no especifica mecanismo final (~all o -all).",
    };
  }

  return {
    estado: "pass",
    registroEncontrado: spf,
    mensaje: "SPF válido y autoriza correctamente a Google Workspace.",
  };
}

/**
 * Evalúa registro DKIM con selector dinámico
 */
export function evaluarDkim(registrosTxt: string[][], selector: string): DiagnosticoDnsItem {
  const dkimRecords = registrosTxt
    .map((r) => r.join(""))
    .filter((txt) => txt.includes("v=DKIM1") || txt.includes("p="));

  if (dkimRecords.length === 0) {
    return {
      estado: "fail",
      registroEncontrado: null,
      mensaje: `No se encontró registro DKIM en el selector '${selector}' (${selector}._domainkey).`,
    };
  }

  const dkim = dkimRecords[0];
  if (!dkim.includes("p=") || dkim.includes("p=;")) {
    return {
      estado: "warning",
      registroEncontrado: dkim,
      mensaje: `Registro DKIM encontrado en selector '${selector}' pero la clave pública (p=) parece vacía o truncada.`,
    };
  }

  return {
    estado: "pass",
    registroEncontrado: dkim,
    mensaje: `DKIM verificado con clave pública activa en selector '${selector}'.`,
  };
}

/**
 * Evalúa registro DMARC
 */
export function evaluarDmarc(registrosTxt: string[][]): DiagnosticoDnsItem {
  const dmarcRecords = registrosTxt
    .map((r) => r.join(""))
    .filter((txt) => txt.startsWith("v=DMARC1"));

  if (dmarcRecords.length === 0) {
    return {
      estado: "fail",
      registroEncontrado: null,
      mensaje: "No existe registro DMARC en _dmarc. Requisito estricto de Google y Yahoo desde 2024.",
    };
  }

  const dmarc = dmarcRecords[0];
  const matchPolitica = dmarc.match(/p=(none|quarantine|reject)/i);
  const politica = matchPolitica ? matchPolitica[1].toLowerCase() : "desconocida";

  if (politica === "none") {
    return {
      estado: "warning",
      registroEncontrado: dmarc,
      mensaje: "DMARC configurado con política p=none (modo monitoreo / staging inicial recomendado durante 1 semana de ramp-up antes de escalar a p=quarantine).",
    };
  }

  return {
    estado: "pass",
    registroEncontrado: dmarc,
    mensaje: `DMARC configurado y protegido con política estricta p=${politica}.`,
  };
}

export interface RegistroMx {
  exchange: string;
  priority: number;
}

/**
 * Evalúa registros MX admitiendo el estándar moderno de Google Workspace (smtp.google.com con prioridad 1)
 * y reteniendo compatibilidad defensiva con el esquema legacy (aspmx.l.google.com).
 */
export function evaluarMx(mxRecords: RegistroMx[]): DiagnosticoDnsItem {
  if (!mxRecords || mxRecords.length === 0) {
    return {
      estado: "fail",
      registroEncontrado: null,
      mensaje: "No existen registros MX configurados en el dominio.",
    };
  }

  const hostsStr = mxRecords.map((m) => `${m.exchange} (${m.priority})`).join(", ");
  const tieneModerno = mxRecords.some((m) => m.exchange.toLowerCase().replace(/\.$/, "") === "smtp.google.com");
  const tieneLegacy = mxRecords.some((m) => m.exchange.toLowerCase().includes("aspmx.l.google.com") || m.exchange.toLowerCase().includes("googlemail.com"));
  const esGoogleGenerico = mxRecords.some((m) => m.exchange.toLowerCase().includes("google"));

  if (tieneModerno) {
    return {
      estado: "pass",
      registroEncontrado: hostsStr,
      mensaje: "Configuración MX moderna de Google Workspace verificada (smtp.google.com, prioridad 1).",
    };
  }

  if (tieneLegacy || esGoogleGenerico) {
    return {
      estado: "pass",
      registroEncontrado: hostsStr,
      mensaje: "Registros MX legacy de Google Workspace verificados y operativos (aspmx.l.google.com).",
    };
  }

  return {
    estado: "warning",
    registroEncontrado: hostsStr,
    mensaje: `Registros MX presentes pero no corresponden a Google Workspace: ${hostsStr}`,
  };
}

/**
 * Chequea la salud completa de DNS para el dominio
 */
export async function chequearSaludDnsDominio(
  opciones?: OpcionesChequeoDns,
): Promise<ReporteSaludDns> {
  const dominio = opciones?.dominio ?? OUTBOUND_DOMAIN;
  const selector = opciones?.dkimSelector ?? process.env.DKIM_SELECTOR ?? "google";
  const resolver = opciones?.dnsResolver ?? dns;
  const ahora = new Date().toISOString();

  let spfDiag: DiagnosticoDnsItem = { estado: "unknown", registroEncontrado: null, mensaje: "No evaluado" };
  let dkimDiag: DiagnosticoDnsItem = { estado: "unknown", registroEncontrado: null, mensaje: "No evaluado" };
  let dmarcDiag: DiagnosticoDnsItem = { estado: "unknown", registroEncontrado: null, mensaje: "No evaluado" };
  let mxDiag: DiagnosticoDnsItem = { estado: "unknown", registroEncontrado: null, mensaje: "No evaluado" };

  // 1. Chequeo SPF
  try {
    const txtRecords = await resolver.resolveTxt(dominio);
    spfDiag = evaluarSpf(txtRecords);
  } catch (e: unknown) {
    spfDiag = {
      estado: "fail",
      registroEncontrado: null,
      mensaje: `Fallo al resolver TXT para SPF en ${dominio}: ${String(e)}`,
    };
  }

  // 2. Chequeo DKIM
  const dkimHost = `${selector}._domainkey.${dominio}`;
  try {
    const dkimTxt = await resolver.resolveTxt(dkimHost);
    dkimDiag = evaluarDkim(dkimTxt, selector);
  } catch (e: unknown) {
    dkimDiag = {
      estado: "fail",
      registroEncontrado: null,
      mensaje: `Fallo al resolver DKIM en ${dkimHost}: ${String(e)}`,
    };
  }

  // 3. Chequeo DMARC
  const dmarcHost = `_dmarc.${dominio}`;
  try {
    const dmarcTxt = await resolver.resolveTxt(dmarcHost);
    dmarcDiag = evaluarDmarc(dmarcTxt);
  } catch (e: unknown) {
    dmarcDiag = {
      estado: "fail",
      registroEncontrado: null,
      mensaje: `Fallo al resolver DMARC en ${dmarcHost}: ${String(e)}`,
    };
  }

  // 4. Chequeo MX
  try {
    const mxRecords = await resolver.resolveMx(dominio);
    mxDiag = evaluarMx(mxRecords);
  } catch (e: unknown) {
    mxDiag = {
      estado: "fail",
      registroEncontrado: null,
      mensaje: `Fallo al consultar MX para ${dominio}: ${String(e)}`,
    };
  }

  // Evaluación del estado general
  let estadoGeneral: DnsCheckStatus = "pass";
  if (spfDiag.estado === "fail" || dkimDiag.estado === "fail" || dmarcDiag.estado === "fail" || mxDiag.estado === "fail") {
    estadoGeneral = "fail";
  } else if (
    spfDiag.estado === "warning" ||
    dkimDiag.estado === "warning" ||
    dmarcDiag.estado === "warning" ||
    mxDiag.estado === "warning"
  ) {
    estadoGeneral = "warning";
  }

  return {
    dominio,
    timestamp: ahora,
    estadoGeneral,
    spf: spfDiag,
    dkim: dkimDiag,
    dmarc: dmarcDiag,
    mx: mxDiag,
  };
}
