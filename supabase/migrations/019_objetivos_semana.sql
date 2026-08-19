-- 019 — Objetivos semanales por socio
--
-- Reemplaza el Excel "Respondo_Control_Semanal_Socios.xlsx" que vivía en el
-- Drive. Mismo modelo, para no obligar a nadie a cambiar el ritual:
--   lunes  → cada socio carga 2-3 objetivos de la semana
--   viernes→ reunión de números: se marca cumplido / parcial / no cumplido
--
-- La métrica que importa NO es el % de cumplimiento: es cuántos objetivos NO
-- cumplidos pasaron sin hablarse en la reunión. Un objetivo que se cae y se
-- conversa es información; uno que se cae en silencio es el problema.

create table if not exists objetivos_semana (
  id uuid primary key default gen_random_uuid(),

  -- Lunes de la semana a la que pertenece el objetivo. Se guarda como date
  -- para que agrupar por semana sea un simple group by.
  semana date not null,

  socio text not null,
  rol text not null default '',

  objetivo text not null,
  -- "Cómo se mide": la pregunta concreta que se responde el viernes.
  como_se_mide text not null default '',

  estado text not null default 'pendiente'
    check (estado in ('pendiente','cumplido','parcial','no_cumplido')),

  motivo text not null default '',
  hablado_reunion boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists objetivos_semana_semana_idx
  on objetivos_semana (semana desc, socio);

-- Un socio no debería cargar dos veces el mismo objetivo en la misma semana.
create unique index if not exists objetivos_semana_unico_idx
  on objetivos_semana (semana, socio, lower(objetivo));
