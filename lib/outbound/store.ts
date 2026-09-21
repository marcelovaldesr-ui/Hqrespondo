/**
 * STORE / PERSISTENCE LAYER — Outbound V1
 *
 * Interfaz unificada de acceso a datos con dos implementaciones:
 * 1. SupabaseOutboundStore: Producción contra PostgreSQL en Supabase.
 * 2. MemoryOutboundStore: Pruebas unitarias/adversariales 100% aisladas, rápidas y reproducibles.
 */

import crypto from "node:crypto";
import {
  type Company,
  type Contact,
  type LeadSource,
  type CompanyResearch,
  type Campaign,
  type OutboxItem,
  type OutboundDomain,
  type OutboundSender,
  type Suppression,
  type ReplyEvent,
  type OutboundEvent,
  type EstadoOutbox,
  type MailboxWatchStatus,
} from "./types";
import { obtenerInicioDelDiaSantiago } from "./scheduler";

/** Genera un hash SHA-256 para el contenido del copy aprobado en Review Mode */
export function calcularHashCopy(subject: string, bodyText: string): string {
  return crypto.createHash("sha256").update(subject.trim() + "|||" + bodyText.trim()).digest("hex");
}

export interface OutboundStore {
  // Dominios & Senders
  getDomain(domain: string): Promise<OutboundDomain | null>;
  updateDomain(domain: string, updates: Partial<OutboundDomain>): Promise<void>;
  getSenders(domainId?: string): Promise<OutboundSender[]>;
  getSenderById(id: string): Promise<OutboundSender | null>;
  updateSender(id: string, updates: Partial<OutboundSender>): Promise<void>;
  incrementSenderCounts(id: string, newLeadsDelta: number, totalDelta: number): Promise<void>;
  incrementDomainSent(domain: string, delta: number): Promise<void>;

  // Sources
  createLeadSource(source: Omit<LeadSource, "id" | "created_at">): Promise<LeadSource>;
  getLeadSources(): Promise<LeadSource[]>;

  // Companies & Contacts
  createCompany(company: Omit<Company, "id" | "created_at" | "updated_at">): Promise<Company>;
  findCompanyByMatchingKey(matchingKey: string): Promise<Company | null>;
  findCompanyByDomain(domain: string): Promise<Company | null>;
  getCompanyById(id: string): Promise<Company | null>;
  updateCompany(id: string, updates: Partial<Company>): Promise<void>;
  listCompanies(limit?: number): Promise<Company[]>;

  createContact(contact: Omit<Contact, "id" | "created_at" | "updated_at">): Promise<Contact>;
  findContactByEmail(emailNormalized: string): Promise<Contact | null>;
  findContactsByCompanyId(companyId: string): Promise<Contact[]>;
  getContactById(id: string): Promise<Contact | null>;
  updateContact(id: string, updates: Partial<Contact>): Promise<void>;
  listContacts(limit?: number): Promise<Contact[]>;

  // Research
  upsertResearch(research: Omit<CompanyResearch, "id" | "created_at" | "updated_at">): Promise<CompanyResearch>;
  getResearchByCompanyId(companyId: string): Promise<CompanyResearch | null>;

  // Campaigns
  createCampaign(campaign: Omit<Campaign, "id" | "created_at" | "updated_at">): Promise<Campaign>;
  getCampaignById(id: string): Promise<Campaign | null>;
  getCampaignBySlug(slug: string): Promise<Campaign | null>;
  listCampaigns(): Promise<Campaign[]>;
  updateCampaign(id: string, updates: Partial<Campaign>): Promise<void>;

