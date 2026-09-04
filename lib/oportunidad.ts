/**
 * MOTOR 1 · OPORTUNIDAD — ¿a esta empresa vale la pena venderle Respondo HOY?
 *
 * POR QUÉ ESTÁ SEPARADO DE LA CONTACTABILIDAD
 * Marcelo, 4-sep-2026: "un lead perfectamente enriquecido sigue siendo un mal
 * lead si esa empresa no tiene sentido comercial para Respondo".
 *
 * Hasta ahora HQ ordenaba Leads Foco por `calidad`, que mide si vamos a poder
 * hablar con alguien. Eso premia a la empresa fácil de contactar por sobre la
 * que nos compraría — que es exactamente el error contrario al que veníamos
 * arreglando, y no se arregla mezclándolos en un solo número.
 *
 * QUÉ LE FALTABA A `encaje.ts`
 * Es un buen clasificador de RUBRO —¿el asistente puede hacer este trabajo?—
 * y eso se conserva entero: es la primera pregunta y sigue siendo la más
 * importante. Pero era lo único. No miraba:
 *
 *   · el TAMAÑO contra lo que podemos vender e implementar hoy. Una clínica de
 *     600 personas calzaba con /clinica/ y salía "encaje alto", cuando ahí hay
 *     compras, seguridad corporativa, integraciones y un ciclo de meses.
 *   · si el negocio tiene VOLUMEN de consultas. Sin volumen no hay dolor.
 *   · si ya está RESUELTO por un incumbente.
 *   · si está VIVO.
 *
 * DE DÓNDE SALEN LAS SEÑALES: DEL MISMO HTML QUE YA BAJAMOS
 * No hay una descarga extra. `enriquecerLead` baja la portada y hasta tres
 * páginas internas para sacar teléfonos; acá se lee ese mismo texto buscando
 * otra cosa. Un fetch, dos motores.
 */

import type { SenalesWeb } from "@/lib/enriquecimiento";
import { evaluarEncaje, ENCAJE_RANK, type NivelEncaje } from "@/lib/encaje";

/* ═══════════ Señales de TAMAÑO y COMPLEJIDAD leídas del sitio ═══════════ */

/**
 * Marcas de que la venta va a pasar por un proceso y no por una conversación.
 * Cada una de estas, en el sitio de un negocio, dice "acá hay un área que
 * decide y un procedimiento que cumplir".
 */
const CORPORATIVO = {
  licitacion: /licitaci[oó]n|mercado p[uú]blico|bases t[eé]cnicas|orden de compra|convenio marco|proveedor(es)? del estado/i,
  compliance: /pol[ií]tica de privacidad corporativa|c[oó]digo de [eé]tica|canal de denuncias|ley 20\.?393|modelo de prevenci[oó]n|iso ?9001|iso ?27001|gobierno corporativo/i,
  rrhh: /trabaja con nosotros|[uú]nete al equipo|ofertas laborales|postula (con nosotros|aqu[ií])|bolsa de (empleo|trabajo)/i,
  inversionistas: /relaci[oó]n con inversionistas|investor relations|memoria anual|junta de accionistas|estados financieros/i,
  areaEmpresas: /venta[s]? corporativa|clientes corporativos|convenios (con )?empresas|planes empresa|portal de proveedores/i,
};

/** Una cadena tiene otro proceso de decisión que un local único. */
const SUCURSALES = /sucursal(es)?|nuestros locales|nuestras tiendas|encuentra tu (local|tienda|sucursal)|centros? de atenci[oó]n/i;

/** Cuenta direcciones distintas. Proxy de cuántos locales tiene. */
const DIRECCION_CL =
  /\b(av(?:\.|enida)?|calle|camino|pasaje|psje\.?)\s+[A-ZÁÉÍÓÚÑ][\wáéíóúñ.'-]+(?:\s+[\wáéíóúñ.'-]+){0,4}\s+#?\s?\d{1,5}\b/gi;

/** Señales de que hay MUCHA consulta entrando. */
const VOLUMEN = {
  pideEscribir: /escr[ií]benos|cont[aá]ctanos por whatsapp|habla con nosotros|te respondemos|cot[ií]za(?: aqu[ií])?|pide tu hora|reserva tu hora|agenda tu hora/i,
  preguntasFrecuentes: /preguntas frecuentes|\bfaq\b/i,
  horarioExtendido: /24 ?(h|hrs|horas)|todos los d[ií]as|domingo/i,
  catalogo: /cat[aá]logo|nuestros (productos|servicios|planes)|lista de precios/i,
};

