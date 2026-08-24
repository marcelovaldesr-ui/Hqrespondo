-- ============================================================================
-- 028 — Fase 1 de la arquitectura de datos: la cola y el libro mayor.
--
-- Hasta hoy el enriquecimiento vive dentro del orquestador: corre, hace lo que
-- puede en los 300 segundos que da Vercel, y lo que no alcanzó se pierde. No
-- hay memoria de qué proveedor ya respondió sobre qué empresa, así que un lead
-- puede pasar dos veces por Apollo y gastar crédito para recibir el mismo "no
-- lo tengo". Y si un proveedor se cae, se sigue llamando hasta agotar el cupo.
--
-- Esta migración trae las tres piezas que faltan:
--
--   1. `cola_enriquecimiento`   — el trabajo pendiente, con estado y reintentos.
--   2. `enriquecimiento_intentos` — el libro mayor: qué se le preguntó a quién,
--      qué contestó (payload crudo en JSONB) y cuánto costó. Append-only.
--   3. `proveedor_estado`       — el cortacircuitos y el control de cupo.
--
--   + las funciones `obtener_lote_cola`, `cerrar_item_cola` y
--     `recuperar_cola_colgada`, que hacen que dos workers simultáneos no se
--     pisen y que un worker muerto no deje trabajo secuestrado para siempre.
--
-- Ejecutar en: Supabase > SQL Editor. Es idempotente: correrla dos veces no
-- rompe nada.
--
-- Nota sobre la Ley 21.719 (vigente 1-dic-2026): el libro mayor es también el
-- registro de procedencia. Para cualquier dato personal en la base se puede
-- responder de qué proveedor salió, qué día y con qué respuesta exacta.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. LA COLA
-- ---------------------------------------------------------------------------
-- Una fila = "hay que averiguar X sobre esta entidad".
--
-- La entidad puede ser un prospect, un lead_foco o una empresa del SII. En vez
-- de una referencia genérica de texto (que no valida nada y deja basura cuando
-- se borra el original) se usan tres columnas con llave foránea real y un CHECK
-- que obliga a que venga exactamente una. `entidad_id` se calcula sola y sirve
-- para los índices.

create table if not exists public.cola_enriquecimiento (
  id            bigint generated always as identity primary key,

  -- a quién se refiere (exactamente una de las tres)
  prospect_id   uuid references public.prospects(id)   on delete cascade,
  lead_foco_id  uuid references public.leads_foco(id)  on delete cascade,
  empresa_rut   text references public.empresas_sii(rut) on delete cascade,

  entidad       text generated always as (
                  case
                    when prospect_id  is not null then 'prospect'
                    when lead_foco_id is not null then 'lead_foco'
                    else 'empresa_sii'
                  end
                ) stored,
  entidad_id    text generated always as (
                  coalesce(prospect_id::text, lead_foco_id::text, empresa_rut)
                ) stored,

  -- qué se quiere averiguar
  objetivo      text not null default 'telefono_directo'
                check (objetivo in ('telefono_directo','email','decisor','linkedin')),

  -- dónde va
  estado        text not null default 'pendiente'
                check (estado in ('pendiente','procesando','completado','fallido','agotado')),

  -- Más alto = se atiende antes. Regla sugerida: 100 si el lead ya tiene
  -- reunión o llamada agendada, 50 si está en el foco de la semana, 0 el resto.
  prioridad     int not null default 0,

  intentos      int not null default 0,
  max_intentos  int not null default 3,

  -- Backoff: mientras esta fecha esté en el futuro, la fila no se toma.
  proximo_intento_at timestamptz not null default now(),

  -- Quién la tomó. Sin esto no se puede distinguir "se está procesando" de
  -- "un worker murió a mitad de camino y nadie va a volver por ella".
  lote_id       uuid,
  tomado_at     timestamptz,

  ultimo_error  text,
  resultado     jsonb,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint cola_una_sola_entidad check (
    (prospect_id  is not null)::int
  + (lead_foco_id is not null)::int
  + (empresa_rut  is not null)::int = 1
  )
);

