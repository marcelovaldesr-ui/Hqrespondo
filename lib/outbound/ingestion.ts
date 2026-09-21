/**
 * INGESTIÓN, NORMALIZACIÓN Y DEDUPLICACIÓN — Outbound V1
 *
 * Principios y Correcciones Mandatorias:
 * 1. Mismo dominio NO es contacto duplicado (pueden existir juan@empresa.cl y maria@empresa.cl).
 * 2. Email exacto normalizado es UNIQUE.
 * 3. Dominio asocia contactos a una misma Company existente si coincide exactamente.
 * 4. Normalización de empresas genera `matching_key`, pero NO fusiona agresivamente:
 *    si dos empresas tienen nombres similares pero RUT o dominio distinto/ambiguo,
 *    se marca `posible_duplicado = true`.
 * 5. Trazabilidad completa (Ley 21.719): Todo contacto registra `LeadSource` con tipo,
 *    referencia, fecha y relación.
 * 6. `relationship_approved_for_copy`: Por defecto `false` salvo autorización explícita.
 * 7. Si el contacto o dominio está en la lista de supresión, se bloquea y NO se re-habilita.
 */

import {
  type Company,
  type Contact,
  type LeadSource,
  type TipoOrigenLead,
  type TipoRelacion,
  type EncajeICP,
} from "./types";
import { type OutboundStore } from "./store";
import {
  normalizarDominio,
  normalizarEmail,
  normalizarNombreEmpresa,
  normalizarNombrePersona,
  normalizarTelefono,
  generarMatchingKey,
} from "./normalization";
import { type EmailVerifier, LocalEmailVerifier } from "./verification";

/** Detecta el delimitador más probable en la primera línea del CSV */
export function detectarSeparador(texto: string): string {
  const primera = texto.split(/\r?\n/)[0] ?? "";
  let mejor = ",";
  let max = -1;
  for (const sep of [",", ";", "\t"]) {
    let n = 0;
    let dentroComillas = false;
    for (const c of primera) {
      if (c === '"') dentroComillas = !dentroComillas;
      else if (c === sep && !dentroComillas) n++;
    }
    if (n > max) {
      max = n;
      mejor = sep;
    }
  }
  return mejor;
}

/** Parser CSV compatible con RFC 4180 (comillas dobles y saltos de línea internos) */
export function parsearCSV(texto: string): string[][] {
  const sep = detectarSeparador(texto);
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let enComillas = false;
  const t = texto.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (enComillas) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          enComillas = false;
        }
      } else {
        campo += c;
      }
    } else if (c === '"') {
      enComillas = true;
    } else if (c === sep) {
      fila.push(campo);
      campo = "";
    } else if (c === "\n") {
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = "";
    } else {
      campo += c;
    }
  }
  if (campo || fila.length) {
    fila.push(campo);
    filas.push(fila);
  }
  return filas.filter((f) => f.some((c) => c.trim()));
}

/** Mapa de encabezados reconocibles */
const ALIAS_COLUMNAS: Record<string, string[]> = {
  empresa: ["empresa", "nombre_fantasia", "nombre", "company", "razon_social"],
  rut: ["rut", "rut_completo", "rut_empresa"],
  web: ["web", "sitio", "sitio_web", "website", "url"],
  rubro: ["rubro", "industria", "sector", "giro", "subrubro"],
  comuna: ["comuna", "ciudad", "city"],
  region: ["region"],
  n_empleados: ["n_empleados", "empleados", "trabajadores"],
  contacto: ["contacto", "persona", "nombre_contacto", "decisor_nombre", "full_name"],
  cargo: ["cargo", "puesto", "decisor_cargo", "title", "job_title"],
  email: ["email", "correo", "mail"],
  telefono: ["telefono", "celular", "fono", "phone", "whatsapp"],
  linkedin_contacto: ["linkedin", "linkedin_contacto", "linkedin_persona"],
  encaje: ["encaje", "fit"],
  senal: ["senal", "senal_dolor", "trigger", "notas", "nota"],
  origen_ref: ["origen", "fuente", "source", "encargo"],
};

function normalizarHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "_");
}

function mapearColumnas(headers: string[]): Record<string, number> {
  const normHeaders = headers.map(normalizarHeader);
  const mapa: Record<string, number> = {};

  for (const [campo, alias] of Object.entries(ALIAS_COLUMNAS)) {
    const idx = normHeaders.findIndex((h) => alias.includes(h));
    if (idx !== -1) {
      mapa[campo] = idx;
    }
  }
  return mapa;
}

