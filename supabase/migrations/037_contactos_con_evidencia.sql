-- ============================================================================
-- 037 · CONTACTOS CON EVIDENCIA — de "un teléfono" a "por qué le creemos"
-- ============================================================================
-- POR QUÉ EXISTE — 4-sep-2026
--
-- Medición real de las llamadas de Tomás: de 13 marcadas a móviles, 9 no
-- hablaron con NADIE. Y 68 de los 91 leads ya estaban en la mejor categoría
-- que el sistema sabía calcular. O sea: el problema no era ordenar mejor los
-- números que teníamos. Los números eran malos y no había forma de saberlo
-- antes de marcar.
--
-- La causa está en el modelo de datos: `leads_foco.telefono` es una columna de
-- texto. Un número de Apollo que nadie verificó y el `wa.me` que el negocio
-- publica en su propio sitio se guardaban idénticos: nueve dígitos. Sin
-- distinguirlos, no hay forma de priorizar, ni de aprender cuál sirvió, ni de
-- explicarle al vendedor qué esperar al marcar.
--
-- Acá un contacto deja de ser texto y pasa a ser una afirmación con respaldo:
-- qué es, dónde se vio, cómo se vio, cuándo, y cuántas fuentes independientes
-- lo confirman.
--
-- NO se borra nada. `telefono` sigue siendo el principal y sigue mandando en
-- la supresión y en la marcación. Esto se suma al lado.
--
-- Ejecutar en: Supabase > SQL Editor. Idempotente.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. LOS CONTACTOS CON SU EVIDENCIA
-- ---------------------------------------------------------------------------
-- Arreglo de objetos, cada uno:
--   { clave, valor, tipo, persona?, cargo?,
--     evidencias: [{ metodo, donde, cuando, contexto? }] }
--
-- Va como jsonb y no como tabla aparte a propósito: se lee y se escribe
-- siempre junto con el lead, nunca por separado, y una tabla más significa un
-- join más en la consulta que arma la cola de llamadas. Si algún día hay que
-- consultar por contacto (por ejemplo "en qué otros leads aparece este
-- número"), ahí sí conviene la tabla.
alter table public.leads_foco
  add column if not exists contactos jsonb not null default '[]'::jsonb;

comment on column public.leads_foco.contactos is
  'Contactos con evidencia: qué es cada número, dónde se vio y cuántas fuentes independientes lo confirman. Lo llena /api/foco/enriquecer.';

-- ---------------------------------------------------------------------------
-- 2. EN QUÉ MONTÓN VA ESTE LEAD
-- ---------------------------------------------------------------------------
-- El vendedor trabaja de arriba hacia abajo y necesita saber, sin abrir la
-- ficha, si esto es una llamada que vale la pena AHORA o un trabajo de
-- escritorio.
alter table public.leads_foco
  add column if not exists calidad text not null default 'insuficiente'
    check (calidad in ('excelente','buena','via_central','mejor_por_escrito','insuficiente','no_usar'));

-- El orden de la cola. Columna generada: no se puede desincronizar de `calidad`.
alter table public.leads_foco
  add column if not exists calidad_rank smallint generated always as (
    case calidad
      when 'excelente'         then 5
      when 'buena'             then 4
      when 'via_central'       then 3
      when 'mejor_por_escrito' then 2
      when 'insuficiente'      then 1
      else 0
    end
  ) stored;

-- Cuándo se enriqueció por última vez. Un dato de hace tres meses vale menos,
-- y sin esta fecha no hay forma de saber a quién toca refrescar.
alter table public.leads_foco
  add column if not exists enriquecido_at timestamptz;

-- ---------------------------------------------------------------------------
-- 3. LO QUE YA SE COMPROBÓ MALO NO VUELVE
-- ---------------------------------------------------------------------------
-- Cuando alguien marca "número equivocado", ese número queda anotado acá. El
-- enriquecimiento lo consulta y no vuelve a proponerlo, venga de donde venga.
--
-- Es la pieza que faltaba para que llamar SIRVA de algo más que esa llamada:
-- hasta ahora el veredicto se guardaba en la nota, en texto libre, donde
-- ningún código lo podía leer.
create table if not exists public.numeros_malos (
  clave        text primary key,          -- solo dígitos, sin código de país
  motivo       text not null default '',
  lead_foco_id uuid references public.leads_foco(id) on delete set null,
  empresa      text not null default '',
  reportado_por text not null default '',
  created_at   timestamptz not null default now()
);

comment on table public.numeros_malos is
  'Números que alguien llamó y resultaron equivocados o inexistentes. El enriquecimiento no los vuelve a proponer.';

-- ---------------------------------------------------------------------------
-- 4. EL ÍNDICE DE LA COLA
-- ---------------------------------------------------------------------------
create index if not exists leads_foco_calidad_idx
  on public.leads_foco (calidad_rank desc, encaje_rank desc, intentos, sin_contestar);

commit;
