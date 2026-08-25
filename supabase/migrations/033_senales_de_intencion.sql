-- 033 — Fase 3: señales de intención.
--
-- QUÉ ES UNA SEÑAL
-- Un hecho público, fechado y citable, que indica que una empresa tiene AHORA
-- el problema que Respondo resuelve. La más fuerte de todas, y la razón por la
-- que esta fase existe: una clínica publicando un aviso para contratar
-- recepcionista. Es un negocio diciendo en voz alta que no da abasto
-- contestando, y que está a punto de gastar un sueldo en resolverlo.
--
-- Llamar a esa clínica esta semana no es lo mismo que llamarla en tres meses.
-- Esta tabla existe para que esa diferencia se note en la cola del día.
--
-- TRES REGLAS QUE LA DEFINEN
--
-- 1. Toda señal trae evidencia o no entra. `evidencia_url` es NOT NULL. Una
--    señal sin fuente es un rumor, y un rumor dicho en una llamada en frío
--    ("supe que están contratando") suena a que espiamos. Con la URL a mano se
--    puede decir de dónde salió.
--
-- 2. Toda señal caduca. Un aviso de empleo vale ~30 días; a los 45 ya
--    contrataron y la señal MIENTE — es peor que no tenerla, porque ordena la
--    cola con información falsa. `vigente_hasta` es obligatorio.
--
-- 3. La señal se guarda aparte del lead. `leads_foco.senal` es el texto que
--    alguien escribió a mano sobre por qué llamar; esto son hechos con fecha y
--    fuente. Mezclarlos haría imposible saber cuál es cuál dentro de un año.
--
-- LO QUE NO SE CONSTRUYE ACÁ, A PROPÓSITO
-- El documento de arquitectura proponía además `empresa_snapshots` para
-- detectar CAMBIOS (que instalaron un sistema de agenda, que abrieron sucursal).
-- Eso necesita dos observaciones separadas en el tiempo para significar algo:
-- con 30 leads en la cola, esa tabla estaría vacía por semanas. Se construye
-- cuando haya historia que comparar, no antes.

begin;

-- ---------------------------------------------------------------------------
-- La tabla
-- ---------------------------------------------------------------------------
create table if not exists public.senales (
  id bigint generated always as identity primary key,

  -- A quién. Igual que la cola: llave foránea real, no texto suelto.
  lead_foco_id uuid references public.leads_foco(id)   on delete cascade,
  empresa_rut  text references public.empresas_sii(rut) on delete cascade,
  prospect_id  uuid references public.prospects(id)     on delete cascade,

  tipo text not null
    check (tipo in ('contratando_atencion','queja_no_contestan','nueva_sucursal','cambio_agenda','otro')),

  -- Una línea, lista para decirla en la llamada. No un párrafo.
  detalle text not null,

  -- Sin fuente no hay señal. Ver la regla 1 arriba.
  evidencia_url text not null,
  fuente        text not null default 'busqueda_publica',

  detectada_at  timestamptz not null default now(),
  -- Cuándo deja de ser cierta. Ver la regla 2.
  vigente_hasta timestamptz not null,

  -- Qué tan seguros estamos de que el aviso es de ESTA empresa y no de una
  -- con nombre parecido. El detector la baja cuando el nombre no calza entero.
  confianza text not null default 'media' check (confianza in ('alta','media','baja')),

  created_at timestamptz not null default now(),

  constraint senales_una_entidad check (
    (lead_foco_id is not null)::int
  + (empresa_rut  is not null)::int
  + (prospect_id  is not null)::int = 1
  )
);

create index if not exists senales_lead_idx    on public.senales (lead_foco_id, vigente_hasta desc);
create index if not exists senales_vigentes_idx on public.senales (vigente_hasta desc, tipo);

-- No anotar dos veces el mismo aviso.
create unique index if not exists senales_sin_duplicados_idx
  on public.senales (lead_foco_id, tipo, evidencia_url)
  where lead_foco_id is not null;

alter table public.senales enable row level security;
revoke all on public.senales from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Lo que la cola del día necesita para ordenar
-- ---------------------------------------------------------------------------
-- Se desnormaliza a propósito: la cola ordena por columna (PostgREST no ordena
-- por subconsulta) y traer la tabla entera para reordenarla en memoria es
-- exactamente lo que `contactabilidad` ya evitó en la migración 021.
alter table public.leads_foco
  add column if not exists senal_reciente      text,
  add column if not exists senal_reciente_url  text,
  add column if not exists senal_reciente_at   timestamptz,
  add column if not exists senal_vigente_hasta timestamptz;

comment on column public.leads_foco.senal_reciente is
  'Copia de la señal vigente más reciente, para ordenar la cola del día sin traer la tabla entera. La verdad vive en `senales`.';

create index if not exists leads_foco_senal_idx
  on public.leads_foco (senal_vigente_hasta desc nulls last)
  where senal_reciente is not null;

-- ---------------------------------------------------------------------------
-- La cola aprende un objetivo nuevo
-- ---------------------------------------------------------------------------
alter table public.cola_enriquecimiento drop constraint if exists cola_enriquecimiento_objetivo_check;
alter table public.cola_enriquecimiento
  add constraint cola_enriquecimiento_objetivo_check
  check (objetivo in ('telefono_directo','email','decisor','linkedin','senal'));

commit;
