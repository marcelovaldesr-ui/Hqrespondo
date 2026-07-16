-- Dashboard rápido de prospección (pegar en Supabase SQL Editor)

-- 1) Total listos para atacar (score >= 70, con teléfono, sin contactar)
select count(*) as listos_para_llamar
from prospects
where score >= 70 and telefono is not null and estado = 'nuevo';

-- 2) Distribución por rubro (top 5 por volumen de score >= 70)
select rubro,
       count(*) as total,
       count(*) filter (where score >= 70) as score_70_mas,
       round(avg(score)) as score_promedio
from prospects
group by rubro
order by score_70_mas desc
limit 5;

-- 3) Cobertura del enriquecimiento web (señales vs sin datos)
select
  count(*) filter (where senales_web is not null)  as con_senales,
  count(*) filter (where senales_web is null)      as sin_senales,
  count(*) filter (where senales_web->>'potencial' = 'alto')        as potencial_alto,
  count(*) filter (where senales_web->>'potencial' = 'medio')       as potencial_medio,
  count(*) filter (where senales_web->>'potencial' = 'bajo')        as potencial_bajo,
  count(*) filter (where senales_web->>'potencial' = 'desconocido') as potencial_desconocido
from prospects;

-- 4) La lista de oro: potencial ALTO + score >= 70, por rubro
select rubro, count(*) as oro, round(avg(score)) as score_prom
from prospects
where score >= 70
  and senales_web->>'potencial' in ('alto')
  and telefono is not null
  and estado = 'nuevo'
group by rubro
order by oro desc;

-- 5) Estado del ciclo de llamadas (requiere migración 016)
select estado,
       count(*) as prospectos,
       count(*) filter (where intentos_llamada > 0) as ya_llamados,
       count(*) filter (where intentos_llamada >= 3) as agotados_3_rondas
from prospects
group by estado
order by prospectos desc;