  // Outbox & Concurrency
  createOutboxItem(item: Omit<OutboxItem, "id" | "created_at" | "updated_at" | "attempt_count">): Promise<OutboxItem>;
  getOutboxItemById(id: string): Promise<OutboxItem | null>;
  getOutboxItemByIdempotencyKey(key: string): Promise<OutboxItem | null>;
  findScheduledOutboxItems(nowIso: string, limit?: number): Promise<OutboxItem[]>;
  acquireOutboxLock(id: string, workerId: string, lockDurationMs: number): Promise<boolean>;
  releaseOutboxLock(id: string, newState: EstadoOutbox, errorMsg?: string | null): Promise<void>;
  updateOutboxItem(id: string, updates: Partial<OutboxItem>): Promise<void>;
  approveOutboxItem(id: string, approvedBy: string): Promise<OutboxItem | null>;
  cancelPendingOutboxForContact(contactId: string, reason: string): Promise<number>;
  listOutbox(filter?: { estado?: EstadoOutbox; limit?: number }): Promise<OutboxItem[]>;

  // Ledger Transaccional de Límites Diarios
  getDailySentCounts(senderId: string, now?: Date): Promise<{ sentToday: number; newLeadsToday: number }>;
  getDomainDailySentCount(domainId: string, now?: Date): Promise<number>;

  // Push Watch Notifications (Google Cloud Pub/Sub)
  getMailboxWatch(mailboxEmail: string): Promise<MailboxWatchStatus | null>;
  listMailboxWatches(): Promise<MailboxWatchStatus[]>;
  upsertMailboxWatch(status: MailboxWatchStatus): Promise<void>;

  // Supresiones
  isSuppressed(email: string, domain?: string): Promise<{ suppressed: boolean; reason?: string }>;
  addSuppression(suppression: Omit<Suppression, "id" | "created_at">): Promise<void>;
  listSuppressions(): Promise<Suppression[]>;

  // Replies
  createReply(reply: Omit<ReplyEvent, "id" | "created_at">): Promise<ReplyEvent>;
  getReplyByGmailMessageId(gmailMessageId: string): Promise<ReplyEvent | null>;
  listReplies(limit?: number): Promise<ReplyEvent[]>;

  // Eventos & Métricas
  logEvent(event: Omit<OutboundEvent, "id" | "created_at">): Promise<void>;
  listEvents(filter?: { tipo?: string; contact_id?: string; limit?: number }): Promise<OutboundEvent[]>;
}

// ============================================================================
// IN-MEMORY IMPLEMENTATION (Deterministic, zero-flakiness for testing)
// ============================================================================

export class MemoryOutboundStore implements OutboundStore {
  domains: Map<string, OutboundDomain> = new Map();
  senders: Map<string, OutboundSender> = new Map();
  sources: Map<string, LeadSource> = new Map();
  companies: Map<string, Company> = new Map();
  contacts: Map<string, Contact> = new Map();
  research: Map<string, CompanyResearch> = new Map();
  campaigns: Map<string, Campaign> = new Map();
  outbox: Map<string, OutboxItem> = new Map();
  suppressions: Map<string, Suppression> = new Map(); // key = valor normalizado
  replies: Map<string, ReplyEvent> = new Map();
  events: OutboundEvent[] = [];
  mailboxWatches: Map<string, MailboxWatchStatus> = new Map();

  constructor() {
    this.initDefaults();
  }