export interface SenalesOportunidad {
  /** Cuántas páginas del sitio se pudieron leer. 0 = no abrió. */
  paginasLeidas: number;
  corporativo: string[];
  sucursales: boolean;
  direccionesDistintas: number;
  volumen: string[];
  /** Reseñas en Google, si Places resolvió la ficha. Proxy de tráfico real. */
  reviews: number | null;
}

/** Lee el HTML ya descargado buscando señales de tamaño, complejidad y volumen. */
export function senalesOportunidadDeHtml(
  todo: string,
  paginasLeidas: number,
  reviews: number | null = null,
): SenalesOportunidad {
  const corporativo: string[] = [];
  for (const [clave, re] of Object.entries(CORPORATIVO)) if (re.test(todo)) corporativo.push(clave);

  const volumen: string[] = [];
  for (const [clave, re] of Object.entries(VOLUMEN)) if (re.test(todo)) volumen.push(clave);

  const dirs = new Set<string>();
  for (const m of todo.matchAll(DIRECCION_CL)) {
    dirs.add(m[0].toLowerCase().replace(/\s+/g, " ").trim());
    if (dirs.size > 30) break;
  }

  return {
    paginasLeidas,
    corporativo,
    sucursales: SUCURSALES.test(todo),
    direccionesDistintas: dirs.size,
    volumen,
    reviews,
  };
}

/* ═══════════════════════ El puntaje de oportunidad ═══════════════════════ */

export const NIVELES_OPORTUNIDAD = ["alta", "media", "baja", "no_ahora"] as const;
export type NivelOportunidad = (typeof NIVELES_OPORTUNIDAD)[number];

export const OPORTUNIDAD_LABEL: Record<NivelOportunidad, string> = {
  alta: "Buena oportunidad",
  media: "Oportunidad media",
  baja: "Oportunidad baja",
  no_ahora: "No vale el tiempo ahora",
};

export interface Oportunidad {
  puntos: number;               // 0-100
  nivel: NivelOportunidad;
  /** Por qué sí. En castellano, para mostrarlo. */
  aFavor: string[];
  /** Por qué no. Lo que le costaría al vendedor. */
  enContra: string[];
  /** El motivo del rubro, que sigue siendo la primera pregunta. */
  encaje: NivelEncaje;
  encajeMotivo: string;
}

export interface EntradaOportunidad {
  empresa: string;
  razon_social?: string | null;
  industria?: string | null;
  senal?: string | null;
  nEmpleados?: number | null;
  web?: SenalesWeb | null;
  negocio?: SenalesOportunidad | null;
}

/**
 * El tamaño en el que Respondo puede vender, implementar y cobrar en un ciclo
 * corto. No es una opinión estética: por debajo el ticket no justifica la
 * implementación, y por encima aparecen compras, seguridad y áreas que opinan.
 *
 * Los bordes son suaves a propósito — un negocio de 2 personas con mucho
 * volumen puede ser excelente, y uno de 60 puede seguir decidiendo en una
 * reunión con el dueño.
 */
function porTamano(n: number | null | undefined): { puntos: number; nota: string } {
  if (n == null || n <= 0) return { puntos: 0, nota: "" };
  if (n <= 2) return { puntos: -12, nota: `solo ${n} persona(s) en planilla: el ticket difícilmente se justifique` };
  if (n <= 5) return { puntos: 4, nota: `${n} personas: chico pero el dueño decide en la misma llamada` };
  if (n <= 30) return { puntos: 14, nota: `${n} personas: el tamaño donde esto se vende, se implementa y se cobra rápido` };
  if (n <= 80) return { puntos: 6, nota: `${n} personas: se puede, pero probablemente haya más de un decisor` };
  if (n <= 200) return { puntos: -8, nota: `${n} personas: acá ya hay áreas y un proceso de compra` };
  return { puntos: -22, nota: `${n} personas: compras, seguridad e integraciones — ciclo largo para nuestra etapa` };
}

