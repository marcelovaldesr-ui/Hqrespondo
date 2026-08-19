import {
  PLAN_PRECIOS,
  PLAN_LABEL,
  PLAN_LIMITES,
  PLANES,
  type Plan,
} from "@/lib/types";

/**
 * Modelo de proyección — versión agosto 2026.
 *
 * El modelo original (proyeccion.html, julio) se armó cuando Respondo era un
 * chatbot de WhatsApp que se vendía a $39.990 con setup aparte. Tres supuestos
 * suyos ya no son ciertos y cambian el resultado, no el decorado:
 *
 *   1. Cobraba $390.000 de implementación por cliente y decía de eso que era
 *      "literalmente la caja de los primeros seis meses". La tabla vigente
 *      (migración 018, 12-ago-2026) dice setup $0: la instalación va incluida.
 *      Sacar ese ingreso atrasa el punto de caja positiva, y hay que verlo.
 *   2. Usaba un solo "ticket promedio" inventado. Hoy existen 4 planes reales
 *      con precio, cupo y excedente definidos: el ticket sale de la mezcla.
 *   3. Facturaba al cliente desde el mes en que entra. Hay 14 días de prueba:
 *      el mes de entrada rinde aproximadamente medio.
 *
 * Y dos cosas que el modelo viejo no tenía y sí existen:
 *   · Los excedentes por conversación sobre el cupo ($50 a $90 según plan).
 *   · El costo variable atado a la MISMA conversación que se vende. El modelo
 *     viejo lo ponía como un % suelto del recurrente; acá el cupo del plan
 *     manda las dos cosas: si un cliente usa más conversaciones, sube su costo
 *     Y sube lo que paga de excedente. Es la única forma de que el margen del
 *     plan salga del plan y no de un porcentaje elegido a dedo.
 *   · Amaro, que no es socio y no reparte caja: se le paga un fijo por cada
 *     reunión válida que consigue. Es costo variable atado al embudo.
 *
 * Todos los montos son NETOS (sin IVA), igual que la tabla de planes.
 */

export const MESES = 36;

/** Mezcla de venta: qué proporción de los clientes nuevos es de cada plan.
 *  Se normaliza sola, así que los números son pesos relativos, no porcentajes
 *  que tengan que sumar 100. */
export type Mezcla = Record<Plan, number>;

export interface Supuestos {
  /** Clientes nuevos al mes durante los primeros 6 meses. */
  nuevos1: number;
  /** Clientes nuevos al mes del mes 7 en adelante. */
  nuevos2: number;
  mezcla: Mezcla;
  /** Fuga mensual de clientes, en %. */
  churn: number;
  /** Qué porcentaje de su cupo usa el cliente promedio. Sobre 100% empieza a
   *  generar excedentes facturables — y también más costo. */
  utilizacion: number;
  /** Costo directo de una conversación: tokens de IA más, si lleva
   *  recordatorio, una plantilla de utilidad de WhatsApp. Las respuestas
   *  dentro de la ventana de 24 h que abre el cliente no las cobra Meta, que
   *  es justo el caso de Tino contestando. */
  costoPorConversacion: number;
  /** Costos fijos mensuales. */
  fijos: number;
  /** Inversión en marketing al mes. */
  marketing: number;
  /** Lo que se le paga a Amaro por cada reunión válida conseguida. */
  porReunion: number;
  /** Cuántas reuniones válidas hacen falta para cerrar un cliente. */
  reunionesPorCierre: number;
  /** % de la caja que se reinvierte en vez de repartirse. */
  reinversion: number;
  socios: number;
  /** Retiro mensual objetivo por socio. */
  objetivo: number;
  /** Cuántos clientes activos alcanza a sostener una persona del equipo.
   *  El modelo no lo usa para frenar la venta: lo usa para avisar. El techo
   *  de este negocio no es cuántos clientes se consiguen, es cuántos se
   *  alcanza a instalar y sostener, y un modelo que crece para siempre sin
   *  decirlo es exactamente la mentira que hay que evitar. */
  capacidadPorPersona: number;
  /** Personas que hoy sostienen implementación y soporte. */
  personasOperando: number;
  /** Punto de partida real, leído de la base: clientes activos y su MRR. */
  clientesIniciales: number;
  mrrInicial: number;
}