-- El índice que importa: es exactamente el orden en que `obtener_lote_cola`
-- pide las filas. Sin él, con 50.000 filas en cola cada llamada al worker hace
-- un scan completo de la tabla.
create index if not exists cola_enriq_listas_idx
  on public.cola_enriquecimiento (prioridad desc, proximo_intento_at, id)
  where estado = 'pendiente';

-- Para el recuperador de colgadas.
create index if not exists cola_enriq_procesando_idx
  on public.cola_enriquecimiento (tomado_at)
  where estado = 'procesando';

-- No encolar dos veces lo mismo. Solo aplica a trabajo vivo: una vez que la
-- fila termina (completado/fallido/agotado) se puede volver a encolar el mismo
-- objetivo más adelante, que es lo correcto — un teléfono puede cambiar.
create unique index if not exists cola_enriq_sin_duplicados_idx
  on public.cola_enriquecimiento (entidad, entidad_id, objetivo)
  where estado in ('pendiente','procesando');

drop trigger if exists cola_enriquecimiento_updated_at on public.cola_enriquecimiento;
create trigger cola_enriquecimiento_updated_at
  before update on public.cola_enriquecimiento
  for each row execute function set_updated_at();


-- ---------------------------------------------------------------------------
-- 2. EL LIBRO MAYOR
-- ---------------------------------------------------------------------------
-- Append-only. Nunca se hace UPDATE ni DELETE sobre esta tabla: es la prueba.
--
-- A propósito NO tiene llave foránea a prospects ni a empresas_sii. Si mañana
-- se borra un prospect, el registro de que el 22-ago-2026 se le preguntó a
-- Apollo por él y Apollo cobró un crédito tiene que sobrevivir. Un libro mayor
-- que se borra solo no es un libro mayor.

create table if not exists public.enriquecimiento_intentos (
  id           bigint generated always as identity primary key,

  cola_id      bigint,          -- referencia suelta, a propósito
  entidad      text not null check (entidad in ('prospect','lead_foco','empresa_sii')),
  entidad_id   text not null,

  proveedor    text not null,   -- 'sii' | 'web' | 'places' | 'hunter' | 'apollo' | 'apollo_2' | 'lusha' | 'gemini'
  objetivo     text not null,

  -- El veredicto normalizado. La diferencia entre 'sin_dato' y 'error' es la
  -- que decide si se vuelve a preguntar: 'sin_dato' es una respuesta definitiva
  -- ("no lo tengo"), 'error' es un problema nuestro o del proveedor y sí se
  -- reintenta.
  resultado    text not null
               check (resultado in ('exito','sin_dato','error','sin_cupo','rate_limit','bloqueado')),

  encontrado   boolean not null default false,
  costo_creditos numeric(10,2) not null default 0,
  ms           int,

  -- El payload crudo, tal cual llegó. Es lo que permite, seis meses después,
  -- responder "¿de dónde salió este número?" sin adivinar. Se recorta antes de
  -- guardar si viene gigante (ver lib/cola.ts).
  respuesta    jsonb,
  error_detalle text,

  created_at   timestamptz not null default now()
);

create index if not exists enriq_intentos_entidad_idx
  on public.enriquecimiento_intentos (entidad, entidad_id, created_at desc);
create index if not exists enriq_intentos_proveedor_idx
  on public.enriquecimiento_intentos (proveedor, created_at desc);
create index if not exists enriq_intentos_costo_idx
  on public.enriquecimiento_intentos (created_at desc)
  where costo_creditos > 0;

-- La regla que ahorra plata: un proveedor que ya dio una respuesta DEFINITIVA
-- sobre esta entidad y este objetivo no se vuelve a consultar. Los errores y
-- los "sin cupo" no cuentan como definitivos, así que esos sí se reintentan.
create unique index if not exists enriq_intentos_definitivo_idx
  on public.enriquecimiento_intentos (entidad, entidad_id, proveedor, objetivo)
  where resultado in ('exito','sin_dato');


-- ---------------------------------------------------------------------------
-- 3. EL CORTACIRCUITOS
-- ---------------------------------------------------------------------------
-- Una fila por proveedor. Dos trabajos distintos en la misma tabla:
--   a) salud   — si el proveedor está fallando, se corta el tráfico un rato.
--   b) cupo    — cuántas llamadas quedan hoy y este mes.
--
-- Sobre los nombres: en la literatura el patrón se llama "circuit breaker" y
-- sus estados son closed/open/half-open, que se leen al revés de lo intuitivo
-- (closed = funcionando). Acá se usan nombres directos: ok / probando / cortado.

