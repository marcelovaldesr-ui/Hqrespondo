-- Outbound V1: forward-only correction of the canonical mail domain.
-- Apply after 041, 042 and 045. The historical migrations remain immutable.
begin;

do $$
declare required_table text;
begin
  foreach required_table in array array[
    'outbound_domains', 'outbound_senders', 'outbound_campaigns',
    'outbound_outbox', 'outbound_events'
  ] loop
    if to_regclass('public.' || required_table) is null then
      raise exception 'Prerequisito faltante: public.% (aplique 041, 042 y 045 antes de 046)', required_table;
    end if;
  end loop;
end $$;

-- Refuse to remove either unconfirmed historical mailbox when it already has
-- operational history. That case needs an explicit, audited mailbox decision.
do $$
declare seed_id uuid;
begin
  foreach seed_id in array array[
    '22222222-2222-2222-2222-222222222222'::uuid,
    '33333333-3333-3333-3333-333333333333'::uuid
  ] loop
    if exists (select 1 from public.outbound_outbox where sender_id = seed_id)
       or exists (select 1 from public.outbound_events where sender_id = seed_id)
       or exists (select 1 from public.outbound_campaigns where seed_id = any(sender_pool_ids)) then
      raise exception 'El sender histórico % tiene referencias; confirme el buzón real antes de aplicar 046', seed_id;
    end if;
  end loop;

  if exists (
    select 1 from public.outbound_senders
    where email = 'marcelo@respon-do.com'
      and id <> '11111111-1111-1111-1111-111111111111'::uuid
  ) and exists (
    select 1 from public.outbound_senders
    where id = '11111111-1111-1111-1111-111111111111'::uuid
      and email = 'marcelo@respon.do'
  ) then
    raise exception 'Ya existe marcelo@respon-do.com con otro id; unifique manualmente antes de aplicar 046';
  end if;
end $$;

-- Remove only the two exact placeholder rows created by 041. Their real
-- addresses remain intentionally undefined until the Owner confirms them.
delete from public.outbound_senders
where (id, email) in (
  ('22222222-2222-2222-2222-222222222222'::uuid, 'contacto@respon.do'),
  ('33333333-3333-3333-3333-333333333333'::uuid, 'crecimiento@respon.do')
);

do $$
declare old_domain_id uuid;
declare canonical_domain_id uuid;
begin
  select id into old_domain_id
  from public.outbound_domains
  where domain = 'respon.do';

  select id into canonical_domain_id
  from public.outbound_domains
  where domain = 'respon-do.com';

  if old_domain_id is null and canonical_domain_id is null then
    raise exception 'No existe el dominio seed de 041 ni respon-do.com; revise el orden de migraciones';
  elsif canonical_domain_id is null then
    update public.outbound_domains
    set domain = 'respon-do.com'
    where id = old_domain_id;
    canonical_domain_id := old_domain_id;
  elsif old_domain_id is not null then
    update public.outbound_senders
    set domain_id = canonical_domain_id,
        updated_at = now()
    where domain_id = old_domain_id;

    delete from public.outbound_domains where id = old_domain_id;
  end if;

  update public.outbound_senders
  set email = 'marcelo@respon-do.com',
      domain_id = canonical_domain_id,
      active = false,
      cold_outreach_enabled = false,
      health_status = 'paused',
      paused_reason = 'Confirmar existencia del buzón, OAuth y Gmail Watch antes de activar',
      updated_at = now()
  where id = '11111111-1111-1111-1111-111111111111'::uuid
    and email = 'marcelo@respon.do';

  update public.outbound_domains
  set active = false,
      paused = true,
      health_status = 'paused',
      spf_status = 'unknown',
      dkim_status = 'unknown',
      dmarc_status = 'unknown',
      mx_status = 'unknown',
      last_dns_check = null,
      paused_reason = 'DNS público verificado; faltan esquema operativo, inboxes, OAuth y Pub/Sub',
      updated_at = now()
  where id = canonical_domain_id;
end $$;

do $$
begin
  if exists (select 1 from public.outbound_domains where domain = 'respon.do')
     or exists (select 1 from public.outbound_senders where email ilike '%@respon.do') then
    raise exception 'Quedaron referencias operativas a respon.do; revise los datos antes de continuar';
  end if;
end $$;

commit;
