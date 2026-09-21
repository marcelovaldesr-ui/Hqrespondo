/**
 * MOTOR DE SECUENCIAS Y SCHEDULING DETERMINISTA — Outbound V1
 *
 * Principio: Fechas y horarios calculados exclusivamente por código determinista.
 * - Zona horaria: America/Santiago.
 * - Ventana de envío: Lunes a Viernes de 09:00 a 18:00 hrs.
 * - Si una fecha cae en sábado o domingo, se rueda automáticamente al siguiente lunes.
 * - Añade jitter determinista (variación aleatoria de minutos) para evitar ráfagas al mismo segundo.
 */

import { type SequenceStep } from "./types";

export const SECUENCIA_DEFAULT: SequenceStep[] = [
  { step_number: 1, delay_days: 0, delay_unit: "calendar_days", channel: "email", angulo: "apertura" },
  { step_number: 2, delay_days: 4, delay_unit: "calendar_days", channel: "email", angulo: "seguimiento_valor" },
  { step_number: 3, delay_days: 11, delay_unit: "calendar_days", channel: "email", angulo: "pregunta_operativa" },
  { step_number: 4, delay_days: 21, delay_unit: "calendar_days", channel: "email", angulo: "cierre_honesto" },
];

/**
 * Calcula el retraso relativo en días entre dos pasos consecutivos de la secuencia.
 * Dado que SECUENCIA_DEFAULT expresa días acumulados desde D0 (0, 4, 11, 21):
 * - Paso 1 -> Paso 2 = 4 - 0 = 4 días
 * - Paso 2 -> Paso 3 = 11 - 4 = 7 días
 * - Paso 3 -> Paso 4 = 21 - 11 = 10 días
 */
export function calcularDelayRelativoPaso(pasoActualNum: number, pasoSiguienteNum: number): number {
  const pasoActualDef = SECUENCIA_DEFAULT.find((s) => s.step_number === pasoActualNum);
  const pasoSiguienteDef = SECUENCIA_DEFAULT.find((s) => s.step_number === pasoSiguienteNum);
  if (!pasoSiguienteDef) return 0;
  const diasActual = pasoActualDef?.delay_days ?? 0;
  return Math.max(1, pasoSiguienteDef.delay_days - diasActual);
}

export interface ParametrosVentanaEnvio {
  horaInicio?: number; // default 9
  horaFin?: number; // default 18
  diasLaborales?: number[]; // [1, 2, 3, 4, 5] (1 = lunes, 5 = viernes)
  zonaHoraria?: string; // "America/Santiago"
  unidad?: "calendar_days" | "business_days"; // Default: "calendar_days"
}

/** Obtiene el inicio del día (00:00:00) en America/Santiago como objeto Date UTC */
export function obtenerInicioDelDiaSantiago(referencia = new Date()): Date {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const parts = formatter.formatToParts(referencia);
  const year = parseInt(parts.find((p) => p.type === "year")!.value, 10);
  const month = parseInt(parts.find((p) => p.type === "month")!.value, 10);
  const day = parseInt(parts.find((p) => p.type === "day")!.value, 10);

  const fechaMediodia = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const formatoHora = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Santiago",
    hour: "numeric",
    hour12: false,
  });
  const horaLocal = parseInt(formatoHora.format(fechaMediodia), 10);
  const offsetHoras = 12 - horaLocal;

  return new Date(Date.UTC(year, month - 1, day, offsetHoras, 0, 0));
}

/** Obtiene los componentes de fecha/hora en la zona horaria especificada */
export function obtenerComponentesFecha(
  date: Date,
  timeZone = "America/Santiago",
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dayOfWeek: number; // 0 = domingo, 1 = lunes, ..., 6 = sábado
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
    weekday: "short",
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  const year = parseInt(getPart("year"), 10);
  const month = parseInt(getPart("month"), 10);
  const day = parseInt(getPart("day"), 10);
  const hour = parseInt(getPart("hour"), 10) % 24;
  const minute = parseInt(getPart("minute"), 10);
  const weekdayStr = getPart("weekday").toLowerCase();

  const daysMap: Record<string, number> = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
  };
  const dayOfWeek = daysMap[weekdayStr] ?? date.getDay();

  return { year, month, day, hour, minute, dayOfWeek };
}

