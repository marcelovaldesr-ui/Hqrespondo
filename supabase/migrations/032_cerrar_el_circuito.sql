-- 032 — Cerrar el circuito: que la llamada diga si el número servía.
--
-- El problema, medido el 25-ago-2026: la cascada encontró su primer teléfono
-- directo (Jorge Bellolio, clínica dental en Maipú) y lo guardó con toda su
-- procedencia... en una columna que NO aparece en ninguna pantalla de HQ.
-- Nadie podía marcarlo. Los datos entraban a una caja de la que no salían.
--
-- Eso rompe lo único que importa: sin llamada no hay "¿quién contestó?", y sin
-- eso no sabemos si los números que encontramos sirven. Llevamos cinco fases de
-- arquitectura y el contador de números verificados por llamada sigue en cero.
--
-- La solución no es una pantalla nueva. `leads_foco` YA es exactamente esto:
-- su unidad es la PERSONA con su número, no el negocio —lo dice su propia
-- migración 021—. Y trae gratis la cola de llamadas, las 15 disposiciones, la
-- bitácora, la supresión y la creación del deal al agendar. Un teléfono directo
-- hallado por la cascada ES un lead de Foco; solo faltaba promoverlo.
--
-- `empresas_sii.lead_foco_id` existe desde la migración 025 y nunca se usó.
-- Ahora se usa: es el hilo que permite que la respuesta de la llamada vuelva
-- a la empresa de origen.
--
-- Lo único que se agrega es el veredicto.

begin;

alter table public.empresas_sii
  add column if not exists telefono_directo_verdicto text
    check (telefono_directo_verdicto in ('decisor','recepcion','malo'));

comment on column public.empresas_sii.telefono_directo_verdicto is
  'Qué resultó ser el número al llamarlo. Lo escribe el registro de resultado en Leads Foco, no una regla: de quién es un teléfono solo lo resuelve la llamada.';

-- Para el informe que importa: de los números que encontró la cascada, ¿cuántos
-- resultaron ser del decisor? Es la métrica que decide si esto vale la pena.
create index if not exists empresas_sii_verdicto_idx
  on public.empresas_sii (telefono_directo_verdicto)
  where telefono_directo is not null;

commit;
