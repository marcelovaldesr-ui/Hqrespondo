-- 022 — Encaje con Respondo en Leads Foco
--
-- POR QUÉ
-- Un lead con teléfono y con el gerente general identificado igual no sirve si
-- el negocio no tiene nada que Respondo pueda resolver. Un estudio jurídico
-- grande cumple todos los requisitos formales —decisor, número, capacidad de
-- pago— y es imposible de atender: cada consulta es distinta y nadie contrata
-- un abogado por WhatsApp. Lo que descarta es el rubro y la forma de operar,
-- no el tamaño.
--
-- La clasificación la calcula `lib/encaje.ts` al importar. Acá se guarda para
-- poder ORDENAR la cola por encaje sin traerse la tabla entera a la aplicación.

begin;

alter table leads_foco
  add column if not exists encaje text not null default 'sin_evaluar'
    check (encaje in ('alto','medio','bajo','nulo','sin_evaluar')),
  -- El motivo escrito no es decoración: es lo que se lee antes de marcar para
  -- saber con qué abrir, y lo que permite discutir una clasificación mala.
  add column if not exists encaje_motivo text not null default '',
  -- Marca de que un humano corrigió el nivel. Una reimportación NO puede
  -- pisarlo: la regla acierta en el grueso, quien llamó ayer sabe más.
  add column if not exists encaje_manual boolean not null default false;

-- Orden de la cola. Se guarda como número porque PostgREST ordena por columna,
-- no por expresión.
alter table leads_foco
  add column if not exists encaje_rank smallint generated always as (
    case encaje
      when 'alto' then 4
      when 'medio' then 3
      when 'sin_evaluar' then 2
      when 'bajo' then 1
      else 0
    end
  ) stored;

create index if not exists leads_foco_encaje_idx
  on leads_foco (encaje_rank desc, contactabilidad desc, intentos);

commit;