create table if not exists public.proveedor_estado (
  proveedor    text primary key,

  estado       text not null default 'ok'
               check (estado in ('ok','probando','cortado')),

  -- Interruptor manual. Ponerlo en false apaga el proveedor sin borrar nada
  -- ni tocar código: se hace desde el editor de tablas de Supabase.
  habilitado   boolean not null default true,

  fallos_consecutivos int not null default 0,
  fallos_umbral       int not null default 5,   -- a los 5 seguidos, se corta
  cortado_hasta       timestamptz,              -- y vuelve a 'probando' acá

  -- Cupo. NULL = sin límite conocido.
  cupo_diario  int,
  cupo_usado_dia int not null default 0,
  dia_actual   date not null default current_date,

  cupo_mensual int,
  cupo_usado_mes int not null default 0,
  mes_actual   date not null default date_trunc('month', current_date)::date,

  -- Cuánto cuesta cada llamada. Sirve para el informe de gasto, no para cobrar.
  costo_por_llamada numeric(10,4) not null default 0,

  ultimo_ok_at timestamptz,
  ultimo_error text,
  notas        text,
  updated_at   timestamptz not null default now()
);

drop trigger if exists proveedor_estado_updated_at on public.proveedor_estado;
create trigger proveedor_estado_updated_at
  before update on public.proveedor_estado
  for each row execute function set_updated_at();

-- Los proveedores que ya existen en el código, con los cupos reales medidos.
-- `on conflict do nothing` para no pisar ajustes hechos a mano después.
insert into public.proveedor_estado
  (proveedor, cupo_diario, cupo_mensual, costo_por_llamada, notas)
values
  ('sii',      null, null,  0,      'Nómina pública del SII ya cargada en empresas_sii. Sin límite, sin costo.'),
  ('web',      null, null,  0,      'Lectura del sitio propio del negocio. Sin costo; el límite es el tiempo de función.'),
  ('places',   null, 1000,  0.035,  'Google Places Text Search (New). 1.000 gratis/mes, después USD 35 por 1.000.'),
  ('hunter',   null, 50,    0,      'Plan gratuito: 50 créditos al mes.'),
  ('apollo',   null, 85,    0,      'Cuenta 1 (APOLLO_API_KEY). Créditos gratuitos.'),
  ('apollo_2', null, 85,    0,      'Cuenta 2 (APOLLO_API_KEY_2). Créditos gratuitos.'),
  ('lusha',    null, null,  0,      'Enriquecimiento por URL de LinkedIn.'),
  ('gemini',   null, null,  0,      'Búsqueda con grounding. Exige cita; sin cita el resultado se descarta.')
on conflict (proveedor) do nothing;


-- ---------------------------------------------------------------------------
-- 4. TOMAR UN LOTE — la pieza central
-- ---------------------------------------------------------------------------
-- El problema que resuelve: si dos workers corren a la vez (y van a correr,
-- porque GitHub Actions dispara cada pocas horas y una corrida puede demorarse)
-- ambos leerían las mismas 25 filas y las procesarían dos veces. Eso es plata:
-- 25 créditos de Apollo gastados de más por corrida duplicada.
--
-- `FOR UPDATE SKIP LOCKED` hace que el segundo worker, en vez de esperar a que
-- el primero suelte las filas, simplemente las salte y se lleve las 25
-- siguientes. Los dos trabajan, ninguno repite.
--
-- El SELECT y el UPDATE van en una sola sentencia, así que no existe una
-- ventana en la que la fila esté leída pero no marcada.

create or replace function public.obtener_lote_cola(
  p_lote     int  default 25,
  p_objetivo text default null
)
returns setof public.cola_enriquecimiento
language plpgsql
as $$
declare
  v_lote_id uuid := gen_random_uuid();