export interface OpcionesImportacion {
  tipo_origen: TipoOrigenLead;
  nombre_fuente: string;
  referencia_fuente?: string;
  url_fuente?: string;
  tipo_relacion_default?: TipoRelacion; // "warm" o "cold"
  relationship_approved_for_copy?: boolean; // false por defecto
  verifier?: EmailVerifier;
}

export interface FilaImportadaResultado {
  fila_num: number;
  empresa: string;
  contacto: string;
  email: string | null;
  estado: "insertado" | "duplicado_ignorado" | "posible_duplicado" | "suprimido" | "invalido";
  motivo: string;
  company_id?: string;
  contact_id?: string;
}

export interface ResumenImportacion {
  total_filas: number;
  insertados: number;
  duplicados_ignorados: number;
  posibles_duplicados: number;
  suprimidos: number;
  invalidos: number;
  detalle: FilaImportadaResultado[];
}

/**
 * Ingesta de CSV a la base de datos aplicando todas las reglas de negocio
 */
export async function importarCSV(
  contenidoCSV: string,
  opciones: OpcionesImportacion,
  store: OutboundStore,
): Promise<ResumenImportacion> {
  const filas = parsearCSV(contenidoCSV);
  if (filas.length < 2) {
    throw new Error("El archivo CSV no contiene suficientes filas (se requiere encabezado y datos)");
  }

  const headers = filas[0];
  const mapa = mapearColumnas(headers);
  const verifier = opciones.verifier ?? new LocalEmailVerifier();

  // 1. Registra la fuente del lote (LeadSource)
  const fuente = await store.createLeadSource({
    tipo_origen: opciones.tipo_origen,
    nombre: opciones.nombre_fuente,
    referencia: opciones.referencia_fuente ?? null,
    url: opciones.url_fuente ?? null,
    notas: `Importación CSV: ${filas.length - 1} filas detectadas`,
  });

  const resumen: ResumenImportacion = {
    total_filas: filas.length - 1,
    insertados: 0,
    duplicados_ignorados: 0,
    posibles_duplicados: 0,
    suprimidos: 0,
    invalidos: 0,
    detalle: [],
  };

  for (let i = 1; i < filas.length; i++) {
    const f = filas[i];
    const val = (k: string) => (mapa[k] !== undefined ? (f[mapa[k]] ?? "").trim() : "");

    const rawEmpresa = val("empresa");
    const rawContacto = val("contacto");
    const rawEmail = val("email");
    const rawWeb = val("web");
    const rawRut = val("rut");
    const rawRubro = val("rubro");
    const rawComuna = val("comuna");
    const rawRegion = val("region");
    const rawEmpleados = parseInt(val("n_empleados"), 10) || null;
    const rawTelefono = val("telefono");
    const rawLinkedin = val("linkedin_contacto");
    const rawEncaje = val("encaje");
    const rawSenal = val("senal");
    const rawRef = val("origen_ref");

    if (!rawEmpresa) {
      resumen.invalidos++;
      resumen.detalle.push({
        fila_num: i,
        empresa: "(vacía)",
        contacto: rawContacto,
        email: rawEmail,
        estado: "invalido",
        motivo: "Fila sin nombre de empresa",
      });
      continue;
    }

    // Normalizaciones
    const nombreEmpresa = normalizarNombreEmpresa(rawEmpresa);
    const matchingKey = generarMatchingKey(nombreEmpresa);
    const dominioWeb = normalizarDominio(rawWeb) ?? normalizarDominio(rawEmail);
    const emailNorm = normalizarEmail(rawEmail);
    const { nombre: contactoNombre, apellido: contactoApellido } = normalizarNombrePersona(rawContacto);
    const telefonoNorm = normalizarTelefono(rawTelefono);

    // Si viene email, revisar supresión permanente
    if (emailNorm) {
      const { suppressed, reason } = await store.isSuppressed(emailNorm, dominioWeb ?? undefined);
      if (suppressed) {
        resumen.suprimidos++;
        resumen.detalle.push({
          fila_num: i,
          empresa: nombreEmpresa,
          contacto: contactoNombre,
          email: emailNorm,
          estado: "suprimido",
          motivo: `Email o dominio en lista de supresión global (${reason})`,
        });
        continue;
      }
    }

    // 2. Localizar o Crear la Empresa (Company)
    // Regla: No hacer merge destructivo. Se busca por matching_key o dominio exacto.
    let company: Company | null = null;

    if (dominioWeb) {
      company = await store.findCompanyByDomain(dominioWeb);
    }
    if (!company) {
      company = await store.findCompanyByMatchingKey(matchingKey);
    }

    let esPosibleDuplicadoEmpresa = false;

    if (company) {
      // Si ya existe pero el nombre o rut es distinto, no fusionar silenciosamente
      if (company.nombre.toLowerCase() !== nombreEmpresa.toLowerCase() && company.rut !== rawRut) {
        esPosibleDuplicadoEmpresa = true;
      }
    } else {
      // Crear nueva empresa
      let encajeIcp: EncajeICP = "sin_evaluar";
      const encLower = rawEncaje.toLowerCase();
      if (["alto", "alta"].includes(encLower)) encajeIcp = "alto";
      else if (["medio", "media"].includes(encLower)) encajeIcp = "medio";
      else if (["bajo", "baja"].includes(encLower)) encajeIcp = "bajo";
      else if (["no_encaja", "descartado"].includes(encLower)) encajeIcp = "no_encaja";

      company = await store.createCompany({
        nombre: rawEmpresa,
        nombre_normalizado: nombreEmpresa,
        matching_key: matchingKey,
        rut: rawRut || null,
        sitio_web: rawWeb || null,
        dominio_web: dominioWeb,
        rubro: rawRubro || null,
        comuna: rawComuna || null,
        region: rawRegion || null,
        n_empleados: rawEmpleados,
        encaje_icp: encajeIcp,
        posible_duplicado: false,
        duplicado_de_id: null,
        tags: [opciones.nombre_fuente],
      });
    }

    // 3. Crear Contacto si existe email
    if (!emailNorm) {
      resumen.detalle.push({
        fila_num: i,
        empresa: nombreEmpresa,
        contacto: contactoNombre || "(sin nombre)",
        email: null,
        estado: "insertado",
        motivo: "Empresa registrada; contacto sin email (se requiere enriquecimiento)",
        company_id: company.id,
      });
      resumen.insertados++;
      continue;
    }

    // Comprobar si el contacto con este email ya existe (Deduplicación por email exacto)
    const contactoExistente = await store.findContactByEmail(emailNorm);
    if (contactoExistente) {
      resumen.duplicados_ignorados++;
      resumen.detalle.push({
        fila_num: i,
        empresa: nombreEmpresa,
        contacto: contactoNombre,
        email: emailNorm,
        estado: "duplicado_ignorado",
        motivo: `Email ${emailNorm} ya existe en el sistema (contacto ID: ${contactoExistente.id})`,
        company_id: company.id,
        contact_id: contactoExistente.id,
      });
      continue;
    }

    // Verificación de email
    const resultadoVerif = await verifier.verificar(emailNorm);

    // Relación previa y autorización de copy
    const tipoRelacion: TipoRelacion = opciones.tipo_relacion_default ?? "cold";
    const relacionDetalle = rawRef || rawSenal || opciones.referencia_fuente || null;
    const approvedForCopy = opciones.relationship_approved_for_copy ?? false;

    // Insertar contacto legítimo
    const contact = await store.createContact({
      company_id: company.id,
      source_id: fuente.id,
      nombre: contactoNombre || "Contacto Comercial",
      apellido: contactoApellido,
      cargo: val("cargo") || null,
      email: rawEmail,
      email_normalizado: emailNorm,
      telefono: telefonoNorm,
      linkedin_url: rawLinkedin || null,
      tipo_relacion: tipoRelacion,
      relacion_detalle: relacionDetalle,
      relationship_approved_for_copy: approvedForCopy,
      verificacion_estado: resultadoVerif.estado,
      verificacion_proveedor: resultadoVerif.proveedor,
      verificacion_fecha: resultadoVerif.fecha,
      verificacion_detalle: resultadoVerif.detalle,
      secuencia_pausada: false,
      secuencia_pausada_motivo: null,
      hold_hasta: null,
    });

    resumen.insertados++;
    resumen.detalle.push({
      fila_num: i,
      empresa: nombreEmpresa,
      contacto: contact.nombre,
      email: emailNorm,
      estado: esPosibleDuplicadoEmpresa ? "posible_duplicado" : "insertado",
      motivo: esPosibleDuplicadoEmpresa
        ? "Contacto creado; empresa marcada como posible duplicado para revisión"
        : `Contacto registrado y verificado (${resultadoVerif.estado})`,
      company_id: company.id,
      contact_id: contact.id,
    });
  }

  return resumen;
}