export function evaluarOportunidad(e: EntradaOportunidad): Oportunidad {
  // ── 1. La primera pregunta sigue siendo el rubro: ¿el asistente puede
  //    hacer este trabajo? Eso ya lo responde `encaje.ts` y no se toca.
  const encaje = evaluarEncaje({
    empresa: e.empresa,
    razon_social: e.razon_social,
    industria: e.industria,
    senal: e.senal,
    nEmpleados: e.nEmpleados,
  } as Parameters<typeof evaluarEncaje>[0]);

  const aFavor: string[] = [];
  const enContra: string[] = [];

  // El encaje pone el piso Y el techo. Un rubro donde el asistente no puede
  // trabajar no se rescata con ninguna otra señal.
  const BASE: Record<NivelEncaje, number> = {
    alto: 62, medio: 46, sin_evaluar: 34, bajo: 16, nulo: 0,
  };
  let puntos = BASE[encaje.nivel];

  // ── EVIDENCIA POR SOBRE PRIOR: el negocio que vive en el DM ────────────
  //
  // El `encaje` es una apuesta a partir del NOMBRE DEL RUBRO: "¿en un negocio
  // así se conversa con clientes?". `solo_redes` no es una apuesta: es la
  // observación de que este negocio, en concreto, no tiene más canal que el
  // mensaje directo. Alguien está escribiendo esas respuestas a mano, hoy.
  //
  // Por eso levanta el piso en vez de sumar unos puntos encima. Los +8 de más
  // abajo se quedan como el bono de volumen que ya eran.
  //
  // Hay una segunda razón, aritmética: a un negocio CON sitio el motor puede
  // restarle hasta 16 puntos cuando le encuentra reservas o CRM andando. A uno
  // que solo tiene Instagram esos descuentos no pueden dispararse nunca —no
  // porque tenga suerte, sino porque es seguro que no hay nada que desplazar—.
  // Compararlos sin corregir eso castiga al que menos infraestructura tiene,
  // que es exactamente el que más nos sirve.
  //
  // NO rescata un rubro `bajo` ni `nulo`: una notaría que solo usa Facebook
  // sigue siendo una notaría. Solo confirma lo que ya era plausible.
  //
  // Y solo vale para un negocio CHICO. Esto lo encontró una prueba de control:
  // un banco de 5.000 personas cuya "web" fuera instagram.com pasaba de
  // "no vale el tiempo" a "oportunidad media". Una empresa de ese tamaño no
  // atiende por DM; lo que pasó es que alguien guardó el link de la red social
  // en vez del sitio. Eso es un dato malo, no una señal. Con el tamaño
  // desconocido sí se aplica: un negocio sin sitio y solo con Instagram es
  // chico casi por definición.
  const chico = e.nEmpleados == null || e.nEmpleados <= 50;
  const soloRedesEvidencia =
    !!e.web?.solo_redes && chico && (encaje.nivel === "medio" || encaje.nivel === "sin_evaluar");
  if (soloRedesEvidencia) {
    puntos = BASE.alto;
    aFavor.push("no tiene sitio: toda su atención pasa por mensajes directos, escritos a mano");
  }

  if (encaje.nivel === "alto") aFavor.push("rubro donde el asistente sí puede trabajar");
  if (encaje.nivel === "bajo" || encaje.nivel === "nulo") enContra.push("el rubro no calza con lo que el asistente sabe hacer");

  // ── 2. Tamaño
  const t = porTamano(e.nEmpleados);
  puntos += t.puntos;
  if (t.nota) (t.puntos >= 0 ? aFavor : enContra).push(t.nota);

  const w = e.web;
  const n = e.negocio;

  // ── 3. ¿Hay volumen de consultas? Sin volumen no hay dolor que resolver.
  if (w?.boton_wa_flotante) { puntos += 9; aFavor.push("botón flotante de WhatsApp: empuja toda la consulta al DM"); }
  else if (w?.whatsapp_link) { puntos += 6; aFavor.push("publica WhatsApp para que le escriban"); }
  // El bono va con el mismo candado de tamaño que el piso de más arriba: la
  // frase "gestiona todo a mano por DM" es igual de falsa para una empresa de
  // 5.000 personas, y antes se la sumábamos igual.
  if (w?.solo_redes && chico) { puntos += 8; aFavor.push("su única presencia es Instagram/Facebook: gestiona todo a mano por DM"); }
  if (n?.volumen.includes("pideEscribir")) { puntos += 5; aFavor.push("su sitio pide explícitamente que le escriban o agenden"); }
  if (n?.volumen.includes("preguntasFrecuentes")) { puntos += 3; aFavor.push("tiene página de preguntas frecuentes: las mismas preguntas se repiten"); }
  if ((n?.reviews ?? 0) >= 150) { puntos += 6; aFavor.push(`${n!.reviews} reseñas en Google: tiene flujo real de clientes`); }
  else if ((n?.reviews ?? 0) > 0 && (n?.reviews ?? 0) < 15) { puntos -= 6; enContra.push(`solo ${n!.reviews} reseñas: poco movimiento visible`); }

  // ── 4. ¿Ya está resuelto? Con el encuadre vigente un bot que solo contesta
  //    NO descalifica —tapa el primer hoyo y deja los otros dos— pero un
  //    sistema de reservas andando sí resuelve una de las tres cosas que
  //    vendemos, y eso baja el valor de la conversación.
  if (w?.reservas) { puntos -= 10; enContra.push(`ya tiene sistema de reservas (${w.reservas}): la agenda la tiene resuelta`); }
  if (w?.crm) { puntos -= 6; enContra.push(`ya usa CRM (${w.crm}): el seguimiento está cubierto`); }
  if (w?.chatbot) { aFavor.push(`tiene bot que contesta (${w.chatbot}) — es la mejor apertura: tapa el primer hoyo y le deja los otros dos`); }
  if (w?.formulario_hora) { puntos += 7; aFavor.push("pide la hora por formulario y no tiene sistema detrás: la agenda la lleva alguien a mano"); }

  // ── 5. Complejidad corporativa. Cada una de estas es tiempo de vendedor
  //    que no termina en una reunión que podamos cerrar este mes.
  const PESO_CORP: Record<string, [number, string]> = {
    licitacion:     [-26, "compra por licitación o convenio marco: no hay conversación que asistir"],
    inversionistas: [-22, "tiene relación con inversionistas: es una corporación, no una pyme"],
    compliance:     [-14, "tiene compliance formal (ISO, canal de denuncias): la compra pasa por revisión"],
    areaEmpresas:   [-8,  "tiene área de ventas corporativas: hay más de un decisor"],
    rrhh:           [-4,  "tiene sección de empleo: estructura de cierta escala"],
  };
  for (const c of n?.corporativo ?? []) {
    const [p, nota] = PESO_CORP[c] ?? [0, ""];
    puntos += p;
    if (nota) enContra.push(nota);
  }

  // Cadena con muchos locales: la decisión sube a una casa matriz.
  if (n && n.direccionesDistintas >= 6) {
    puntos -= 16;
    enContra.push(`${n.direccionesDistintas} direcciones en el sitio: es una cadena, la decisión no está en el local`);
  } else if (n?.sucursales && (n?.direccionesDistintas ?? 0) >= 3) {
    puntos -= 7;
    enContra.push("tiene varias sucursales: confirmar quién decide");
  }

  // ── 6. ¿Está vivo? Un sitio que no abre no descalifica —muchas pymes viven
  //    en Instagram— pero tampoco aporta.
  if (n && n.paginasLeidas === 0) enContra.push("no se pudo leer su sitio: hay menos con qué juzgar");

  puntos = Math.max(0, Math.min(100, Math.round(puntos)));

  // ── 7. El nivel, con permiso explícito de decir que no vale la pena.
  let nivel: NivelOportunidad;
  if (encaje.nivel === "nulo") nivel = "no_ahora";
  else if (puntos >= 62) nivel = "alta";
  else if (puntos >= 42) nivel = "media";
  else if (puntos >= 25) nivel = "baja";
  else nivel = "no_ahora";

  return { puntos, nivel, aFavor, enContra, encaje: encaje.nivel, encajeMotivo: encaje.motivo };
}

/** Para ordenar en SQL sin recalcular. */
export const OPORTUNIDAD_RANK: Record<NivelOportunidad, number> = {
  alta: 3, media: 2, baja: 1, no_ahora: 0,
};

export { ENCAJE_RANK };
