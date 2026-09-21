-- Outbound V1: forward-only operational safety after 041/042.
begin;

do $$
declare required_table text;
begin
  foreach required_table in array array[
    'outbound_domains', 'outbound_senders', 'outbound_lead_sources',
    'outbound_companies', 'outbound_contacts', 'outbound_research',
    'outbound_campaigns', 'outbound_outbox', 'outbound_suppressions',
    'outbound_replies', 'outbound_events', 'outbound_mailbox_watches'
  ] loop
    if to_regclass('public.' || required_table) is null then
      raise exception 'Prerequisito faltante: public.% (aplique 041 y 042 antes de 045)', required_table;
    end if;
  end loop;
end $$;

alter table public.outbound_outbox drop constraint if exists outbound_outbox_estado_check;
alter table public.outbound_outbox add constraint outbound_outbox_estado_check
  check (estado in (
    'generated', 'pending_review', 'approved', 'scheduled', 'sending',
    'simulated', 'sent', 'failed', 'cancelled', 'blocked', 'suppressed'
  ));

create unique index if not exists outbound_replies_gmail_message_id_uidx
  on public.outbound_replies (gmail_message_id);

alter table public.outbound_domains
  add constraint outbound_domains_limits_nonnegative check (domain_daily_limit >= 0 and sent_today >= 0);
alter table public.outbound_senders
  add constraint outbound_senders_limits_valid check (
    new_leads_daily_limit >= 0 and total_messages_daily_limit >= new_leads_daily_limit
    and sent_today >= 0 and new_leads_today >= 0 and warmup_stage between 0 and 10
  );
alter table public.outbound_senders
  add constraint outbound_senders_rates_valid check (
    bounce_rate between 0 and 100 and hard_bounce_rate between 0 and 100
    and opt_out_rate between 0 and 100 and reply_rate between 0 and 100
  );

-- Historical seeds are placeholders until the domain and each real mailbox are verified.
update public.outbound_domains
set active = false,
    paused = true,
    health_status = 'critical',
    domain_daily_limit = least(domain_daily_limit, 6),
    paused_reason = 'Bloqueado hasta verificar DNS público, buzones OAuth y Pub/Sub',
    updated_at = now()
where domain = 'respon.do';

update public.outbound_senders
set active = false,
    cold_outreach_enabled = false,
    health_status = 'paused',
    new_leads_daily_limit = least(new_leads_daily_limit, 2),
    total_messages_daily_limit = least(total_messages_daily_limit, 3),
    paused_reason = 'Mailbox seed no verificado; confirmar identidad, OAuth y watch antes de activar',
    updated_at = now()
where id in (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'outbound_domains', 'outbound_senders', 'outbound_lead_sources',
    'outbound_companies', 'outbound_contacts', 'outbound_research',
    'outbound_campaigns', 'outbound_outbox', 'outbound_suppressions',
    'outbound_replies', 'outbound_events', 'outbound_mailbox_watches'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format('grant all on table public.%I to service_role', table_name);
  end loop;
end $$;

commit;