  private initDefaults() {
    const domainId = "00000000-0000-0000-0000-000000000001";
    const now = new Date().toISOString();

    this.domains.set("respon.do", {
      id: domainId,
      domain: "respon.do",
      active: true,
      domain_daily_limit: 30,
      sent_today: 0,
      health_status: "healthy",
      paused: false,
      paused_reason: null,
      spf_status: "unknown",
      dkim_status: "unknown",
      dmarc_status: "unknown",
      mx_status: "unknown",
      last_dns_check: null,
      created_at: now,
      updated_at: now,
    });

    // Sender A - Marcelo
    this.senders.set("11111111-1111-1111-1111-111111111111", {
      id: "11111111-1111-1111-1111-111111111111",
      name: "Marcelo Valdés",
      email: "marcelo@respon.do",
      domain_id: domainId,
      type: "founder",
      active: true,
      cold_outreach_enabled: false, // WARM only
      new_leads_daily_limit: 5,
      total_messages_daily_limit: 15,
      sent_today: 0,
      new_leads_today: 0,
      warmup_stage: 5,
      warmup_started_at: now,
      health_status: "healthy",
      bounce_rate: 0,
      hard_bounce_rate: 0,
      opt_out_rate: 0,
      reply_rate: 0,
      last_send_at: null,
      last_error: null,
      paused_reason: null,
      created_at: now,
      updated_at: now,
    });

    // Sender B - Outbound 1
    this.senders.set("22222222-2222-2222-2222-222222222222", {
      id: "22222222-2222-2222-2222-222222222222",
      name: "Equipo Respondo",
      email: "contacto@respon.do",
      domain_id: domainId,
      type: "outbound",
      active: true,
      cold_outreach_enabled: true,
      new_leads_daily_limit: 5,
      total_messages_daily_limit: 15,
      sent_today: 0,
      new_leads_today: 0,
      warmup_stage: 1,
      warmup_started_at: now,
      health_status: "healthy",
      bounce_rate: 0,
      hard_bounce_rate: 0,
      opt_out_rate: 0,
      reply_rate: 0,
      last_send_at: null,
      last_error: null,
      paused_reason: null,
      created_at: now,
      updated_at: now,
    });

    // Sender C - Outbound 2
    this.senders.set("33333333-3333-3333-3333-333333333333", {
      id: "33333333-3333-3333-3333-333333333333",
      name: "Ventas Respondo",
      email: "crecimiento@respon.do",
      domain_id: domainId,
      type: "outbound",
      active: true,
      cold_outreach_enabled: true,
      new_leads_daily_limit: 5,
      total_messages_daily_limit: 15,
      sent_today: 0,
      new_leads_today: 0,
      warmup_stage: 1,
      warmup_started_at: now,
      health_status: "healthy",
      bounce_rate: 0,
      hard_bounce_rate: 0,
      opt_out_rate: 0,
      reply_rate: 0,
      last_send_at: null,
      last_error: null,
      paused_reason: null,
      created_at: now,
      updated_at: now,
    });
  }

  // Dominios & Senders
  async getDomain(domain: string): Promise<OutboundDomain | null> {
    return this.domains.get(domain) ?? null;
  }

  async updateDomain(domain: string, updates: Partial<OutboundDomain>): Promise<void> {
    const d = this.domains.get(domain);
    if (!d) return;
    this.domains.set(domain, { ...d, ...updates, updated_at: new Date().toISOString() });
  }

  async getSenders(domainId?: string): Promise<OutboundSender[]> {
    const all = Array.from(this.senders.values());
    return domainId ? all.filter((s) => s.domain_id === domainId) : all;
  }

  async getSenderById(id: string): Promise<OutboundSender | null> {
    return this.senders.get(id) ?? null;
  }

  async updateSender(id: string, updates: Partial<OutboundSender>): Promise<void> {
    const s = this.senders.get(id);
    if (!s) return;
    this.senders.set(id, { ...s, ...updates, updated_at: new Date().toISOString() });
  }

  async incrementSenderCounts(id: string, newLeadsDelta: number, totalDelta: number): Promise<void> {
    const s = this.senders.get(id);
    if (!s) return;
    s.new_leads_today += newLeadsDelta;
    s.sent_today += totalDelta;
    s.last_send_at = new Date().toISOString();
    s.updated_at = new Date().toISOString();
  }

  async incrementDomainSent(domain: string, delta: number): Promise<void> {
    const d = this.domains.get(domain);
    if (!d) return;
    d.sent_today += delta;
    d.updated_at = new Date().toISOString();
  }

  // Sources
  async createLeadSource(source: Omit<LeadSource, "id" | "created_at">): Promise<LeadSource> {
    const id = "src_" + Math.random().toString(36).substring(2, 10);
    const created_at = new Date().toISOString();
    const item: LeadSource = { id, ...source, created_at };
    this.sources.set(id, item);
    return item;
  }

