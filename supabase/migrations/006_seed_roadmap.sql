-- ============================================================
-- 006 — Seed inicial del roadmap desde roadmap-respondo.csv
-- (migración one-shot; solo inserta si la tabla está vacía,
-- así se puede correr dos veces sin duplicar).
-- ============================================================

insert into roadmap_items (tarea, estado, area, fecha_limite, notas, creado_por)
select v.tarea, v.estado, v.area, v.fecha_limite::date, v.notas, 'migracion-csv'
from (values
  ('Comprar dominio ($12.000/año)', 'Hecho', 'Marca', null, 'Definido y comprado en reunión 4-jul'),
  ('Logo e isotipo', 'Hecho', 'Marca', null, 'Isotipo confirmado'),
  ('Definir base de historias destacadas IG', 'Hecho', 'Instagram', null, 'Equipo, FAQs, Industrias, Clientes, ¿Quiénes somos?'),
  ('Diseñar primer post base IG', 'Hecho', 'Instagram', null, 'Plantilla base lista'),
  ('Definir precios v1', 'Hecho', 'Comercial', null, 'Falta cerrar al 100%'),
  ('DECISIÓN: ¿Solo bot WhatsApp o más servicios?', 'Esta semana', 'Decisión', '2026-07-10', 'Bloquea video del bot y estructura de la web. Dashboards como candidato'),
  ('DECISIÓN: Cerrar precios definitivos', 'Esta semana', 'Decisión', '2026-07-10', 'Confirmar si rigen los interinos o la estructura reposicionada'),
  ('DECISIÓN: Nombre y cara del bot', 'Esta semana', 'Decisión', '2026-07-10', 'Personaje para el video IA de presentación'),
  ('Corregir detalles pendientes de la web', 'Esta semana', 'Web', '2026-07-10', 'Versión casi lista; definir detalles y corregir'),
  ('Idioma de la web según localización', 'Esta semana', 'Web', '2026-07-10', 'Detectar idioma por ubicación del visitante'),
  ('Video de presentación de la página web', 'Esta semana', 'Web', '2026-07-10', null),
  ('Video IA del bot presentándose', 'Esta semana', 'Producto', '2026-07-10', 'Depende de decidir nombre/cara y servicios'),
  ('Post IG: Equipo (historias reales de nosotros)', 'Esta semana', 'Instagram', '2026-07-10', null),
  ('Post IG: FAQs (preguntas frecuentes)', 'Esta semana', 'Instagram', '2026-07-10', null),
  ('Post IG: Industrias (nichos que atacamos)', 'Esta semana', 'Instagram', '2026-07-10', null),
  ('Post IG: ¿Quiénes somos? (qué hacemos)', 'Esta semana', 'Instagram', '2026-07-10', null),
  ('Subir historias destacadas a IG', 'Esta semana', 'Instagram', '2026-07-10', null),
  ('Levantar lista de tiendas IG de Chile con datos de contacto', 'Esta semana', 'Ventas', '2026-07-10', 'Insumo para salir a vender el lunes 13'),
  ('Definir oferta de visita/servicio en persona', 'Esta semana', 'Ventas', '2026-07-10', null),
  ('HITO: Salir a buscar clientes', 'Esta semana', 'Ventas', '2026-07-13', 'Arranca lunes 13-jul con todo lo anterior cerrado'),
  ('Post IG: Clientes (quiénes nos compraron)', 'Backlog', 'Instagram', null, 'Cuando existan clientes reales'),
  ('Migrar web a Next.js', 'Backlog', 'Web', null, 'Solo si se confirma multi-servicio y con clientes pagando'),
  ('Dashboards como servicio', 'Backlog', 'Producto', null, 'Evaluar tras validar el bot de WhatsApp'),
  ('Testimonios y video real en la landing', 'Backlog', 'Web', null, 'Tras primeros casos de éxito'),
  ('Ampliar nichos: ropa, e-commerce, tecnología, corredoras, cabañas, dentistas', 'Backlog', 'Comercial', null, 'Priorizar por dolor comercial y capacidad de pago')
) as v(tarea, estado, area, fecha_limite, notas)
where not exists (select 1 from roadmap_items);
