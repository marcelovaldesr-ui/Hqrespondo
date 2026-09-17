/**
 * RESPONDO HQ — REVENUE OPERATING SYSTEM V1
 * Motor Determinista de Calificación y Priorización Comercial
 *
 * Principio fundacional de Marcelo (4-sep-2026):
 * "CONTACTABILIDAD NO REEMPLAZA EL FIT COMERCIAL. Un lead perfectamente enriquecido
 * sigue siendo un mal lead si esa empresa no tiene sentido comercial para Respondo."
 */

export interface ScoringFactors {
  // Factores de Encaje (ICP Fit)
  usesWhatsApp: boolean;
  usesBooking: boolean;
  usesPaidAds: boolean;
  isQuoteDriven: boolean;
  isSpeedSensitive: boolean;
  employeeCount?: number | null;
  branchesCount?: number | null;
  industry: string;
  hasOwnWeb: boolean;

  // Factores de Señal de Intención (Intent)
  repliedToOutreach?: boolean;
  meetingBooked?: boolean;
  meetingAttended?: boolean;
  askedPricing?: boolean;
  pilotInterest?: boolean;
  proposalRequested?: boolean;
  decisionMakerInvolved?: boolean;
}

export interface ScoreResult {
  fitScore: number;       // 0-100
  intentScore: number;    // 0-100
  priorityScore: number;  // 0-100 (Media geométrica ponderada)
  veredicto: "prioridad_inmediata" | "llamar_hoy" | "enriquecer_o_nurture" | "descartar";
  reasons: string[];
}

/** Industrias con alto fit natural para Respondo en Chile */
const HIGH_FIT_INDUSTRIES = [
  "estetica",
  "belleza",
  "clinica",
  "dental",
  "salud",
  "taller",
  "motos",
  "automotriz",
  "imprenta",
  "distribucion",
  "servicios_profesionales",
  "veterinaria",
  "clases",
  "arriendos",
];

export function calcularScoringComercial(factors: ScoringFactors): ScoreResult {
  const reasons: string[] = [];
  let fit = 0;
  let intent = 0;

  // 1. EVALUACIÓN DE ENCAJE (FIT - Máx 100 pts)

  // WhatsApp como canal comercial (base obligatoria)
  if (factors.usesWhatsApp) {
    fit += 25;
    reasons.push("+25: Utiliza WhatsApp como canal activo de atención");
  } else {
    reasons.push("-10: No se detecta enlace directo a WhatsApp");
  }

  // Agendamiento o citas
  if (factors.usesBooking) {
    fit += 20;
    reasons.push("+20: Negocio dependiente de agenda/citas (fuerte tracción con agenda IA)");
  }

  // Venta basada en cotizaciones / consultas
  if (factors.isQuoteDriven) {
    fit += 20;
    reasons.push("+20: Venta consultiva por cotización (ideal para Tino y Beto)");
  }

  // Inversión en publicidad digital (Click-to-WhatsApp)
  if (factors.usesPaidAds) {
    fit += 15;
    reasons.push("+15: Invierte activamente en anuncios (demanda urgente sin respuesta inmediata)");
  }

  // Sensible a velocidad de respuesta
  if (factors.isSpeedSensitive) {
    fit += 10;
    reasons.push("+10: Ventas altamente sensibles al tiempo de primera respuesta");
  }

  // Industria prioritaria
  const indNormalized = (factors.industry || "").toLowerCase();
  const isHighFit = HIGH_FIT_INDUSTRIES.some((ind) => indNormalized.includes(ind));
  if (isHighFit) {
    fit += 10;
    reasons.push(`+10: Rubro prioritario validado (${factors.industry})`);
  }

  // Tamaño de empresa (Sweet spot: 5 a 50 empleados)
  if (factors.employeeCount) {
    if (factors.employeeCount >= 3 && factors.employeeCount <= 50) {
      fit += 10;
      reasons.push(`+10: Tamaño óptimo (${factors.employeeCount} empleados: pyme con volumen y dueño accesible)`);
    } else if (factors.employeeCount > 200) {
      fit -= 30;
      reasons.push(`-30: Empresa demasiado grande (${factors.employeeCount} empleados: riesgo de burocracia enterprise)`);
    }
  }

  // Normalizar Fit entre 0 y 100
  fit = Math.max(0, Math.min(100, fit));

  // 2. EVALUACIÓN DE INTENCIÓN (INTENT - Máx 100 pts)
  if (factors.decisionMakerInvolved) {
    intent += 25;
    reasons.push("+25 (Intent): Tomador de decisión confirmado en la conversación");
  }
  if (factors.proposalRequested) {
    intent += 25;
    reasons.push("+25 (Intent): Solicitó propuesta formal");
  }
  if (factors.pilotInterest) {
    intent += 20;
    reasons.push("+20 (Intent): Mostró interés explícito en el piloto de 14 días");
  }
  if (factors.meetingAttended) {
    intent += 15;
    reasons.push("+15 (Intent): Asistió a la reunión de discovery");
  } else if (factors.meetingBooked) {
    intent += 10;
    reasons.push("+10 (Intent): Reunión agendada en calendario");
  }
  if (factors.repliedToOutreach) {
    intent += 10;
    reasons.push("+10 (Intent): Respondió positivamente a prospección");
  }
  if (factors.askedPricing) {
    intent += 10;
    reasons.push("+10 (Intent): Preguntó activamente por precios/planes");
  }

  intent = Math.max(0, Math.min(100, intent));

  // 3. PRIORIDAD (Media geométrica con piso de fit)
  // Regla declarada de Marcelo: si fit < 40, priority = 0 ("sin fit no hay prioridad")
  let priority = 0;
  if (fit >= 40) {
    // Si no hay intent todavía (etapa prospecto), asumimos intent base de 20 para ordenar por fit
    const effectiveIntent = Math.max(intent, 20);
    priority = Math.round(Math.sqrt(fit * effectiveIntent));
  } else {
    priority = 0;
    reasons.push("Nota: Prioridad anulada por bajo encaje comercial (fit < 40 -> priority = 0)");
  }

  // Veredicto
  let veredicto: ScoreResult["veredicto"] = "enriquecer_o_nurture";
  if (priority >= 65 && intent >= 40) {
    veredicto = "prioridad_inmediata";
  } else if (priority >= 45 || fit >= 70) {
    veredicto = "llamar_hoy";
  } else if (fit < 35) {
    veredicto = "descartar";
  }

  return {
    fitScore: Math.max(0, Math.min(100, fit)),
    intentScore: Math.max(0, Math.min(100, intent)),
    priorityScore: Math.max(0, Math.min(100, priority)),
    veredicto,
    reasons,
  };
}

