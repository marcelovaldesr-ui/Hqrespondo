-- Read-only preflight. Safe to run before 041/042/045; it never changes data.
begin transaction read only;

select name, to_regclass('public.' || name) as relation
from unnest(array[
  'outbound_domains', 'outbound_senders', 'outbound_lead_sources',
  'outbound_companies', 'outbound_contacts', 'outbound_research',
  'outbound_campaigns', 'outbound_outbox', 'outbound_suppressions',
  'outbound_replies', 'outbound_events', 'outbound_mailbox_watches'
]) as required(name);

select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public' and tablename like 'outbound_%'
order by tablename;

select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name like 'outbound_%'
  and grantee in ('anon', 'authenticated', 'service_role')
order by table_name, grantee, privilege_type;

select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and indexname = 'outbound_replies_gmail_message_id_uidx';

commit;
