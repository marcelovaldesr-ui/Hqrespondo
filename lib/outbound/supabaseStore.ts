/**
 * SUPABASE STORE IMPLEMENTATION — Outbound V1
 *
 * Mapea las llamadas del OutboundStore a PostgreSQL / Supabase
 * usando el cliente service_role (`lib/db.ts`).
 */

import { db } from "../db";
import {
  type OutboundStore,
  calcularHashCopy,
} from "./store";
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

export class SupabaseOutboundStore implements OutboundStore {
  private client() {
    return db();
  }

  // Dominios & Senders
  async getDomain(domain: string): Promise<OutboundDomain | null> {
    const { data, error } = await this.client()
      .from("outbound_domains")
      .select("*")
      .eq("domain", domain)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return data as OutboundDomain;
  }

  async updateDomain(domain: string, updates: Partial<OutboundDomain>): Promise<void> {
    await this.client()
      .from("outbound_domains")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("domain", domain);
  }

  async getSenders(domainId?: string): Promise<OutboundSender[]> {
    let q = this.client().from("outbound_senders").select("*");
    if (domainId) q = q.eq("domain_id", domainId);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as OutboundSender[];
  }

  async getSenderById(id: string): Promise<OutboundSender | null> {
    const { data } = await this.client()
      .from("outbound_senders")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    return (data as OutboundSender) ?? null;
  }