/**
 * Calcula scoring determinista a partir de los datos de un Deal
 */
export function calcularScoringDeal(deal: {
  industry?: string;
  contact_whatsapp?: string;
  contact_phone?: string;
  contact_role?: string;
  etapa?: string;
  fit_score?: number;
  intent_score?: number;
}): {
  fitScore: number;
  intentScore: number;
  priorityScore: number;
} {
  // Si ya vienen scores explícitos válidos asignados, respetarlos
  if (
    typeof deal.fit_score === "number" &&
    typeof deal.intent_score === "number" &&
    deal.fit_score > 0
  ) {
    const fit = Math.max(0, Math.min(100, deal.fit_score));
    const intent = Math.max(0, Math.min(100, deal.intent_score));
    const priority = fit < 40 ? 0 : Math.round(Math.sqrt(fit * Math.max(intent, 20)));
    return {
      fitScore: fit,
      intentScore: intent,
      priorityScore: Math.max(0, Math.min(100, priority)),
    };
  }

  const ind = (deal.industry || "").toLowerCase();
  const usesWhatsApp = !!deal.contact_whatsapp || !!deal.contact_phone;
  const usesBooking =
    ind.includes("salud") ||
    ind.includes("dental") ||
    ind.includes("estetica") ||
    ind.includes("belleza") ||
    ind.includes("clinica");
  const isQuoteDriven =
    ind.includes("taller") ||
    ind.includes("imprenta") ||
    ind.includes("distribucion") ||
    ind.includes("arriendos");

  const etapa = deal.etapa || "nuevo";
  const meetingAttended =
    etapa === "discovery_completado" ||
    etapa === "calificado" ||
    etapa === "piloto_activo" ||
    etapa === "propuesta_enviada" ||
    etapa === "en_decision" ||
    etapa === "ganado";
  const meetingBooked = etapa === "reunion_agendada" || meetingAttended;
  const pilotInterest = etapa === "piloto_propuesto" || etapa === "piloto_activo";
  const proposalRequested =
    etapa === "propuesta_enviada" || etapa === "en_decision" || etapa === "ganado";

  const res = calcularScoringComercial({
    usesWhatsApp,
    usesBooking,
    usesPaidAds: false,
    isQuoteDriven,
    isSpeedSensitive: true,
    industry: deal.industry || "general",
    hasOwnWeb: true,
    meetingBooked,
    meetingAttended,
    pilotInterest,
    proposalRequested,
    decisionMakerInvolved: deal.contact_role
      ? /dueño|socio|gerente|fundador|director|decisor/i.test(deal.contact_role)
      : false,
  });

  return {
    fitScore: res.fitScore,
    intentScore: res.intentScore,
    priorityScore: res.priorityScore,
  };
}
