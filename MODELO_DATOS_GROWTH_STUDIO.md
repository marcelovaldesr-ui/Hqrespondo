# MODELO DE DATOS — GROWTH STUDIO
**Fecha:** 6-jul-2026 · Complementa MODELO_DATOS_RESPONDHQ.md.
Dos capas: **seed de código** (fuente principal) y **persistencia Supabase opcional** (additiva).

---

## 1. Capa seed (código) — `lib/growth/`
Sin base de datos, sin migraciones, disponible al instante en Vercel. Se edita en git.

| Archivo | Exporta | Contenido |
|---|---|---|
| `types.ts` | enums + interfaces + label maps | Taxonomía: PilarKey, ContentStatus, Canal, Formato, Funnel, NivelVenta, Prioridad, y las entidades ContentIdea, CarouselDraft, VideoScript, ContentCalendarItem, IndustryContent, Battlecard, HighlightPlan, CopySnippet, ContentPillar. |
| `pillars.ts` | `PILARES` | 10 pilares de contenido con mezcla recomendada. |
| `industries.ts` | `RUBROS`, `RUBROS_PRIORITARIOS` | 12 rubros (5 ICP detallados + 7 secundarios). |
| `battlecards.ts` | `BATTLECARDS` | 9 competidores/alternativas. |
| `highlights.ts` | `DESTACADAS` | 10 destacadas de IG con historias. |
| `copies.ts` | `COPIES`, `copiesPorTipo` | ~60 snippets reutilizables (hooks, CTAs, captions, objeciones, prospección…). |
| `ideas.ts` | `IDEAS_SEED` (50), `CARRUSELES` (8), `GUIONES` (8), `CALENDARIO` (20) | Contenido inicial completo. |
| `generators.ts` | `generarCarrusel`, `generarGuion`, `generarIdeasDesdeEstrategia` | Plantillas deterministas. |
| `store.ts` | `getIdeas`, `getCalendar` | Merge defensivo seed + BD. |

**Precedente en el proyecto:** este patrón "datos en código, no en tabla" es el mismo de `lib/objetivos.ts` (metas del mes). Elegido a propósito: cero migraciones para el contenido base, editable por 2 personas.

## 2. Capa persistencia (Supabase) — OPCIONAL, migración 009
Solo para contenido **creado por el equipo** dentro del módulo. Additiva: `CREATE TABLE IF NOT EXISTS`, no toca datos existentes. Mismo criterio de seguridad del resto (RLS on sin policies; service_role solo en servidor).

### growth_ideas
`id uuid` · `titulo` · `descripcion` · `pilar` · `rubro` (slug|null) · `canal` · `formato` · `prioridad` (alta|media|baja) · `estado` (idea|borrador|en_revision|listo|publicado|descartado) · `responsable` · `fecha_sugerida date` · `fuente` · `objetivo_comercial` · `funnel` (descubrimiento|consideracion|decision) · `cta` · `notas` · `created_at/updated_at` (trigger).

### growth_calendar
`id uuid` · `titulo` · `fecha date` · `canal` · `formato` · `pilar` · `rubro` · `estado` · `responsable` · `idea_id → growth_ideas(set null)` · `notas` · `created_at/updated_at`.

Índices: `growth_ideas(estado)`, `growth_ideas(pilar)`, `growth_calendar(fecha)`.

## 3. Comportamiento defensivo
`lib/growth/store.ts` y las rutas `/api/growth/*` detectan el error "tabla no existe" (código 42P01 / mensaje) y **degradan a solo-seed** sin lanzar 500. Efecto: RespondHQ sigue desplegando y el módulo funciona en lectura aunque la migración 009 no se haya ejecutado. Al crear una idea sin tabla, la API responde 409 con un mensaje claro ("ejecuta la migración 009").

## 4. API
| Ruta | Métodos |
|---|---|
| `/api/growth/ideas` | GET (BD), POST (crea; responsable ← x-hq-user) |
| `/api/growth/ideas/[id]` | PATCH, DELETE |
| `/api/growth/calendar` | GET, POST |
| `/api/growth/calendar/[id]` | PATCH, DELETE |

## 5. Cómo ejecutar la migración 009
Supabase → SQL Editor → New query → pegar `supabase/migrations/009_growth_studio.sql` → Run. Es idempotente (IF NOT EXISTS). Recomendado exportar backup antes (Database → Backups), aunque no toca tablas existentes.

## 6. Limitaciones conocidas / evolución
- El seed no es editable desde la UI (por diseño): se edita en código y se versiona.
- Sin histórico de métricas de publicación (los estados son foto actual). Futuro: tabla `growth_metrics(pieza, fecha, alcance, saves, clics)`.
- Sin relación dura idea↔prospecto/deal todavía (solo conceptual). Futuro: `growth_ideas.rubro` ya permite recomendar contenido por rubro a prospectos.