  async getLeadSources(): Promise<LeadSource[]> {
    return Array.from(this.sources.values());
  }

  // Companies & Contacts
  async createCompany(company: Omit<Company, "id" | "created_at" | "updated_at">): Promise<Company> {
    const id = "comp_" + Math.random().toString(36).substring(2, 10);
    const now = new Date().toISOString();
    const item: Company = { id, ...company, created_at: now, updated_at: now };
    this.companies.set(id, item);
    return item;
  }

  async findCompanyByMatchingKey(matchingKey: string): Promise<Company | null> {
    for (const c of this.companies.values()) {
      if (c.matching_key === matchingKey) return c;
    }
    return null;
  }

  async findCompanyByDomain(domain: string): Promise<Company | null> {
    if (!domain) return null;
    const dNorm = domain.toLowerCase().trim();
    for (const c of this.companies.values()) {
      if (c.dominio_web?.toLowerCase().trim() === dNorm) return c;
    }
    return null;
  }

  async getCompanyById(id: string): Promise<Company | null> {
    return this.companies.get(id) ?? null;
  }

  async updateCompany(id: string, updates: Partial<Company>): Promise<void> {
    const c = this.companies.get(id);
    if (!c) return;
    this.companies.set(id, { ...c, ...updates, updated_at: new Date().toISOString() });
  }

  async listCompanies(limit = 100): Promise<Company[]> {
    return Array.from(this.companies.values()).slice(0, limit);
  }

  async createContact(contact: Omit<Contact, "id" | "created_at" | "updated_at">): Promise<Contact> {
    const existing = await this.findContactByEmail(contact.email_normalizado);
    if (existing) {
      throw new Error(`Duplicate contact email: ${contact.email_normalizado}`);
    }
    const id = "cnt_" + Math.random().toString(36).substring(2, 10);
    const now = new Date().toISOString();
    const item: Contact = { id, ...contact, created_at: now, updated_at: now };
    this.contacts.set(id, item);
    return item;
  }

  async findContactByEmail(emailNormalized: string): Promise<Contact | null> {
    const norm = emailNormalized.toLowerCase().trim();
    for (const c of this.contacts.values()) {
      if (c.email_normalizado === norm) return c;
    }
    return null;
  }

  async findContactsByCompanyId(companyId: string): Promise<Contact[]> {
    return Array.from(this.contacts.values()).filter((c) => c.company_id === companyId);
  }

  async getContactById(id: string): Promise<Contact | null> {
    return this.contacts.get(id) ?? null;
  }

  async updateContact(id: string, updates: Partial<Contact>): Promise<void> {
    const c = this.contacts.get(id);
    if (!c) return;
    this.contacts.set(id, { ...c, ...updates, updated_at: new Date().toISOString() });
  }

  async listContacts(limit = 100): Promise<Contact[]> {
    return Array.from(this.contacts.values()).slice(0, limit);
  }

  // Research
  async upsertResearch(
    research: Omit<CompanyResearch, "id" | "created_at" | "updated_at">,
  ): Promise<CompanyResearch> {
    const now = new Date().toISOString();
    for (const [id, r] of this.research.entries()) {
      if (r.company_id === research.company_id) {
        const updated: CompanyResearch = { ...r, ...research, updated_at: now };
        this.research.set(id, updated);
        return updated;
      }
    }
    const id = "res_" + Math.random().toString(36).substring(2, 10);
    const created: CompanyResearch = { id, ...research, created_at: now, updated_at: now };
    this.research.set(id, created);
    return created;
  }

  async getResearchByCompanyId(companyId: string): Promise<CompanyResearch | null> {
    for (const r of this.research.values()) {
      if (r.company_id === companyId) return r;
    }
    return null;
  }