begin
  return query
  with candidatos as (
    select c.id
      from public.cola_enriquecimiento c
     where c.estado = 'pendiente'
       and c.proximo_intento_at <= now()
       and (p_objetivo is null or c.objetivo = p_objetivo)
     order by c.prioridad desc, c.proximo_intento_at, c.id
     limit greatest(coalesce(p_lote, 25), 0)
     for update skip locked
  )
  update public.cola_enriquecimiento c
     set estado     = 'procesando',
         lote_id    = v_lote_id,
         tomado_at  = now(),
         intentos   = c.intentos + 1,
         updated_at = now()
    from candidatos k
   where c.id = k.id
  returning c.*;
end;
$$;

comment on function public.obtener_lote_cola(int, text) is
  'Toma hasta p_lote filas pendientes de la cola y las marca como procesando en una sola transacción. Seguro con workers concurrentes (FOR UPDATE SKIP LOCKED).';


-- ---------------------------------------------------------------------------
-- 4-bis. ENCOLAR EN LOTE
-- ---------------------------------------------------------------------------
-- Tiene que ser una función y no un `upsert` desde la app por un detalle de
-- Postgres que no es obvio: `cola_enriq_sin_duplicados_idx` es un índice único
-- PARCIAL (solo cubre las filas vivas). Para que `ON CONFLICT` lo reconozca hay
-- que repetirle el mismo WHERE del índice, y el cliente de Supabase no tiene
-- forma de mandar esa cláusula — falla con "no unique or exclusion constraint
-- matching the ON CONFLICT specification". Acá sí se puede escribir completa.
--
-- Recibe un arreglo JSON: [{"entidad":"empresa_sii","id":"76.123.456-7",
--                           "objetivo":"telefono_directo","prioridad":50}, ...]
-- Devuelve cuántas filas NUEVAS quedaron encoladas (las repetidas se ignoran).

create or replace function public.encolar_items(p_items jsonb)
returns int
language plpgsql
as $$
declare
  v_n int;
begin
  insert into public.cola_enriquecimiento
    (prospect_id, lead_foco_id, empresa_rut, objetivo, prioridad)
  select distinct on (i->>'entidad', i->>'id', coalesce(i->>'objetivo','telefono_directo'))
    case when i->>'entidad' = 'prospect'    then (i->>'id')::uuid end,
    case when i->>'entidad' = 'lead_foco'   then (i->>'id')::uuid end,
    case when i->>'entidad' = 'empresa_sii' then  i->>'id'         end,
    coalesce(i->>'objetivo', 'telefono_directo'),
    coalesce((i->>'prioridad')::int, 0)
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) i
  where i->>'entidad' in ('prospect','lead_foco','empresa_sii')
    and coalesce(i->>'id','') <> ''
  on conflict (entidad, entidad_id, objetivo)
    where estado in ('pendiente','procesando')
  do nothing;

  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

comment on function public.encolar_items(jsonb) is
  'Encola trabajo en lote sin duplicar lo que ya está vivo en la cola. Idempotente.';


-- ---------------------------------------------------------------------------
-- 5. CERRAR UNA FILA
-- ---------------------------------------------------------------------------
-- El backoff está acá y no en TypeScript a propósito: si el worker se muere
-- justo después de llamar al proveedor, el estado de la fila lo decide la base,
-- no un proceso que ya no existe.
--
-- 'fallido' con intentos disponibles vuelve a 'pendiente' con espera creciente
-- (5 min, 25 min, 2 horas). Sin intentos, queda en 'agotado' y no se toca más
-- hasta que alguien la mire.

create or replace function public.cerrar_item_cola(
  p_id        bigint,
  p_estado    text,
  p_resultado jsonb default null,
  p_error     text  default null
)
returns public.cola_enriquecimiento
language plpgsql
as $$
declare
  v_fila public.cola_enriquecimiento;
