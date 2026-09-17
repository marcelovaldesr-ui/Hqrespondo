"use server";

import { revalidatePath } from "next/cache";
import { getRevenueStore } from "@/lib/revenue/store";
import {
  HqDeal,
  HqMeeting,
  HqPilot,
  HqProposal,
  RevenueStage,
  LostReason,
} from "@/lib/revenue/types";
import { validarUUID } from "@/lib/revenue/validation";

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

function revalidateAllRevenuePages() {
  try {
    revalidatePath("/pipeline");
    revalidatePath("/dashboard");
    revalidatePath("/reuniones");
    revalidatePath("/pilotos");
    revalidatePath("/propuestas");
  } catch (err) {
    // revalidatePath puede fallar en entorno de testing fuera de request context
  }
}

/**
 * Crea un nuevo Deal en el sistema persistente
 */
export async function createDealAction(
  rawInput: unknown
): Promise<ActionResult<HqDeal>> {
  try {
    const store = getRevenueStore();
    const created = await store.createDeal(rawInput as any);
    revalidateAllRevenuePages();
    return { success: true, data: created };
  } catch (err: any) {
    console.error("[createDealAction] error:", err);
    return { success: false, error: err?.message || "Error al crear el deal" };
  }
}

/**
 * Actualiza la etapa de un Deal aplicando validación de transición y guardrails
 */
export async function updateDealStageAction(
  dealId: string,
  newStage: RevenueStage,
  extraUpdates?: Partial<HqDeal>
): Promise<ActionResult<HqDeal>> {
  try {
    validarUUID(dealId, "dealId");
    const store = getRevenueStore();
    const updated = await store.updateDeal(dealId, {
      ...extraUpdates,
      etapa: newStage,
    });
    revalidateAllRevenuePages();
    return { success: true, data: updated };
  } catch (err: any) {
    console.error("[updateDealStageAction] error:", err);
    return { success: false, error: err?.message || "Error al actualizar la etapa del deal" };
  }
}

/**
 * Actualiza la Próxima Acción de un Deal (Regla de Oro)
 */
export async function updateDealNextActionAction(
  dealId: string,
  nextAction: string,
  nextActionAt: string
): Promise<ActionResult<HqDeal>> {
  try {
    validarUUID(dealId, "dealId");
    const store = getRevenueStore();
    const updated = await store.updateDeal(dealId, {
      next_action: nextAction,
      next_action_at: nextActionAt,
    });
    revalidateAllRevenuePages();
    return { success: true, data: updated };
  } catch (err: any) {
    console.error("[updateDealNextActionAction] error:", err);
    return { success: false, error: err?.message || "Error al actualizar próxima acción" };
  }
}

/**
 * Cierra un Deal como Perdido exigiendo motivo estructurado
 * y cancela pilotos activos para evitar incoherencias
 */
export async function closeDealLostAction(
  dealId: string,
  lostReason: LostReason,
  lostNotes?: string
): Promise<ActionResult<HqDeal>> {
  try {
    validarUUID(dealId, "dealId");
    const store = getRevenueStore();

    // Detección y resolución de incoherencia de etapa: Deal perdido con piloto activo
    const pilots = await store.getPilots(dealId);
    const activePilots = pilots.filter((p) =>
      ["activo", "configuracion", "revision_pendiente", "programado"].includes(p.status)
    );
    for (const pilot of activePilots) {
      await store.updatePilot(pilot.id, {
        status: "cancelado",
        resultado_notas: `Piloto cancelado automáticamente: Deal cerrado como perdido (${lostReason})`,
      });
    }

    const updated = await store.updateDeal(dealId, {
      etapa: "perdido",
      lost_reason: lostReason,
      lost_notes: lostNotes || null,
      stalled: false,
      stalled_reason: null,
    });

    revalidateAllRevenuePages();
    return { success: true, data: updated };
  } catch (err: any) {
    console.error("[closeDealLostAction] error:", err);
    return { success: false, error: err?.message || "Error al marcar deal como perdido" };
  }
}

/**
 * Cierra un Deal como Ganado
 */
export async function closeDealWonAction(
  dealId: string,
  wonNotes?: string
): Promise<ActionResult<HqDeal>> {
  try {
    validarUUID(dealId, "dealId");
    const store = getRevenueStore();
    const updated = await store.updateDeal(dealId, {
      etapa: "ganado",
      lost_reason: null,
      lost_notes: null,
      won_notes: wonNotes || null,
      stalled: false,
      stalled_reason: null,
    });

    revalidateAllRevenuePages();
    return { success: true, data: updated };
  } catch (err: any) {
    console.error("[closeDealWonAction] error:", err);
    return { success: false, error: err?.message || "Error al marcar deal como ganado" };
  }
}

/**
 * Crea una reunión persistente y sincroniza coherentemente la etapa del Deal de forma atómica
 */