  // Campaigns
  async createCampaign(campaign: Omit<Campaign, "id" | "created_at" | "updated_at">): Promise<Campaign> {
    const id = "camp_" + Math.random().toString(36).substring(2, 10);
    const now = new Date().toISOString();
    const item: Campaign = { id, ...campaign, created_at: now, updated_at: now };
    this.campaigns.set(id, item);
    return item;
  }

  async getCampaignById(id: string): Promise<Campaign | null> {
    return this.campaigns.get(id) ?? null;
  }

  async getCampaignBySlug(slug: string): Promise<Campaign | null> {
    for (const c of this.campaigns.values()) {
      if (c.slug === slug) return c;
    }
    return null;
  }

  async listCampaigns(): Promise<Campaign[]> {
    return Array.from(this.campaigns.values());
  }

  async updateCampaign(id: string, updates: Partial<Campaign>): Promise<void> {
    const c = this.campaigns.get(id);
    if (!c) return;
    this.campaigns.set(id, { ...c, ...updates, updated_at: new Date().toISOString() });
  }

  // Outbox
  async createOutboxItem(
    item: Omit<OutboxItem, "id" | "created_at" | "updated_at" | "attempt_count">,
  ): Promise<OutboxItem> {
    for (const existing of this.outbox.values()) {
      if (existing.idempotency_key === item.idempotency_key) {
        throw new Error(`Duplicate idempotency_key: ${item.idempotency_key}`);
      }
    }
    const id = "out_" + Math.random().toString(36).substring(2, 10);
    const now = new Date().toISOString();
    const outboxItem: OutboxItem = {
      id,
      ...item,
      attempt_count: 0,
      locked_at: null,
      locked_by: null,
      lock_expires_at: null,
      gmail_message_id: item.gmail_message_id ?? null,
      gmail_thread_id: item.gmail_thread_id ?? null,
      error_message: item.error_message ?? null,
      enviado_at: item.enviado_at ?? null,
      created_at: now,
      updated_at: now,
    };
    this.outbox.set(outboxItem.id, outboxItem);
    return outboxItem;
  }

  async getOutboxItemById(id: string): Promise<OutboxItem | null> {
    return this.outbox.get(id) ?? null;
  }

  async getOutboxItemByIdempotencyKey(key: string): Promise<OutboxItem | null> {
    for (const item of this.outbox.values()) {
      if (item.idempotency_key === key) return item;
    }
    return null;
  }

  async findScheduledOutboxItems(nowIso: string, limit = 50): Promise<OutboxItem[]> {
    const items: OutboxItem[] = [];
    const nowTime = new Date(nowIso).getTime();

    for (const item of this.outbox.values()) {
      if (item.estado !== "approved" && item.estado !== "scheduled") continue;
      if (new Date(item.scheduled_for).getTime() <= nowTime) {
        items.push(item);
      }
    }
    return items.sort((a, b) => new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime()).slice(0, limit);
  }

  /** Lock de concurrencia atómico */
  async acquireOutboxLock(id: string, workerId: string, lockDurationMs: number): Promise<boolean> {
    const item = this.outbox.get(id);
    if (!item) return false;
    const now = Date.now();

    if (item.estado === "sending") {
      // Solo se puede tomar si el lock anterior expiró
      if (item.lock_expires_at && new Date(item.lock_expires_at).getTime() > now) {
        return false;
      }
    } else if (item.estado !== "approved" && item.estado !== "scheduled") {
      return false;
    } else {
      if (item.locked_at && item.lock_expires_at && new Date(item.lock_expires_at).getTime() > now) {
        return false;
      }
    }

    item.estado = "sending";
    item.locked_at = new Date(now).toISOString();
    item.locked_by = workerId;
    item.lock_expires_at = new Date(now + lockDurationMs).toISOString();
    item.attempt_count = (item.attempt_count ?? 0) + 1;
    item.updated_at = new Date(now).toISOString();
    return true;
  }