begin
  if p_estado not in ('completado','fallido') then
    raise exception 'cerrar_item_cola: p_estado debe ser completado o fallido, llegó %', p_estado;
  end if;

  update public.cola_enriquecimiento c
     set estado = case
                    when p_estado = 'completado'        then 'completado'
                    when c.intentos >= c.max_intentos   then 'agotado'
                    else 'pendiente'
                  end,
         resultado = coalesce(p_resultado, c.resultado),
         ultimo_error = case when p_estado = 'completado' then null else p_error end,
         proximo_intento_at = case
           when p_estado = 'completado' then c.proximo_intento_at
           -- 5 min, 25 min, 2 h 05 — suficiente para que un proveedor caído
           -- se recupere sin que la fila quede parada un día entero.
           else now() + (power(5, least(c.intentos, 3)) * interval '1 minute')
         end,
         lote_id   = null,
         tomado_at = null,
         updated_at = now()
   where c.id = p_id
  returning c.* into v_fila;

  return v_fila;
end;
$$;


-- ---------------------------------------------------------------------------
-- 6. RECUPERAR LAS COLGADAS
-- ---------------------------------------------------------------------------
-- Vercel corta la función a los 300 segundos sin avisar. Cuando eso pasa, las
-- filas que el worker había tomado quedan en 'procesando' para siempre: nadie
-- las va a cerrar y `obtener_lote_cola` no las vuelve a mirar.
--
-- Esto es lo que impide que la cola se seque sola. Llamarlo al INICIO de cada
-- corrida del worker, antes de pedir el lote.

create or replace function public.recuperar_cola_colgada(
  p_minutos int default 15
)
returns int
language plpgsql
as $$
declare
  v_n int;
begin
  update public.cola_enriquecimiento c
     set estado = case when c.intentos >= c.max_intentos then 'agotado' else 'pendiente' end,
         ultimo_error = 'el worker no cerró la fila (probable corte por tiempo de Vercel)',
         proximo_intento_at = now(),
         lote_id = null,
         tomado_at = null,
         updated_at = now()
   where c.estado = 'procesando'
     and c.tomado_at < now() - (greatest(coalesce(p_minutos, 15), 1) * interval '1 minute');
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;


-- ---------------------------------------------------------------------------
-- 7. SEGURIDAD
-- ---------------------------------------------------------------------------
-- Mismo criterio de la migración 002: RLS activo, sin policies, y sin GRANT a
-- los roles públicos. Todo acceso pasa por el servidor con la service_role key,
-- que ignora RLS por diseño.
--
-- Las funciones se declaran sin SECURITY DEFINER (corren con los permisos de
-- quien llama) y además se les revoca el EXECUTE a anon/authenticated, para que
-- no queden expuestas como endpoints RPC públicos de PostgREST.

alter table public.cola_enriquecimiento     enable row level security;
alter table public.enriquecimiento_intentos enable row level security;
alter table public.proveedor_estado         enable row level security;

revoke all on public.cola_enriquecimiento     from anon, authenticated;
revoke all on public.enriquecimiento_intentos from anon, authenticated;
revoke all on public.proveedor_estado         from anon, authenticated;

revoke all on function public.obtener_lote_cola(int, text)      from anon, authenticated, public;
revoke all on function public.cerrar_item_cola(bigint, text, jsonb, text) from anon, authenticated, public;
revoke all on function public.recuperar_cola_colgada(int)       from anon, authenticated, public;
revoke all on function public.encolar_items(jsonb)               from anon, authenticated, public;

grant execute on function public.obtener_lote_cola(int, text)      to service_role;
grant execute on function public.cerrar_item_cola(bigint, text, jsonb, text) to service_role;
grant execute on function public.recuperar_cola_colgada(int)       to service_role;
grant execute on function public.encolar_items(jsonb)               to service_role;

commit;

-- ============================================================================
-- COMPROBACIÓN (opcional, se puede correr aparte después del commit):
--
--   -- 1) encolar tres empresas de prueba
--   insert into public.cola_enriquecimiento (empresa_rut, objetivo, prioridad)
--   select rut, 'telefono_directo', 10
--     from public.empresas_sii
--    where telefono is null
--    limit 3
--   on conflict do nothing;
--
--   -- 2) tomar el lote (debe devolver las 3, ya en 'procesando')
--   select id, entidad, entidad_id, estado, intentos from public.obtener_lote_cola(25);
--
--   -- 3) volver a tomar (debe devolver 0 filas: ya no hay pendientes)
--   select count(*) from public.obtener_lote_cola(25);
--
--   -- 4) limpiar
--   delete from public.cola_enriquecimiento where prioridad = 10;
-- ============================================================================
