-- 024 — La prueba de concepto de 2 semanas, en el Pipeline
--
-- POR QUÉ
-- Los 18 correos de la secuencia prometen lo mismo: "una prueba de concepto
-- personalizada de DOS SEMANAS, sin costo". Es el centro del pitch y la etapa
-- donde el prospecto decide — y HQ no la registraba en ninguna parte.
--
-- El tracker del Drive (estado_clientes_respon-do.xlsx) sí la lleva, con tres
-- columnas: Inicio demo, Término demo, Resultado demo. Sin eso, una demo que
-- empezó el 13 de agosto simplemente se apaga sola el 27 y nadie se entera:
-- no hay fecha que venza, no hay alerta, no hay nada que reclame el cierre.

begin;

alter table deals
  add column if not exists demo_inicio date,
  add column if not exists demo_termino date,
  add column if not exists demo_resultado text not null default ''
    check (demo_resultado in ('', 'en_curso', 'exitosa', 'sin_uso', 'no_convencio', 'cancelada'));

create index if not exists deals_demo_idx on deals (demo_termino)
  where demo_resultado = 'en_curso';

commit;