export interface FilaProyeccion {
  mes: number;
  nuevos: number;
  activos: number;
  /** Recurrente en régimen: todos los activos pagando mes completo. */
  mrr: number;
  /** Conversaciones atendidas en el mes por toda la base. */
  conversaciones: number;
  /** El mes pide más implementación y soporte del que el equipo aguanta. */
  sobreCapacidad: boolean;
  /** Lo que efectivamente se factura: descuenta la prueba de los que entran. */
  recurrenteFacturado: number;
  excedentes: number;
  ingresos: number;
  reuniones: number;
  costoReuniones: number;
  costoVariable: number;
  costos: number;
  caja: number;
  cajaAcumulada: number;
  repartible: number;
  porSocio: number;
}

/** Días de prueba de la tabla vigente. El mes de entrada rinde la fracción
 *  del mes que queda después de la prueba. */
export const DIAS_PRUEBA = 14;
const FACTOR_MES_ENTRADA = (30 - DIAS_PRUEBA) / 30;

/** Promedio ponderado de cualquier atributo del plan según la mezcla. */
function ponderado(m: Mezcla, valor: Record<Plan, number>): number {
  const total = PLANES.reduce((a, p) => a + Math.max(0, m[p]), 0);
  if (total <= 0) return 0;
  return PLANES.reduce((a, p) => a + Math.max(0, m[p]) * valor[p], 0) / total;
}

/** Cupo de conversaciones del plan promedio según la mezcla. */
export function cupoPromedio(m: Mezcla): number {
  return ponderado(m, PLAN_LIMITES);
}

export function ticketPromedio(m: Mezcla): number {
  const total = PLANES.reduce((a, p) => a + Math.max(0, m[p]), 0);
  if (total <= 0) return 0;
  return (
    PLANES.reduce((a, p) => a + Math.max(0, m[p]) * PLAN_PRECIOS[p].mensual, 0) /
    total
  );
}

/** Precio de excedente promedio ponderado por la misma mezcla. Un cliente
 *  Empresa paga $50 por conversación extra y uno Tino solo paga $90: usar un
 *  número único sobreestimaría o subestimaría según a quién se le venda. */
export function excedentePromedio(m: Mezcla, precios: Record<Plan, number>): number {
  return ponderado(m, precios);
}

