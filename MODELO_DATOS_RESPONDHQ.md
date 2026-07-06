# MODELO DE DATOS — RESPONDO HQ
Supabase (Postgres). RLS activado sin policies en todas las tablas: el acceso con anon key queda bloqueado; el panel usa la service_role key solo en el servidor. Fuente: `supabase/schema.sql` + migraciones 002–008.

## prospects (prospección)
`id uuid` · `nombre` · `rubro` · `comuna` · `telefono` · `web` · `direccion` · `rating` · `reviews` · `score int (0-100)` · `razon_score` · `mensaje` (primer toque generado por IA) · `estado` ∈ nuevo|contactado|respondio|reunion|en_pipeline|descartado · `proxima_accion date` · `notas` · `place_id unique` (dedupe) · `created_at/updated_at`.
Flujo: `/api/search` inserta con dedupe por place_id y teléfono → estados avanzan a mano → "→ Pipeline" crea el deal y marca `en_pipeline` (el prospecto no se duplica ni se pierde: queda vinculado por `deals.prospect_id`).

## deals (pipeline)
`id` · `prospect_id → prospects (set null)` · `nombre_negocio` · `rubro` · `plan` ∈ esencial|cotizador|pro (**claves BD; en UI son Inicial/Crecimiento/Pro**) · `valor_setup` · `valor_mensual` · `etapa` ∈ contactado|demo|propuesta|cliente|perdido · `proxima_accion` · `fecha_proxima date` · `notas` · `created_at/updated_at`.
`updated_at` (trigger) alimenta la señal de "oportunidad detenida" (5+ días). MRR probable: 10/30/50% según etapa.

## clients (clientes activos)
`id` · `nombre` · `rubro` · `plan` · `mensualidad` · `telefono_bot` · `workflow_id` (n8n) · `activo bool` · `fecha_inicio` · `created_at`. MRR actual = suma de mensualidades de activos.

## bot_events (monitoreo)
`id` · `client_id → clients (set null)` · `tipo` ∈ mensaje|error|heartbeat|**lead_captured|quote_generated|meeting_booked|human_handoff** (los 4 últimos desde migración 008) · `detalle` · `costo_clp` · `created_at`. Alimenta salud/uptime/costo por cliente, feed del dashboard y reporte mensual.

## briefs
`id` · `contenido text` · `tipo` ∈ diario|mensual_cliente · `client_id` (solo mensuales) · `created_at`.

## roadmap_items
`id` · `tarea` · `estado` (Esta semana/En curso/Backlog/Hecho + libres) · `area` · `fecha_limite` · `notas` · `creado_por/actualizado_por` (desde header x-hq-user) · timestamps.

## onboarding_tasks
`id` · `client_id → clients (cascade)` · `paso` · `orden` · `hecho` · `hecho_por` · `hecho_at`. Se crean 7 pasos estándar al crear cliente.

## decisiones
`id` · `titulo` · `detalle` · `decidido_por` · `created_at`. (Impacto/estado/revisión: pendiente, ver roadmap.)

## gastos
`id` · `fecha date` · `concepto` · `categoria` · `monto int CLP` · `pagado_por` · `notas`.

## cobros
`id` · `client_id (cascade)` · `mes date` (día 1 del mes) · `monto` · `estado` ∈ pendiente|pagado · `pagado_at` · `notas` · `unique(client_id, mes)`. Se generan por botón desde los clientes activos del mes.

## bot_configs
`id` · `client_id` · `tono` · `horario_atencion jsonb {lun_vie,sab,dom}` · `derivacion_reglas` · `derivacion_contacto` · `extra jsonb`. n8n la lee vía `GET /api/hooks/bot-config?workflow_id=`.

## Objetivos (sin tabla — decisión deliberada)
Las metas del mes viven en `lib/objetivos.ts` (constantes) y el avance se calcula en vivo desde prospects/deals/clients. Evita una migración y una UI de configuración que nadie necesita con 2 socios. Si en el futuro se quiere histórico mensual → tabla `objetivos(mes, clave, meta, avance_cierre)`.

## Limitaciones conocidas
- Sin `updated_at` en clients (no crítico).
- El avance de objetivos es foto actual, no acumulado histórico por mes.
- Backups: solo los automáticos de Supabase (verificar retención del plan free). Export manual recomendado antes de cambios grandes: Supabase → Database → Backups.
- Migración pendiente sugerida (009, futura): `decisiones.impacto/estado`, `deals.responsable/motivo_perdida`.
