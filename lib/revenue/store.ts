/**
 * RESPONDO HQ — REVENUE OPERATING SYSTEM V1
 * Capa de Persistencia y Acceso a Datos Remediada
 *
 * Reglas de Arquitectura:
 * 1. Paridad Absoluta de Contrato: MemoryRevenueStore y SupabaseRevenueStore aplican exactamente
 *    las mismas validaciones runtime, guardrails, scoring determinista e invariantes de dominio.
 * 2. Cero IDs Ficticios: Se generan exclusivamente UUIDs RFC 4122 v4 (crypto.randomUUID).
 * 3. Prohibición de Fallback Silencioso: MemoryStore solo se permite en tests o con HQ_DEMO_MODE="true" explícito fuera de prod.
 * 4. Prohibición de Datos Inventados: Se erradica el fallback legacy que inventaba precios, ciudades y acciones.
 * 5. Errores Operacionales Visibles: Si falta configuración o la base de datos falla, se emite un error estructurado.
 */

import { db } from "@/lib/db";
import {
  HqDeal,
  HqMeeting,
  HqPilot,
  HqProposal,
  HqExperiment,
  HqFeedback,
  HqActivity,
  RevenueStage,
} from "./types";
import { evaluarTratoEstancado } from "./guardrails";
import { calcularScoringDeal } from "./scoring";
import {
  validarCreateDealInput,
  validarUpdateDealInput,
  validarCreateMeetingInput,
  validarUpdateMeetingInput,
  validarCreatePilotInput,
  validarUpdatePilotInput,
  validarCreateProposalInput,
  validarUpdateProposalInput,
  validarUUID,
} from "./validation";

export class RevenueConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RevenueConfigError";
  }
}

export class RevenueDatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RevenueDatabaseError";
  }
}

export interface IRevenueStore {
  // Deals
  getDeals(filters?: { etapa?: RevenueStage; stalledOnly?: boolean }): Promise<HqDeal[]>;
  getDealById(id: string): Promise<HqDeal | null>;
  createDeal(deal: Omit<HqDeal, "id" | "created_at" | "updated_at">): Promise<HqDeal>;
  updateDeal(id: string, updates: Partial<HqDeal>): Promise<HqDeal>;
  deleteDeal(id: string): Promise<boolean>;

  // Meetings
  getMeetings(dealId?: string): Promise<HqMeeting[]>;
  createMeeting(meeting: Omit<HqMeeting, "id" | "created_at" | "updated_at">): Promise<HqMeeting>;
  createMeetingWithDealTransition(
    meeting: Omit<HqMeeting, "id" | "created_at" | "updated_at">,
    dealTransition?: Partial<HqDeal>
  ): Promise<{ meeting: HqMeeting; deal: HqDeal }>;
  updateMeeting(id: string, updates: Partial<HqMeeting>): Promise<HqMeeting>;

  // Pilots
  getPilots(dealId?: string): Promise<HqPilot[]>;
  createPilot(pilot: Omit<HqPilot, "id" | "created_at" | "updated_at">): Promise<HqPilot>;
  createPilotWithDealTransition(
    pilot: Omit<HqPilot, "id" | "created_at" | "updated_at">,
    dealTransition?: Partial<HqDeal>
  ): Promise<{ pilot: HqPilot; deal: HqDeal }>;
  updatePilot(id: string, updates: Partial<HqPilot>): Promise<HqPilot>;

  // Proposals
  getProposals(dealId?: string): Promise<HqProposal[]>;
  createProposal(proposal: Omit<HqProposal, "id" | "created_at" | "updated_at">): Promise<HqProposal>;
  createProposalWithDealTransition(
    proposal: Omit<HqProposal, "id" | "created_at" | "updated_at">,
    dealTransition?: Partial<HqDeal>
  ): Promise<{ proposal: HqProposal; deal: HqDeal }>;
  updateProposal(id: string, updates: Partial<HqProposal>): Promise<HqProposal>;

