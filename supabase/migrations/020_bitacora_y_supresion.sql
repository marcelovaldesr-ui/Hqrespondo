-- 020 — Bitácora de actividad + lista de supresión
--
-- Fase 1 de la auditoría del 19-ago-2026. Dos cimientos:
--
-- 1) `actividades` — el registro único del que salen TODAS las métricas.
--    Hoy cada número del dashboard se calcula con una consulta distinta
--    sobre `prospects`, así que cada pantalla puede contar distinto y nadie
--    se entera. Con un log de eventos, "tasa de conexión" tiene UNA
--    definición y no tres.
--
-- 2) `supresiones` — quien dijo que no por un canal no puede recibir
--    contacto por otro. Hoy eso vive en la cabeza de quien llamó.
--    Además es requisito de la Ley 21.719, que entra en vigencia el
--    1-dic-2026 y consagra el derecho de oposición para marketing directo.

begin;

-- ---------------------------------------------------------------- ACTIVIDADES
create table if not exists actividades (
  id uuid primary key default gen_random_uuid(),

  -- A quién. prospect_id es lo habitual; se deja nulo para actividades
  -- sueltas (un contacto que todavía no es prospecto).
  prospect_id uuid references prospects(id) on delete cascade,
  -- Copia del identificador de contacto al momento del evento. Si el
  -- prospecto se borra o le cambian el teléfono, la actividad sigue siendo
  -- auditable — que es justamente lo que pide la 21.719.
  contacto text not null default '',

  actor text not null default '',

  canal text not null
    check (canal in ('llamada','whatsapp','email','reunion','otro')),

  tipo text not null default 'toque'
    check (tipo in ('primer_contacto','seguimiento','respuesta','reunion','toque')),

  -- Disposición CERRADA. Sin esto no se puede calcular tasa de conexión ni
  -- conversación→reunión: con notas en texto libre no hay nada que contar.
  resultado text not null
    check (resultado in (
      'contactado','no_contesto','gatekeeper','numero_malo',
      'interesado','seguimiento','no_interesa','fuera_icp','enviado'
    )),

  nota text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists actividades_prospect_idx on actividades (prospect_id, created_at desc);
create index if not exists actividades_fecha_idx    on actividades (created_at desc);
create index if not exists actividades_resultado_idx on actividades (resultado, created_at desc);

-- ---------------------------------------------------------------- SUPRESIONES
create table if not exists supresiones (
  id uuid primary key default gen_random_uuid(),

  -- Teléfono normalizado (solo dígitos) o correo en minúsculas. La
  -- normalización se hace en la app: +56 9 1234 5678 y 991234567 tienen que
  -- colisionar, si no la lista no sirve de nada.
  valor text not null,
  tipo text not null check (tipo in ('telefono','email')),

  motivo text not null default '',
  -- De dónde salió la oposición: sirve como prueba ante la 21.719.
  origen text not null default 'manual',
  creado_por text not null default '',
  created_at timestamptz not null default now()
);

create unique index if not exists supresiones_valor_idx on supresiones (valor);

commit;