/**
 * Calcula la próxima fecha hábil de envío en base a una fecha de referencia y días de retraso.
 * En V1:
 * - diasRetraso opera en DÍAS CALENDARIO por defecto (unidad: 'calendar_days').
 * - Si la fecha resultante cae en fin de semana (sábado/domingo), rueda automáticamente al lunes hábil.
 * - Si cae fuera de la ventana 09:00 a 18:00 CLT, se ajusta a la ventana correspondiente.
 */
export function calcularFechaProgramada(
  fechaBase: Date,
  diasRetraso: number,
  params?: ParametrosVentanaEnvio,
  jitterMinutos = 0,
): Date {
  const horaInicio = params?.horaInicio ?? 9;
  const horaFin = params?.horaFin ?? 18;
  const diasLaborales = params?.diasLaborales ?? [1, 2, 3, 4, 5];
  const timeZone = params?.zonaHoraria ?? "America/Santiago";
  const unidad = params?.unidad ?? "calendar_days";

  let target: Date;

  if (unidad === "business_days") {
    // Modo explícito de días hábiles: avanza día a día solo contando días hábiles
    target = new Date(fechaBase.getTime());
    let diasAvanzados = 0;
    while (diasAvanzados < diasRetraso) {
      target = new Date(target.getTime() + 86_400_000);
      const comp = obtenerComponentesFecha(target, timeZone);
      if (diasLaborales.includes(comp.dayOfWeek)) {
        diasAvanzados++;
      }
    }
  } else {
    // Modo V1 por defecto: DELAY EN DÍAS CALENDARIO
    target = new Date(fechaBase.getTime() + diasRetraso * 86_400_000);

    // Ajuste posterior: Si cae en sábado o domingo, rueda al lunes hábil siguiente a las 09:00
    const compInicial = obtenerComponentesFecha(target, timeZone);
    if (!diasLaborales.includes(compInicial.dayOfWeek)) {
      while (!diasLaborales.includes(obtenerComponentesFecha(target, timeZone).dayOfWeek)) {
        target = new Date(target.getTime() + 86_400_000);
      }
      // Al rodar de fin de semana al lunes, parte al inicio de la jornada
      const compLunes = obtenerComponentesFecha(target, timeZone);
      const diffHoras = horaInicio - compLunes.hour;
      target = new Date(target.getTime() + diffHoras * 3600_000);
    }
  }

  // Ajustar a la ventana horaria (entre horaInicio y horaFin)
  const comp = obtenerComponentesFecha(target, timeZone);
  let horaElegida = comp.hour;

  if (horaElegida < horaInicio) {
    horaElegida = horaInicio;
  } else if (horaElegida >= horaFin) {
    // Si ya pasó la ventana de hoy, pasa al día hábil siguiente a las 09:00
    target = new Date(target.getTime() + 86_400_000);
    while (!diasLaborales.includes(obtenerComponentesFecha(target, timeZone).dayOfWeek)) {
      target = new Date(target.getTime() + 86_400_000);
    }
    const compSiguiente = obtenerComponentesFecha(target, timeZone);
    const diffHoras = horaInicio - compSiguiente.hour;
    target = new Date(target.getTime() + diffHoras * 3600_000);
    horaElegida = horaInicio;
  }

  // Aplicar jitter determinista (entre 0 y 45 minutos)
  const compFinal = obtenerComponentesFecha(target, timeZone);
  const minutosFinales = Math.min(59, Math.max(0, compFinal.minute + jitterMinutos));

  const diffHoras = horaElegida - compFinal.hour;
  const diffMinutos = minutosFinales - compFinal.minute;
  const fechaFinal = new Date(target.getTime() + diffHoras * 3600_000 + diffMinutos * 60_000);

  return fechaFinal;
}

/** Genera una clave hash determinista para idempotencia */
export function generarIdempotencyKey(params: {
  campaignId: string;
  contactId: string;
  stepNumber: number;
}): string {
  return `outbox_${params.campaignId}_${params.contactId}_step${params.stepNumber}`;
}