  // Experiments
  getExperiments(): Promise<HqExperiment[]>;
  createExperiment(experiment: Omit<HqExperiment, "id" | "created_at" | "updated_at">): Promise<HqExperiment>;

  // Feedback
  getFeedback(): Promise<HqFeedback[]>;
  logFeedback(feedback: Omit<HqFeedback, "id" | "created_at">): Promise<HqFeedback>;

  // Activities
  getActivities(dealId?: string): Promise<HqActivity[]>;
  logActivity(activity: Omit<HqActivity, "id" | "created_at">): Promise<HqActivity>;
}

/**
 * Implementación determinista en memoria
 * Exclusivamente autorizada para tests unitarios o desarrollo con opt-in explícito (HQ_DEMO_MODE="true")
 */
export class MemoryRevenueStore implements IRevenueStore {
  public deals: Map<string, HqDeal> = new Map();
  public meetings: Map<string, HqMeeting> = new Map();
  public pilots: Map<string, HqPilot> = new Map();
  public proposals: Map<string, HqProposal> = new Map();
  public experiments: Map<string, HqExperiment> = new Map();
  public feedback: Map<string, HqFeedback> = new Map();
  public activities: HqActivity[] = [];

  async getDeals(filters?: { etapa?: RevenueStage; stalledOnly?: boolean }): Promise<HqDeal[]> {
    let list = Array.from(this.deals.values());
    if (filters?.etapa) {
      list = list.filter((d) => d.etapa === filters.etapa);
    }
    if (filters?.stalledOnly) {
      list = list.filter((d) => d.stalled);
    }
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async getDealById(id: string): Promise<HqDeal | null> {
    validarUUID(id, "deal_id");
    return this.deals.get(id) || null;
  }

  async createDeal(dealInput: Omit<HqDeal, "id" | "created_at" | "updated_at">): Promise<HqDeal> {
    const validated = validarCreateDealInput(dealInput);

    // Calcular scoring si no viene establecido
    const scores = calcularScoringDeal(validated);
    validated.fit_score = validated.fit_score || scores.fitScore;
    validated.intent_score = validated.intent_score || scores.intentScore;
    // Derivación forzada en servidor: regla de Marcelo inviolable (fit < 40 => priority = 0)
    validated.priority_score = validated.fit_score < 40 ? 0 : Math.round(Math.sqrt(validated.fit_score * validated.intent_score));

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const created: HqDeal = {
      ...validated,
      id,
      created_at: now,
      updated_at: now,
    };

    const check = evaluarTratoEstancado(created);
    created.stalled = check.isStalled;
    created.stalled_reason = check.reason;

    this.deals.set(id, created);
    return created;
  }

  async updateDeal(id: string, updates: Partial<HqDeal>): Promise<HqDeal> {
    validarUUID(id, "deal_id");
    const current = this.deals.get(id);
    if (!current) throw new Error(`Deal ${id} no encontrado`);

    const validatedUpdates = validarUpdateDealInput(current, updates as Record<string, unknown>);

    // Recalcular scores si cambia etapa, industria o roles
    if (validatedUpdates.etapa || validatedUpdates.industry) {
      const mergedForScore = { ...current, ...validatedUpdates };
      const scores = calcularScoringDeal(mergedForScore);
      validatedUpdates.fit_score = scores.fitScore;
      validatedUpdates.intent_score = scores.intentScore;
      validatedUpdates.priority_score = scores.priorityScore;
    }

    const merged: HqDeal = {
      ...current,
      ...validatedUpdates,
      updated_at: new Date().toISOString(),
    };

    const check = evaluarTratoEstancado(merged);
    merged.stalled = check.isStalled;
    merged.stalled_reason = check.reason;

    this.deals.set(id, merged);
    return merged;
  }

  async deleteDeal(id: string): Promise<boolean> {
    validarUUID(id, "deal_id");
    return this.deals.delete(id);
  }

  async getMeetings(dealId?: string): Promise<HqMeeting[]> {
    if (dealId) validarUUID(dealId, "deal_id");
    let list = Array.from(this.meetings.values());
    if (dealId) list = list.filter((m) => m.deal_id === dealId);
    return list.sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
  }

  async createMeeting(meetingInput: Omit<HqMeeting, "id" | "created_at" | "updated_at">): Promise<HqMeeting> {
    const res = await this.createMeetingWithDealTransition(meetingInput, undefined);
    return res.meeting;
  }

  async createMeetingWithDealTransition(
    meetingInput: Omit<HqMeeting, "id" | "created_at" | "updated_at">,
    dealTransition?: Partial<HqDeal>
  ): Promise<{ meeting: HqMeeting; deal: HqDeal }> {
    const validated = validarCreateMeetingInput(meetingInput);

    // Verificar que el deal exista
    const currentDeal = this.deals.get(validated.deal_id);
    if (!currentDeal) {
      throw new Error(`FOREIGN_KEY_ERROR: El Deal ${validated.deal_id} no existe.`);
    }

    let updatedDealData: HqDeal | null = null;
    if (dealTransition && Object.keys(dealTransition).length > 0) {
      const validatedUpdates = validarUpdateDealInput(currentDeal, dealTransition as Record<string, unknown>);
      const now = new Date().toISOString();
      const updatedDeal: HqDeal = {
        ...currentDeal,
        ...validatedUpdates,
        updated_at: now,
      };
      const evalStalled = evaluarTratoEstancado(updatedDeal);
      updatedDeal.stalled = evalStalled.isStalled;
      updatedDeal.stalled_reason = evalStalled.reason;
      updatedDealData = updatedDeal;
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const created: HqMeeting = { ...validated, id, created_at: now, updated_at: now };

    // Mutación conjunta atómica: solo se aplica tras validación 100% exitosa de ambas partes
    if (updatedDealData) {
      this.deals.set(updatedDealData.id, updatedDealData);
    }
    this.meetings.set(id, created);

    return { meeting: created, deal: updatedDealData || currentDeal };
  }

  async updateMeeting(id: string, updates: Partial<HqMeeting>): Promise<HqMeeting> {
    validarUUID(id, "meeting_id");
    const current = this.meetings.get(id);
    if (!current) throw new Error(`Meeting ${id} no encontrada`);
    const validatedUpdates = validarUpdateMeetingInput(current, updates);
    const merged: HqMeeting = { ...current, ...validatedUpdates, updated_at: new Date().toISOString() };
    this.meetings.set(id, merged);
    return merged;
  }

  async getPilots(dealId?: string): Promise<HqPilot[]> {
    if (dealId) validarUUID(dealId, "deal_id");
    let list = Array.from(this.pilots.values());
    if (dealId) list = list.filter((p) => p.deal_id === dealId);
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async createPilot(pilotInput: Omit<HqPilot, "id" | "created_at" | "updated_at">): Promise<HqPilot> {
    const res = await this.createPilotWithDealTransition(pilotInput, undefined);
    return res.pilot;
  }

  async createPilotWithDealTransition(
    pilotInput: Omit<HqPilot, "id" | "created_at" | "updated_at">,
    dealTransition?: Partial<HqDeal>
  ): Promise<{ pilot: HqPilot; deal: HqDeal }> {
    const validated = validarCreatePilotInput(pilotInput);

    const currentDeal = this.deals.get(validated.deal_id);
    if (!currentDeal) {
      throw new Error(`FOREIGN_KEY_ERROR: El Deal ${validated.deal_id} no existe.`);
    }

    let updatedDealData: HqDeal | null = null;
    if (dealTransition && Object.keys(dealTransition).length > 0) {
      const validatedUpdates = validarUpdateDealInput(currentDeal, dealTransition as Record<string, unknown>);
      const now = new Date().toISOString();
      const updatedDeal: HqDeal = {
        ...currentDeal,
        ...validatedUpdates,
        updated_at: now,
      };
      const evalStalled = evaluarTratoEstancado(updatedDeal);
      updatedDeal.stalled = evalStalled.isStalled;
      updatedDeal.stalled_reason = evalStalled.reason;
      updatedDealData = updatedDeal;
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const created: HqPilot = { ...validated, id, created_at: now, updated_at: now };

    if (updatedDealData) {
      this.deals.set(updatedDealData.id, updatedDealData);
    }
    this.pilots.set(id, created);

    return { pilot: created, deal: updatedDealData || currentDeal };
  }

  async updatePilot(id: string, updates: Partial<HqPilot>): Promise<HqPilot> {
    validarUUID(id, "pilot_id");
    const current = this.pilots.get(id);
    if (!current) throw new Error(`Pilot ${id} no encontrado`);
    const validatedUpdates = validarUpdatePilotInput(current, updates);
    const merged: HqPilot = { ...current, ...validatedUpdates, updated_at: new Date().toISOString() };
    this.pilots.set(id, merged);
    return merged;
  }

  async getProposals(dealId?: string): Promise<HqProposal[]> {
    if (dealId) validarUUID(dealId, "deal_id");
    let list = Array.from(this.proposals.values());
    if (dealId) list = list.filter((p) => p.deal_id === dealId);
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async createProposal(proposalInput: Omit<HqProposal, "id" | "created_at" | "updated_at">): Promise<HqProposal> {
    const res = await this.createProposalWithDealTransition(proposalInput, undefined);
    return res.proposal;
  }

  async createProposalWithDealTransition(
    proposalInput: Omit<HqProposal, "id" | "created_at" | "updated_at">,
    dealTransition?: Partial<HqDeal>
  ): Promise<{ proposal: HqProposal; deal: HqDeal }> {
    const validated = validarCreateProposalInput(proposalInput);

    const currentDeal = this.deals.get(validated.deal_id);
    if (!currentDeal) {
      throw new Error(`FOREIGN_KEY_ERROR: El Deal ${validated.deal_id} no existe.`);
    }

    let updatedDealData: HqDeal | null = null;
    if (dealTransition && Object.keys(dealTransition).length > 0) {
      const validatedUpdates = validarUpdateDealInput(currentDeal, dealTransition as Record<string, unknown>);
      const now = new Date().toISOString();
      const updatedDeal: HqDeal = {
        ...currentDeal,
        ...validatedUpdates,
        updated_at: now,
      };
      const evalStalled = evaluarTratoEstancado(updatedDeal);
      updatedDeal.stalled = evalStalled.isStalled;
      updatedDeal.stalled_reason = evalStalled.reason;
      updatedDealData = updatedDeal;
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const created: HqProposal = { ...validated, id, created_at: now, updated_at: now };

    if (updatedDealData) {
      this.deals.set(updatedDealData.id, updatedDealData);
    }
    this.proposals.set(id, created);

    return { proposal: created, deal: updatedDealData || currentDeal };
  }

  async updateProposal(id: string, updates: Partial<HqProposal>): Promise<HqProposal> {
    validarUUID(id, "proposal_id");
    const current = this.proposals.get(id);
    if (!current) throw new Error(`Proposal ${id} no encontrada`);
    const validatedUpdates = validarUpdateProposalInput(current, updates);
    const merged: HqProposal = { ...current, ...validatedUpdates, updated_at: new Date().toISOString() };
    this.proposals.set(id, merged);
    return merged;
  }

  async getExperiments(): Promise<HqExperiment[]> {
    return Array.from(this.experiments.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  async createExperiment(experiment: Omit<HqExperiment, "id" | "created_at" | "updated_at">): Promise<HqExperiment> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const created: HqExperiment = { ...experiment, id, created_at: now, updated_at: now };
    this.experiments.set(id, created);
    return created;
  }

  async getFeedback(): Promise<HqFeedback[]> {
    return Array.from(this.feedback.values()).sort((a, b) => b.frecuencia - a.frecuencia);
  }

  async logFeedback(feedback: Omit<HqFeedback, "id" | "created_at">): Promise<HqFeedback> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const created: HqFeedback = { ...feedback, id, created_at: now };
    this.feedback.set(id, created);
    return created;
  }

  async getActivities(dealId?: string): Promise<HqActivity[]> {
    if (dealId) validarUUID(dealId, "deal_id");
    let list = this.activities;
    if (dealId) list = list.filter((a) => a.deal_id === dealId);
    return [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async logActivity(activity: Omit<HqActivity, "id" | "created_at">): Promise<HqActivity> {
    if (activity.deal_id) validarUUID(activity.deal_id, "deal_id");
    const id = crypto.randomUUID();
    const created: HqActivity = { ...activity, id, created_at: new Date().toISOString() };
    this.activities.push(created);
    return created;
  }
}

/**
 * Implementación de producción conectada a PostgreSQL vía Supabase service_role
 */
export class SupabaseRevenueStore implements IRevenueStore {
  async getDeals(filters?: { etapa?: RevenueStage; stalledOnly?: boolean }): Promise<HqDeal[]> {
    let query = db().from("hq_deals").select("*");
    if (filters?.etapa) query = query.eq("etapa", filters.etapa);
    if (filters?.stalledOnly) query = query.eq("stalled", true);
    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      throw new RevenueDatabaseError(
        `Error al consultar 'hq_deals': ${error.message}. Asegúrese de haber aplicado la migración 043 en Supabase.`
      );
    }
    return (data || []) as HqDeal[];
  }

  async getDealById(id: string): Promise<HqDeal | null> {
    validarUUID(id, "deal_id");
    const { data, error } = await db().from("hq_deals").select("*").eq("id", id).maybeSingle();
    if (error) {
      throw new RevenueDatabaseError(`Error al consultar deal ${id}: ${error.message}`);
    }
    return (data as HqDeal) || null;
  }

  async createDeal(dealInput: Omit<HqDeal, "id" | "created_at" | "updated_at">): Promise<HqDeal> {
    const validated = validarCreateDealInput(dealInput);

    // Calcular scoring determinista
    const scores = calcularScoringDeal(validated);
    validated.fit_score = validated.fit_score || scores.fitScore;
    validated.intent_score = validated.intent_score || scores.intentScore;
    // Derivación forzada en servidor: regla de Marcelo inviolable (fit < 40 => priority = 0)
    validated.priority_score = validated.fit_score < 40 ? 0 : Math.round(Math.sqrt(validated.fit_score * validated.intent_score));

    // Evaluar estado de estancamiento inicial
    const check = evaluarTratoEstancado(validated as HqDeal);
    validated.stalled = check.isStalled;
    validated.stalled_reason = check.reason;

    const { data, error } = await db()
      .from("hq_deals")
      .insert(validated)
      .select("*")
      .single();

    if (error) {
      throw new RevenueDatabaseError(`Error al persistir Deal en Supabase: ${error.message}`);
    }
    return data as HqDeal;
  }

  async updateDeal(id: string, updates: Partial<HqDeal>): Promise<HqDeal> {
    validarUUID(id, "deal_id");
    const current = await this.getDealById(id);
    if (!current) {
      throw new Error(`Deal ${id} no encontrado para actualización`);
    }

    const validatedUpdates = validarUpdateDealInput(current, updates as Record<string, unknown>);

    // Recalcular scores si cambia etapa o industria
    if (validatedUpdates.etapa || validatedUpdates.industry) {
      const mergedForScore = { ...current, ...validatedUpdates };
      const scores = calcularScoringDeal(mergedForScore);
      validatedUpdates.fit_score = scores.fitScore;
      validatedUpdates.intent_score = scores.intentScore;
      validatedUpdates.priority_score = scores.priorityScore;
    }

    // Reevaluar estancamiento
    const mergedForStalled = { ...current, ...validatedUpdates } as HqDeal;
    const check = evaluarTratoEstancado(mergedForStalled);
    validatedUpdates.stalled = check.isStalled;
    validatedUpdates.stalled_reason = check.reason;

    const { data, error } = await db()
      .from("hq_deals")
      .update({ ...validatedUpdates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw new RevenueDatabaseError(`Error al actualizar Deal en Supabase: ${error.message}`);
    }
    return data as HqDeal;
  }

  async deleteDeal(id: string): Promise<boolean> {
    validarUUID(id, "deal_id");
    const { error } = await db().from("hq_deals").delete().eq("id", id);
    if (error) {
      throw new RevenueDatabaseError(`Error al eliminar Deal: ${error.message}`);
    }
    return true;
  }

  async getMeetings(dealId?: string): Promise<HqMeeting[]> {
    if (dealId) validarUUID(dealId, "deal_id");
    let query = db().from("hq_meetings").select("*");
    if (dealId) query = query.eq("deal_id", dealId);
    const { data, error } = await query.order("scheduled_at", { ascending: false });
    if (error) {
      throw new RevenueDatabaseError(`Error al consultar reuniones: ${error.message}`);
    }
    return (data || []) as HqMeeting[];
  }

  async createMeeting(meetingInput: Omit<HqMeeting, "id" | "created_at" | "updated_at">): Promise<HqMeeting> {
    const res = await this.createMeetingWithDealTransition(meetingInput, undefined);
    return res.meeting;
  }

  async createMeetingWithDealTransition(
    meetingInput: Omit<HqMeeting, "id" | "created_at" | "updated_at">,
    dealTransition?: Partial<HqDeal>
  ): Promise<{ meeting: HqMeeting; deal: HqDeal }> {
    const validated = validarCreateMeetingInput(meetingInput);
    const deal = await this.getDealById(validated.deal_id);
    if (!deal) throw new RevenueDatabaseError(`El Deal ${validated.deal_id} no existe.`);

    let validatedDealUpdates: Partial<HqDeal> | null = null;
    if (dealTransition && Object.keys(dealTransition).length > 0) {
      validatedDealUpdates = validarUpdateDealInput(deal, dealTransition as Record<string, unknown>);
    }

    const { data: rpcData, error: rpcErr } = await db().rpc("create_meeting_with_stage_transition", {
      p_meeting: validated,
      p_deal_updates: validatedDealUpdates || null,
    });

    if (rpcErr) {
      throw new RevenueDatabaseError(`Error en transacción PostgreSQL (meeting): ${rpcErr.message}`);
    }

    return {
      meeting: rpcData.meeting as HqMeeting,
      deal: rpcData.deal as HqDeal,
    };
  }

  async updateMeeting(id: string, updates: Partial<HqMeeting>): Promise<HqMeeting> {
    validarUUID(id, "meeting_id");
    const { data: current, error: getErr } = await db().from("hq_meetings").select("*").eq("id", id).single();
    if (getErr || !current) {
      throw new RevenueDatabaseError(`Meeting ${id} no encontrada: ${getErr?.message || "Registro inexistente"}`);
    }
    const validatedUpdates = validarUpdateMeetingInput(current as HqMeeting, updates);
    const { data, error } = await db()
      .from("hq_meetings")
      .update({ ...validatedUpdates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      throw new RevenueDatabaseError(`Error al actualizar Reunión: ${error.message}`);
    }
    return data as HqMeeting;
  }

  async getPilots(dealId?: string): Promise<HqPilot[]> {
    if (dealId) validarUUID(dealId, "deal_id");
    let query = db().from("hq_pilots").select("*");
    if (dealId) query = query.eq("deal_id", dealId);
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) {
      throw new RevenueDatabaseError(`Error al consultar pilotos: ${error.message}`);
    }
    return (data || []) as HqPilot[];
  }

  async createPilot(pilotInput: Omit<HqPilot, "id" | "created_at" | "updated_at">): Promise<HqPilot> {
    const res = await this.createPilotWithDealTransition(pilotInput, undefined);
    return res.pilot;
  }

  async createPilotWithDealTransition(
    pilotInput: Omit<HqPilot, "id" | "created_at" | "updated_at">,
    dealTransition?: Partial<HqDeal>
  ): Promise<{ pilot: HqPilot; deal: HqDeal }> {
    const validated = validarCreatePilotInput(pilotInput);
    const deal = await this.getDealById(validated.deal_id);
    if (!deal) throw new RevenueDatabaseError(`El Deal ${validated.deal_id} no existe.`);

    let validatedDealUpdates: Partial<HqDeal> | null = null;
    if (dealTransition && Object.keys(dealTransition).length > 0) {
      validatedDealUpdates = validarUpdateDealInput(deal, dealTransition as Record<string, unknown>);
    }

    const { data: rpcData, error: rpcErr } = await db().rpc("create_pilot_with_stage_transition", {
      p_pilot: validated,
      p_deal_updates: validatedDealUpdates || null,
    });

    if (rpcErr) {
      throw new RevenueDatabaseError(`Error en transacción PostgreSQL (pilot): ${rpcErr.message}`);
    }

    return {
      pilot: rpcData.pilot as HqPilot,
      deal: rpcData.deal as HqDeal,
    };
  }

  async updatePilot(id: string, updates: Partial<HqPilot>): Promise<HqPilot> {
    validarUUID(id, "pilot_id");
    const { data: current, error: getErr } = await db().from("hq_pilots").select("*").eq("id", id).single();
    if (getErr || !current) {
      throw new RevenueDatabaseError(`Pilot ${id} no encontrado: ${getErr?.message || "Registro inexistente"}`);
    }
    const validatedUpdates = validarUpdatePilotInput(current as HqPilot, updates);
    const { data, error } = await db()
      .from("hq_pilots")
      .update({ ...validatedUpdates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      throw new RevenueDatabaseError(`Error al actualizar Piloto: ${error.message}`);
    }
    return data as HqPilot;
  }

  async getProposals(dealId?: string): Promise<HqProposal[]> {
    if (dealId) validarUUID(dealId, "deal_id");
    let query = db().from("hq_proposals").select("*");
    if (dealId) query = query.eq("deal_id", dealId);
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) {
      throw new RevenueDatabaseError(`Error al consultar propuestas: ${error.message}`);
    }
    return (data || []) as HqProposal[];
  }

  async createProposal(proposalInput: Omit<HqProposal, "id" | "created_at" | "updated_at">): Promise<HqProposal> {
    const res = await this.createProposalWithDealTransition(proposalInput, undefined);
    return res.proposal;
  }

  async createProposalWithDealTransition(
    proposalInput: Omit<HqProposal, "id" | "created_at" | "updated_at">,
    dealTransition?: Partial<HqDeal>
  ): Promise<{ proposal: HqProposal; deal: HqDeal }> {
    const validated = validarCreateProposalInput(proposalInput);
    const deal = await this.getDealById(validated.deal_id);
    if (!deal) throw new RevenueDatabaseError(`El Deal ${validated.deal_id} no existe.`);

    let validatedDealUpdates: Partial<HqDeal> | null = null;
    if (dealTransition && Object.keys(dealTransition).length > 0) {
      validatedDealUpdates = validarUpdateDealInput(deal, dealTransition as Record<string, unknown>);
    }

    const { data: rpcData, error: rpcErr } = await db().rpc("create_proposal_with_stage_transition", {
      p_proposal: validated,
      p_deal_updates: validatedDealUpdates || null,
    });

    if (rpcErr) {
      throw new RevenueDatabaseError(`Error en transacción PostgreSQL (proposal): ${rpcErr.message}`);
    }

    return {
      proposal: rpcData.proposal as HqProposal,
      deal: rpcData.deal as HqDeal,
    };
  }

  async updateProposal(id: string, updates: Partial<HqProposal>): Promise<HqProposal> {
    validarUUID(id, "proposal_id");
    const { data: current, error: getErr } = await db().from("hq_proposals").select("*").eq("id", id).single();
    if (getErr || !current) {
      throw new RevenueDatabaseError(`Proposal ${id} no encontrada: ${getErr?.message || "Registro inexistente"}`);
    }
    const validatedUpdates = validarUpdateProposalInput(current as HqProposal, updates);
    const { data, error } = await db()
      .from("hq_proposals")
      .update({ ...validatedUpdates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      throw new RevenueDatabaseError(`Error al actualizar Propuesta: ${error.message}`);
    }
    return data as HqProposal;
  }

  async getExperiments(): Promise<HqExperiment[]> {
    const { data, error } = await db().from("hq_experiments").select("*").order("created_at", { ascending: false });
    if (error) {
      throw new RevenueDatabaseError(`Error al consultar experimentos: ${error.message}`);
    }
    return (data || []) as HqExperiment[];
  }

  async createExperiment(experiment: Omit<HqExperiment, "id" | "created_at" | "updated_at">): Promise<HqExperiment> {
    const { data, error } = await db().from("hq_experiments").insert(experiment).select("*").single();
    if (error) {
      throw new RevenueDatabaseError(`Error al crear Experimento: ${error.message}`);
    }
    return data as HqExperiment;
  }

  async getFeedback(): Promise<HqFeedback[]> {
    const { data, error } = await db().from("hq_feedback").select("*").order("frecuencia", { ascending: false });
    if (error) {
      throw new RevenueDatabaseError(`Error al consultar feedback: ${error.message}`);
    }
    return (data || []) as HqFeedback[];
  }

  async logFeedback(feedback: Omit<HqFeedback, "id" | "created_at">): Promise<HqFeedback> {
    const { data, error } = await db().from("hq_feedback").insert(feedback).select("*").single();
    if (error) {
      throw new RevenueDatabaseError(`Error al registrar Feedback: ${error.message}`);
    }
    return data as HqFeedback;
  }

  async getActivities(dealId?: string): Promise<HqActivity[]> {
    if (dealId) validarUUID(dealId, "deal_id");
    let query = db().from("hq_activities").select("*");
    if (dealId) query = query.eq("deal_id", dealId);
    const { data, error } = await query.order("created_at", { ascending: false }).limit(50);
    if (error) {
      throw new RevenueDatabaseError(`Error al consultar actividades: ${error.message}`);
    }
    return (data || []) as HqActivity[];
  }

  async logActivity(activity: Omit<HqActivity, "id" | "created_at">): Promise<HqActivity> {
    if (activity.deal_id) validarUUID(activity.deal_id, "deal_id");
    const { data, error } = await db().from("hq_activities").insert(activity).select("*").single();
    if (error) {
      throw new RevenueDatabaseError(`Error al registrar Actividad: ${error.message}`);
    }
    return data as HqActivity;
  }
}

let testSingletonStore: IRevenueStore | null = null;

export function setRevenueStoreForTesting(store: IRevenueStore | null) {
  testSingletonStore = store;
}

/** Singleton de acceso general a la capa de datos de Revenue con control Fail-Closed */
export function getRevenueStore(options?: { allowMemory?: boolean }): IRevenueStore {
  if (testSingletonStore) {
    return testSingletonStore;
  }

  const isTest =
    process.env.NODE_ENV === "test" ||
    Boolean(process.env.NODE_TEST_CONTEXT) ||
    Boolean(process.env.npm_lifecycle_event?.includes("test")) ||
    (typeof process !== "undefined" && Array.isArray(process.argv) && process.argv.some((a) => a.includes("test")));
  const isProd = process.env.NODE_ENV === "production";
  const explicitDemo = process.env.HQ_DEMO_MODE === "true";

  // 1. En tests unitarios: siempre MemoryRevenueStore
  if (isTest && !isProd) {
    return new MemoryRevenueStore();
  }

  // 2. En modo demo explícito fuera de producción: permitir MemoryRevenueStore
  if (explicitDemo && !isProd) {
    return new MemoryRevenueStore();
  }

  // 3. Si se solicita explícitamente y no es producción
  if (options?.allowMemory && !isProd) {
    return new MemoryRevenueStore();
  }

  // 4. En producción o desarrollo estándar: Exigir configuración real de Supabase
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new RevenueConfigError(
      "CONFIG_ERROR: Faltan credenciales de base de datos (SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY). " +
      "Revenue OS V1 opera en modo fail-closed y rechaza caer en demo silencioso sin datos persistentes. " +
      "Para desarrollo local desconectado use HQ_DEMO_MODE=true explícito."
    );
  }

  return new SupabaseRevenueStore();
}
