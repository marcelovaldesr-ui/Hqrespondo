-- 021 — Leads Foco: el segundo motor de prospección
--
-- POR QUÉ EXISTE
-- La lista actual sale de Google Maps: micro-pymes, número público, el que
-- contesta es quien esté en el mesón. Sirve, pero las DOS reuniones que se
-- consiguieron (RS-SHOP/KTM y Aleta) fueron con un perfil de empresa que esa
-- lista nunca habría traído: medianas, con decisor identificado y su número.
--
-- Esta tabla es ese otro perfil. Convive con `prospects`, no lo reemplaza:
-- son dos motores con criterios y guiones distintos.
--
-- DIFERENCIA CLAVE DE MODELO
-- En `prospects` la unidad es el NEGOCIO y el teléfono es el del local.
-- Acá la unidad es la PERSONA: nombre, cargo y su número. Por eso una misma
-- empresa puede tener varias filas (un gerente comercial y un jefe de
-- operaciones son dos conversaciones distintas).

begin;

create table if not exists leads_foco (
  id uuid primary key default gen_random_uuid(),

  -- ---------- Empresa ----------
  empresa text not null,
  razon_social text not null default '',
  rut text not null default '',
  web text not null default '',
  linkedin_empresa text not null default '',
  industria text not null default '',
  n_empleados integer,
  comuna text not null default '',
  region text not null default '',

  -- ---------- Persona ----------
  contacto text not null default '',
  cargo text not null default '',
  telefono text not null default '',
  email text not null default '',
  linkedin_contacto text not null default '',

  -- ---------- Operación ----------
  -- "Lista" = campaña. Permite trabajar tandas separadas sin mezclarlas.
  lista text not null default 'general',

  estado text not null default 'nuevo'
    check (estado in ('nuevo','contactando','agendado','ganado','descartado')),

  -- Disposición del ÚLTIMO toque. Cerrada a propósito: con notas libres no
  -- se puede calcular tasa de conexión (misma lección que en /llamadas).
  ultimo_resultado text
    check (ultimo_resultado in (
      'no_contesta','llamar_mas_tarde','gatekeeper','derivo','exito','rechazo',
      'mandar_correo','mandar_whatsapp','equivocado','no_existe','no_aplica',
      'ya_cliente','duplicado','no_contactar','blacklist'
    )),

  tags text[] not null default '{}',
  nota text not null default '',
  -- Cuándo volver a llamar. Es lo que hace que un "llamar más tarde" no se
  -- pierda: la fila reaparece sola ese día.
  recordatorio timestamptz,

  intentos integer not null default 0,
  ultimo_intento timestamptz,

  -- ---------- Enriquecimiento ----------
  senal text not null default '',        -- por qué llamarlos
  confianza text not null default 'baja',
  fuente_url text not null default '',
  -- Ficha de empresa generada por IA, con la fuente de cada dato.
  ficha jsonb,
  ficha_actualizada timestamptz,

  -- Contactabilidad: 3 = tiene teléfono Y persona, 2 = solo teléfono,
  -- 1 = solo persona, 0 = ninguno de los dos. Es columna generada porque el
  -- orden de la cola depende de esto y calcularlo en la app obligaría a traer
  -- la tabla entera para después ordenarla.
  contactabilidad smallint generated always as (
    (case when telefono <> '' then 2 else 0 end) +
    (case when contacto <> '' then 1 else 0 end)
  ) stored,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_foco_trabajo_idx
  on leads_foco (lista, estado, recordatorio);
create index if not exists leads_foco_cola_idx
  on leads_foco (contactabilidad desc, intentos, n_empleados desc);
create index if not exists leads_foco_cargo_idx on leads_foco (cargo);
create index if not exists leads_foco_empresa_idx on leads_foco (empresa);

-- Una misma persona no debe entrar dos veces por la misma lista.
create unique index if not exists leads_foco_unico_idx
  on leads_foco (lista, lower(empresa), lower(contacto));

commit;
