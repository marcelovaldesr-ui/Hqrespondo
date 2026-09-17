/**
 * RESPONDO HQ — REVENUE OPERATING SYSTEM V1
 * Guardrails Comerciales y Detección de Estancamiento
 *
 * Regla de oro:
 * "NINGUNA OPORTUNIDAD ACTIVA DEBERÍA QUEDAR SIN NEXT_ACTION + NEXT_ACTION_AT
 * después de meeting, pilot o propuesta."
 */

import { HqDeal, HqMeeting, HqPilot, HqProposal, RevenueStage } from "./types";

export interface StalledCheckResult {
  isStalled: boolean;
  reason: string | null;
  recommendedAction: string | null;
  daysInactive: number;
}

const ETAPAS_ACTIVAS: RevenueStage[] = [
  "nuevo",
  "contactando",
  "reunion_agendada",
  "discovery_completado",
  "calificado",
  "piloto_propuesto",
  "piloto_activo",
  "propuesta_enviada",
  "en_decision",
];

export function esEtapaActiva(etapa: RevenueStage): boolean {
  return ETAPAS_ACTIVAS.includes(etapa);
}

/**
 * Evalúa si un Deal está estancado operativamente.
 */
export function evaluarTratoEstancado(
  deal: HqDeal,
  options?: {
    meetings?: HqMeeting[];
    proposals?: HqProposal[];
    pilots?: HqPilot[];
    now?: Date;
  }
): StalledCheckResult {
  if (!esEtapaActiva(deal.etapa)) {
    return {
      isStalled: false,
      reason: null,
      recommendedAction: null,
      daysInactive: 0,
    };
  }

  const now = options?.now || new Date();
  const updatedTime = new Date(deal.updated_at || deal.created_at).getTime();
  const daysInactive = Math.max(0, Math.floor((now.getTime() - updatedTime) / (1000 * 60 * 60 * 24)));

  // Regla 1: Next Action vencido
  if (deal.next_action_at) {
    const nextActionDate = new Date(deal.next_action_at);
    if (nextActionDate.getTime() < now.getTime()) {
      const daysOverdue = Math.floor((now.getTime() - nextActionDate.getTime()) / (1000 * 60 * 60 * 24));
      return {
        isStalled: true,
        reason: `Siguiente acción vencida hace ${daysOverdue} día(s): "${deal.next_action}"`,
        recommendedAction: "Ejecutar toque comprometido o reagendar con fecha firme",
        daysInactive,
      };
    }
  } else {
    return {
      isStalled: true,
      reason: "Oportunidad activa sin próxima acción programada (Next Step huérfano)",
      recommendedAction: "Definir inmediatamente responsable, acción y fecha próxima",
      daysInactive,
    };
  }

  // Regla 2: Trampa de la Propuesta Aleta (Propuesta enviada sin fecha de revisión ni decisión)
  if (deal.etapa === "propuesta_enviada") {
    const activeProposal = options?.proposals?.find(
      (p) => p.deal_id === deal.id && (p.status === "enviada" || p.status === "en_revision")
    );
    if (activeProposal) {
      if (!activeProposal.review_date && !activeProposal.decision_date) {
        return {
          isStalled: true,
          reason: "Propuesta enviada sin fecha de revisión ni decisión ('Problema Aleta')",
          recommendedAction: "Enviar follow-up consultivo fijando llamada de 15 minutos para revisar dudas",
          daysInactive,
        };
      }
      if (activeProposal.decision_date && new Date(activeProposal.decision_date).getTime() < now.getTime()) {
        return {
          isStalled: true,
          reason: `Fecha de decisión comprometida superada (${activeProposal.decision_date})`,
          recommendedAction: "Llamar al decisor para solicitar resolución o registrar objeción",
          daysInactive,
        };
      }
    }
  }

  // Regla 3: Piloto activo sin revisión del Día 14 fijada
  if (deal.etapa === "piloto_activo") {
    const activePilot = options?.pilots?.find(
      (p) => p.deal_id === deal.id && (p.status === "activo" || p.status === "configuracion")
    );
    if (activePilot && !activePilot.review_date) {
      return {
        isStalled: true,
        reason: "Piloto en curso sin fecha de reunión del Día 14 programada",
        recommendedAction: "Fijar sesión formal de revisión de métricas para el Día 14",
        daysInactive,
      };
    }
  }

  // Regla 4: Inactividad prolongada por etapa
  const MAX_DIAS_INACTIVIDAD: Partial<Record<RevenueStage, number>> = {
    contactando: 4,
    reunion_agendada: 5,
    discovery_completado: 3,
    calificado: 3,
    piloto_propuesto: 4,
    propuesta_enviada: 4,
    en_decision: 3,
  };

  const umbral = MAX_DIAS_INACTIVIDAD[deal.etapa] || 7;
  if (daysInactive >= umbral) {
    return {
      isStalled: true,
      reason: `Sin avance en etapa '${deal.etapa}' por más de ${daysInactive} días (umbral: ${umbral}d)`,
      recommendedAction: "Reactivar al prospecto con nuevo dato de valor o marcar como nurture/perdido",
      daysInactive,
    };
  }

  return {
    isStalled: false,
    reason: null,
    recommendedAction: null,
    daysInactive,
  };
}

/**
 * Valida la Regla de Oro: Ningún Deal activo puede quedar sin next_action ni next_action_at
 */
export function validarReglaNextAction(deal: {
  etapa: RevenueStage;
  next_action?: string | null;
  next_action_at?: string | null;
}): { valid: boolean; error?: string } {
  if (!esEtapaActiva(deal.etapa)) {
    return { valid: true };
  }

  if (!deal.next_action || deal.next_action.trim().length === 0) {
    return {
      valid: false,
      error: "Toda oportunidad activa debe tener una 'Próxima Acción' descrita con claridad.",
    };
  }

  if (!deal.next_action_at) {
    return {
      valid: false,
      error: "Toda oportunidad activa debe tener una fecha programada para la próxima acción.",
    };
  }

  return { valid: true };
}

/**
 * Valida que una propuesta comercial tenga las fechas requeridas
 */
export function validarPropuestaGuardrail(proposal: {
  status: string;
  review_date?: string | null;
  decision_date?: string | null;
}): { valid: boolean; warning?: string } {
  if (proposal.status === "enviada") {
    if (!proposal.review_date && !proposal.decision_date) {
      return {
        valid: true,
        warning:
          "ADVERTENCIA COMERCIAL: Propuesta sin fecha de revisión ni de decisión. Se corre el riesgo de pérdida de control ('Efecto Aleta').",
      };
    }
  }
  return { valid: true };
}