  async releaseOutboxLock(id: string, newState: EstadoOutbox, errorMsg?: string | null): Promise<void> {
    const item = this.outbox.get(id);
    if (!item) return;
    const now = new Date().toISOString();
    item.estado = newState;
    item.locked_at = null;
    item.locked_by = null;
    item.lock_expires_at = null;
    if (errorMsg !== undefined) item.error_message = errorMsg;
    if (newState === "sent") item.enviado_at = now;
    item.updated_at = now;
  }

  async updateOutboxItem(id: string, updates: Partial<OutboxItem>): Promise<void> {
    const item = this.outbox.get(id);
    if (!item) return;

    // Review Mode Hardening: Si el copy (asunto o cuerpo) se edita tras haber sido aprobado o programado,
    // se invalida automáticamente la aprobación previa para evitar que salga contenido modificado sin revisión.
    const subjectModificado = updates.subject !== undefined && updates.subject.trim() !== item.subject.trim();
    const bodyModificado = updates.body_text !== undefined && updates.body_text.trim() !== item.body_text.trim();

    let updatesFinales: Partial<OutboxItem> = { ...updates };
    if ((subjectModificado || bodyModificado) && (item.estado === "approved" || item.estado === "scheduled")) {
      updatesFinales = {
        ...updatesFinales,
        estado: "pending_review",
        approved_by: null,
        approved_at: null,
        approved_copy_hash: null,
        error_message: "Aprobación invalidada: el copy fue modificado tras ser aprobado. Requiere nueva aprobación.",
      };
    }

    this.outbox.set(id, { ...item, ...updatesFinales, updated_at: new Date().toISOString() });
  }

  async approveOutboxItem(id: string, approvedBy: string): Promise<OutboxItem | null> {
    const item = this.outbox.get(id);
    if (!item) return null;
    const now = new Date().toISOString();
    const hash = calcularHashCopy(item.subject, item.body_text);

    item.estado = "approved";
    item.approved_by = approvedBy;
    item.approved_at = now;
    item.approved_copy_hash = hash;
    item.error_message = null;
    item.updated_at = now;
    return item;
  }

  async getDailySentCounts(senderId: string, now = new Date()): Promise<{ sentToday: number; newLeadsToday: number }> {
    const inicioDia = obtenerInicioDelDiaSantiago(now).toISOString();
    let sentToday = 0;
    let newLeadsToday = 0;

    for (const item of this.outbox.values()) {
      if (item.sender_id !== senderId) continue;
      // Contamos sent y sending (reserva atómica contra workers concurrentes)
      if (item.estado === "sent" || item.estado === "sending") {
        const fechaReferencia = item.enviado_at || item.locked_at || item.scheduled_for;
        if (fechaReferencia >= inicioDia) {
          sentToday++;
          if (item.step_number === 1) {
            newLeadsToday++;
          }
        }
      }
    }

    return { sentToday, newLeadsToday };
  }

  async getDomainDailySentCount(domainId: string, now = new Date()): Promise<number> {
    const inicioDia = obtenerInicioDelDiaSantiago(now).toISOString();
    const senders = await this.getSenders(domainId);
    const senderIds = new Set(senders.map((s) => s.id));
    let totalSent = 0;

    for (const item of this.outbox.values()) {
      if (!item.sender_id || !senderIds.has(item.sender_id)) continue;
      if (item.estado === "sent" || item.estado === "sending") {
        const fechaReferencia = item.enviado_at || item.locked_at || item.scheduled_for;
        if (fechaReferencia >= inicioDia) {
          totalSent++;
        }
      }
    }

    return totalSent;
  }

  async getMailboxWatch(mailboxEmail: string): Promise<MailboxWatchStatus | null> {
    return this.mailboxWatches.get(mailboxEmail.toLowerCase().trim()) ?? null;
  }

  async listMailboxWatches(): Promise<MailboxWatchStatus[]> {
    return Array.from(this.mailboxWatches.values());
  }