export async function createMeetingAction(
  rawInput: unknown
): Promise<ActionResult<HqMeeting>> {
  try {
    if (!rawInput || typeof rawInput !== "object") {
      throw new Error("VALIDATION_ERROR: Datos de reunión inválidos");
    }
    const input = rawInput as Record<string, any>;
    const store = getRevenueStore();
    const deal = await store.getDealById(input.deal_id);
    if (!deal) {
      throw new Error(`FOREIGN_KEY_ERROR: El Deal ${input.deal_id} no existe.`);
    }

    let dealTransition: Partial<HqDeal> | undefined;
    if (input.status === "agendada" || !input.status) {
      dealTransition = {
        etapa: "reunion_agendada",
        next_action: `Reunión: ${input.meeting_type || "discovery"}`,
        next_action_at: input.scheduled_at,
      };
    }

    const { meeting } = await store.createMeetingWithDealTransition(rawInput as any, dealTransition);

    revalidateAllRevenuePages();
    return { success: true, data: meeting };
  } catch (err: any) {
    console.error("[createMeetingAction] error:", err);
    return { success: false, error: err?.message || "Error al crear la reunión" };
  }
}

/**
 * Actualiza una reunión existente
 */
export async function updateMeetingAction(
  meetingId: string,
  updates: Partial<HqMeeting>
): Promise<ActionResult<HqMeeting>> {
  try {
    validarUUID(meetingId, "meetingId");
    const store = getRevenueStore();
    const updated = await store.updateMeeting(meetingId, updates);
    revalidateAllRevenuePages();
    return { success: true, data: updated };
  } catch (err: any) {
    console.error("[updateMeetingAction] error:", err);
    return { success: false, error: err?.message || "Error al actualizar la reunión" };
  }
}

/**
 * Crea un piloto persistente de 14 días y sincroniza la etapa del Deal a 'piloto_activo' de forma atómica
 */
export async function createPilotAction(
  rawInput: unknown
): Promise<ActionResult<HqPilot>> {
  try {
    if (!rawInput || typeof rawInput !== "object") {
      throw new Error("VALIDATION_ERROR: Datos de piloto inválidos");
    }
    const input = rawInput as Record<string, any>;
    const store = getRevenueStore();
    const deal = await store.getDealById(input.deal_id);
    if (!deal) {
      throw new Error(`FOREIGN_KEY_ERROR: El Deal ${input.deal_id} no existe.`);
    }

    let dealTransition: Partial<HqDeal> | undefined;
    if (input.status === "activo") {
      const startDate = input.start_date ? new Date(input.start_date) : new Date();
      const day7 = new Date(startDate.getTime() + 7 * 86400000).toISOString();
      dealTransition = {
        etapa: "piloto_activo",
        next_action: "Seguimiento checkpoint Día 7 de piloto",
        next_action_at: input.review_date || day7,
      };
    }

    const { pilot } = await store.createPilotWithDealTransition(rawInput as any, dealTransition);

    revalidateAllRevenuePages();
    return { success: true, data: pilot };
  } catch (err: any) {
    console.error("[createPilotAction] error:", err);
    return { success: false, error: err?.message || "Error al crear el piloto" };
  }
}

/**
 * Actualiza un piloto existente
 */
export async function updatePilotAction(
  pilotId: string,
  updates: Partial<HqPilot>
): Promise<ActionResult<HqPilot>> {
  try {
    validarUUID(pilotId, "pilotId");
    const store = getRevenueStore();
    const updated = await store.updatePilot(pilotId, updates);
    revalidateAllRevenuePages();
    return { success: true, data: updated };
  } catch (err: any) {
    console.error("[updatePilotAction] error:", err);
    return { success: false, error: err?.message || "Error al actualizar el piloto" };
  }
}

/**
 * Crea una propuesta comercial persistente y sincroniza la etapa del Deal a 'propuesta_enviada' de forma atómica
 */
export async function createProposalAction(
  rawInput: unknown
): Promise<ActionResult<HqProposal>> {
  try {
    if (!rawInput || typeof rawInput !== "object") {
      throw new Error("VALIDATION_ERROR: Datos de propuesta inválidos");
    }
    const input = rawInput as Record<string, any>;
    const store = getRevenueStore();
    const deal = await store.getDealById(input.deal_id);
    if (!deal) {
      throw new Error(`FOREIGN_KEY_ERROR: El Deal ${input.deal_id} no existe.`);
    }

    let dealTransition: Partial<HqDeal> | undefined;
    if (input.status === "enviada") {
      dealTransition = {
        etapa: "propuesta_enviada",
        next_action: "Revisar propuesta comercial enviada",
        next_action_at: input.review_date || input.decision_date || new Date(Date.now() + 3 * 86400000).toISOString(),
        plan: input.plan,
        valor_mensual_neto: input.valor_mensual_neto,
        valor_setup_neto: input.valor_setup_neto,
      };
    }

    const { proposal } = await store.createProposalWithDealTransition(rawInput as any, dealTransition);

    revalidateAllRevenuePages();
    return { success: true, data: proposal };
  } catch (err: any) {
    console.error("[createProposalAction] error:", err);
    return { success: false, error: err?.message || "Error al crear la propuesta" };
  }
}

/**
 * Actualiza una propuesta comercial
 */
export async function updateProposalAction(
  proposalId: string,
  updates: Partial<HqProposal>
): Promise<ActionResult<HqProposal>> {
  try {
    validarUUID(proposalId, "proposalId");
    const store = getRevenueStore();
    const updated = await store.updateProposal(proposalId, updates);
    revalidateAllRevenuePages();
    return { success: true, data: updated };
  } catch (err: any) {
    console.error("[updateProposalAction] error:", err);
    return { success: false, error: err?.message || "Error al actualizar la propuesta" };
  }
}
