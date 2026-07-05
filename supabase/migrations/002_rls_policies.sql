-- ============================================================
-- 002 — Endurecimiento RLS
-- Estado previo: RLS activo SIN policies (deny por defecto para
-- anon/authenticated; la service_role lo ignora por bypassrls).
-- Esta migración hace ese bloqueo explícito y a prueba de errores:
-- aunque alguien cree una policy permisiva por accidente, sin
-- GRANT los roles públicos siguen sin acceso.
-- Ejecutar en: Supabase > SQL Editor
-- ============================================================

-- 1) Revocar todo privilegio de los roles públicos sobre las tablas actuales
revoke all on all tables in schema public from anon, authenticated;

-- 2) Y sobre cualquier tabla futura creada por postgres en public
alter default privileges in schema public
  revoke all on tables from anon, authenticated;

-- 3) Asegurar RLS activo (idempotente; ya venía del schema base)
alter table prospects  enable row level security;
alter table deals      enable row level security;
alter table clients    enable row level security;
alter table bot_events enable row level security;
alter table briefs     enable row level security;

-- ============================================================
-- Patrón para el futuro (NO ejecutar aún): cuando exista acceso
-- de cara a clientes, cada cliente entrará con la anon key + JWT
-- cuyo app_metadata.client_id identifique su empresa, y se crearán
-- policies del estilo:
--
--   create policy "cliente ve solo lo suyo" on bot_events
--     for select to authenticated
--     using (client_id = (auth.jwt() -> 'app_metadata' ->> 'client_id')::uuid);
--
-- más el GRANT select correspondiente. Hasta entonces, todo acceso
-- pasa por el servidor del panel con la service_role key.
-- ============================================================
