/**
 * DECISOR — de quién es la empresa, sin scrapear a nadie.
 *
 * El problema que resuelve: la lista de llamadas son teléfonos de mesón. Para
 * pedir por alguien hay que saber su nombre, y en un negocio de 3 a 10
 * personas ese nombre no está en LinkedIn (medido: 0 de 12 microempresas
 * tenían decisor encontrable ahí).
 *
 * Pero sí está en un lugar que nadie mira: la RAZÓN SOCIAL del SII. En Chile
 * una EIRL o una "X y Compañía Limitada" lleva el nombre completo del dueño
 * por obligación legal. Medido sobre el universo de cupo único: 583 de 7.312
 * empresas (7%) traen el nombre completo de una persona, y son justamente las
 * chicas — "PAMELA GUINEZ LATTUS Y COMPAÑIA LIMITADA", "CENTRO MEDICO MARIA
 * JOSEFA AIQUEL GUZMAN E.I.R.L.". Ahí no hay que adivinar: el nombre lo
 * publicó el Estado.
 *
 * Lo que NO se hace acá, y es a propósito: la heurística suelta de "1 a 3
 * palabras no genéricas = apellido". Se probó contra 24 empresas con dueño
 * conocido y acertó 3. El 66% que parecía apellido eran marcas —ICEGCLINIC,
 * ALTAIR, TURO—, y usarla habría hecho que HQ pidiera por "el señor Altair".
 * Solo entran los patrones que se sostienen solos.
 */

export type PatronDecisor = "nombre_completo" | "doctor" | "socios";

export interface DecisorDetectado {
  /** Nombre tal como se va a decir por teléfono. */
  nombre: string;
  patron: PatronDecisor;
  /** Qué tan seguro es que esa persona sea dueña o socia. */
  confianza: "alta" | "media";
  /** Frase lista para la llamada. */
  comoPreguntar: string;
  /** De dónde salió, para poder auditarlo (Ley 21.719). */
  origen: string;
}

import { pareceNombreDePersona, podarNombre } from "@/lib/nombrePersona";

const LEGAL =
  /\b(SPA|S\.?A\.?|LTDA|LIMITADA|E\.?I\.?R\.?L\.?|EIRL|SOCIEDAD|SOC|CIA|COMPANIA|COMPAÑIA|Y CIA|DE RESPONSABILIDAD|EMPRESA INDIVIDUAL|E HIJOS|Y ASOCIADOS|ASOCIADOS)\b/g;

/** Palabras de negocio: nunca son parte del nombre de una persona. */
const NO_PERSONA = new Set(
  `CENTRO CENTROS MEDICO MEDICA MEDICOS MEDICAS CLINICA CLINICO CLINICAS SALUD SERVICIOS SERVICIO
   PRESTACIONES PRESTADORA ATENCION INTEGRAL INTEGRALES DENTAL DENTALES ODONTOLOGICA ODONTOLOGICO
   ODONTOLOGIA ODONTOLOGICOS ODONTOLOGICAS ESTETICA ESTETICO VETERINARIA VETERINARIO OPTICA OPTICAS PROFESIONAL PROFESIONALES
   INVERSIONES INVERSION COMERCIAL COMERCIALIZADORA ASESORIA ASESORIAS DEL LOS LAS CHILE KINESIOLOGIA
   KINESICA REHABILITACION IMAGENES IMAGENOLOGIA DIAGNOSTICO ESPECIALIDADES ESPECIALIDAD GENERAL SUR
   NORTE ORIENTE PONIENTE NUEVA NUEVO SANTA SAN RADIOLOGICOS OTROS CAPACITACION MEDICINA CIRUGIA
   ONCOLOGIA PSIQUIATRIA NEUROCIENCIAS OFTALMOLOGICA OFTALMOLOGICO OFTALMOLOGOS PSIQUIATRAS
   ODONTOLOGOS OFTALMOLOGIA PODOLOGIA DERMATOLOGICA BIENESTAR DEPORTIVO DEPORTIVA PADEL FITNESS
   GIMNASIO SPA BELLEZA PELUQUERIA CONSULTORIO POLICLINICO HOSPITAL LABORATORIO LABORATORIOS DIALISIS
   SCANNER RESONANCIA PABELLONES QUIRURGICOS FUNDACION CLINICOS ANDES PLAZA ITALIA REGIONAL TERAPIA
   TERAPIAS ADMINISTRADORA GESTION SISTEMAS TECNOLOGIA GRUPO RED REDES VISION DENTISTA DENTISTAS
   SONRISA SMILE CARE HEALTH MEDIC MEDICAL CLINIC DENT LASER ESTETICAS BUCAL MAXILOFACIAL IMPLANTES
   ORTODONCIA HIJOS`.split(/\s+/),
);

/**
 * Nombres de pila frecuentes en Chile. Son el ancla que separa a una persona
 * de una marca: "ALTAIR CLINIQUE" no tiene ninguno, "PAMELA GUINEZ LATTUS" sí.
 */
