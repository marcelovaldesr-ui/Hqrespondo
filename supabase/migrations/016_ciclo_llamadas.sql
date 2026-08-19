-- 016: Ciclo de llamadas — control de reintentos para el CSV diario.
-- Regla: un prospecto no vuelve a salir en la lista de llamadas hasta
-- 7 días después del último intento sin contacto, máximo 3 rondas.

alter table prospects
  add column if not exists ultimo_intento_llamada timestamptz,
  add column if not exists intentos_llamada int not null default 0;

comment on column prospects.ultimo_intento_llamada is
  'Última vez que salió en el CSV de llamadas (app/api/prospects/csv-llamadas).';
comment on column prospects.intentos_llamada is
  'Rondas de llamada sin lograr contacto. A la 3ª sin éxito → descartar.';

create index if not exists idx_prospects_llamadas
  on prospects (estado, score desc, ultimo_intento_llamada);