  async updateSender(id: string, updates: Partial<OutboundSender>): Promise<void> {
    await this.client()
      .from("outbound_senders")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id);
  }

  async incrementSenderCounts(id: string, newLeadsDelta: number, totalDelta: number): Promise<void> {
    const s = await this.getSenderById(id);
    if (!s) return;
    await this.client()
      .from("outbound_senders")
      .update({
        new_leads_today: s.new_leads_today + newLeadsDelta,
        sent_today: s.sent_today + totalDelta,
        last_send_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
  }

  async incrementDomainSent(domain: string, delta: number): Promise<void> {
    const d = await this.getDomain(domain);
    if (!d) return;
    await this.client()
      .from("outbound_domains")
      .update({
        sent_today: d.sent_today + delta,
        updated_at: new Date().toISOString(),
      })
      .eq("domain", domain);
  }

  // Sources
  async createLeadSource(source: Omit<LeadSource, "id" | "created_at">): Promise<LeadSource> {
    const { data, error } = await this.client()
      .from("outbound_lead_sources")
      .insert(source)
      .select()
      .single();
    if (error) throw error;
    return data as LeadSource;
  }

  async getLeadSources(): Promise<LeadSource[]> {
    const { data } = await this.client().from("outbound_lead_sources").select("*");
    return (data ?? []) as LeadSource[];
  }

  // Companies & Contacts
  async createCompany(company: Omit<Company, "id" | "created_at" | "updated_at">): Promise<Company> {
    const { data, error } = await this.client()
      .from("outbound_companies")
      .insert(company)
      .select()
      .single();
    if (error) throw error;
    return data as Company;
  }

  async findCompanyByMatchingKey(matchingKey: string): Promise<Company | null> {
    const { data, error } = await this.client()
      .from("outbound_companies")
      .select("*")
      .eq("matching_key", matchingKey)
      .maybeSingle();
    return (data as Company) ?? null;
  }

  async findCompanyByDomain(domain: string): Promise<Company | null> {
    if (!domain) return null;
    const { data, error } = await this.client()
      .from("outbound_companies")
      .select("*")
      .eq("dominio_web", domain.toLowerCase().trim())
      .maybeSingle();
    return (data as Company) ?? null;
  }

  async getCompanyById(id: string): Promise<Company | null> {
    const { data } = await this.client()
      .from("outbound_companies")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    return (data as Company) ?? null;
  }

  async updateCompany(id: string, updates: Partial<Company>): Promise<void> {
    await this.client()
      .from("outbound_companies")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id);
  }

  async listCompanies(limit = 100): Promise<Company[]> {
    const { data, error } = await this.client()
      .from("outbound_companies")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as Company[];
  }

  async createContact(contact: Omit<Contact, "id" | "created_at" | "updated_at">): Promise<Contact> {
    const { data, error } = await this.client()
      .from("outbound_contacts")
      .insert(contact)
      .select()
      .single();
    if (error) throw error;
    return data as Contact;
  }

  async findContactByEmail(emailNormalized: string): Promise<Contact | null> {
    const { data, error } = await this.client()
      .from("outbound_contacts")
      .select("*")
      .eq("email_normalizado", emailNormalized.toLowerCase().trim())
      .maybeSingle();
    if (error) throw error;
    return (data as Contact) ?? null;
  }

  async findContactsByCompanyId(companyId: string): Promise<Contact[]> {
    const { data, error } = await this.client()
      .from("outbound_contacts")
      .select("*")
      .eq("company_id", companyId);
    if (error) throw error;
    return (data ?? []) as Contact[];
  }

  async getContactById(id: string): Promise<Contact | null> {
    const { data, error } = await this.client()
      .from("outbound_contacts")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data as Contact) ?? null;
  }

  async updateContact(id: string, updates: Partial<Contact>): Promise<void> {
    await this.client()
      .from("outbound_contacts")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id);
  }

  async listContacts(limit = 100): Promise<Contact[]> {
    const { data, error } = await this.client()
      .from("outbound_contacts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as Contact[];
  }

  // Research
  async upsertResearch(
    research: Omit<CompanyResearch, "id" | "created_at" | "updated_at">,
  ): Promise<CompanyResearch> {
    const now = new Date().toISOString();
    const { data, error } = await this.client()
      .from("outbound_research")
      .upsert({ ...research, updated_at: now }, { onConflict: "company_id" })
      .select()
      .single();
    if (error) throw error;
    return data as CompanyResearch;
  }

  async getResearchByCompanyId(companyId: string): Promise<CompanyResearch | null> {
    const { data } = await this.client()
      .from("outbound_research")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();
    return (data as CompanyResearch) ?? null;
  }

  // Campaigns
  async createCampaign(campaign: Omit<Campaign, "id" | "created_at" | "updated_at">): Promise<Campaign> {
    const { data, error } = await this.client()
      .from("outbound_campaigns")
      .insert(campaign)
      .select()
      .single();
    if (error) throw error;
    return data as Campaign;
  }

  async getCampaignById(id: string): Promise<Campaign | null> {
    const { data } = await this.client()
      .from("outbound_campaigns")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    return (data as Campaign) ?? null;
  }

  async getCampaignBySlug(slug: string): Promise<Campaign | null> {
    const { data } = await this.client()
      .from("outbound_campaigns")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    return (data as Campaign) ?? null;
  }

  async listCampaigns(): Promise<Campaign[]> {
    const { data } = await this.client().from("outbound_campaigns").select("*");
    return (data ?? []) as Campaign[];
  }

  async updateCampaign(id: string, updates: Partial<Campaign>): Promise<void> {
    await this.client()
      .from("outbound_campaigns")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id);
  }

  // Outbox
  async createOutboxItem(
    item: Omit<OutboxItem, "id" | "created_at" | "updated_at" | "attempt_count">,
  ): Promise<OutboxItem> {
    const { data, error } = await this.client()
      .from("outbound_outbox")
      .insert(item)
      .select()
      .single();
    if (error) throw error;
    return data as OutboxItem;
  }

  async getOutboxItemById(id: string): Promise<OutboxItem | null> {
    const { data } = await this.client()
      .from("outbound_outbox")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    return (data as OutboxItem) ?? null;
  }

  async getOutboxItemByIdempotencyKey(key: string): Promise<OutboxItem | null> {
    const { data } = await this.client()
      .from("outbound_outbox")
      .select("*")
      .eq("idempotency_key", key)
      .maybeSingle();
    return (data as OutboxItem) ?? null;
  }

  async findScheduledOutboxItems(nowIso: string, limit = 50): Promise<OutboxItem[]> {
    const { data } = await this.client()
      .from("outbound_outbox")
      .select("*")
      .in("estado", ["approved", "scheduled"])
      .lte("scheduled_for", nowIso)
      .order("scheduled_for", { ascending: true })
      .limit(limit);
    return (data ?? []) as OutboxItem[];
  }

  async acquireOutboxLock(id: string, workerId: string, lockDurationMs: number): Promise<boolean> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + lockDurationMs);

    // Intenta adquirir el lock atómicamente si el item está en approved/scheduled o su lock expiró
    const { data, error } = await this.client()
      .from("outbound_outbox")
      .update({
        estado: "sending",
        locked_at: now.toISOString(),
        locked_by: workerId,
        lock_expires_at: expiresAt.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("id", id)
      .in("estado", ["approved", "scheduled", "sending"])
      .or(`lock_expires_at.is.null,lock_expires_at.lte.${now.toISOString()}`)
      .select("id");

    return Boolean(data && data.length > 0 && !error);
  }

  async releaseOutboxLock(id: string, newState: EstadoOutbox, errorMsg?: string | null): Promise<void> {
    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
      estado: newState,
      locked_at: null,
      locked_by: null,
      lock_expires_at: null,
      updated_at: now,
    };
    if (errorMsg !== undefined) updates.error_message = errorMsg;
    if (newState === "sent") updates.enviado_at = now;

    await this.client().from("outbound_outbox").update(updates).eq("id", id);
  }

  async updateOutboxItem(id: string, updates: Partial<OutboxItem>): Promise<void> {
    const item = await this.getOutboxItemById(id);
    if (!item) return;

    const subjectModificado = updates.subject !== undefined && updates.subject.trim() !== item.subject.trim();
    const bodyModificado = updates.body_text !== undefined && updates.body_text.trim() !== item.body_text.trim();

    let updatesFinales: Partial<OutboxItem> = { ...updates, updated_at: new Date().toISOString() };
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

    await this.client()
      .from("outbound_outbox")
      .update(updatesFinales)
      .eq("id", id);
  }

  async approveOutboxItem(id: string, approvedBy: string): Promise<OutboxItem | null> {
    const item = await this.getOutboxItemById(id);
    if (!item) return null;
    const now = new Date().toISOString();
    const hash = calcularHashCopy(item.subject, item.body_text);

    const { data, error } = await this.client()
      .from("outbound_outbox")
      .update({
        estado: "approved",
        approved_by: approvedBy,
        approved_at: now,
        approved_copy_hash: hash,
        error_message: null,
        updated_at: now,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as OutboxItem;
  }

  async getDailySentCounts(senderId: string, now = new Date()): Promise<{ sentToday: number; newLeadsToday: number }> {
    const inicioDia = obtenerInicioDelDiaSantiago(now).toISOString();
    const [{ data: sent, error: sentError }, { data: sending, error: sendingError }] = await Promise.all([
      this.client()
      .from("outbound_outbox")
      .select("step_number, estado")
      .eq("sender_id", senderId)
      .eq("estado", "sent")
      .gte("enviado_at", inicioDia),
      this.client()
        .from("outbound_outbox")
        .select("step_number, estado")
        .eq("sender_id", senderId)
        .eq("estado", "sending")
        .gte("locked_at", inicioDia),
    ]);
    if (sentError) throw sentError;
    if (sendingError) throw sendingError;

    const reservations = [...(sent ?? []), ...(sending ?? [])];
    const sentToday = reservations.length;
    const newLeadsToday = reservations.filter((i: { step_number: number }) => i.step_number === 1).length;
    return { sentToday, newLeadsToday };
  }

  async getDomainDailySentCount(domainId: string, now = new Date()): Promise<number> {
    const inicioDia = obtenerInicioDelDiaSantiago(now).toISOString();
    const senders = await this.getSenders(domainId);
    const senderIds = senders.map((s) => s.id);
    if (senderIds.length === 0) return 0;

    const [{ count: sentCount, error: sentError }, { count: sendingCount, error: sendingError }] = await Promise.all([
      this.client().from("outbound_outbox").select("id", { count: "exact", head: true })
        .in("sender_id", senderIds).eq("estado", "sent").gte("enviado_at", inicioDia),
      this.client().from("outbound_outbox").select("id", { count: "exact", head: true })
        .in("sender_id", senderIds).eq("estado", "sending").gte("locked_at", inicioDia),
    ]);
    if (sentError) throw sentError;
    if (sendingError) throw sendingError;
    return (sentCount ?? 0) + (sendingCount ?? 0);
  }

  async getMailboxWatch(mailboxEmail: string): Promise<MailboxWatchStatus | null> {
    const { data, error } = await this.client()
      .from("outbound_mailbox_watches")
      .select("*")
      .eq("mailbox_email", mailboxEmail.toLowerCase().trim())
      .maybeSingle();
    if (error) throw error;
    return (data as MailboxWatchStatus) ?? null;
  }

  async listMailboxWatches(): Promise<MailboxWatchStatus[]> {
    const { data, error } = await this.client()
      .from("outbound_mailbox_watches")
      .select("*")
      .order("mailbox_email", { ascending: true });
    if (error) throw error;
    return (data ?? []) as MailboxWatchStatus[];
  }

  async upsertMailboxWatch(status: MailboxWatchStatus): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await this.client()
      .from("outbound_mailbox_watches")
      .upsert({
        ...status,
        mailbox_email: status.mailbox_email.toLowerCase().trim(),
        updated_at: now,
      }, { onConflict: "mailbox_email" });
    if (error) throw error;
  }

  async cancelPendingOutboxForContact(contactId: string, reason: string): Promise<number> {
    const { data } = await this.client()
      .from("outbound_outbox")
      .update({
        estado: "cancelled",
        error_message: reason,
        updated_at: new Date().toISOString(),
      })
      .eq("contact_id", contactId)
      .in("estado", ["pending_review", "approved", "scheduled"])
      .select("id");
    return data?.length ?? 0;
  }

  async listOutbox(filter?: { estado?: EstadoOutbox; limit?: number }): Promise<OutboxItem[]> {
    let q = this.client().from("outbound_outbox").select("*").order("scheduled_for", { ascending: true });
    if (filter?.estado) q = q.eq("estado", filter.estado);
    const { data, error } = await q.limit(filter?.limit ?? 100);
    if (error) throw error;
    return (data ?? []) as OutboxItem[];
  }

  // Supresiones
  async isSuppressed(email: string, domain?: string): Promise<{ suppressed: boolean; reason?: string }> {
    const normEmail = email.toLowerCase().trim();
    const emailDomain = normEmail.split("@")[1];
    const targets = [normEmail];
    if (domain) targets.push(domain.toLowerCase().trim());
    if (emailDomain) targets.push(emailDomain.toLowerCase().trim());

    const { data } = await this.client()
      .from("outbound_suppressions")
      .select("*")
      .in("valor", targets)
      .limit(1)
      .maybeSingle();

    if (data) {
      return { suppressed: true, reason: `Suprimido (${data.motivo})` };
    }
    return { suppressed: false };
  }

  async addSuppression(suppression: Omit<Suppression, "id" | "created_at">): Promise<void> {
    await this.client().from("outbound_suppressions").upsert({
      ...suppression,
      valor: suppression.valor.toLowerCase().trim(),
    }, { onConflict: "valor" });
  }

  async listSuppressions(): Promise<Suppression[]> {
    const { data, error } = await this.client().from("outbound_suppressions").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Suppression[];
  }

  // Replies
  async createReply(reply: Omit<ReplyEvent, "id" | "created_at">): Promise<ReplyEvent> {
    const { data, error } = await this.client()
      .from("outbound_replies")
      .insert(reply)
      .select()
      .single();
    if (error) throw error;
    return data as ReplyEvent;
  }

  async getReplyByGmailMessageId(gmailMessageId: string): Promise<ReplyEvent | null> {
    const { data, error } = await this.client()
      .from("outbound_replies")
      .select("*")
      .eq("gmail_message_id", gmailMessageId)
      .maybeSingle();
    if (error) throw error;
    return (data as ReplyEvent) ?? null;
  }

  async listReplies(limit = 100): Promise<ReplyEvent[]> {
    const { data, error } = await this.client()
      .from("outbound_replies")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as ReplyEvent[];
  }

  // Eventos
  async logEvent(event: Omit<OutboundEvent, "id" | "created_at">): Promise<void> {
    await this.client().from("outbound_events").insert(event);
  }

  async listEvents(filter?: { tipo?: string; contact_id?: string; limit?: number }): Promise<OutboundEvent[]> {
    let q = this.client().from("outbound_events").select("*").order("created_at", { ascending: false });
    if (filter?.tipo) q = q.eq("tipo", filter.tipo);
    if (filter?.contact_id) q = q.eq("contact_id", filter.contact_id);
    const { data } = await q.limit(filter?.limit ?? 100);
    return (data ?? []) as OutboundEvent[];
  }
}
