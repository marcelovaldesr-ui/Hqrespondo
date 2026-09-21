/**
 * NORMALIZACIÓN DE DATOS — Outbound V1
 *
 * Reglas mandatorias del diseño:
 * 1. Email: minúsculas, trim, sin espacios. El email exacto normalizado es único.
 * 2. Dominio: extrae hostname limpio sin http(s):// ni www. ni rutas.
 * 3. Empresa:
 *    - `nombre`: tal como viene.
 *    - `nombre_normalizado`: limpio de espacios dobles y caracteres de control.
 *    - `matching_key`: remueve sufijos societarios (SpA, S.P.A., Ltda, Limitada, S.A., EIRL)
 *      y acentos/puntuación para BÚSQUEDA y detección de duplicados.
 *    - REGLA: El matching_key NO hace merges destructivos automáticos. Si hay ambigüedad,
 *      se marca `posible_duplicado = true`.
 * 4. Persona: Nombre capitalizado adecuadamente, sin títulos comerciales pegados.
 * 5. Teléfono: Normalización a formato chileno estándar (569...) sin inventar dígitos.
 */

/** Normaliza email: minúsculas, sin espacios */
export function normalizarEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  // Validación sintáctica básica RFC 5322
  const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!re.test(s)) return null;
  return s;
}

/** Extrae dominio limpio de una URL o de un email */
export function normalizarDominio(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.trim().toLowerCase();

  // Si viene como email
  if (s.includes("@")) {
    s = s.split("@")[1];
  }

  // Quita protocolo
  s = s.replace(/^https?:\/\//i, "");
  // Quita credenciales o puertos
  s = s.replace(/:\d+/, "");
  // Quita www.
  s = s.replace(/^www\./i, "");
  // Quita rutas y query params
  s = s.split("/")[0].split("?")[0].split("#")[0].trim();

  // Valida que tenga al menos un punto y caracteres válidos
  if (!s || !s.includes(".") || s.length < 4) return null;
  return s;
}

/** Normaliza texto quitando acentos y caracteres especiales para comparaciones */
export function simplificarTexto(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remueve acentos
    .replace(/[^a-z0-9\s]/g, " ") // reemplaza signos por espacios
    .replace(/\s+/g, " ")
    .trim();
}

/** Sufijos legales comunes en Chile que se limpian SOLO para matching_key */
const SUFIJOS_LEGALES = [
  /\bspa\b/gi,
  /\bs\s+p\s+a\b/gi,
  /\bltda\b/gi,
  /\blimitada\b/gi,
  /\bs\s+a\b/gi,
  /\bsa\b/gi,
  /\beirl\b/gi,
  /\be\s+i\s+r\s+l\b/gi,
  /\bcompania\b/gi,
  /\bcia\b/gi,
  /\bsociedad\b/gi,
  /\bcomercializadora\b/gi,
  /\binversiones\b/gi,
];

/**
 * Genera matching_key para empresas:
 * NO se utiliza para hacer merge silencioso, sino como clave auxiliar
 * de búsqueda y para marcar `posible_duplicado = true`.
 */
export function generarMatchingKey(nombreEmpresa: string): string {
  let s = simplificarTexto(nombreEmpresa);
  for (const suf of SUFIJOS_LEGALES) {
    s = s.replace(suf, " ");
  }
  return s.trim().replace(/\s+/g, "_").replace(/^_+|_+$/g, "");
}

/** Limpia y normaliza el nombre de la empresa sin alterar su forma legal real */
export function normalizarNombreEmpresa(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/** Prolija nombre de persona (capitaliza correctamente y quita emojis o muletillas) */
export function normalizarNombrePersona(raw: string | null | undefined): {
  nombre: string;
  apellido: string | null;
} {
  if (!raw) return { nombre: "", apellido: null };

  // Remueve emojis y caracteres no alfabéticos raros
  let limpio = raw
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

  // Si viene en formato "APELLIDO, NOMBRE"
  if (limpio.includes(",")) {
    const partes = limpio.split(",").map((p) => p.trim());
    if (partes.length >= 2) {
      limpio = `${partes[1]} ${partes[0]}`;
    }
  }

  const palabras = limpio.split(" ").filter(Boolean);
  if (palabras.length === 0) return { nombre: "", apellido: null };

  // Capitalizar cada palabra
  const cap = palabras.map((p) => {
    const lower = p.toLowerCase();
    if (["de", "del", "la", "las", "los", "y", "e"].includes(lower) && palabras.indexOf(p) !== 0) {
      return lower;
    }
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });

  if (cap.length === 1) {
    return { nombre: cap[0], apellido: null };
  }

  const nombre = cap[0];
  const apellido = cap.slice(1).join(" ");
  return { nombre, apellido };
}

/** Normaliza teléfonos chilenos a formato 569XXXXXXXX */
export function normalizarTelefono(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digitos = raw.replace(/\D/g, "");
  if (!digitos) return null;

  // 569XXXXXXXX (11 dígitos)
  if (digitos.startsWith("569") && digitos.length === 11) {
    return digitos;
  }
  // 9XXXXXXXX (9 dígitos celular)
  if (digitos.startsWith("9") && digitos.length === 9) {
    return "56" + digitos;
  }
  // 00569XXXXXXXX
  if (digitos.startsWith("00569") && digitos.length === 13) {
    return digitos.slice(2);
  }
  // Fijo o no reconocido: no inventar celular
  return digitos.length >= 8 ? digitos : null;
}
