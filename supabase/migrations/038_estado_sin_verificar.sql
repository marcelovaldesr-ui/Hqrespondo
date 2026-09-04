-- ============================================================================
-- 038 · Un estado más: "número sin verificar"
-- ============================================================================
-- POR QUÉ — 4-sep-2026, después de correr el enriquecimiento sobre 20 leads
-- reales.
--
-- Salieron leads sin sitio web cuyo único contacto era un número heredado de
-- Apollo o escrito a mano. El sistema los rotulaba "Buena probabilidad" porque
-- eran móviles y traían nombre. Pero esa es EXACTAMENTE la categoría que ya
-- había fallado: de 13 llamadas a móviles el 4-sep, 9 no hablaron con nadie.
--
-- Prometer "buena probabilidad" sobre un número que nadie puede comprobar es
-- la forma más rápida de que el vendedor deje de creerle a la herramienta.
-- Este estado dice lo que de verdad tenemos.
-- ============================================================================

begin;

alter table public.leads_foco drop constraint if exists leads_foco_calidad_check;

alter table public.leads_foco
  add constraint leads_foco_calidad_check
  check (calidad in ('excelente','buena','sin_verificar','via_central','mejor_por_escrito','insuficiente','no_usar'));

-- Va entre "buena" y "via_central": se puede llamar, pero sin saber qué hay
-- del otro lado.
alter table public.leads_foco drop column if exists calidad_rank;
alter table public.leads_foco
  add column calidad_rank smallint generated always as (
    case calidad
      when 'excelente'         then 6
      when 'buena'             then 5
      when 'sin_verificar'     then 4
      when 'via_central'       then 3
      when 'mejor_por_escrito' then 2
      when 'insuficiente'      then 1
      else 0
    end
  ) stored;

create index if not exists leads_foco_calidad_idx
  on public.leads_foco (calidad_rank desc, encaje_rank desc, intentos, sin_contestar);

commit;
