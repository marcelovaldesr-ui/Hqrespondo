# MEJORAS IMPLEMENTADAS — RESPONDO HQ
**Fecha:** 6 de julio de 2026 · Build validado (tsc + next build OK).

## 1. Precios corregidos a la Estructura Final (el cambio más importante)
`lib/types.ts`: los planes ahora usan los nombres y precios comerciales vigentes — **Inicial $79.000 + $290.000 · Crecimiento $149.000 + $490.000 · Pro $279.000 + $890.000**. Las claves de base de datos (`esencial/cotizador/pro`) NO cambiaron (cero riesgo de migración); solo cambian etiquetas y montos por defecto. Se agregaron `PLAN_LIMITES` (800/3.500/9.000 conversaciones) y `PILOTO_FUNDADOR_DCTO` (30/20/20/10/10% solo en setup). **Los deals antiguos conservan sus valores guardados** — solo los nuevos toman los precios corregidos.

## 2. Dashboard → Centro de mando (Mission Control)
`app/dashboard/page.tsx` (reescrito):
- **Estado de la misión**: fase derivada de datos reales (0 clientes = "Validación comercial", 1–4 = "Primeros pilotos", 5+ = "Crecimiento"), próximo hito y microcopy sobrio. $0 MRR se presenta como fase, no como fracaso.
- **Las 3 prioridades de hoy**: reglas de urgencia (errores bots > seguimientos vencidos > cobros pendientes > oportunidades detenidas > calientes > tareas atrasadas > "buscar prospectos"). Cada una es un link directo al módulo.
- **Objetivos del mes**: 5 metas del roadmap comercial con avance real, estado (al día/atrasado/logrado) y acción sugerida.
- **Fila financiera**: por cobrar del mes y gastos del mes (con alerta si superan el MRR), junto a errores y conversaciones.
- **MRR probable** en la tarjeta de pipeline (10/30/50% según etapa).
- Gradiente sutil de marca en el hero; estados vacíos que empujan a la acción.

## 3. Prospección como bandeja de trabajo comercial
`components/ProspectTable.tsx`:
- Filtros rápidos **"⚡ Calientes s/contactar"** (nuevo + score ≥ 70) y **"⏳ Sin respuesta"** (contactados).
- Botón **"Detalle"** en cada fila: razón del score visible + **acción recomendada** por reglas, primer mensaje, **generador de follow-ups** (F1, F2, respondió→demo, post-demo, reactivación — plantillas del paquete comercial, adaptadas por estado), **próxima acción editable** (con atajos Hoy/+3d/+7d) y **notas editables**.
- Al marcar un prospecto como "Contactado" sin próxima acción, se agenda **follow-up automático a +3 días**.
- `lib/mensajes.ts` (nuevo): plantillas desde `estrategia-comercial/MENSAJES_PROSPECCION_RESPONDO.md`; el link de la demo se toma de `NEXT_PUBLIC_DEMO_LINK`.

## 4. Pipeline con seguimiento real
`components/Kanban.tsx`:
- **Señales por tarjeta**: follow-up vencido (rojo), sin movimiento 5+ días / propuesta sin respuesta (ámbar), demo sin fecha (azul).
- **Fecha de próxima acción editable** (existía en la BD, no en la UI) y visible en la tarjeta.
- Botón **"Propuesta"**: copia una propuesta de 1 página (problema → solución → plan → precio del deal → garantía → próximo paso) generada por `lib/propuesta.ts` (nuevo). No inventa precios: si el deal tiene valores en 0 usa la lista y lo marca "REVISAR ANTES DE ENVIAR".

## 5. Brief diario conectado a todo el sistema
`lib/brief.ts`: ahora lee además roadmap vencido, cobros pendientes, gastos vs MRR, objetivos del mes y decisiones recientes. El prompt exige **3 prioridades numeradas siempre**, secciones solo con datos, y si todo está vacío sugiere acciones comerciales concretas. El fallback sin IA también incluye finanzas, objetivos atrasados y sugerencias.

## 6. Objetivos founder-friendly (módulo nuevo, sin tabla nueva)
`lib/objetivos.ts` (nuevo): 5 metas de julio (100 contactados, 10 respuestas, 5 demos, 4 propuestas, 2 clientes — del ROADMAP_COMERCIAL_30_DIAS) calculadas desde datos reales de prospectos/deals/clientes, con estado según el avance esperado del mes y acción recomendada. Visibles en el dashboard y en el brief. **Supuesto documentado:** son constantes de código (se editan ahí al cambiar el mes); el avance es foto del estado actual, no histórico.

## 7. Finanzas con control de negocio
`components/Finanzas.tsx` + `app/finanzas/page.tsx`: fila de resumen con **MRR actual, margen del mes, punto de equilibrio (clientes que faltan, referencia plan Crecimiento $149.000 o promedio real), por cobrar del mes**, y alerta cuando los gastos superan el MRR (con tono de fase si aún no hay clientes).

## 8. Eventos comerciales de bots
- `supabase/migrations/008_eventos_comerciales.sql` (nueva): amplía tipos a `lead_captured`, `quote_generated`, `meeting_booked`, `human_handoff`.
- `app/api/hooks/bot-events/route.ts` valida contra la lista ampliada; dashboard los muestra en el feed con etiqueta y color. **Ejecutar la migración 008 en Supabase antes de que n8n use los tipos nuevos** (sin ella, los 3 tipos históricos siguen funcionando igual).

## 9. Navegación y cockpit
`components/Sidebar.tsx`: orden según el flujo del día (Centro de mando → Prospección → Pipeline → Clientes & Bots → Finanzas → Brief → Roadmap → Decisiones), microcopy "Menos ruido. Más demos.", indicador "Sistema activo", v0.4.

## 10. Decisiones y estados vacíos
- `components/Decisiones.tsx`: búsqueda instantánea (aparece con 4+ decisiones) y empty states con propósito.
- `components/Clients.tsx`: empty state accionable que explica qué pasará cuando entre el primer cliente.
- Prospección y Finanzas: vacíos con siguiente acción.

## Qué NO se tocó (a propósito)
Landing pública · RoadmapBoard (maduro) · middleware/auth · lib/db (fix no-store) · dedupe de búsqueda · salud/uptime/onboarding/config de Clientes & Bots · migraciones 002–007 · workflows n8n de ejemplo.

## Qué quedó pendiente
Ver `ROADMAP_RESPONDHQ.md`.

## ⚠ Nota operativa importante (OneDrive)
Durante esta sesión el mirror de archivos del sandbox recibió versiones truncadas de los archivos editados (problema conocido de OneDrive en este workspace). **Los archivos reales en tu disco están completos y el build fue validado con exactamente estos cambios en un entorno limpio.** Recomendación: haz `git status` + commit **desde tu máquina** (no desde otra sesión sandbox) y verifica que `npm run build` pase localmente antes del push a Vercel.
