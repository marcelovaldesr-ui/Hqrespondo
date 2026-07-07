# ROADMAP — GROWTH STUDIO
**Fecha:** 6-jul-2026.

---

## 🔴 Urgente (antes de usar en serio)
- **Correr `npm run build`** en `respondo-hq/` y corregir cualquier error de tipos antes de desplegar (esta sesión no pudo compilar: la carpeta no se montó en el sandbox). Ver RESUMEN_FINAL.
- **Commit** de los archivos nuevos (`lib/growth/*`, `app/growth/*`, `components/growth/*`, `app/api/growth/*`, `supabase/migrations/009_growth_studio.sql`, docs) — revisar `git status`.
- **Verificar el Sidebar** en local: la entrada "Growth Studio" aparece y navega bien en desktop y mobile.

## 🟡 Esta semana
- **Ejecutar la migración 009** en Supabase (opcional pero recomendado) para poder guardar ideas y calendario propios.
- Producir la munición de la Semana 1 desde el Calendario seed (7–13 jul), alineada al roadmap comercial.
- Registrar en RespondHQ → Decisiones el nombre "Growth Studio" y la mezcla de pilares.

## 🟢 Próximos 30 días
**✅ Implementado el 6-jul-2026** (ver PLAN_IMPLEMENTACION_GROWTH_30D.md):
- ✅ **Contenido por rubro en la ficha del prospecto** — `lib/growth/match.ts` mapea el rubro libre del prospecto a un slug y muestra fórmula "sin", ideas y mensaje del rubro en el detalle de `ProspectTable` (con botones de copiar y link a `/growth/rubros#slug`).
- ✅ **Botón "→ Roadmap"** en cada idea: crea una tarea `area: "Contenido"` vía `/api/roadmap`.
- ✅ **Filtro "Para prospección"** en Ideas (regla derivada: funnel consideración/decisión + rubro u objeción; sin migración).
- ✅ **Contador real de cupos** del Piloto Fundador en el panel (`5 − nº de clientes`).
- ✅ **Pulido mobile** en filas del Calendario (wrap seguro).

Pendiente:
- Completar los 7 rubros secundarios al nivel de los 5 ICP — **a medida que la prospección muestre tracción** en ellos (decisión deliberada: no gastar tiempo pre-lanzamiento en contenido que aún no se necesita).
- Camino explícito de "útil para prospección" con columna propia (migración 010) — solo si se quiere marcar a mano en vez de la regla derivada.

## 🔵 Más adelante (futuro, documentado)
- **Generación con IA externa:** conectar Gemini (ya en el proyecto para scoring/brief) para enriquecer los generadores de carrusel/guion. Los generadores por plantilla quedan como fallback siempre disponible.
- **Publicación automática a redes** (upload-post / Meta) — hoy explícitamente fuera de alcance.
- **Integración Canva/Figma:** exportar el guion de carrusel a una plantilla de diseño.
- **Integración con el blog / SEO:** publicar los artículos por rubro y enlazar `pagina_seo`.
- **Calendario conectado a Google Calendar** del equipo.
- **Conexión profunda con pipeline:** sugerir automáticamente la pieza post-demo/post-propuesta según la etapa del deal.
- **Métricas de contenido:** tabla `growth_metrics` para cerrar el loop aprendizaje → nuevas ideas.
- **Comment-to-DM (Captador Instagram, Mes 2):** "comenta COTIZA y te llega la demo".