const PILA = new Set(
  `JUAN JOSE MARIA LUIS CARLOS JORGE MANUEL FRANCISCO PEDRO MIGUEL RICARDO CLAUDIO PATRICIO SERGIO
   RODRIGO CRISTIAN ALEJANDRO MARCELO EDUARDO FERNANDO ANDRES GONZALO PABLO MAURICIO OSCAR HERNAN
   RAUL VICTOR ROBERTO GUILLERMO ENRIQUE ALVARO IGNACIO FELIPE MATIAS DIEGO NICOLAS DANIEL GABRIEL
   SEBASTIAN TOMAS BENJAMIN JAVIER MARCO MARIO RENE HUGO IVAN CESAR ARTURO ALFREDO JAIME LEONARDO
   CRISTOBAL MAXIMILIANO VICENTE AGUSTIN JOAQUIN EMILIO GASTON RODOLFO ALBERTO ARMANDO ORLANDO
   ANA CARMEN ROSA PATRICIA VERONICA CLAUDIA MONICA ANDREA PAULA CAROLINA MARCELA ALEJANDRA
   FRANCISCA CATALINA VALENTINA CONSTANZA DANIELA CAMILA JAVIERA ANTONIA SOFIA ISIDORA MACARENA
   PAOLA LORENA CECILIA XIMENA SANDRA ELIZABETH TERESA GLORIA SILVIA ANGELA SOLEDAD MARGARITA
   BEATRIZ VIVIANA PAMELA KAREN JESSICA NATALIA DENISSE PRISCILA BARBARA OLIVIA NILSER RUBEN
   EDGARDO JOSEFA MONSERRAT IVES`.split(/\s+/),
);

const sinAcento = (s: string) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

/** Deja el nombre en formato de saludo: "Pamela Guinez Lattus". */
function capitalizar(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length <= 2 ? w : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

/** Primer nombre, que es como se pide por teléfono. */
export function primerNombre(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] ?? nombre;
}

/**
 * Busca al dueño en la razón social. Devuelve null cuando no hay evidencia:
 * es preferible no tener nombre a tener uno inventado.
 */
export function decisorDeRazonSocial(razonSocial: string): DecisorDetectado | null {
  const rs = sinAcento(razonSocial);
  if (!rs.trim()) return null;

  // 1) "DR/DRA + nombre" — el más explícito de todos.
  const dr = rs.match(/\b(?:DR|DRA|DOCTOR|DOCTORA)\.?\s+([A-Z]{3,}(?:\s+[A-Z]{3,}){1,3})/);
  if (dr) {
    const limpio = dr[1]
      .split(/\s+/)
      .filter((t) => !NO_PERSONA.has(t))
      .join(" ");
    const podado = podarNombre(limpio);
    if (pareceNombreDePersona(podado)) {
      const nombre = capitalizar(podado);
      return {
        nombre,
        patron: "doctor",
        confianza: "alta",
        comoPreguntar: `¿Se encuentra el doctor ${primerNombre(nombre)}?`,
        origen: `Razón social del SII: "${razonSocial}"`,
      };
    }
  }

  const limpio = rs.replace(LEGAL, " ").replace(/[^A-Z ]/g, " ");
  const toks = limpio.split(/\s+/).filter((t) => t.length >= 3);

  // 2) Nombre completo de persona: tres o más palabras seguidas que no son
  //    de negocio y que incluyen un nombre de pila reconocible.
  let mejor: string[] | null = null;
  let i = 0;
  while (i < toks.length) {
    if (NO_PERSONA.has(toks[i])) {
      i++;
      continue;
    }
    let j = i;
    while (j < toks.length && !NO_PERSONA.has(toks[j])) j++;
    const seq = toks.slice(i, j);
    if (seq.length >= 3 && seq.some((t) => PILA.has(t))) {
      if (!mejor || seq.length > mejor.length) mejor = seq;
    }
    i = j + 1;
  }
  if (mejor) {
    // El nombre EMPIEZA en el primer nombre de pila. Sin esto, un rubro que
    // falte en la lista de arriba se cuela como si fuera parte del nombre
    // ("Odontologicos Olivia Andrea Tapia"), y HQ terminaría preguntando por
    // "don Odontológicos". Anclar en la pila es a prueba de huecos de
    // vocabulario, que es mejor que ir tapando palabra por palabra.
    const desde = mejor.findIndex((t) => PILA.has(t));
    const recortado = desde > 0 ? mejor.slice(desde) : mejor;
    const podado = podarNombre(recortado.join(" "));
    if (!pareceNombreDePersona(podado)) return null;
    const nombre = capitalizar(podado);
    return {
      nombre,
      patron: "nombre_completo",
      confianza: "alta",
      comoPreguntar: `¿Está ${primerNombre(nombre)}?`,
      origen: `Razón social del SII: "${razonSocial}"`,
    };
  }

  // 3) "APELLIDO Y APELLIDO" — son los socios, aunque falte el nombre de pila.
  // Dos apellidos unidos por "y". Se exige que ninguno sea palabra de rubro:
  // "GINECOLOGICA Y RADIOLOGICA" no son los socios, es la especialidad.
  const socios = limpio.match(/\b([A-Z]{4,})\s+Y\s+([A-Z]{4,})\b/);
  if (
    socios &&
    !NO_PERSONA.has(socios[1]) &&
    !NO_PERSONA.has(socios[2]) &&
    pareceNombreDePersona(`${socios[1]} ${socios[2]}`)
  ) {
    const nombre = capitalizar(`${socios[1]} y ${socios[2]}`);
    return {
      nombre,
      patron: "socios",
      confianza: "media",
      comoPreguntar: `¿Está el señor ${capitalizar(socios[1])} o el señor ${capitalizar(socios[2])}?`,
      origen: `Razón social del SII (apellidos de los socios): "${razonSocial}"`,
    };
  }

  return null;
}