export function proyectar(s: Supuestos, preciosExcedente: Record<Plan, number>): FilaProyeccion[] {
  const ticket = ticketPromedio(s.mezcla);
  const precioExc = excedentePromedio(s.mezcla, preciosExcedente);
  const cupo = cupoPromedio(s.mezcla);
  const convPorCliente = cupo * (s.utilizacion / 100);
  const excedentePorCliente = Math.max(0, convPorCliente - cupo);

  const filas: FilaProyeccion[] = [];
  // Dos cohortes: los clientes que YA existen mantienen su mensualidad real
  // (leída de la base), y los nuevos entran al ticket de la mezcla. Meterlos
  // en un solo promedio revaluaría a los clientes actuales a un precio que
  // nadie les cobró.
  let activosHeredados = s.clientesIniciales;
  let mrrHeredado = s.mrrInicial;
  let activosNuevos = 0;
  let acumulada = 0;

  for (let mes = 1; mes <= MESES; mes++) {
    const nuevos = mes <= 6 ? s.nuevos1 : s.nuevos2;
    const queda = 1 - s.churn / 100;

    // La fuga se aplica sobre la base que YA estaba, no sobre los que entran
    // este mes: un cliente no se puede fugar antes de terminar su prueba.
    activosHeredados *= queda;
    mrrHeredado *= queda;
    const enRegimen = activosHeredados + activosNuevos * queda;
    activosNuevos = activosNuevos * queda + nuevos;

    const activos = activosHeredados + activosNuevos;

    // El recurrente "de régimen" es la foto de cuánto rinde la base si nadie
    // más entra. Es el número que importa para valorizar.
    const mrr = mrrHeredado + activosNuevos * ticket;

    // Lo facturado descuenta la prueba de los que recién entraron.
    const recurrenteFacturado =
      mrrHeredado +
      (activosNuevos - nuevos) * ticket +
      nuevos * ticket * FACTOR_MES_ENTRADA;

    // Los excedentes solo los generan los clientes que ya están operando: uno
    // que está en su prueba todavía no pasó ningún cupo.
    const excedentes = enRegimen * excedentePorCliente * precioExc;

    const ingresos = recurrenteFacturado + excedentes;

    // El costo sí lo generan todos, incluidos los que están en prueba: el
    // cliente en prueba consume igual. Es la parte que hace que una prueba
    // larga cueste plata de verdad.
    const conversaciones = activos * convPorCliente;

    // Amaro cobra por reunión válida, no por cierre. Las reuniones que hay
    // que conseguir para cerrar `nuevos` clientes son el costo real.
    const reuniones = nuevos * s.reunionesPorCierre;
    const costoReuniones = reuniones * s.porReunion;

    const costoVariable = conversaciones * s.costoPorConversacion;
    const costos = costoVariable + s.fijos + s.marketing + costoReuniones;

    const caja = ingresos - costos;
    acumulada += caja;

    const repartible = Math.max(0, caja) * (1 - s.reinversion / 100);
    const porSocio = s.socios > 0 ? repartible / s.socios : 0;

    filas.push({
      mes,
      nuevos,
      activos,
      mrr,
      conversaciones,
      sobreCapacidad: activos > s.capacidadPorPersona * s.personasOperando,
      recurrenteFacturado,
      excedentes,
      ingresos,
      reuniones,
      costoReuniones,
      costoVariable,
      costos,
      caja,
      cajaAcumulada: acumulada,
      repartible,
      porSocio,
    });
  }
  return filas;
}

/** La caja mensual que hace falta para que cada socio retire el objetivo,
 *  dado cuánto se reinvierte. Es la línea de referencia del gráfico. */
export function cajaObjetivo(s: Supuestos): number {
  const factor = 1 - s.reinversion / 100;
  if (factor <= 0) return Infinity;
  return (s.objetivo * s.socios) / factor;
}

export interface Hitos {
  /** Primer mes con caja positiva. */
  breakeven: FilaProyeccion | null;
  /** Primer mes en que cada socio alcanza su objetivo de retiro. */
  objetivo: FilaProyeccion | null;
  /** Primer mes con 12 clientes activos: el punto donde implementar deja de
   *  caber en el tiempo disponible y toca sumar a alguien. */
  doceClientes: FilaProyeccion | null;
  /** Mes en que la caja acumulada deja de estar en rojo. */
  recuperaInversion: FilaProyeccion | null;
  /** Primer mes en que la base supera lo que el equipo puede sostener. */
  techoOperativo: FilaProyeccion | null;
}

export function hitos(filas: FilaProyeccion[], s: Supuestos): Hitos {
  return {
    breakeven: filas.find((f) => f.caja > 0) ?? null,
    objetivo: filas.find((f) => f.porSocio >= s.objetivo) ?? null,
    doceClientes: filas.find((f) => f.activos >= 12) ?? null,
    recuperaInversion: filas.find((f) => f.cajaAcumulada >= 0) ?? null,
    techoOperativo: filas.find((f) => f.sobreCapacidad) ?? null,
  };
}

export const PLAN_NOMBRE = PLAN_LABEL;