  async upsertMailboxWatch(status: MailboxWatchStatus): Promise<void> {
    this.mailboxWatches.set(status.mailbox_email.toLowerCase().trim(), {
      ...status,
      updated_at: new Date().toISOString(),
    });
  }

  async cancelPendingOutboxForContact(contactId: string, reason: string): Promise<number> {
    let count = 0;
    const now = new Date().toISOString();
    for (const item of this.outbox.values()) {
      if (item.contact_id === contactId && (item.estado === "pending_review" || item.estado === "approved" || item.estado === "scheduled")) {
        item.estado = "cancelled";
        item.error_message = reason;
        item.updated_at = now;
        count++;
      }
    }
    return count;
  }

  async listOutbox(filter?: { estado?: EstadoOutbox; limit?: number }): Promise<OutboxItem[]> {
    let all = Array.from(this.outbox.values());
    if (filter?.estado) {
      all = all.filter((i) => i.estado === filter.estado);
    }
    return all.slice(0, filter?.limit ?? 100);
  }

  // Supresiones
  async isSuppressed(email: string, domain?: string): Promise<{ suppressed: boolean; reason?: string }> {
    const normEmail = email.toLowerCase().trim();
    const supEmail = this.suppressions.get(normEmail);
    if (supEmail) {
      return { suppressed: true, reason: `Email suprimido (${supEmail.motivo})` };
    }

    if (domain) {
      const normDom = domain.toLowerCase().trim();
      const supDom = this.suppressions.get(normDom);
      if (supDom) {
        return { suppressed: true, reason: `Dominio completo suprimido (${supDom.motivo})` };
      }
    }

    const emailDomain = normEmail.split("@")[1];
    if (emailDomain) {
      const supEmailDom = this.suppressions.get(emailDomain);
      if (supEmailDom) {
        return { suppressed: true, reason: `Dominio del correo suprimido (${supEmailDom.motivo})` };
      }
    }

    return { suppressed: false };
  }

  async addSuppression(suppression: Omit<Suppression, "id" | "created_at">): Promise<void> {
    const norm = suppression.valor.toLowerCase().trim();
    const id = "sup_" + Math.random().toString(36).substring(2, 10);
    const item: Suppression = {
      id,
      ...suppression,
      valor: norm,
      created_at: new Date().toISOString(),
    };
    this.suppressions.set(norm, item);
  }

  async listSuppressions(): Promise<Suppression[]> {
    return Array.from(this.suppressions.values());
  }

  // Replies
  async createReply(reply: Omit<ReplyEvent, "id" | "created_at">): Promise<ReplyEvent> {
    const id = "rep_" + Math.random().toString(36).substring(2, 10);
    const item: ReplyEvent = { id, ...reply, created_at: new Date().toISOString() };
    this.replies.set(id, item);
    return item;
  }

  async getReplyByGmailMessageId(gmailMessageId: string): Promise<ReplyEvent | null> {
    return Array.from(this.replies.values()).find((reply) => reply.gmail_message_id === gmailMessageId) ?? null;
  }

  async listReplies(limit = 100): Promise<ReplyEvent[]> {
    return Array.from(this.replies.values()).slice(0, limit);
  }

  // Eventos
  async logEvent(event: Omit<OutboundEvent, "id" | "created_at">): Promise<void> {
    const id = "evt_" + Math.random().toString(36).substring(2, 10);
    this.events.unshift({ id, ...event, created_at: new Date().toISOString() });
  }

  async listEvents(filter?: { tipo?: string; contact_id?: string; limit?: number }): Promise<OutboundEvent[]> {
    let result = this.events;
    if (filter?.tipo) result = result.filter((e) => e.tipo === filter.tipo);
    if (filter?.contact_id) result = result.filter((e) => e.contact_id === filter.contact_id);
    return result.slice(0, filter?.limit ?? 100);
  }
}
