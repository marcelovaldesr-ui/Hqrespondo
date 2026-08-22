-- 025 — El universo del SII entra a la base, y cada empresa puede tener dueño.
--
-- Hasta ahora las 7.312 empresas de cupo único vivían en un CSV que solo se
-- abría a mano. Mientras siga así no se puede cruzar con lo que ya se llamó,
-- ni filtrar en pantalla, ni saber qué falta.
--
-- Trae tres cosas:
--   1. `empresas_sii`  — el universo, con RUT como llave.
--   2. Campos de decisor en `prospects` y `leads_foco` — quién manda, de dónde
--      salió ese dato y cuándo se verificó. El origen es obligatorio: la Ley
--      21.719 entra el 1-dic-2026 y pide poder responder de dónde salió cada
--      dato personal.
--   3. `tipo_numero` — distinguir el teléfono de recepción del directo. Es lo
--      que separa "¿está el dueño?" de "¿hablo con Rodrigo?".

begin;

create table if not exists public.empresas_sii (
  rut                text primary key,
  razon_social       text not null,
  categoria          text,
  actividad_sii      text,
  n_trabajadores     int,
  cod_tramo_ventas   int,
  ventas_anuales     text,
  region             text,
  comuna             text,
  inicio_actividades date,
  -- Por cuál motor corresponde atacarla. Lo decide el tamaño: bajo 12
  -- trabajadores no hay nadie en LinkedIn (medido: 0 de 12), así que va por
  -- Google Maps; desde 12 sí (medido: 24 de 51).
  motor              text check (motor in ('llamadas','foco')),
  -- Estado del trabajo sobre esta empresa.
  telefono           text,
  telefono_origen    text,
  decisor_nombre     text,
  decisor_cargo      text,
  decisor_origen     text,
  decisor_confianza  text check (decisor_confianza in ('alta','media','baja')),
  verificado_at      timestamptz,
  prospect_id        uuid references public.prospects(id) on delete set null,
  lead_foco_id       uuid references public.leads_foco(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists empresas_sii_comuna_idx   on public.empresas_sii (comuna);
create index if not exists empresas_sii_categoria_idx on public.empresas_sii (categoria);
create index if not exists empresas_sii_motor_idx    on public.empresas_sii (motor);
-- Para la cola de trabajo: las que aún no tienen decisor, por tamaño.
create index if not exists empresas_sii_pendientes_idx
  on public.empresas_sii (motor, n_trabajadores desc)
  where decisor_nombre is null;

-- ---------- decisor y tipo de número en las tablas que ya existen ----------
alter table public.prospects
  add column if not exists decisor_cargo    text,
  add column if not exists decisor_origen   text,
  add column if not exists verificado_at    timestamptz,
  add column if not exists tipo_numero      text
    check (tipo_numero in ('recepcion','directo','movil_dueno','desconocido'));

alter table public.leads_foco
  add column if not exists decisor_origen   text,
  add column if not exists verificado_at    timestamptz,
  add column if not exists tipo_numero      text
    check (tipo_numero in ('recepcion','directo','movil_dueno','desconocido'));

-- Un celular publicado por un negocio de pocos trabajadores casi siempre es
-- el del dueño: 59% de las clínicas de la base publica un 9xxxxxxxx. No se
-- afirma, se marca como hipótesis para que la llamada la confirme.
update public.prospects
   set tipo_numero = case
         when telefono is null or telefono = '' then null
         when regexp_replace(telefono, '\D', '', 'g') ~ '^(56)?9[0-9]{8}$' then 'movil_dueno'
         else 'recepcion'
       end
 where tipo_numero is null;

commit;
